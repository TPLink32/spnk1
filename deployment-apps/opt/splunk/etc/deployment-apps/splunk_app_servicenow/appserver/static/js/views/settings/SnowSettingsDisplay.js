/**
 * Created by strong on 7/29/15.
 */

define([
    'jquery',
    'underscore',
    'backbone',
    'models/Base',
    'app/views/common/BaseSection',
    'views/shared/controls/ControlGroup',
    'app/collections/SnowSettings',
    'app/models/SnowSetting',
    'app/utils/MomentUtil',
    //"app/views/common/WaitingPanel",
    'app/models/Config!'
],function($, _, Backbone, BaseModel, BaseSection, ControlGroup, SnowSettings,SnowSetting,MomentUtil, Config){
    var MSG_SETTINGS_SAVE_FAILED = _('Could not authenticate to ServiceNow. Please check your credentials and try again.').t();
    var MSG_SETTINGS_SAVED_SUCCESS = "Settings is saved successfully!";
    var MSG_TYPE_ERROR = 'MSG_TYPE_ERROR';
    var MSG_TYPE_WARNING = 'MSG_TYPE_WARNING';
    var MSG_TYPE_SUCCESS = 'MSG_TYPE_SUCCESS';
    return BaseSection.extend({
        className:"snow-settings-display",
        initialize:function(options){
            BaseSection.prototype.initialize.apply(this, arguments);
            if(Config.ERROR){
                //ERROR will be displayed in Router
                return;
            }
            this.settings = new SnowSettings();
            var self = this;
            this.settings.fetch({
                data:Config.CONTEXT,
                error:function(model, response){
                    //WaitingPanel.close();
                    self._showMsg(response.responseText, MSG_TYPE_ERROR);
                }
            });
            this.model = new Backbone.Model();
            this.collectionIntervalControl = new ControlGroup({
                controlType: 'Text',
                required: false,
                label: _("Default data collection interval (in seconds)").t(),
                updateOnKeyUp:true,
                controlOptions: {
                    modelAttribute: 'collection_interval',
                    model: this.model
                }
            });

            this.sinceWhenControl = new ControlGroup({
                controlType: 'Text',
                required: false,
                label: _('Default start time for data collection (UTC in "YYYY-MM-DD hh:mm:ss" format. Default is one year ago.)').t(),
                updateOnKeyUp:true,
                controlOptions: {
                    modelAttribute: 'since_when',
                    model: this.model
                }
            });

            this.loglevelControl = new ControlGroup({
                controlType: 'SyntheticSelect',
                required: false,
                label: _('Logging level (DEBUG, INFO, or ERROR) ').t(),
                controlOptions: {
                    modelAttribute: 'loglevel',
                    model: this.model,
                    items: [{label:'ERROR',value:'ERROR'},{label:'WARNING',value:'WARNING'},{label:'INFO',value:'INFO'},
                    {label:'DEBUG',value:'DEBUG'}]
                }
            });
            this.listenTo(this.settings, 'add remove update reset sort', this.refreshSettingsToPage, this);
        },

        _validate:function(){
            this.$('.msg').removeClass('msg-none msg-warning msg-error msg-success').addClass('msg-none');
            this.$('i.icon').removeClass("icon-warning-sign icon-alert-circle icon-check");
            this.$('.msg-text').html("");
            var sinceWhenStr = this.model.get('since_when');
            var moment = MomentUtil.strptime(sinceWhenStr, '%Y-%m-%d %H:%M:%S');
            if(sinceWhenStr != null && sinceWhenStr.length>0 && moment.strftime("%Y-%m-%d %H:%M:%S") != sinceWhenStr){
                return "the format of Data started from is not valid"
            }
            var intervalStr = this.model.get('collection_interval');
            if(intervalStr != null && intervalStr.length>0 && isNaN(Number(intervalStr))){
                return "the format of Default data collection interval is not valid"
            }
            return true;
        },

        _showMsg: function(msg, type){
            if (type === MSG_TYPE_WARNING) {
                this.$('.msg').removeClass('msg-none msg-warning msg-error msg-success').addClass('msg-warning');
                this.$('i.icon').removeClass("icon-warning-sign icon-alert-circle icon-check").addClass("icon-warning-sign");
            } else if (type === MSG_TYPE_ERROR) {
                this.$('.msg').removeClass('msg-none msg-warning msg-error msg-success').addClass('msg-error');
                this.$('i.icon').removeClass("icon-warning-sign icon-alert-circle icon-check").addClass("icon-alert-circle");
            } else if (type === MSG_TYPE_SUCCESS) {
                this.$('.msg').removeClass('msg-none msg-warning msg-error msg-success').addClass('msg-success');
                this.$('i.icon').removeClass("icon-warning-sign icon-alert-circle icon-check").addClass("icon-check");
            } else {
                return;
            }

            this.$('.msg-text').text(msg);
        },

        saveSettings:function(){
            var result = this._validate();
            if (result !== true){
                this._showMsg(result, MSG_TYPE_ERROR);
                return;
            }
            var setting ;
            if(this.settings.models.length > 0) {
                setting = this.settings.at(0)
            }else{
                setting = new SnowSetting();
            }
            var that = this;
            setting.entry.content.set('name','snow_account');
            setting.entry.content.set('collection_interval', this.model.get('collection_interval'));
            setting.entry.content.set('loglevel', this.model.get('loglevel'));
            setting.entry.content.set('since_when', this.model.get('since_when'));
            //WaitingPanel.show();
            this.$('.submit').html('<i class="loader"></i>Checking');
            this.$('.submit').addClass("disabled");
            setting.save({},{
                data:Config.CONTEXT,
                success:function(){
                    //WaitingPanel.close();
                    //that._showMsg(MSG_SETTINGS_SAVED_SUCCESS,MSG_TYPE_SUCCESS);   //DO NOT show successful message in settings page
                    that.$('.submit').html("Save");
                    that.$('.submit').removeClass('disabled');
                    if(that.settings.models.length==0){
                        that.model.settings.add(snowAccount);
                    }else{
                        // TODO deal with update refresh
                        that.refreshSettingsToPage();
                    }
                },
                error: function(msg){
                    //WaitingPanel.close();
                    that._showMsg(MSG_SETTINGS_SAVE_FAILED, MSG_TYPE_ERROR);
                    that._changeInputState(true);
                    that.$('.submit').html("Save");
                    that.$('.submit').removeClass('disabled');
                    if (that.model.data) {
                        that.$('.btn-add').html(BTN_PRIMARY_TEXT.UPDATE);
                    } else {
                        that.$('.btn-add').html(BTN_PRIMARY_TEXT.ADD);
                    }
                }
            });
        },

        refreshSettingsToPage:function(){
            if(this.settings.models.length > 0){
                var setting = this.settings.at(0);
                this.model.data = setting;
                this.model.set('collection_interval', setting.entry.content.get('collection_interval'));
                this.model.set('since_when', setting.entry.content.get('since_when'));
                this.model.set('loglevel', setting.entry.content.get('loglevel'));
            }else {
                this.model.data = null;
                this.model.set('collection_interval', '120');
                this.model.set('since_when', '');
                this.model.set('loglevel', 'INFO');
            }
        },
        renderContent:function(sectionbody) {
            $(sectionbody).append(this.collectionIntervalControl.render().$el);
            $(sectionbody).append(this.sinceWhenControl.render().$el);
            var self = this;
            $(function(){
                self.sinceWhenControl.$("input").datepicker({
                    dateFormat: 'yy-mm-dd',
                    minDate: new Date(1970, 1 - 1, 1),
                    onSelect:function(dateText,inst){
                        self.model.set('since_when', dateText+" 00:00:00");
                    }
                });
            });
            //$(sectionbody).append(this.loglevelControl.render().$el);

            this.refreshSettingsToPage();
            //this._changeInputState(true);
            if (this.readonly) {
                this.$('.alter').addClass('hide');
            }
            return this;
        }
    });
});