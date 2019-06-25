/*
 * This file contains the code to perform all necessary prechecks for pages of this app.
 */
	
/*
 * This section contains a work around for the Windows and AD page's context 
 * specific help resolution. This is required owing to Web FX error DVPL-4408
 * owing to which the directory structure in the urls for windows and ad pages
 * are incompatible with help resolution. Work around is to extract the directory
 * structure and convert to a . notation.
 * Please see MSAPP-2355 for more context.
 * 
 * The work around is to extract the url part after splunk_app_windows_infrastructure/
 * and convert the / notation in the rest of the path until the page name to . notation,
 * then set that as the page property for the app. This ensures that on render of
 * the splunk header view, the help documentation link gets set to the
 * context specific help location.
 * 
 * Eg. url .../splunk_app_windows_infrastructure/windows/event/ would with the fix,
 * set help link to ...app.splunk_app_windows_infrastructure.windows.event
 */

define(['jquery', 'splunkjs/ready!', 'splunkjs/mvc/sharedmodels'],
        function($, MVC, SharedModels)
{
    var thisModule = {};
    
    thisModule.fixHelpLinks = function()
	{   
        var currentPageUrl = $(location).attr('href');
        
        var application = SharedModels.get('app');
        var appNamespace = application.get('app');
        var appNamespaceComponentInUrl = appNamespace + '/';
        
        var indexOfAppComponentInUrl = currentPageUrl.indexOf(
            appNamespaceComponentInUrl,
            0
            );
        
        var indexOfHelpContextStart =
            indexOfAppComponentInUrl + appNamespaceComponentInUrl.length;
        
        var indexOfNextSlash = currentPageUrl.indexOf(
            '/',
            indexOfHelpContextStart
            );
        
        var indexOfHelpContextEnd = currentPageUrl.indexOf(
            '/',
            indexOfNextSlash + 1
            );
        
        if (indexOfHelpContextEnd === -1) {
            if (currentPageUrl.length > indexOfNextSlash + 1 &&
                currentPageUrl[indexOfNextSlash + 1] === '?') {
                indexOfHelpContextEnd = indexOfNextSlash;
            } else {
                indexOfHelpContextEnd = currentPageUrl.length - 1;
            }
        }
        
        var helpLinkContext = currentPageUrl.substring(
            indexOfHelpContextStart,
            indexOfHelpContextEnd
            );
        
        helpLinkContext = helpLinkContext.replace('/', ".");
        
        application.set('page', helpLinkContext);
        
        // Splunk header needs a refresh to persist this change
        MVC.Components.getInstance('header').render();
	}
    
    return thisModule;
});