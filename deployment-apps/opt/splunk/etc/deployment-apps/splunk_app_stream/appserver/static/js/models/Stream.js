define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/Field",
    "app-js/models/Filters",
    "app-js/models/Extras",
    "splunk.util"
], function(
    $,
    _,
    Backbone,
    Field,
    Filters,
    Extras,
    splunk_util
    ) {
    return Backbone.Model.extend({
        // See splunk_app_stream/package/default/stream_schema for definition of Stream structure.

        clone: function() {
            // Start with a shallow clone of 'this'.
            var deepClone = Backbone.Model.prototype.clone.call(this);

            // Now make it a deep clone, by making a deep copy of the attributes.
            deepClone.set($.extend(true, {}, this.attributes));

            return deepClone;
        },

        urlRoot: Splunk.util.make_url([
            "custom",
            "splunk_app_stream",
            "streams"
        ].join('/')),

        setStreamMode: function (mode) {

            var deferred = $.Deferred();
            var url;

            if (mode === "enable") {

                //latestEnableTime field needs to be updated for packet streams
                if (this.get('isPacketStream')) {
                    var unixTime = parseInt(new Date().getTime() / 1000);
                    this.save({
                        enabled: true,
                        latestEnableTime: unixTime
                    }, {
                        success: function (model) {
                            deferred.resolve({success: true, value: model});
                        },
                        error: function (error) {
                            deferred.resolve({success: false, value: error});
                        }
                    });
                    return deferred;
                }

                url = Splunk.util.make_url(["custom", "splunk_app_stream", "streams", this.get('id'), "enable"].join('/'));
            }
            else if (mode === "disable") {
                url = Splunk.util.make_url(["custom", "splunk_app_stream", "streams", this.get('id'), "disable"].join('/'));
            }
            else if (mode === "estimate") {
                url = Splunk.util.make_url(["custom", "splunk_app_stream", "streams", this.get('id'), "statsOnly"].join('/'));
            } else {
                return false;
            }

            $.ajax({
                type: "PUT",
                url: url,
                dataType: 'json',
                success: function (model) {
                    deferred.resolve({success: true, value: model});
                },
                error: function (error) {
                    deferred.resolve({success: false, value: error});
                }
            });

            return deferred;
        },

        deleteStream: function () {
            var deferred= $.Deferred();
            //each individual destroy takes ~3s.
            //Bottlenecked by backend, hopefully user doesn't bulk delete alot...
            this.destroy({
                success: function (model) {
                    deferred.resolve({success: true, value: model});
                },
                error: function (model, error) {
                    deferred.resolve({success: false, value: error});
                },
                wait: true
            })
            return deferred;
        },

        defaults: {
            id: "",
            streamType: "event",
            name: '',
            enabled: true,
            aggregated: false,
            extras: {},
            fields: [],
            index: null,

            // TODO: The Stream model should use the Filters model, e.g.
            // filters: new Filters()
            // However, this will require some research on how to handle nested models.
            filters: {matchAllComparisons: true, comparisons: []}
        },
        validate: function (attributes) {
            if (!attributes.id) {
                return 'Please specify a name for the new stream.';
            }
            if (!attributes.id.match(/^\w+$/)) {
                return "Please specify a name using only letters, digits and underscores ('_').";
            }
            return false;
        }
    });
});
