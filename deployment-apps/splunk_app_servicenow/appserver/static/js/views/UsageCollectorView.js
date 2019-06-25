/**
 * Created by peter on 3/11/16.
 */
define([
    "jquery",
    "underscore",
    "backbone",
    "views/Base",
    "app/lib/ui-metrics-collector/ui-metrics-collector",

], function(
    $,
    _,
    Backbone,
    BaseView,
    UIMetricsCollector
){
    return BaseView.extend({
        template: "",

        /**
            appData: appData stuff
         */
        initialize: function(attributes) {
            BaseView.prototype.initialize.apply(this, arguments);
            this.model = attributes.model;

            this.togglerView = new UIMetricsCollector.Views.Toggler();

            this.render();
        },

        render: function() {
            this.$el.append(this.togglerView.render().el);

            return this;
        }
    });
});
