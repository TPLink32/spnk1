define([
    "jquery",
    "underscore",
    "backbone",
    "app-js/models/Comparison"
], function(
    $,
    _,
    Backbone,
    Comparison
    ) {

    return Backbone.Collection.extend({
        model: Comparison,
    });
});