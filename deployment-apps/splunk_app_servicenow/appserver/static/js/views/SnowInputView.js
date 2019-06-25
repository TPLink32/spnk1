/**
 * Created by strong on 8/5/15.
 */
define(
    [
        'jquery',
        'underscore',
        'backbone',
        'models/Base',
        'views/Base',
        'app/views/inputs/SnowInputDisplay'
        //'app/models/Config!',
    ],
    function (
        $,
        _,
        Backbone,
        BaseModel,
        BaseView,
        SnowInputDisplay
        //Config,
    ) {
        return BaseView.extend({
            initialize: function (options) {
                BaseView.prototype.initialize.apply(this, arguments);

                this.model = this.model || {};
                this.model.control = new BaseModel();
                this.children.snowInputDisplay = new SnowInputDisplay();
            },

            events: {

            },

            render: function() {
                this.$el.html(this.template);
                this.$('.input-display').append(this.children.snowInputDisplay.render().el);
                return this;
            },

            template:'<div class="section input-display"></div>'
        })
    });