require([
'underscore',
'jquery',
'splunkjs/mvc',
'splunkjs/mvc/tableview',
'splunkjs/mvc/simplexml/ready!'
], function(_, $, mvc, TableView) {

// Translations from rangemap results to CSS class
var ICONS = {
severe: 'alert-circle',
elevated: 'alert',
low: 'check-circle'
};

var RangeMapIconRenderer = TableView.BaseCellRenderer.extend({
canRender: function(cell) {
// Only use the cell renderer for the range field
return cell.field === 'Status';
},
render: function($td, cell) {
var icon = 'question';
//debugger;
if (!(cell.value instanceof Array)) {
console.log("data is array, lets fix it");
cell.value = cell.value.split("##");
}
console.log("dataset is: ", cell.value)

for (var v in cell.value) {
 
if (cell.value.hasOwnProperty(v)) {
val = cell.value[v];
// Fetch the icon for the value
if (ICONS.hasOwnProperty(val)) {
icon = ICONS[val];
}
var needsBreak = (v == cell.value-1) ? "":"<br />";
// Create the icon element and add it to the table cell
$td.addClass('icon').append(_.template('<i class="icon-<%-icon%> <%- range %>" title="<%- range %>"></i>', {
icon: icon,
range: val
}) + needsBreak);
}
}
}
});

mvc.Components.get('feed_status').getVisualization(function(tableView){
// Register custom cell renderer
tableView.table.addCellRenderer(new RangeMapIconRenderer());
// Force the table to re-render
tableView.table.render();
});

});
