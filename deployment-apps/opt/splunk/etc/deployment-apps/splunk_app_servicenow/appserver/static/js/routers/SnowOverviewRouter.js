/**
 * Created by strong on 6/24/15.
 */
define([
    'underscore',
    'jquery',
    'backbone',
    'routers/Base',
    'uri/route',
    'contrib/text!app/views/ConfigurationTemplate.html',
    "app/utils/ErrorDispatcher",
    'app/views/common/ErrorView',
    'app/views/SnowOverviewView',
    'app/models/Config!'
],function(_,
              $,
              Backbone,
              BaseRouter,
              route,
              PageTemplate,
              ErrorDispatcher,
              //HeaderView,
              ErrorView,
              SnowOverviewView,
              Config
              ){

        return BaseRouter.extend({
            routes: {
                ':locale/app/:app/:page(/)': '_route',
                '*root/:locale/app/:app/:page(/)': '_routeRooted'
            },
            initialize: function () {
                BaseRouter.prototype.initialize.apply(this, arguments);
                this.pageReady = $.Deferred();
                this.setPageTitle(_('Configuration').t());

                this.model = $.extend(this.model, {
                    application: this.model.application
                });

                this.snowInputView = new SnowOverviewView({
                    model: this.model
                });
                this.errorView = new ErrorView();
                ErrorDispatcher.subscribe(this._renderError.bind(this));
                this.fetchAppLocals = true;
            },
            _renderStructure: function () {
                // render Splunk header and common header
                $('.preload').replaceWith(this.pageView.el);
                this.pageView.$('.main-section-body').append(PageTemplate);
                //this.pageView.$('.app-page-header').html("TITLE");
                this.pageView.$('.app-page-error').html(this.errorView.render().$el);
                if(Config.ERROR){
                    this.errorView.showError(Config.ERROR);
                    this.pageView.$('.app-page-body').remove();

                }else{
                    this.pageView.$('.app-page-body').append(this.snowInputView.render().el);
                }

                this._polyfill62();
            },

            _renderError: function (message, errorCode) {
                if (this.pageReady.state() == 'resolved') {
                    this.pageView.$('.app-page-body').remove();
                    this.errorView.showError(message);
                }
            },
            bootstrapAppNav: function () {
                // polyfill for 6.2
                var nav = __splunkd_partials__['/servicesNS/' + encodeURIComponent(this.model.application.get('owner')) + '/' + encodeURIComponent(this.model.application.get('app')) + '/apps/nav'];
                if (nav) {
                    __splunkd_partials__['/appnav'] = nav;
                }
                BaseRouter.prototype.bootstrapAppNav.apply(this, arguments);
            },
            bootstrapAppLocals: function () {
                BaseRouter.prototype.bootstrapAppLocals.apply(this, arguments);
                this.deferreds.appLocals.then(function () {
                    _.each(this.collection.appLocals.models, function (app) {
                        if (!app.entry.content.has('show_in_nav')) {
                            // polyfill for 6.2
                            var show = app.entry.get('name') !== "splunk_management_console" &&
                                app.entry.get('name') !== "launcher";
                            app.entry.content.set('show_in_nav', show, {silent: true});
                        }
                    })
                }.bind(this));
            },
            _polyfill62: function () {
                _.delay(function () {
                    this.pageView.$('.whatsnew').hide();
                }.bind(this), 500);
            },
            /*
             THE ENTRY POINT
             */
            _route: function (locale, app, page) {
                var args = arguments,
                    self = this;
                if (this.pageReady.state() != 'resolved') {
                    // initialize the page
                    BaseRouter.prototype.page.apply(this, args);
                    this.deferreds.pageViewRendered.done(function () {
                        $('.preload').replaceWith(self.pageView.el);

                        //our code
                        self._renderStructure();

                        self.pageReady.resolve()
                    });
                    this.pageReady.then(this._route.bind(this, arguments))
                }
            },
            _routeRooted: function (root, locale, app, page) {
                this.model.application.set({
                    root: root
                }, {silent: true});
                this._route(locale, app, page);
            }
        });
    });
