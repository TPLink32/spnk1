/*
 * This file contains the code to implement the customize features page for setup
 */

define([
        'jquery',
        'underscore',
        'splunkjs/mvc',
        'common/CustomPages/AppSetupPages/CustomizeFeatures',
        'splunk_app_windows_infrastructure/setup/AppSetupConfigs/WinfraSetupConfig',
        'splunk_app_windows_infrastructure/WinfraConstants',
        'splunk_app_windows_infrastructure/default'
        ],
        function(
            $,
            _,
            mvc,
            CustomizeFeatures,
            WinfraSetupConfig,
            WinfraConstants,
            DefaultNav
            )
{   
    var customize_page = {
        addPageParts: function(parentEl) {
            CustomizeFeatures.initialize(WinfraSetupConfig.get());
            
            CustomizeFeatures.render(parentEl);
        },
        
        getPageLabel: function() {
            return 'Customize Features';
        },
        
        getNextLabel: function() {
            return 'Save';
        },

        validateNext: function() {
            CustomizeFeatures.saveChanges(DefaultNav);
        }
    };
    
    return customize_page;
});