/**
 * Created by strong on 8/5/15.
 */
define([
    'jquery',
    'underscore',
    'backbone',
    'module',
    'models/Base',
    'views/shared/Modal',
    'views/shared/controls/ControlGroup',
    'app/models/SnowDataInput',
    'app/collections/SnowDataInputs',
    'app/utils/Util',
    'app/models/Config!'
],function($, _, Backbone, module, BaseModel, Modal, ControlGroup, SnowInput, SnowInputs, LinkUtil, Config){
    var MSG_TYPE_ERROR = 'MSG_TYPE_ERROR';
    var MSG_TYPE_WARNING = 'MSG_TYPE_WARNING';
    var DIALOG_BTN_ADD = '<a href="#" class="btn btn-primary modal-btn-primary pull-right btn-add">' + _('Add').t() + '</a>';
    var BTN_PRIMARY_TEXT = {
        ADD: _('Add').t(),
        CHECK: _('Checking').t(),
        UPDATE: _('Update').t()
    };
    return Modal.extend({
        moduleId:module.id,
        className : Modal.CLASS_NAME + ' add-snow-input-dialog-modal modal-wide',
        events: $.extend({}, Modal.prototype.events, {
            'click .btn-add:not(.disabled)': '_addInput'
        }),

        initialize: function(options){
            Modal.prototype.initialize.apply(this, arguments);
            this.model = new BaseModel();
            this.model.data = this.options.input;

            this.nameControl = new ControlGroup({
                controlType:'Text',
                required: true,
                label: _("Database table name").t(),
                help:_("ServiceNow database table name").t(),
                controlOptions:{
                    modelAttribute: 'name',
                    model: this.model
                }
            });

            this.durationControl = new ControlGroup({
                controlType:"Text",
                required:true,
                label:_("Collection interval").t(),
                help:_("Collection interval for this table (in seconds)").t(),
                controlOptions:{
                    modelAttribute:"duration",
                    model: this.model
                }
            });

            this.excludeControl = new ControlGroup({
                controlType:"Text",
                required:false,
                label:_("Excluded properties").t(),
                help:_("Excluded properties of the database table (comma separated)").t(),
                controlOptions:{
                    modelAttribute:"exclude",
                    model: this.model
                }
            });

            this.timefieldControl = new ControlGroup({
                controlType:"Text",
                required:false,
                label:_("Time field of the table").t(),
                help:_('Field in the table to use for the time of each event (Default is "sys_updated_on")').t(),
                controlOptions:{
                    modelAttribute:"timefield",
                    model: this.model
                }
            });

            this.sincewhenControl = new ControlGroup({
                controlType:"Text",
                required:false,
                label:_("Start time").t(),
                help:_('The app collects data with a time later than this (UTC in "YYYY-MM-DD hh:mm:ss" format. Default is one year ago.)').t(),
                controlOptions:{
                    modelAttribute:"since_when",
                    model: this.model
                }
            });
        },
        show: function(input) {
            Modal.prototype.show.apply(this, arguments);
            
            this.$('.msg')[0].className = 'msg msg-none';

            if (input) {
                this.model.data = input;
                this.nameControl.hide();
                //this.durationCont
                this.model.set('name', input.entry.get("name"));
                this.model.set('duration', input.entry.content.get('duration'));
                this.model.set('timefield', input.entry.content.get('timefield'));
                this.model.set('since_when', input.entry.content.get('since_when'));
                this.model.set('exclude', input.entry.content.get('exclude'));

                this.$(Modal.HEADER_TITLE_SELECTOR).html(_('Update Service-Now Data Input: '+input.entry.get("name")).t());
                this.$('.btn-add').html(BTN_PRIMARY_TEXT.UPDATE);
            } else {
                this.model.data = null;
                this.nameControl.show();
                this.model.set('name', '');
                this.model.set('duration', '');
                this.model.set('timefield', 'sys_updated_on');
                this.model.set('since_when', '');
                this.model.set('exclude', '');

                this.$(Modal.HEADER_TITLE_SELECTOR).html(_('Add ServiceNow Data Input').t());
                this.$('.btn-add').html(BTN_PRIMARY_TEXT.ADD);
            }

            this._changeInputState(true);
            this.$('.btn-add').removeClass('disabled');
        },
        render: function() {
            this.$el.html(Modal.TEMPLATE);
            this.$(Modal.HEADER_TITLE_SELECTOR).html(_('Add ServiceNow Data Input').t());
            this.$(Modal.BODY_SELECTOR).show();
            this.$(Modal.BODY_SELECTOR).append($('<div class="form"></div>'));
            this.$(Modal.BODY_FORM_SELECTOR).html(_.template(this.dialogFormBodyTemplate, {LINK_PREFIX:LinkUtil.getLinkPrefix()}));

            // add controls
            this.$('.snow-input-name').append(this.nameControl.render().el);
            this.$('.snow-input-duration').append(this.durationControl.render().el);
            this.$('.snow-input-exclude').append(this.excludeControl.render().el);
            this.$('.snow-input-timefield').append(this.timefieldControl.render().el);
            this.$('.snow-input-sincewhen').append(this.sincewhenControl.render().el);

            this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
            this.$(Modal.FOOTER_SELECTOR).append(DIALOG_BTN_ADD);
            var self = this;
            $(function(){
                self.sincewhenControl.$("input").datepicker({
                    dateFormat: 'yy-mm-dd',
                    minDate: new Date(1970, 1 - 1, 1),
                    onSelect:function(dateText,inst){
                        self.model.set('since_when', dateText+" 00:00:00");
                    }
                });
            });

            return this;
        },

        _validate:function(){
            if(!$.trim(this.model.get('name')) ){
                return "Data Input Name should not be empty"
            }
            if(this.model.data&&!this.model.data.entry.content.get("can_remove")&&!$.trim(this.model.get("duration"))){
                return "Custome data input should have collection interval set"
            }

            //TODO validate time format

            return true;
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

        _changeInputState: function(isEnable) {
            if (isEnable) {
                this.nameControl.enable();
                this.durationControl.enable();
                this.excludeControl.enable();
                this.timefieldControl.enable();
                this.sincewhenControl.enable();
            } else {
                this.nameControl.disable();
                this.durationControl.disable();
                this.excludeControl.disable();
                this.timefieldControl.disable();
                this.sincewhenControl.disable();
            }
        },

        _addInput:function(){
            this.$('.msg')[0].className = 'msg msg-none';
            var result = this._validate();
            if (result != true){
                this._showMsg(result, MSG_TYPE_ERROR);
                return;
            }

            this.$('.btn-add').html('<i class="loader"></i>checking');
            this.$('.btn-add').addClass('disabled');
            this._changeInputState(false);

            var snowInput = this.model.data? this.model.data : new SnowInput();
            if(!this.model.data){
                snowInput.entry.content.set("name",this.model.get("name"));
            }
            snowInput.entry.content.set("duration",this.model.get("duration"));
            snowInput.entry.content.set("timefield",this.model.get("timefield"));
            snowInput.entry.content.set("since_when",this.model.get("since_when"));
            snowInput.entry.content.set("exclude",this.model.get("exclude"));
            var that = this;
            snowInput.save({},{
                data: Config.CONTEXT,
                success:function(){
                    if(that.model.inputs && !that.model.data){
                        var input = new SnowInput();
                        input.set("id", that.model.get("name"));
                        input.fetch({
                            data:Config.CONTEXT,
                            success:function(model){
                                that.model.inputs.add(model);
                            },
                            error:function(model, response){
                                that._showMsg( _(response.responseJSON.messages[0].text).t(), MSG_TYPE_ERROR);
                            }
                        });
                    }
                    that.$('.btn-add').removeClass('disabled');
                    that._changeInputState(true);
                    that.hide();
                },
                error:function(input, response){
                    that._showMsg( _(response.responseJSON.messages[0].text).t(), MSG_TYPE_ERROR);
                    that._changeInputState(true);
                    that.$('.btn-add').removeClass('disabled');
                    if (that.model.data) {
                        that.$('.btn-add').html(BTN_PRIMARY_TEXT.UPDATE);
                    } else {
                        that.$('.btn-add').html(BTN_PRIMARY_TEXT.ADD);
                    }
                }
            })
        },

        dialogFormBodyTemplate: '\
            <div class="msg msg-none"><i class="icon"></i><div class="msg-text"></div></div>\
            <p>\
                Use this form to start collecting data from a new ServiceNow database table.\
                <a class="external" target="_blank" href="/help?location=<%= LINK_PREFIX %>snowapp.config.input">Learn more</a>\
            </p>\
            <div class="snow-input-name"></div>\
            <div class="snow-input-duration"></div>\
            <div class="snow-input-exclude"></div>\
            <div class="snow-input-timefield"></div>\
            <div class="snow-input-sincewhen"></div>\
        '
    })
});