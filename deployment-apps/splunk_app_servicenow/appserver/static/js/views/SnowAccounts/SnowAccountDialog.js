/**
 * Created by strong on 6/24/15.
 */

define([
    'jquery',
    'underscore',
    'backbone',
    'module',
    'models/Base',
    'views/shared/Modal',
    'views/shared/controls/ControlGroup',
    'app/models/SnowAccount',
    'app/collections/SnowAccounts'
    ],
    function(
        $,
        _,
        Backbone,
        module,
        BaseModel,
        Modal,
        ControlGroup,
        SnowAccount,
        SnowAccounts
    ) {

        var DIALOG_BTN_ADD = '<a href="#" class="btn btn-primary modal-btn-primary pull-right btn-add">' + _('Add').t() + '</a>';
        var MSG_AUTH_FAILED = _('Could not authenticate to AWS. Please check your credentials and try again.').t();
        var MSG_NO_PERMISSION_1 = _('It appears you are using an AWS account that does not have permissions to list S3 bucket names. Work with your AWS administrator to ensure the accounts you use have the required permissions.').t();
        var MSG_NO_PERMISSION_2 = _('You can proceed with adding this account and change the IAM permissions later.').t();
        //var MSG_ROOT_ACCOUNT = _('Warning - it appears you are using an AWS root account. For better security, please consider using an IAM user account instead.').t();
        var MSG_TYPE_ERROR = 'MSG_TYPE_ERROR';
        var MSG_TYPE_WARNING = 'MSG_TYPE_WARNING';
        var BTN_PRIMARY_TEXT = {
            ADD: _('Add').t(),
            CHECK: _('Checking').t(),
            UPDATE: _('Update').t()
        };

        return Modal.extend({
            moduleId: module.id,
            className: Modal.CLASS_NAME + ' add-aws-account-dialog-modal modal-wide',

            events: $.extend({}, Modal.prototype.events, {
                'click .btn-add:not(.disabled)': '_addAccount'
            }),

            initialize: function(options) {
                Modal.prototype.initialize.apply(this, arguments);

                this.model = new BaseModel();
                this.model.snowAccounts = this.options.snowAccounts;

                this.urlControl = new ControlGroup({
                    //id: 'urlInputControl',
                    controlType: 'Text',
                    required: true,
                    label: _("Service-Now URL").t(),
                    help: _('ServiceNow URL address').t(),
                    controlOptions: {
                        modelAttribute: 'snow_url',
                        model: this.model,
                        additionalClassNames: 'snow_url-input'
                    }
                });

                this.releaseControl = new ControlGroup({
                    controlType:'Text',
                    required:true,
                    label:_("Release").t(),
                    help:_('Release of Service-Now, if you don\'t know, choose automatic.').t(),
                    controlOptions:{
                        modelAttribute: 'release',
                        model: this.model,
                        additionalClassNames:'release-input'
                    }
                });

                this.usernameControl = new ControlGroup({
                    controlType: 'Text',
                    required: true,
                    label: _("Username").t(),
                    help: _("").t(),
                    controlOptions: {
                        modelAttribute: 'username',
                        model: this.model,
                        additionalClassNames: 'username-input'
                    }
                });

                this.passwordControl = new ControlGroup({
                    //id: 'pswdInputControl',
                    controlType: 'Text',
                    required: true,
                    label: _("Password").t(),
                    controlOptions: {
                        modelAttribute: 'password',
                        model: this.model,
                        password: true,
                        additionalClassNames: 'password-input'
                    }
                });

            },

            show: function(account) {
                Modal.prototype.show.apply(this, arguments);

                this.$('.msg')[0].className = 'msg msg-none';

                if (account) {
                    this.model.data = account;
                    this.model.set('snow_url', account.entry.content.get('snow_url'));
                    this.model.set('release', account.entry.content.get('release'));
                    this.model.set('username', account.entry.content.get('username'));
                    this.model.set('password', account.entry.content.get('password'));

                    this.$(Modal.HEADER_TITLE_SELECTOR).html(_('Update Service-Now Account').t());
                    this.$('.btn-add').html(BTN_PRIMARY_TEXT.UPDATE);
                } else {
                    this.model.data = null;
                    this.model.set('snow_url', '');
                    this.model.set('release', '');
                    this.model.set('username', '');
                    this.model.set('password', '');

                    this.$(Modal.HEADER_TITLE_SELECTOR).html(_('Add Service-Now Account').t());
                    this.$('.btn-add').html(BTN_PRIMARY_TEXT.ADD);
                }

                this._changeInputState(true);
                this.$('.btn-add').removeClass('disabled');
            },

            _validate: function() {
                //if (!this.model.get('snow_url') || !/^[\w -,]+$/.test(this.model.get('snow_url'))) {
                //    return "Only alphanumeric , space, dash, underscore, and comma characters are supported for account names.";
                //}

                if (!this.model.get('username') || $.trim(this.model.get('username')).length == 0) {
                    return "Service-Now Account username can't be empty.";
                }

                if (!this.model.get('password')) {
                    return "Service-Now Account password can't be empty.";
                }

                return true;
            },

            _addAccount: function() {
                // clean error message
                this.$('.msg')[0].className = 'msg msg-none';

                // front end validation
                var result = this._validate();

                if (result  !== true) {
                    this._showMsg(result, MSG_TYPE_ERROR);
                    return;
                }

                // show checking and disable button
                this.$('.btn-add').html('<i class="loader"></i>checking');
                this.$('.btn-add').addClass('disabled');

                this._changeInputState(false);

                var that = this;

                // send to backend
                var snowAccount = new SnowAccount();
                snowAccount.entry.content.set('name', 'snow_account');
                snowAccount.entry.content.set('snow_url', this.model.get('snow_url'));
                snowAccount.entry.content.set('release', this.model.get('release'));
                snowAccount.entry.content.set('password', this.model.get('password'));
                snowAccount.entry.content.set('username', this.model.get('username'));
                snowAccount.save({},{
                    data: {app:'Splunk_TA_snow',owner:'admin'},
                    success: function() {
                        // add model into collection
                        //TODO deal with update
                        that.model.snowAccounts.add(snowAccount);
                        // hide dialog
                        that.hide();
                    },
                    error: function(msg){
                        // TODO handle different cases
                        that._showMsg(MSG_AUTH_FAILED, MSG_TYPE_ERROR);
                        that._changeInputState(true);
                        that.$('.btn-add').removeClass('disabled');
                        if (that.model.data) {
                            that.$('.btn-add').html(BTN_PRIMARY_TEXT.UPDATE);
                        } else {
                            that.$('.btn-add').html(BTN_PRIMARY_TEXT.ADD);
                        }
                    }
                });
            },

            _changeInputState: function(isEnable) {
                if (isEnable) {
                    this.urlControl.render().enable();
                    this.releaseControl.render().enable();
                    this.usernameControl.render().enable();
                    this.passwordControl.render().enable();
                } else {
                    this.urlControl.render().disable();
                    this.releaseControl.render().disable();
                    this.usernameControl.render().disable();
                    this.passwordControl.render().disable();
                }
            },

            _showMsg: function(msg, type){
                if (type === MSG_TYPE_WARNING) {
                    this.$('.msg')[0].className = 'msg msg-warning';
                    this.$('i.icon')[0].className = 'icon icon-warning-sign';
                } else if (type === MSG_TYPE_ERROR) {
                    this.$('.msg')[0].className = 'msg msg-error';
                    this.$('i.icon')[0].className = 'icon icon-alert-circle';
                } else {
                    return;
                }

                this.$('.msg-text').text(msg);
            },

            render: function() {
                this.$el.html(Modal.TEMPLATE);
                this.$(Modal.HEADER_TITLE_SELECTOR).html(_('Add ServiceNow Account').t());
                this.$(Modal.BODY_SELECTOR).show();
                this.$(Modal.BODY_SELECTOR).append($('<div class="form"></div>'));
                this.$(Modal.BODY_FORM_SELECTOR).html(_(this.dialogFormBodyTemplate).template({}));

                // add controls
                this.$('.aws-account-url').append(this.urlControl.render().el);
                this.$('.aws-account-release').append(this.releaseControl.render().el);
                this.$('.aws-account-username').append(this.usernameControl.render().el);
                this.$('.aws-account-pswd').append(this.passwordControl.render().el);

                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
                this.$(Modal.FOOTER_SELECTOR).append(DIALOG_BTN_ADD);

                return this;
            },

            dialogFormBodyTemplate: '\
                <div class="msg msg-none"><i class="icon"></i><div class="msg-text"></div></div>\
                <div class="aws-account-url"></div>\
                <div class="aws-account-release"></div>\
                <div class="aws-account-username"></div>\
                <div class="aws-account-pswd"></div>\
            '
        });
    });
