define([
    "jquery",
    "underscore",
    "backbone",
    "splunk.util"
], function(
    $,
    _,
    Backbone,
    splunk_util
    ) {
    return Backbone.Model.extend({
        urlRoot: Splunk.util.make_url([
            "custom",
            "splunk_app_stream",
            "fileservermountpoints"
        ].join('/')),

        idAttribute: '_key',

        validate: function(attrs, options) {
            // TODO: possbily some validation could be done, but it's not obvious what it should be.
        }
    });
});
