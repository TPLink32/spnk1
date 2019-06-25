/*
 * This file contains the code to implement the introduction page for setup
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
        'text!splunk_app_windows_infrastructure/setup/introduction_page.html'
        ],
        function(
            $,
            _,
            PageMarkup
            )
{   
    var introduction_page = {
        addPageParts: function(parentEl) {
            parentEl.html(PageMarkup);
        },
        
        getPageLabel: function() {
            return 'Introduction';
        },
        
        getNextLabel: function() {
            return 'Start';
        },

        validateNext: function() {
            return true;
        }
    };
    
    return introduction_page;
});