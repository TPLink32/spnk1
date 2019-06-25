/**
 * Created by michael on 6/21/15.
 */
define([
    'jquery',
    'underscore',
    'backbone',
    'views/Base',
    'app/models/AwsDataInput',
    'app/utils/ErrorDispatcher',
], function ($, _, Backbone, BaseView, AwsDataInput, ErrorDispatcher) {

    return BaseView.extend({
        initialize: function () {
            BaseView.prototype.initialize.apply(this, arguments);
            this.inputDeferred = $.Deferred();
            this.inputDeferred.done(this._onInputReady.bind(this));
        },
        /**
         * load or create this.inputModel
         * @param inputsModel inputs model
         * @param context current context with aws_service name
         * @param action current action
         * @param name input name, required in edit action
         * @private
         */
        _loadInput: function (inputsModel, context, action, name) {
            var self = this;
            if (action == 'create') {
                self.inputModel = new AwsDataInput();
                this.inputDeferred.resolve()
            }
            else {
                if (inputsModel.isFetched()) {
                    self.inputModel = inputsModel.findByEntryName(name);
                    self.inputDeferred.resolve();
                }
                else {
                    inputsModel.fetch({
                        data: context,
                        success: function (collection) {
                            self.inputModel = collection.findByEntryName(name);
                            self.inputDeferred.resolve();
                        },
                        error: function (collection, response, options) {
                            ErrorDispatcher.raise(response);
                        }
                    })
                }
            }
        },
        render: function () {
            if (this.inputDeferred.state() == 'pending') {
                // render loading indicator
                var template = this.compiledTemplate();
                this.$el.html(template);
            }
            return this;
        },
        _onInputReady: function () {
            // override by sub module
            return this;
        },
        template: '<div id="placeholder-main-section-body">Loading...</div>'
    });
});
