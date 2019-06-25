define([
    "jquery",
    "underscore",
    "backbone"
], function(
    $,
    _,
    Backbone
    ) {
    return Backbone.Model.extend({
        initialize: function() {
          // example fields
          
          // "aggType": "key", 
          // "desc": "Server IP Address", 
          // "enabled": true, 
          // "name": "dest_ip", 
          // "term": "flow.s-ip"
        }
    });
});