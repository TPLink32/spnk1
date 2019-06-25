/*global define*/
define([
    "underscore", 
    "jquery", 
    "backbone", 
    "common/grayskull/common/contrib/d3/d3.amd", 
    "common/grayskull/deepdive/graphs/BaseGraphView", 
    "common/grayskull/deepdive/DeepDiveUtils"
], function (_, $, Backbone, d3, BaseGraphView, deepDiveUtils) {
    
    /* Typenames for common things. */
    var Event = Backbone.Model.extend({});
    var Events = Backbone.Collection.extend({model: Event});

    /**
     * Renders a single rectangle of the heatmap
     */
    var EventView = Backbone.View.extend({
        classname: 'event',
        tagName: 'rect',
        hexMap: {
            blue: "#005ad5",
            yellow: " #fac51c",
            red: "#d85d3c",
            orange: "#f7902b",
            purple: "#956d95",
            green: "#9ac23c"
        },

        initialize: function(options) {
            this.options = options;
            _.extend(this, _.pick(this.options, ['offset', 'opacity', 'result', 'width', 'height', 'x', 'y']));
            this.parent_svg = d3.select(this.el);
            this.svg = this.parent_svg
                .append(this.tagName)
                .classed(this.className, true);
            this.el = this.svg[0][0];
            this.model.on('change:color', _.bind(this._onColorChange, this)); 
        },

        _onColorChange: function() {
            this.svg.attr('fill', this._colorToHex(this.model.get('color')));
        },

        _colorToHex: function(color) {
            return this.hexMap[color] ? this.hexMap[color] : "#005ad5";
        },

        render: function() {
            // TODO: stroke and stroke-width are reserved for future
            // 'select' feature.  MSAPP-2870.
            this.svg 
                .attr('x', this.x)
                .attr('y', this.y)
                .attr('height', this.height)
                .attr('width', this.width-1)
                .attr('fill-opacity', this.opacity)
                .attr('fill', this.colorToHex(this.model.get('color')))
                .attr('stroke', 'transparent')
                .attr('stroke-width', 0.7);
        },
    });

    var HeatMapGraphView = BaseGraphView.extend({
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
                    console.log("this ends badly");
                }
                return that.chartController.timeScale(parseFloat(d[timeIndex])); };

            var yScaleMapping = function(d) { return that.chartController.yScale(parseFloat(d[yIndex])); };
            var heightMapping = function(d) { return heightMax - that.chartController.yScale(parseFloat(d[yIndex])); };

            var fillMapping = function(d) { 
                var ySet = that.chartController.yScale(parseFloat(d[yIndex]));
                return isNaN(ySet) ? 0.0 : 1.0 - (ySet / heightMax);
            };

            var span = deepDiveUtils.getSpan(fields, rows);
            // Calculate column width based on total domain and the columns to render within it
            var columnWidth = ((this.chartController.timeScale(this.timeExtent[1]) - 
                                this.chartController.timeScale(this.timeExtent[0])) / rows.length) - 1;
            if (columnWidth < 1) {
                columnWidth = 1;
            }
            
            // RENDER!!!!
            var columns = d3stage.selectAll("rect.column-graph")
                    .data(rows, function(d) { return d[timeIndex]; });
            
            // Create the new elements
            columns.enter().append("rect")
                .attr("fill", color)
                .attr("stroke", color)
                .attr("stroke-width", 0)
                .attr("class", "column-graph");
            
            // Update existing elements
            columns.attr("fill", color)
                .attr("stroke", color)
                .transition()
                .attr('fill-opacity', fillMapping)
                .attr("x", xScaleMapping)
                .attr("width", columnWidth)
                .attr("y", 0)
                .attr("height", heightMax);

            // Remove old marker elements
            columns.exit().remove();
        }
    });
    return HeatMapGraphView;
});
