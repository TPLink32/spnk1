/*
 * Implementation for a model for each item in a list control
 */

define([
        'backbone'
        ],
        function(
            Backbone
            )
{   
    var listItemModel = Backbone.Model.extend({
        idAttribute: 'itemId',
        
         /**
          * Default setting values
          * This also acts as the catalog of valid settings
          * @protected
          */
        defaults: {
            itemId: null,
            itemHtml: null
        }
    });
    
    return listItemModel;
});