
define(
    [
        'jquery',
        'underscore',
        'backbone',
        'models/Base',
        'views/Base',
        'app/views/SnowAccounts/SnowAccountDisplay',
        'app/views/settings/SnowSettingsDisplay',
        //'app/models/Config!',
        'contrib/text!app/views/SnowOverviewView.html'
    ],
    function (
        $,
        _,
        Backbone,
        BaseModel,
        BaseView,
        SnowAccountDisplay,
        SnowSettingsDisplay,
        //Config,
        pageTemplate
    ) {
        return BaseView.extend({
            initialize: function (options) {
                BaseView.prototype.initialize.apply(this, arguments);

                this.model = this.model || {};
                this.model.control = new BaseModel();

                // initialize context, append aws_service.
                //this.context = _.extend(
                //    {'aws_service': Config.SERVICES.CLOUD_CONFIG},
                //    Config.CONTEXT,
                //    this.model.context || {});
                this.children.snowInputDisplay = new SnowAccountDisplay();
                this.children.snowSettingsDisplay = new SnowSettingsDisplay({
                    label: _("Advanced Settings").t(),
                    "allowExpand":true
                });
            },

            events: {
                'click .form-btns>.submit': 'saveSettings',
                'click .form-btns>.cancel': 'deleteAccount'
            },

            saveSettings:function(){
                var result1 = this.children.snowInputDisplay._validate();
                var result2 = this.children.snowSettingsDisplay._validate();
                if(result1 != true ) {
                    this.children.snowInputDisplay._showMsg(result1, "MSG_TYPE_ERROR");
                }
                if( result2 != true){
                    this.children.snowSettingsDisplay._showMsg(result2, "MSG_TYPE_ERROR");
                }
                if (result1!= true || result2 != true){
                    return;
                }

                this.children.snowInputDisplay.saveAccounts();
                this.children.snowSettingsDisplay.saveSettings();
            },

            deleteAccount:function(){
                this.children.snowInputDisplay.deleteAccounts();
            },

            render: function() {
                this.$el.html(pageTemplate);
                this.$('.account-display').append(this.children.snowInputDisplay.render().el);
                this.$('.advanced-settings').append(this.children.snowSettingsDisplay.render().el);
                return this;
            }
        })
    });