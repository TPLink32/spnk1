/*
 * This file contains the code to implement the check data page for setup
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
        'splunkjs/mvc/searchmanager',
        'common/SearchRunner',
        'common/SearchIconRenderer',
        'common/PageMessagesView',
        'common/SyncTaskQueue',
        'common/CustomPages/AppSetupPages/CheckDataPage',
        'text!splunk_app_windows_infrastructure/setup/check_data_page.html'
        ],
        function(
            $,
            _,
            SearchManager,
            SearchRunner,
            SearchIconRenderer,
            PageMessagesView,
            SyncTaskQueue,
            CheckDataPage,
            PageMarkup
            )
{   
    var check_data_page = {
        _dataCheckSections: {
            'windowsData':  {
                'searches': [
                     {
                         'search': 'sourcetype="Perfmon*" | head 5',
                         'critical': false
                     },
                     {
                         'search': 'sourcetype="WinHostMon*" | head 5',
                         'critical': false
                     },
                     {
                         'search': 'sourcetype="WinPrintMon*" | head 5',
                         'critical': false
                     },
                     {
                         'search': 'sourcetype="WinRegistry*" | head 5',
                         'critical': false
                     },
                     {
                         'search': 'sourcetype="WMI*" | head 5',
                         'critical': false
                     },
                     {
                         'search': 'sourcetype="WinEventLog*" OR sourcetype="XmlWinEventLog*" | head 5',
                         'critical': false
                     }
                     ],
                'description': 'Data from Splunk Add-on for Microsoft Windows',
                'helpHref': '/help?location=[MSApp:1.1.3]app.splunk_app_windows_infrastructure.learnmore.ftr.windowsaddon',
                'helpText': 'Splunk Add-on for Microsoft Windows for Splunk Universal Forwarder'
            }, 
            'adData':  {
                'searches': [
                     {
                         'search': 'sourcetype="MSAD*" | head 5',
                         'critical': true
                     },
                     {
                         'search': 'sourcetype="ActiveDirectory*" | head 5',
                         'critical': true
                     },
                     {
                         'search': 'sourcetype="WinEventLog*" OR sourcetype="XmlWinEventLog*" | head 5',
                         'critical': false
                     },
                     {
                         'search': 'sourcetype="Perfmon*" | head 5',
                         'critical': false
                     }
                     ],
                'description': 'Data from Splunk Add-on for Microsoft Windows Active Directory',
                'helpHref': '/help?location=[MSApp:1.1.3]app.splunk_app_windows_infrastructure.learnmore.ftr.adaddons',
                'helpText': 'Splunk Add-on for Microsoft Windows Active Directory for Splunk Universal Forwarder'
            }
        },
        
        addPageParts: function(parentEl) {
            parentEl.html(PageMarkup);
            
            $('.next-button').addClass('disabled');
            
            CheckDataPage.addDataChecks(this._dataCheckSections, '#check-data-page', '.next-button');
        },
        
        getPageLabel: function() {
            return 'Check Data';
        },
        
        getNextLabel: function() {
            return 'Next';
        },

        validateNext: function() {
            return CheckDataPage.isDataFound();
        }
    };
    
    return check_data_page;
});
