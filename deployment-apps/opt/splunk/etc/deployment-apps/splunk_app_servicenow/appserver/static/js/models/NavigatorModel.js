define([
    'jquery',
    'underscore',
    'backbone',
    'uri/route'
], function ($, _, Backbone, route) {

    return Backbone.Model.extend({
        initialize: function (options) {
            Backbone.Model.prototype.initialize.apply(this, arguments);
            this.application = options.application;
        },
        initialPage: function (awsService, action, name) {
            this.set({
                'aws_service': awsService,
                'action': action,
                'name': name
            }, {silent: true});
        },
        navigateToRoot: function () {
            this._updateLastVisit();
            this.unset('aws_service', {silent: true});
            this.unset('action', {silent: true});
            this.unset('name', {silent: true});
            this.updateUrl();
        },
        /**
         * navigate to a page with action and name
         * @param awsService
         * @param action in ['create','edit']
         * @param name key of the resource, required when action == 'edit'
         */
        navigateToPage: function (awsService, action, name) {
            this._updateLastVisit();
            this.set({
                'aws_service': awsService,
                'action': action,
                'name': name
            }, {silent: true});
            this.updateUrl();
        },
        /**
         * navigate back to last visit page
         * @returns {boolean}
         */
        navigateBack: function () {
            if (this.lastvisit) {
                this.navigateToPage(this.lastvisit.aws_service, this.lastvisit.action, this.lastvisit.name);
                return true;
            }
            else {
                return false;
            }
        },
        _updateLastVisit: function () {
            this.lastvisit = this.toJSON();
        },
        updateUrl: function () {
            var nextUrl = route.page(
                this.application.get('root'),
                this.application.get('locale'),
                this.application.get('app'),
                this.application.get('page'));
            if (this.has('aws_service')) {
                nextUrl += '?aws_service=' + this.get('aws_service');
                if (this.has('action')) {
                    nextUrl += '&action=' + this.get('action');
                    if (this.has('name')) {
                        nextUrl += '&name=' + this.get('name');
                    }
                }
            }
            this.unset('url', {silent: true});
            this.set('url', nextUrl);
        }
    });
})
