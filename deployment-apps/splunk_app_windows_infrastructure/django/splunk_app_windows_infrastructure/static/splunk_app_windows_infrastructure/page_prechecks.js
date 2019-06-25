/*
 * This file contains the code to perform all necessary prechecks for pages of this app.
 */

define([
        'common/CustomPages/AppSetupPages/SetupHelpers',
        'splunk_app_windows_infrastructure/WinfraConstants',
        'splunk_app_windows_infrastructure/help_context_handler'
        ],
        function(
                SetupHelpers,
                WinfraConstants,
                HelpContextHandler
                )
{
    var thisModule = {};
    
    thisModule.runChecks = function()
    {
    	/*
    	 * Invoke context specific help handler
    	 */
        HelpContextHandler.fixHelpLinks();
        
        /*
         * Redirect to setup if first time run
         */
        SetupHelpers.isAppSetupRequired(
            WinfraConstants.getAppRestId(),
            function(isAppSetupRequired, appBuild) {
                if (isAppSetupRequired) {
                    window.location.replace('/dj/splunk_app_windows_infrastructure/setup');
                }
            }
            );
    }
    
    return thisModule;
});