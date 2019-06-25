    define([
    "jquery",
    "underscore",
    "backbone",
    "bootstrap",
    "contrib/text!app/templates/TasksTable/Row.html",
    'app/views/Modals/EditTask'
], function(
    $,
    _,
    Backbone,
    Bootstrap,
    TasksTableRowTask,
    EditTaskDialog
){
    return Backbone.View.extend({
        tagName: "tr",
        template: _.template(TasksTableRowTask),

        events: {
            "click a.update-item": "editTask",
            "click a.delete-item": "deleteTask",
            "click a.enable-item": "enableTask",
            "click a.disable-item": "disableTask"
        },

        initialize: function (options) {
            Backbone.View.prototype.initialize.call(this, arguments);

            this.collections = options.collections;
            this.listenTo(this.model, 'change', this.render);
            this.listenTo(this.model, 'destroy', function() {
                this.$el.remove();
            });
        },

        convertToBoolean: function(arg) {
            return $.parseJSON(String(arg).toLowerCase());
        },

        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            if (this.convertToBoolean(this.model.get("disabled")))
                this.$("span[name=enabledPanel]").hide();
            else
                this.$("span[name=disabledPanel]").hide();

            if (!this.convertToBoolean(this.model.get("_removable")))
                this.$("div[name=dv_remove_row]").hide();
            return this;
        },

        editTask: function() {
            var dlg = new EditTaskDialog({
                el: $("#addon_task_edit_dialog"),
                model: this.model
            }).render();
            dlg.modal();
        },

        deleteTask: function() {
            if(confirm('Are you sure you want to delete the task: "' + this.model.get("name")+'"?')){
                this.model.url = this.collections.url + "/" + this.model.get("id");
                //this.collections.remove();//
                this.model.destroy({
                    wait: true,
                    error: function(model,response){
                        var rsp=response.responseText;
                        var rspx=rsp.substring(rsp.indexOf('<body>'),rsp.length)
                            .replace(new RegExp('<(/?)(h1|p|html|body)([^>]*)>','g'),'<$1div$3>')
                            .replace(new RegExp('<[^>]*/>','g'),'');
                        var splunk_error_page=$(rspx);
                        var status=splunk_error_page.find('.status').text();
                        var msg=splunk_error_page.find('.msg').text();
                        alert(status+':\n'+msg);
                    },success: function(){
                    }
                } );
            }
        },

        enableTask: function() {
            this.model.save({disabled: "0"}, {
                wait: true,
                error: function(model,response){
                    var rsp=response.responseText;
                    var rspx=rsp.substring(rsp.indexOf('<body>'),rsp.length)
                        .replace(new RegExp('<(/?)(h1|p|html|body)([^>]*)>','g'),'<$1div$3>')
                        .replace(new RegExp('<[^>]*/>','g'),'');
                    var splunk_error_page=$(rspx);
                    var status=splunk_error_page.find('.status').text();
                    var msg=splunk_error_page.find('.msg').text();
                    alert(status+':\n'+msg);
                },success: function(){
                }
            } );
        },

        disableTask: function() {
            this.model.save({disabled: "1"}, {
                wait: true,
                error: function(model,response){
                    var rsp=response.responseText;
                    var rspx=rsp.substring(rsp.indexOf('<body>'),rsp.length)
                        .replace(new RegExp('<(/?)(h1|p|html|body)([^>]*)>','g'),'<$1div$3>')
                        .replace(new RegExp('<[^>]*/>','g'),'');
                    var splunk_error_page=$(rspx);
                    var status=splunk_error_page.find('.status').text();
                    var msg=splunk_error_page.find('.msg').text();
                    alert(status+':\n'+msg);
                },success: function(){
                }
            } );
        }

    });

});
