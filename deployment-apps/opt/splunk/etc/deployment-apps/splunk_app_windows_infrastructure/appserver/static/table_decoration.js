require([
    'underscore',
    'jquery',
    'splunkjs/mvc',
    'splunkjs/mvc/tableview',
    'splunkjs/mvc/simplexml/ready!'
], function(_, $, mvc, TableView) {
    var ICONS = {
        False: 'x',
        True: 'check'
    };
    var tables = ['decorated_table', 'topology_table'];

    var RangeMapIconRenderer = TableView.BaseCellRenderer.extend({
        canRender: function(cell) {
            return ['True', 'False'].indexOf(cell.value) > -1;
        },
        render: function($td, cell) {
            if (ICONS.hasOwnProperty(cell.value)) {
                icon = ICONS[cell.value];
                $td.addClass('icon').html(_.template('<i class="icon-<%-icon%> <%- value %>" title="<%- value %>"></i>', {
                    icon: icon,
                    value: cell.value
                }));
            }
        }
    });

    _.each(tables, function(table) {
        if (!mvc.Components.get(table)) return;
        mvc.Components.get(table).getVisualization(function(tableView){
            tableView.addCellRenderer(new RangeMapIconRenderer());
        });
    });
});
