/**
 * Created by strong on 8/4/15.
 */

define([
    'jquery',
    'underscore',
    'backbone',
    'views/Base',
    'app/utils/ErrorDispatcher',
    "app/utils/DialogManager",
    'app/models/Config!',
    'app/views/common/WaitingPanel'
],function($, _, Backbone, BaseView, ErrorDispatcher, DialogManager, Config, WaitingPanel){
    return BaseView.extend({
        tagName:"tr",
        className: 'table-body-tr',
        initialize: function(options){
            BaseView.prototype.initialize.apply(this, arguments);
            this.editDialog = this.options.dialog;
            this.waitingPanel = WaitingPanel;
        },
        events: {
            'click i.delete-btn': 'deleteRow',
            'click td.col-name>a': 'editRow',
            'click td>a.enable_disable_btn':'enableOrDisable'
        },

        deleteRow:function(e){
            var self = this;
            DialogManager.showConfirmDialog({
                title:"Warning",
                content:"Do you really want to delete input:"+self.model.entry.get("name"),
                btnCancel:"Cancel",
                btnOK:"Delete"
            },function(){
                self.model.destroy({
                    data:Config.CONTEXT,
                    success:function(){
                        self.remove();
                    }
                });
            });

        },

        editRow:function(e){
            this.editDialog.show(this.model);
        },

        enableOrDisable:function(){
            var disabled = this.model.entry.content.get('disabled');
            var nextAction = "";
            var nextStatus = "";
            if(disabled == '1' || disabled == 'true'||disabled=="True"){
                this.model.entry.content.set("disabled", "0");
                nextAction = "Disable";
                nextStatus = "Enabled";
            }else{
                this.model.entry.content.set("disabled", "1");
                nextAction = "Enable";
                nextStatus = "Disabled";
            }
            var self = this;
            this._blockScreen();
            this.model.save({},{
                data:Config.CONTEXT,
                success:function(){
                    self.$('.enable_disable_btn').text(nextAction);
                    self.$('.status').text(nextStatus)
                    self._unblockScreen();
                },
                error: function(msg){
                    self._unblockScreen();
                }
            });
        },

        render:function(){
            var disabled = this.model.entry.content.get('disabled');
            var status = (disabled == '1' || disabled == 'true'||disabled=="True")?'Disabled':"Enabled";
            var actionBtnText = status == 'Disabled'? "Enable":"Disable";
            var canRemove = this.model.entry.content.get("can_remove");
            var template = _.template(this.template, {
                name: this.model.entry.get('name'),
                status:status,
                action:actionBtnText
            });
            this.$el.html(template);
            if(canRemove){
                this.$(".delete-btn").css({"display":"inline-block"});
            }else{
                this.$(".delete-btn").css({"display":"none"});
            }
            return this
        },

        template: '\
            <td class="col-name vmiddle"><a><%= name %></a></td>\
            <td class="col-regions vmiddle status"><%= status %></td>\
            <td class="col-actions vmiddle">\
                <a class="enable_disable_btn"><%= action %></a>&nbsp;&nbsp;&nbsp;<i class="delete-btn icon-trash"></i>\
            </td>\
        ',

        _blockScreen: function () {
            this.waitingPanel.show();
        },
        
        _unblockScreen: function () {
            this.waitingPanel.close();
        },
    })
});