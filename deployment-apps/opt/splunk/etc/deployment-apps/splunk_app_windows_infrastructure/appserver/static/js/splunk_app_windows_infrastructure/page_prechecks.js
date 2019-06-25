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
        // TAG-11466: Comment out this fix help links for now
        // HelpContextHandler.fixHelpLinks();
        
        /*
         * Redirect to setup if first time run
         */
        SetupHelpers.isAppSetupRequired(
            WinfraConstants.getAppRestId(),
            function(isAppSetupRequired, appBuild, appVersion) {
                if (isAppSetupRequired) {
                    window.location.replace(WinfraConstants.getSplunkWebUrl() + 'app/splunk_app_windows_infrastructure/guided_setup');
                }
            }
            );
    }
    
    return thisModule;
});