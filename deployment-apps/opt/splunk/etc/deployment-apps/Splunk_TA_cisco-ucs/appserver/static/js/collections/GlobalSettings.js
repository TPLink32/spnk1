define([
    'jquery',
    'underscore',
    'backbone',
    "splunk.util",
    'app/models/GlobalSetting'],
function(
    $,
    _,
    Backbone,
    splunkdUtils,
    GlobalSetting
) {
    return Backbone.Collection.extend({
        url: splunkdUtils.make_url('custom/Splunk_TA_cisco-ucs/manage_global_settings/global_settings'),
        model: GlobalSetting

    });
});


