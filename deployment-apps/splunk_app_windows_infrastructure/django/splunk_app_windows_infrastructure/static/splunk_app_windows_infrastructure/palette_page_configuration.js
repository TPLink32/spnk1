/*global define */
define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var sdk = require('splunkjs/splunk');
    var Backbone = require('backbone');
    var PalettePageValidations = require('./palette_page_validations');
    var AclReadOnlyModel = require('models/ACLReadOnly');
    var splunkd_utils = require('util/splunkd_utils');
    var sharedModels = require('./palette-shared-models');

    var PropertiesModel = PalettePageValidations.extend({
        defaults: {
            title: "",
            description: "",
            name: "",
            panels: []
        },

        initialize: function(attributes, options) {
            this.options = options || {};
            this.errors = [];
            this.parent = this.options.parent;
        },

        isNew: function() { 
            return this.parent.isNew();
        },

        // PropertiesModel::panels should always and without
        // confusion be an array of arrays of Panel.about strings.

        set: function(key, val, options) {
            var attrs;

            if (_.isNull(key)) 
                return this;
            
            if (_.isObject(key)) {
                attrs = key;
                options = val;
            } else {
                (attrs = {})[key] = val;
            }

            if (attrs.hasOwnProperty('panels')) {
                if (_.isString(attrs.panels)) {
                    attrs.panels = JSON.parse(attrs.panels);
                }
            }
            return Backbone.Model.prototype.set.apply(this, [attrs, options]);
        },

        save: function() {
            return this.parent.save.apply(this.parent, arguments);
        },

        toStanzaJson: function() { 
            var json = _.omit(this.toJSON(), ['name', 'eai:appName', 'eai:userName']);
            json.panels = JSON.stringify(json.panels);
            return json;
        }
    });

    // The ACLs read schema is: {
    //    sharing: USER / APP / GLOBAL
    //    owner: <id token>
    //    perms: {
    //       read: [<id token>, ...]
    //       write: [<id token>, ...]
    //    }
    // }

    var extractRoleNames = function(roles) { 
        return roles.map(
            function(role) { 
                return role.entry.get('name'); 
            }
        );
    };


    var AclsModel = AclReadOnlyModel.extend({
        defaults: {
            sharing: splunkd_utils.USER
        },

        initialize: function(attributes, options) {
            options = options || {};
            AclReadOnlyModel.prototype.initialize.call(this, attributes, options);
            var canAdminAll = (_.indexOf(sharedModels.get('user').entry.content.get('capabilities'), 
                                         'admin_all_objects') !== -1);
            if (!attributes.app) { 
                this.set('app', sharedModels.get('app').get('app'));
            }
            if (!attributes.owner) { 
                this.set('owner', sharedModels.get('user').entry.get('name'));
            }
            if (!attributes.can_share_user) {
                this.set('can_share_user', canAdminAll);
            }
            if (!attributes.can_share_app) {
                this.set('can_share_app', canAdminAll);
            }
            this.parent = options.parent;
            this.roles = sharedModels.get('roles');
            this.roleNames = extractRoleNames(this.roles);
        },

        permsToObj: function() {
            var perms = this.get('perms') || {};
            perms.read = perms.read || [];
            perms.write = perms.write || [];
            return perms;
        },

        // The ACLPerms controls have their own internal
        // representation.

        toControlPermsObject: function() {
            var perms = this.permsToObj();
            var initialRoles = {
                'Everyone.read': _.indexOf(perms.read, '*') != -1,
                'Everyone.write': _.indexOf(perms.write, '*') != -1
            };
            function setRoles(m, roleName) {
                m[roleName + '.read'] = _.indexOf(perms.read, roleName) != -1;
                m[roleName + '.write'] = _.indexOf(perms.write, roleName) != -1;
                return m;
            }
            return _.reduce(this.roleNames, setRoles, initialRoles);
        },

        setWithPerms: function(attrs, perms) {
            var that = this;

            // In any programming language with closure, classes are
            // pure syntactic sugar.
            var usersHaveRole = function(role) { 
                return function(roleName) { return !!perms[roleName + '.' + role]; };
            };

            var change_Everyone_ToSplat = function(n) { 
                return n === 'Everyone' ? '*' : n; 
            };

            var getPermsFor = function(role) { 
                return (_.chain(that.roleNames.concat(['Everyone']))
                        .filter(usersHaveRole(role))
                        .map(change_Everyone_ToSplat).value());
            };

            var getPerms = function() {
                return { 
                    "perms": {
                        "read": getPermsFor('read'),
                        "write": getPermsFor('write') 
                    }
                };
            };

            return AclReadOnlyModel.prototype.set.call(this, _.extend({
                sharing: attrs.sharing,
                owner: attrs.owner
            }, attrs.sharing === splunkd_utils.USER ? {} : getPerms()));
        },

        save: function(attrs, perms) {
            if (attrs) { this.setWithPerms(attrs, perms); }

            var toParentWriteObject = this.toJSON();
            if (toParentWriteObject.perms) {
                toParentWriteObject['perms.read'] = toParentWriteObject.perms.read.join(',');
                toParentWriteObject['perms.write'] = toParentWriteObject.perms.write.join(',');
            }
            toParentWriteObject = _.pick(toParentWriteObject, 
                                         ['perms.read', 'perms.write', 'sharing', 'owner']);
            return this.parent.saveAcls(toParentWriteObject);
        }
    });

    var PalettePageConfiguration = function(features) {
        this.options = _.pick(features, ['user', 'service', 'about']);
        this.dirty = false;
        // Properties and ACLs are maintained as separate observables.
        this.properties = new PropertiesModel(features.properties || {}, {parent: this});
        this.acls = new AclsModel({}, {parent: this});
        this.stanza = null;
        this.properties.on('change', this.setDirty, this);
        this.namespace = {};
    };

    _.extend(PalettePageConfiguration.prototype, Backbone.Events, {
        paletteName: function() {
            return this.options.about;
        },

        service: function() {
            return this.options.service;
        },

        app: function() {
            return this.service().app;
        },
        
        isNew: function() {
            return false;
        },

        // Given a palette stanza name, a valid service object, and a
        // valid namespace object, return a promise that resolves to
        // an [err, stanza] message.

        _fetch: function(palette, service, namespace) {
            var that = this;
            var dfd = $.Deferred();
            var requestStanza = function() {
                return new sdk.Service.ConfigurationStanza(
                    service,
                    'palettepalettes', 
                    palette,
                    namespace
                );
            };
            requestStanza().fetch(function(err, stanza) {
                if (err) { 
                    return dfd.reject(err); 
                }
                return dfd.resolve(stanza);
            });
            return dfd;
        },

        // Fetch is generally called only once, at page load.  It
        // represents the start of the page's lifespan.

        fetch: function(options) {
            if (options && options.about) {
                this.options.about = options.about;
            }

            var mdfd = $.Deferred();
            var that = this;

            // Given a namespace, get the "most specific" stanza for
            // this configuration to which that namespace refers.

            var getSpecificStanza = function(namespace) {
                return that._fetch(that.paletteName(), that.service(), namespace);
            };

            var whenFetchFails = function(error) {
                that.trigger('pageNotFound');
                mdfd.reject(error);
                return;
            };

            // Once we have the best possible stanza, record the
            // actual details of this configuration object, including
            // its satellite Property and ACLs models, keep the stanza
            // for future updates and interaction, and notify
            // observers that the configuration is complete.

            var configurePage = function(stanza) {
                that.namespace = _.pick(stanza.acl(), ['app', 'owner', 'sharing']);

                that.properties.set(_.extend(stanza.properties(), 
                                             {name: that.paletteName()}));

                if (_.isEqual(stanza.properties()['panels'], [])) { 
                    that.properties.trigger('change:panels'); 
                }

                that.acls.set(stanza.acl());
                that.stanza = stanza;
                that.dirty = false;
                that.trigger('change', that);
                mdfd.resolve(that);
            };
                
            // A waterfall, from requesting the most general stanza,
            // to getting the most specific stanza a second time with
            // the current owner.  This works around
            // splunk.js/Entity's cache of the "qualified" URL, which
            // prevented access to the most specific stanza.

            $.when(getSpecificStanza({owner: '-', app: this.app()}))
                .done(function(firststanza) {
                    var owner = firststanza.acl().owner;
                    $.when(getSpecificStanza({owner: owner, app: that.app()}))
                        .done(configurePage)
                        .fail(function() { configurePage(firststanza); });  
                })
                .fail(whenFetchFails);
            
            return mdfd;
        }
    });

    return PalettePageConfiguration;
});

