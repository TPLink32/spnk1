define([
        'jquery',
        'underscore',
        'views/shared/dialogs/DialogBase',
        'common/CustomPages/AppSetupPages/LookupBuilder'
        ],
        function(
            $,
            _,
            DialogBase,
            LookupBuilder
        )
{
    var LookupBuilderDialog =  {
        _migratedLookupCollection: 'MsftApps-MigratedLookups',

        getCommonLookupBuilderDialog: function() {
            var LookupBuilderDialogBase = DialogBase.extend({
                initialize: function() {
                    this.$el.modal({ show: false, keyboard: false, backdrop: 'static' });
                    DialogBase.prototype.initialize.apply(this, arguments);
                }
            });

            var $outputEl = $('<pre id="lookup-builder"></pre>').css({
                'white-space': 'normal',
                'overflow-x': 'scroll'
            });

            var lookupBuilderDialog = new LookupBuilderDialogBase();
            lookupBuilderDialog.settings.set('cancelButtonLabel', 'Cancel and go back');
            lookupBuilderDialog.renderBody = function($el) {
                $el.append($outputEl);
            };
            
            lookupBuilderDialog.on('click:closeButton click:cancelButton', function(e) {
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = getDefaultLocation();
                }
            });

            lookupBuilderDialog.appendOutput = function(message) {
                $outputEl.append(message + '<br/>');
                $outputEl.animate({ scrollTop: '99999px' });
            };
            
            lookupBuilderDialog.appendContent = function(message) {
                this.appendOutput(message);
            };
            
            lookupBuilderDialog.setTitle = function(titleText) {
                this.settings.set('titleLabel', titleText);
            };
            
            lookupBuilderDialog.markDone = function() {
                lookupBuilderDialog.settings.set('cancelButtonLabel', 'Finish and go back');
            };

            getDefaultLocation = function() {
                var currentPage = window.location.href;
                if(currentPage.split('/').slice(-2)[0] == "splunk_app_microsoft_exchange"){
                    return currentPage.substr(0, currentPage.lastIndexOf('/')) + '/home';    
                }
                return currentPage.substr(0, currentPage.lastIndexOf('/')) + '/infra_home';
            };

            return lookupBuilderDialog;
        },

        showLookupMigratorDialog: function(searches) {
            var lookupBuilderDialog = this.getCommonLookupBuilderDialog();
            lookupBuilderDialog.show();
            LookupBuilder.migrateLookups(searches, lookupBuilderDialog);
        },

        showLookupBuilderDialog: function(searches) {
            var lookupBuilderDialog = this.getCommonLookupBuilderDialog();
            lookupBuilderDialog.show();
            LookupBuilder.buildLookups(searches, lookupBuilderDialog);
        }
    };

    return LookupBuilderDialog;
});
