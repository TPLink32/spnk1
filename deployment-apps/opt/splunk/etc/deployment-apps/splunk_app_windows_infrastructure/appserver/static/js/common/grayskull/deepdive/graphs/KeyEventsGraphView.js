/*global define*/
define([
    "underscore", 
    "jquery", 
    "backbone", 
    "common/grayskull/common/contrib/d3/d3.amd", 
    "common/grayskull/deepdive/graphs/BaseGraphView", 
    "common/grayskull/deepdive/DeepDiveUtils"], 

function (_, $, Backbone, d3, BaseGraphView, deepDiveUtils) {
        
    var KeyEventsView = BaseGraphView.extend({
        //
        // Overrides of Backbone Methods
        //
        /**
         * Overload to setup anything initially required by the graph
         * @public
         */
        render: function() {
            return this;
        },
        
        /**
         * render the data from the data manager into a series of heatmap tiles.
         * key assumptions in the rendering are:
         * -> a single data point represents the value over a period starting with the timestamp and ending timestamp + span
         * -> all data points have the same span
         * -> we set a minimum column width of 14px, we want a gap of 1px between columns #TODO: this needs to be set at a span level
         * @param {Array} fields the fields associated with the rows
         * @param {Array} rows the data from the dataManager
         * @param {d3.scale} timeScale the scale to use when rendering the domain (_time)
         * @param {d3.scale} yScale the scale to use when rendering the range (y-axis)
         */

        getYExtent: function(fields, rows) {
            var that = this;
            var yIndex = this.getYIndex(fields);
            var yExtent = d3.extent(rows, function(d) { 
                var yVal = d[yIndex];
                return that.isNum(yVal) ? Number(yVal) : undefined;
            });
            
            return yExtent;
        },

        renderGraph: function(fields, rows, timeScale, yScale) {
            var chartController = this.chartController;
            var timeIndex = _.indexOf(fields, "_time");
            var yIndex = this.getYIndex(fields);
            
            var d3stage = d3.select(this.$el.get(0));
            var color = this.laneSettings.get("graphColor");
            
            // Helper functions
            var that = this;
            var heightMax = this.chartController.yScale(this.yExtent[0]);

            var xScaleMapping = function(d) {
                if (isNaN(that.chartController.timeScale(parseFloat(d[timeIndex])))) {
                    console.log("Requested time index cannot map to current time scale.");
                }
                return that.chartController.timeScale(parseFloat(d[timeIndex])); };


            var span = deepDiveUtils.getSpan(fields, rows);
            // Calculate column width based on total domain and the columns to render within it
            var columnWidth = ((this.chartController.timeScale(this.timeExtent[1]) - 
                                this.chartController.timeScale(this.timeExtent[0])) / rows.length) - 1;
            if (columnWidth < 1) {
                columnWidth = 1;
            }
            
            // RENDER!!!!
            var columns = d3stage.selectAll("g.key-events-container")
                    .data(rows, function(d) { return d[timeIndex]; });

            // Remove old marker elements
            columns.exit().remove();

            // Create the new elements
            columns.enter().append("g").each(function(g) {
                var group = d3.select(this);

                if (parseInt(g[yIndex], 10) === 0) {
                    return;
                }

                group.attr("class", "key-events-container")
                    .attr('opacity', '1e-6');

                group.append('rect')
                    .attr("opacity", 1)
                    .attr("x", 3)
                    .attr("y", 8)
                    .attr("height", heightMax - 16)
                    .attr("width", columnWidth - 6)
                    .attr("fill", '#444444');
                
                group.append('rect')
                    .attr("x", 4)
                    .attr("y", 9)
                    .attr("height", heightMax - 18)
                    .attr("width", columnWidth - 8)
                    .attr("fill", color);

                group.append('text')
                    .attr('class', 'key-events-container-text')
                    .attr("font-family", "Roboto, Droid, 'Helvetica Neue', Helvetica, Arial, sans-serif;")
                    .attr("font-size", "16px")
                    .attr('font-weight', 'bold')
                    .attr('fill', '#444444')
                    .attr('text-anchor', 'middle')
                    .attr('y', (heightMax / 2) + 4)
                    .attr('x', (columnWidth / 2));
            });
            
            columns.each(function(g) {
                var group = d3.select(this);
                
                group.select('.key-events-container-text')
                    .text(String(parseInt(g[yIndex], 10)));
                
                group.attr('opacity', 1)
                    .attr("transform", 'translate(' + xScaleMapping(g) + ', 0)');
            });
        }
    });
    return KeyEventsView;
});
