/**
 * Created by strong on 8/4/15.
 */
define([
    "jquery",
    "underscore",
    "backbone",
    "models/Base",
    "views/Base",
    "views/shared/controls/ControlGroup",
    "app/views/common/WaitingPanel",
    "app/collections/SnowDataInputs",
    "app/views/inputs/SnowInputRow",
    "app/views/inputs/SnowInputDialog",
    "app/models/Config!",
    'app/lib/ui-metrics-collector/ui-metrics-collector',
],function(
    $,
    _,
    Backbone,
    BaseModel,
    BaseView,
    ControlGroup,
    WaitingPanel,
    SnowDataInputs,
    InputRow,
    SnowInputDialog,
    Config,
    UIMetricsCollector){

    var MSG_TYPE_WARNING = 'MSG_TYPE_WARNING';
    var MSG_TYPE_SUCCESS = 'MSG_TYPE_SUCCESS';
    var MSG_TYPE_ERROR = "MSG_TYPE_ERROR";
    return BaseView.extend({
        initialize:function(options){
            BaseView.prototype.initialize.apply(this, arguments);
            if(Config.ERROR){
                //ERROR will be displayed in Router
                return;
            }
            this.model = this.model || {};
            this.model.control = new BaseModel();
            this.inputs = new SnowDataInputs();
            WaitingPanel.show();
            var self = this;
            this.inputs.fetch({
                data:Config.CONTEXT,
                success:function(){
                    WaitingPanel.close();
                },
                error:function(model, response){
                    WaitingPanel.close();
                    self._showMsg(response.responseText, MSG_TYPE_ERROR);
                }
            });
            this.children.snowInputDialog = new SnowInputDialog();
            this.children.snowInputDialog.render().appendTo($('body'));
            this.listenTo(this.inputs, 'add reset', this.refreshDataInpusToPage, this);
            this.listenTo(this.inputs, 'add reset', this._sendInputsStatus, this);
        },

        refreshDataInpusToPage:function(){
            WaitingPanel.close();
            this.$el.html(this.template);
            var self = this;
            if(this.inputs.length > 0){
                this.children.snowInputDialog.model.inputs = this.inputs;
                _.each(this.inputs.models, function(data){
                    var row = new InputRow({
                        model:data,
                        dialog:self.children.snowInputDialog
                    });

                    // Send inputs status info when the user click enable or disable
                    data.on('change', self._sendInputsStatus.bind(self));

                    this.$('tbody').append(row.render().el);
                }.bind(this));
            }
        },
        
        _sendInputsStatus: function () {
            var inputsStatus = {};
            var disabledCount = 0;
            var enabledCount = 0;
            if(this.inputs.length > 0){
                _.each(this.inputs.models, function(data){
                    var disabled = data.entry.content.get('disabled');
                    // Same code with SnowInputRow.js
                    if (disabled === '1' || disabled === 'true'||disabled === "True") {
                        disabledCount = disabledCount + 1;
                    }
                    else {
                        enabledCount = enabledCount + 1;
                    }
                });
            }
            inputsStatus.disabledCount = disabledCount;
            inputsStatus.enabledCount = enabledCount;
            UIMetricsCollector.collect('input_status', inputsStatus);
        },

        _showMsg:function(msg, type){
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

        render:function(){
            this.$el.html(this.template);
            return this;
        },

        addInput:function(){
            this.children.snowInputDialog.show();
        },

        events: {
            'click .btn-add-input': 'addInput'
        },

        template:'\
            <div class="msg msg-none"><i class="icon"></i><div class="msg-text"></div></div>\
            <div class="section section-right">\
                <a class="btn btn-primary btn-add-input">Add Input</a>\
            </div>\
            <div class="section-close">\
                <table class="table table-chrome table-striped table-border aws-cloudtrail-table">\
                    <thead class="table-head">\
                        <tr class="table-head-tr">\
                            <th>Input Name</th>\
                            <th>Status</th>\
                            <th>Action</th>\
                        </tr>\
                    </thead>\
                    <tbody class="table-body">\
                    </tbody>\
                </table>\
            </div>\
        '
    })
});