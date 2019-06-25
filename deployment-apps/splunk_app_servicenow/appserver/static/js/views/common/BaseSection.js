/**
 * Created by strong on 8/13/15.
 */
define([
    'jquery',
    'underscore',
    'backbone',
    'views/Base'
], function ($, _, Backbone, BaseView) {


    return BaseView.extend({
        initialize: function () {
            BaseView.prototype.initialize.apply(this, arguments);
            this.label = this.options.label; // section label
            this.allowExpand = this.options.allowExpand || false;
            this.expand = !this.options.expand || false;
        },
        sectionReady: function () {
            // subject to be overrided by sub module
            return $.Deferred().resolve();
        },
        /**
         * enable the whole section
         */
        enable: function () {
            this.$el.removeClass('disabled');
            this.invokeOnChildren('enable');
        },
        /**
         * disable the whole section
         */
        disable: function () {
            this.$el.addClass('disabled');
            this.invokeOnChildren('disable');
        },
        signalChanged: function () {
            if (!this._singalChanged)
                this._singalChanged = _.debounce(function () {
                    this.trigger('changed');
                }.bind(this), 50);
            this._singalChanged();
        },
        render: function () {
            this.$el.html(this.compiledTemplate({
                label: this.label,
                allowExpand: this.allowExpand
            }));
            this.renderContent(this.$('.section-body'));
            this._onHeaderClick();
            return this;
        },
        renderContent: function ($content) {
            // should be override by sub module
        },
        events: {
            'click .section-header': '_onHeaderClick'
        },
        _onHeaderClick: function () {
            if (this.allowExpand) {
                if (this.expand) {
                    //hide section content
                    this.$('.section-header i').removeClass('icon-chevron-down').addClass('icon-chevron-right');
                    this.$('.section-body').hide();
                    this.expand = false;
                }
                else {
                    //show section content
                    this.$('.section-header i').removeClass('icon-chevron-right').addClass('icon-chevron-down');
                    this.$('.section-body').show();
                    this.expand = true;
                }
            }
        },
        template: '\
            <% if (allowExpand) { %>\
                <div class="section-header expandable">\
            <% } else { %>\
                <div class="section-header">\
            <% } %>\
                <% if (label) { %>\
                <p class="section-label">\
                    <% if (allowExpand) { %><i class="icon-chevron-right"></i><% } %>\
                    <%- label %>\
                </p><% } %>\
            </div>\
            <div class="section-body">\
                <div class="msg msg-none"><i class="icon"></i><div class="msg-text"></div></div>\
            <div/>\
            '
    });
});