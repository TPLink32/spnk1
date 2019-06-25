define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/MountPoint",
    "splunk.util"
], function(
    $,
    _,
    Backbone,
    MountPoint,
    splunk_util
    ) {
    return Backbone.Collection.extend({
        model: MountPoint,
        url: Splunk.util.make_url([
            "custom",
            "splunk_app_stream",
            "fileservermountpoints"
        ].join('/')),
        comparator: "id"
    });
});
