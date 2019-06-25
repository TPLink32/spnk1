/**
 * Created by strong on 6/24/15.
 */
define(
    [
        'jquery',
        'underscore',
        'backbone',
        'models/Base',
        'views/Base',
        'views/shared/controls/ControlGroup',
        'app/collections/SnowAccounts',
        "app/views/common/WaitingPanel",
        'app/models/SnowAccount',
        "app/utils/ErrorDispatcher",
        "app/utils/ErrorParser",
        "app/utils/DialogManager",
        'app/utils/Util',
        'app/models/Config!'
    ],
    function ($, _, Backbone, BaseModel, BaseView, ControlGroup, SnowAccounts, WaitingPanel, SnowAccount,ErrorDispatcher,ErrorParser,DialogManager,LinkUtil, Config) {
        var MSG_AUTH_FAILED = _('Could not authenticate to ServiceNow. Please check your credentials and try again.').t();
        var MSG_ACCOUNT_SAVED_SUCCESS = "Configuration successfully!";
        var MSG_TYPE_ERROR = 'MSG_TYPE_ERROR';
        var MSG_TYPE_WARNING = 'MSG_TYPE_WARNING';
        var MSG_TYPE_SUCCESS = 'MSG_TYPE_SUCCESS';
        var BTN_PRIMARY_TEXT = {
            ADD: _('Add').t(),
            CHECK: _('Checking').t(),
            UPDATE: _('Update').t()
        };
        return BaseView.extend({

            className: 'snow-account-display',


            /**
             * Account Selector
             * @param {Object} options
             *              {boolean} (optional) readonly, default is false
             *              {String} (optional) accountName
             */
            initialize: function(options){
                BaseView.prototype.initialize.apply(this, arguments);
                if(Config.ERROR){
                    //ERROR will be displayed in Router
                    return;
                }
                this.model = new Backbone.Model();
                this.readonly = this.options.readonly || false;

                // fetch accounts
                this.snowAccounts = new SnowAccounts();
                WaitingPanel.show();
                var self = this;
                this.snowAccounts.fetch({
                    data:Config.CONTEXT,
                    success:function(){
                        WaitingPanel.close();
                    },
                    error:function(model, response){
                        WaitingPanel.close();
                        ErrorDispatcher.raise(ErrorParser.parse(response.responseText))
                        //self._showMsg(err.msg, err.type);
                    }
                });

                this.urlControl = new ControlGroup({
                    controlType: 'Text',
                    required: true,
                    label: _("ServiceNow URL").t(),
                    help: _('Enter your ServiceNow URL. For example, https://mycompany.service-now.com').t(),
                    updateOnKeyUp:true,
                    controlOptions: {
                        modelAttribute: 'snow_url',
                        model: this.model
                    }
                });

                this.usernameControl = new ControlGroup({
                    controlType: 'Text',
                    required: true,
                    label: _("Username").t(),
                    updateOnKeyUp:true,
                    help: _.template('Enter the username and password of the account the Splunk App for ServiceNow should use to collect data and integrate with ServiceNow. <a class="external" target="_blank" href="/help?location=<%= LINK_PREFIX %>snowapp.config.account">Learn more</a>', {LINK_PREFIX:LinkUtil.getLinkPrefix()}),
                    controlOptions: {
                        modelAttribute: 'username',
                        model: this.model
                    }
                });

                this.passwordControl = new ControlGroup({
                    //id: 'pswdInputControl',
                    controlType: 'Text',
                    required: true,
                    label: _("Password").t(),
                    updateOnKeyUp:true,
                    controlOptions: {
                        modelAttribute: 'password',
                        model: this.model,
                        password: true
                    }
                });

                // in case of "edit input"
                if (this.readonly) {
                    this.model.set('account', this.options.accountName);
                }

                this.listenTo(this.snowAccounts, 'add remove update reset sort', this.refreshSettingsToPage, this);
            },

            _changeInputState: function(isEnable) {
                if (isEnable) {
                    this.urlControl.$('input').prop('disabled',false);
                    this.usernameControl.$('input').prop('disabled',false);
                    this.passwordControl.$('input').prop('disabled',false);
                } else {
                    this.urlControl.$('input').prop('disabled',true);
                    this.usernameControl.$('input').prop('disabled',true);
                    this.passwordControl.$('input').prop('disabled',true);
                }
            },

            _validate: function() {
                this.$('.msg')[0].className = 'msg msg-none';
                this.$('i.icon')[0].className = 'icon';
                this.$('.msg-text').html("");
                if (!this.model.get('snow_url')) {
                    return "ServiceNow URL can not be empty";
                }

                if (!this.model.get('username') || $.trim(this.model.get('username')).length == 0) {
                    return "Service-Now Account username can't be empty.";
                }

                if (!this.model.get('password')) {
                    return "Service-Now Account password can't be empty.";
                }

                return true;
            },

            _showMsg: function(msg, type){
                if (type === MSG_TYPE_WARNING) {
                    this.$('.msg')[0].className = 'msg msg-warning';
                    this.$('i.icon')[0].className = 'icon icon-warning-sign';
                } else if (type === MSG_TYPE_ERROR) {
                    this.$('.msg')[0].className = 'msg msg-error';
                    this.$('i.icon')[0].className = 'icon icon-alert-circle';
                } else if (type === MSG_TYPE_SUCCESS) {
                    this.$('.msg')[0].className = 'msg msg-success';
                    this.$('i.icon')[0].className = 'icon icon-check';
                } else {
                    return;
                }

                this.$('.msg-text').text(msg);
            },

            saveAccounts: function() {
                var result = this._validate();
                if (result !== true){
                    this._showMsg(result, MSG_TYPE_ERROR);
                    return;
                }else{
                    this._changeInputState(false);
                    var that = this;
                    var snowAccount ;
                    if(this.snowAccounts.models.length > 0) {
                        snowAccount = this.snowAccounts.at(0)
                    }else{
                        snowAccount = new SnowAccount();
                    }

                    snowAccount.entry.content.set('name','snow_account');
                    snowAccount.entry.content.set('snow_url', this.model.get('snow_url'));
                    snowAccount.entry.content.set('release', 'automatic');
                    snowAccount.entry.content.set('password', this.model.get('password'));
                    snowAccount.entry.content.set('username', this.model.get('username'));
                    this.$('.submit').html('<i class="loader"></i>Checking');
                    this.$('.submit').addClass("disabled");
                    that.$('.cancel').addClass('disabled');
                    WaitingPanel.show();
                    snowAccount.save({},{
                        data:Config.CONTEXT,
                        success:function(){
                            WaitingPanel.close();
                            that._showMsg(MSG_ACCOUNT_SAVED_SUCCESS,MSG_TYPE_SUCCESS);
                            that._changeInputState(true);
                            that.$('.submit').html("Save");
                            that.$('.submit').removeClass('disabled');
                            that.$('.cancel').removeClass('disabled');
                            if(that.snowAccounts.models.length==0){
                                that.snowAccounts.add(snowAccount);
                            }else{
                                // TODO deal with update refresh

                            }
                        },
                        error: function(model,response){
                            WaitingPanel.close();
                            if(response.responseText.indexOf("Can not authenticate the ServiceNow account")){
                                that._showMsg(MSG_AUTH_FAILED, MSG_TYPE_ERROR);
                            }else{
                                var err = ErrorParser.parse(response.responseText);
                                that._showMsg(err.msg, err.type);
                            }

                            that._changeInputState(true);
                            that.$('.submit').removeClass('disabled');
                            that.$('.cancel').removeClass('disabled');
                            that.$('.submit').html("Save");
                        }
                    });
                }
            },

            refreshSettingsToPage:function(){
                WaitingPanel.close();
                if(this.snowAccounts.models.length > 0){
                    var account = this.snowAccounts.at(0);
                    this.model.data = account;
                    this.model.set('snow_url', account.entry.content.get('snow_url'));
                    this.model.set('username', account.entry.content.get('username'));
                    this.model.set('password', account.entry.content.get('password'));
                }else {
                    this.model.data = null;
                    this.model.set('snow_url', '');
                    this.model.set('username', '');
                    this.model.set('password', '');
                }
            },

            deleteAccounts:function(){
                var that = this;
                DialogManager.showConfirmDialog({
                    title:"Warning",
                    content:"Do you really want to delete the ServiceNow account information?",
                    btnCancel:"Cancel",
                    btnOK:"Delete"
                }, function(){
                    if(that.snowAccounts.models.length > 0){
                        that.snowAccounts.models[0].destroy({
                            data: Config.CONTEXT
                        });
                        that.snowAccounts.remove(that.snowAccounts.at(0),{
                            data: Config.CONTEXT
                        });
                    }
                });
            },

            render: function() {
                // clear list first
                this.$('.inline-accounts-list').html('');
                this.$el.html(_.template(this.template, {LINK_PREFIX:LinkUtil.getLinkPrefix()}));
                this.$('.snow-account-url').append(this.urlControl.render().$el);
                this.$('.snow-account-username').append(this.usernameControl.render().el);
                this.$('.snow-account-pswd').append(this.passwordControl.render().el);

                //this.refreshSettingsToPage();
                this._changeInputState(true);
                if (this.readonly) {
                    this.$('.alter').addClass('hide');
                }

                return this;
            },

            template: '\
                <div>\
                    <div class="inline-accounts-list">\
                        <div class="account">\
                            <div class="msg msg-none"><i class="icon"></i><div class="msg-text"></div></div>\
                            <p class="title">Instructions</p>\
                            <p>\
                                Connect the Splunk App for ServiceNow to your ServiceNow account. When you save this page, the Splunk App for ServiceNow begins collecting data immediately.\
                                <a class="external" target="_blank" href="/help?location=<%= LINK_PREFIX %>snowapp.config">Learn more</a>\
                            </p>\
                            <br/>\
                            <p class="title">ServiceNow Account</p>\
                            <div class="snow-account-url"></div>\
                            <div class="snow-account-username"></div>\
                            <div class="snow-account-pswd"></div>\
                        </div>\
                    </div>\
                </div>\
            '
        })
    });