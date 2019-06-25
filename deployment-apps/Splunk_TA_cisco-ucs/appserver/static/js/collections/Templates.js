define([
    'jquery',
    'underscore',
    'backbone',
    "splunk.util",
    'app/models/Template'],
function(
    $,
    _,
    Backbone,
    splunkdUtils,
    Template
) {
    return Backbone.Collection.extend({
        url: splunkdUtils.make_url('custom/Splunk_TA_cisco-ucs/manage_templates/templates'),
        model: Template

    });
});


