/*global define */
define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var mvc = require('splunkjs/mvc');
    var sdk = require('splunkjs/splunk');
    var Backbone = require('backbone');
    var sharedModels = require('splunkjs/mvc/sharedmodels');

    var UserPreferences = Backbone.Model.extend({
        /**
         * An abstraction of the .conf system that allows for easy(!)
         * definition of stanzas and filenames.  This is a Backbone
         * model; it emits the expected 'change' and 'error' events.
         */

        initialize: function(attrs, options) {
            /**
             * @param {options.file} The user's conf file to which to
             *     write the stanza.
             * @param {options.stanza} The stanza name
             * @param {options.field} (optional) A dictionary of
             *     expected field names in the stanza and how the
             *     value side of the conf file should be
             *     parsed. Currently supports 'text' (default) and
             *     'json'
             */
            var defoptions = {
                user: sharedModels.get('user').entry.get('name'),
                app: sharedModels.get('app').get('app')
            };
            this.options = _.extend({}, defoptions, _.pick(options, ['file', 'stanza', 'fields']));
            if ((!this.options.file) || (!this.options.stanza)) {
                throw new Error('A file and stanza is required.');
            }
            this.namespace = {
                app: this.options.app,
                owner: this.options.user
            };
            this.service = this.options.service || mvc.createService(this.namespace);
        },

        parse: function(resp, options) {
            var fields = this.options.fields;
            var convert = function(val, key) {
                if (_.isUndefined(fields[key])) {
                    return [key, val];
                }
                switch (fields[key]) {
                    case 'json': return [key, JSON.parse(val)]; break;
                    default: break;
                }
                return [key, val];
            };

            /* Because we're not supporting ACLs or change of
             * application or user, we take these out and let SplunkD
             * reassert them with the defaults upon write.  This lets
             * our model be a representation of the stanza
             * uncontaminated by .conf accounting details.
             */
            var noEai = function(k) { 
                return (! _.contains(['disabled', 'eai:acl', 'eai:appName', 'eai:userName'], k));
            };

            return _.chain(resp)
                .map(convert)
                .filter(noEai)
                .object()
                .value();
        },

        toJSON: function() {
            var fields = this.options.fields;
            var attributes = Backbone.Model.prototype.toJSON.apply(this, arguments);
            return _.object(_.map(attributes, function(val, key) {
                if (_.isUndefined(fields[key])) {
                    return [key, val];
                }
                switch (fields[key]) {
                    case 'json': return [key, JSON.stringify(val)]; break;
                    default: break;
                }
                return [key, val];
            }));
        },

        fetch: function(options) {
            var that = this;
            var dfd = $.Deferred();
            options = options ? _.clone(options) : {};
            
            var requestStanza = new sdk.Service.ConfigurationStanza(
                this.service,
                this.options.file,
                this.options.stanza, 
                this.namespace);
            
            requestStanza.fetch(function(err, resp) {
                if (err) { 
                    that.trigger('error', that, err, options);
                    return dfd.reject(err); 
                }
                if (!that.set(that.parse(resp._properties, options), options)) {
                    that.trigger('error', that, err, options);
                    return dfd.reject("Parse failed", resp);
                }
                return dfd.resolve(resp);
            });
            return dfd.promise();
        },

        save: function(key, val, options) {
            var dfd = $.Deferred();
            var that = this;
            var attrs;

            if (key == null || typeof key === 'object') {
                attrs = key;
                options = val;
            } else {
                (attrs = {})[key] = val;
            }

            options = _.extend({validate: true}, options);
            if (! _.isNull(attrs)) {
                this.set(attrs, options);
            }

            var stanza = new sdk.Service.ConfigurationStanza(
                this.service, 
                this.options.file, 
                this.options.stanza,
                this.namespace);
            
            var content = this.toJSON();

            /* The very annoying two-step of having SplunkD inform you
             * that no such configuration file exists to which you can
             * write your data, so go through the second-stage
             * operation of creating a new file/stanza pair.
             */
            stanza.update(content, function(err, written) { 
                if (err) {
                    if (err.status != 404) {
                        that.trigger('error', that, err, options);
                        dfd.reject(err); // Failed update.
                        return;
                    }

                    var newFile = new sdk.Service.ConfigurationFile(
                        that.service, that.options.file, that.namespace);

                    newFile.create(that.options.stanza, content, function(err, newstanza) {
                        if (err) { 
                            that.trigger('error', that, err, options);
                            dfd.reject(err);
                            return;
                        }
                        dfd.resolve(true); // Successful create.
                    });
                }
                dfd.resolve(true); // Succesful update
            });
            return dfd.promise();
        }
    });

    return UserPreferences;
});
