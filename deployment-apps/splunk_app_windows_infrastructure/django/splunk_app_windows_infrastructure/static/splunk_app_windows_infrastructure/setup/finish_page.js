/*
 * This file contains the code to implement the finish page for setup
 */

requirejs.config({
    enforceDefine: false,
    paths: {
        'text': './contrib/text'
    }
});

define([
        'jquery',
        'underscore',
        'common/CustomPages/AppSetupPages/AppSetupManager',
        'common/CustomPages/AppSetupPages/SetupConfigManager',
        'splunk_app_windows_infrastructure/setup/AppSetupConfigs/WinfraSetupConfig',
        'text!splunk_app_windows_infrastructure/setup/finish_page.html'
        ],
        function(
            $,
            _,
            AppSetupManager,
            SetupConfigManager,
            WinfraSetupConfig,
            PageMarkup
            )
{   
    var finish_page = {
        addPageParts: function(parentEl) {
            parentEl.html(PageMarkup);
            
            SetupConfigManager.build(WinfraSetupConfig.get());
            
            AppSetupManager.getNav(SetupConfigManager, function(nav) {
                // Disable links to features in sections that were removed from nav
                // by admin
                var sectionShortcuts = [
                    {section: 'Windows', linkSel: '#windows-home'},
                    {section: 'Active Directory', linkSel: '#ad-home'}
                ];
                
                _.each(sectionShortcuts, function(sectionShortcut) {
                    if (!nav.isSectionInNav(sectionShortcut.section)) {
                        $(sectionShortcut.linkSel).addClass('disabled');
                    }
                });
            });
        },
        
        getPageLabel: function() {
            return 'Finish';
        },
        
        getNextLabel: function() {
            return 'Done';
        },

        validateNext: function() {
            // Next should not be allowed on this page
            return false;
        }
    };
    
    return finish_page;
});