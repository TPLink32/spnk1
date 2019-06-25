define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/ForwarderGroup",
    "splunk.util"
], function(
    $,
    _,
    Backbone,
    ForwarderGroup,
    splunk_util
    ) {
    return Backbone.Collection.extend({
        model: ForwarderGroup,
        url: Splunk.util.make_url([
            "custom",
            "splunk_app_stream",
            "streamforwardergroups"
        ].join('/')),
        comparator: "id"
    });
});