/*global define */

define(function(require, exports, module) {
    var $ = require('jquery');
    var _ = require('underscore');
    var Backbone = require('backbone');
    var sdk = require('splunkjs/splunk');
    var sharedModels = require('./palette-shared-models');

    /** The Palette Configuration consists of four items which have to
     * be retrieved from the back-end: the current user, the list of
     * panels, the list of inputs, and the list of searches.  This
     * provides access to those objects, and composes them behind a
     * single interface with a single fetch() action
     */

    //   ___  _     _        _     ___       __ _      _ _   _             
    //  / _ \| |__ (_)___ __| |_  |   \ ___ / _(_)_ _ (_) |_(_)___ _ _  ___
    // | (_) | '_ \| / -_) _|  _| | |) / -_)  _| | ' \| |  _| / _ \ ' \(_-<
    //  \___/|_.__// \___\__|\__| |___/\___|_| |_|_||_|_|\__|_\___/_||_/__/
    //           |__/                                                      
    
    // The following object definitions are static objects returned by
    // server-side calls.  Each of them contains an EAI blob with a
    // "properties" object that contains the actual content of the
    // configuration object request.
    
    var _GenericConfigurationModel = Backbone.Model.extend({
        initialize: function(attributes, options) {
            this.id = attributes.name;
            this._cache = {};
            this.properties = new Backbone.Model(attributes.properties());
        }
    });
    
    var _GenericConfigurationCollection = Backbone.Collection.extend({
        model: _GenericConfigurationModel,
 
        parse: function(resp) {
            return resp;
        },
       
        initialize: function(objects, options) {
            var service = options.service;
            this.panels = [];
            this.service = new sdk.Service(service.http, {
                host: service.host,
                port: service.port,
                scheme: service.scheme,
                token: service.token,
                owner: null,
                app: service.app
            });
            return this;
        },
        
        confFile: function() {
            throw new Error("Not implemented");
        },
        
        fetch: function(options) {
            var panelsfetch;
            var that = this;
            var dfd = $.Deferred();
            panelsfetch = this.confFile();
            panelsfetch.fetch(function(err, panels) {
                that.panels = panels;
                that.reset(that.parse(panels.list()));
                dfd.resolve(this);
            });
            return dfd;
        }
    });
    
    var Panelref = _GenericConfigurationModel.extend({ 
        categories: function() {
            if (this._cache.categories) { 
                return this._cache.categories; 
            }
            if (! this.properties.get('categories')) {
                return this._cache.categories = [];
            }
            return this._cache.categories = JSON.parse(this.properties.get('categories'));
        }
    });

    var appNamespace = {
        owner: '-',
        app: 'splunk_app_windows_infrastructure'
    };

    var PanelrefList = _GenericConfigurationCollection.extend({
        model: Panelref,
        confFile: function() {
            return new sdk.Service.ConfigurationFile(this.service, 'palettepanels', appNamespace);
        },
        groupByApplication: function(filter) {
            // MSAPP-1864: (Business Policy) Panel Groups must be
            // sorted in the order of 'Exchange,' 'Windows,' 'Active
            // Directory.'

            filter = filter || function() { return true; };

             var panelGroupSorter = function(group) {
                return _.indexOf(['Exchange', 'Windows', 'Active Directory'], group.name);
            };

            var panelAppName = function(panel) { 
                return panel.properties.get('application');
            };

            var panelByName = function(panel) {
                return panel.properties.get('title');
            };

            var panelSorter = function(panels, panelAppName) {
                return {name: panelAppName, panels: _.sortBy(panels, panelByName)};
            };

            var panelFilter = function(group) {
                return {name: group.name, panels: _.filter(group.panels, filter)};
            };

            return this
                .chain()
                .groupBy(panelAppName)
                .map(panelSorter)
                .map(panelFilter)
                .sortBy(panelGroupSorter)
                .value();
        }
    });
    
    var Inputref = _GenericConfigurationModel.extend({});
    var InputrefList = _GenericConfigurationCollection.extend({
        model: Inputref,
        confFile: function() {
            return new sdk.Service.ConfigurationFile(this.service, 'paletteinputs', appNamespace);
        }
    });
    
    var Searchref = _GenericConfigurationModel.extend({});
    var SearchrefList = _GenericConfigurationCollection.extend({
        model: Searchref,
        confFile: function() {
            return new sdk.Service.ConfigurationFile(this.service, 'palettesearches', appNamespace);
        }
    });

    /** 
     * Initialize the Palette Controller, which contains the
     * definitions and descriptions of all the components of the
     * Palette system and the user under which the current instance
     * of Palette is running.
     *
     * By instantiating these Backbone objects first, and only later
     * initializing them, we allow external objects (like Backbone
     * Views) to bind to models and collections before instantiation.
     * This helps guarantee fetch-time rendering happens at fetch, and
     * not in some ad-hoc fashion or by calling render() manually.
     *
     * @param service   A SplunkJS SDK Service object.
     *
     * @return An object with references to the user, panels, inputs,
     * and searches (by those name) as local objects.  Those objects
     * will not be populated.
     */
    
    var PaletteConfiguration = function(service) {
        var that = this;
        this.panels = new PanelrefList([],  {service: service});
        this.inputs = new InputrefList([],  {service: service});
        this.searches = new SearchrefList([], {service: service});
        this.app = sharedModels.get('app');
        this.user = sharedModels.get('user');
        this.roles = sharedModels.get('roles');
        return this;
    };

    /**
     * Start all of the initial configuration downloads.
     *
     * @param callback (optional) A callback for flow control.  The
     * callback will receive four arguments, the user, panels, inputs
     * and searches objects, after instantiation.
     * 
     * @returns A promise that, when resolved, contains the same
     * arguments as those passed to the callback.
     *
     * TODO: This is happy-path stuff.  Handle any error conditions.
     */

    PaletteConfiguration.prototype.start = function(callback) {
        var that = this;
        var dfd = $.Deferred();
        $.when.apply(null, [this.roles.dfd,
                            this.user.dfd,
                            this.app.dfd,
                            this.panels.fetch(), 
                            this.inputs.fetch(), 
                            this.searches.fetch()])
            .then(
                function() {
                    that.userName = that.user.entry.get('name');
                    dfd.resolve(that.user, that.panels, that.inputs, that.searches);
                    if (callback) {
                        callback(that.user, that.panels, that.inputs, that.searches);
                    }
                });
        return dfd;
    };

    return PaletteConfiguration;
});
