/*
 * Implementation for a collection for list items
 */

define([
        'backbone',
        'common/customvisualizations/listpickercontrol/listitemmodel',
        ],
        function(
            Backbone,
            ListItemModel
            )
{   
    var listItemCollection = Backbone.Collection.extend({
        model: ListItemModel
    });
    
    return listItemCollection;
});