/*global define */
define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var PalettePageConfiguration = require('./palette_page_configuration');
    var sdk = require('splunkjs/splunk');
    var Backbone = require('backbone');
    var splunk_util = require('splunk.util');
    var sharedModels = require('./palette-shared-models');
    var splunkd_utils = require('util/splunkd_utils');

    var appRoot = splunk_util.getConfigValue('DJANGO_ROOT_PATH', 'dj/');
    var paletteUrl = appRoot + '/splunk_app_windows_infrastructure/palette/';
    var currentUser = sharedModels.get('user');

    var ExistingPalettePageConfiguration = function(features) {
        PalettePageConfiguration.apply(this, arguments);
    };

    _.extend(ExistingPalettePageConfiguration.prototype, PalettePageConfiguration.prototype, Backbone.Events, {
        _canAdminAll: function() { 
            return _.indexOf(currentUser.entry.content.get('capabilities'), 'admin_all_objects') !== -1;
        },

        _userIsOwnerOrAdmin: function() {
            return ((this._canAdminAll()) ||
                    this.acls.get('owner') == currentUser.entry.get('name'));
        },

        _userHasWritePermission: function() {
            var acls = (this.acls.get('perms') && this.acls.get('perms').write) || ['*'];
            var roles = currentUser.entry.content.get('roles') || [];
            return ((this._canAdminAll()) ||     // Admin always has write permission
                    (_.contains(acls, '*')) || 
                    (_.intersection(roles, acls).length > 0));
        },

        _isUserGeneratedContent: function() {
                return (! this.properties.get('isDefault'));
        },

        _pageIsWriteable: function() {
            return (this.acls.get('can_write') && 
                    this._userHasWritePermission()) || false;
        },

        canWrite: function() {
            return (this._pageIsWriteable() && 
                    this._userIsOwnerOrAdmin() &&
                    this._isUserGeneratedContent());
        },

        canPerm: function() {
            return (this._canAdminAll() && 
                    this._isUserGeneratedContent() && 
                    this._pageIsWriteable());
        },

        setDirty: function(cond) {
            cond = _.isUndefined(cond) ? true : cond;
            this.dirty = cond;
            this.trigger(cond ? 'dirty' : 'clean');
        },

        stanzaForUpdate: function() {
            var stanza = new sdk.Service.ConfigurationStanza(this.service(), 'palettepalettes', this.stanza.name, {
                app: this.stanza.acl().app, 
                owner: this.stanza.acl().owner, 
                sharing: this.stanza.acl().sharing
            });
            stanza._load(this.stanza);
            return stanza;
        },

        save: function() {
            var dfd = $.Deferred();
            var that = this;
            var stanza = this.stanzaForUpdate();
            stanza.update(
                this.properties.toStanzaJson(), 
                function(err, palette) { 
                    if (err) {
                        return dfd.reject(err);
                    }

                    // Although the access rights shouldn't change
                    // duiring a properties update, this fetch always
                    // returns a new stanza and we *know* it has the
                    // right permissions for future updates, do the
                    // fetch and keep the stanza anyway.  That's how
                    // Core does it.

                    $.when(that._fetch(that.paletteName(), that.service(), that.namespace))
                        .done(function(stanza) {
                            that.stanza = stanza;
                            that.dirty = false;
                            return dfd.resolve(that);
                        })
                        .fail(function(error) { dfd.reject(error, that); });
                    return dfd;
                }
            );
            return dfd;
        },
         
        saveAcls: function(acls, callback) {
            // If the namespace changes, we must also change the Stanza's namespace.

            var dfd = $.Deferred();
            var that = this;

            var stanza = this.stanzaForUpdate();
            var req = stanza.post("acl", acls, function(err, result) {
                if (err) { 
                    return dfd.reject(err); 
                }
                
                // Once the stanza has been updated, it's sharing may
                // have changed.  It is critical to fetch service-side
                // stanza using the requested sharing, to internalize
                // that new namespace, and to preserve that stanza for
                // future transactions.

                var namespaceWithNewSharing = _.extend({}, that.namespace, { sharing: acls.sharing });
                $.when(that._fetch(that.paletteName(), that.service(), namespaceWithNewSharing))
                    .done(function(stanza) {
                        that.namespace = _.pick(stanza.acl(), ['app', 'owner', 'sharing']);
                        that.stanza = stanza;
                        that.acls.set(that.stanza.acl());
                        if (callback) { callback.apply(arguments); }
                        return dfd.resolve(result);
                    })
                    .fail(function(error) { 
                        return dfd.reject(error);
                    });
                return dfd;
            });
            return dfd;
        },

        paletteUrl: function() {
            if (! (this.stanza && this.stanza.name)) {
                return '';
            }
            return paletteUrl + this.stanza.name;
        },

        deleteEntity: function() {
            var dfd = $.Deferred();
            var stanza = this.stanzaForUpdate();
            stanza.del("", {}, function() { 
                dfd.resolve([this].concat(Array.prototype.slice.call(arguments, 0)));
            });
            return dfd;
        }
    });

    var NewPalettePageConfiguration = function(features) {
        PalettePageConfiguration.apply(this, arguments);
    };

    _.extend(NewPalettePageConfiguration.prototype, ExistingPalettePageConfiguration.prototype, Backbone.Events, {

        save: function(options) {
            var that = this;
            var dfd = $.Deferred();

            var temporaryPalette = new ExistingPalettePageConfiguration({service: this.options.service});
            $.when(temporaryPalette.fetch({about: this.properties.get('name')})).then(
                function() { return dfd.reject(_("A Palette Page with that ID already exists").t()); },
                function() {
                    // Always save new pages in the context of the current user.
                    var user = sharedModels.get('user').entry.get('name');
                    that.options.service = that.options.service.specialize(user, 'splunk_app_windows_infrastructure');
                    
                    var stanza = new sdk.Service.ConfigurationFile(
                        that.options.service, 'palettepalettes', {
                            owner: user,
                            sharing: splunkd_utils.USER
                        });
                    
                    stanza.create(that.properties.get('name'), that.properties.toStanzaJson(), function(err, stanza) {
                        if (err) { 
                            return dfd.reject(err); 
                        }
                        that.stanza = stanza;
                        that.options.about = stanza.name;
                        
                        // Users without this permission cannot access the ACL endpoint.
                        if (! that._canAdminAll()) {
                            that.dirty = false;
                            return dfd.resolve(that);
                        }
                        
                        $.when(that.acls.save()).then(function() {
                            that.dirty = false;
                            return dfd.resolve(that);
                        });
                        return dfd.promise();
                    });
                });
            return dfd;
        },
        
        fetch: function() {
            throw new Error("Not Implemented.");
        },
        
        isNew: function() {
            return true;
        },

        canWrite: function() { 
            return true; 
        },

        canPerm: function() { 
            return _.indexOf(currentUser.entry.content.get('capabilities'), 'admin_all_objects') !== -1;
        }
    });
    
    return function(service, isnew) {
        var whichClass = isnew ? NewPalettePageConfiguration : ExistingPalettePageConfiguration;
        return new whichClass({service: service});
    };
});

