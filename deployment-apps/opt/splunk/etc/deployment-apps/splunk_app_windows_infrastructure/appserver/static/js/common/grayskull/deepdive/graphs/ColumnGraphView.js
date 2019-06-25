define(["underscore", "jquery", "backbone", "common/grayskull/common/contrib/d3/d3.amd", "common/grayskull/deepdive/graphs/BaseGraphView", "common/grayskull/deepdive/DeepDiveUtils"], 
	function (_, $, Backbone, d3, BaseGraphView, deepDiveUtils) {
		
		/**
		 * Renders a column graph
		 */
		var ColumnGraphView = BaseGraphView.extend({
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
			 * compute the extent of the range data. range data is defined from the lane settings
			 * @param {Array} fields the fields associated with the rows
			 * @param {Array} rows the data from the dataManager
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
			
			
			/**
			 * render the data from the data manager into a series of columns.
			 * key assumptions in the rendering are:
			 * -> a single data point represents the value over a period starting with the timestamp and ending timestamp + span
			 * -> all data points have the same span
			 * -> we set a minimum column width of 14px, we want a gap of 1px between columns #TODO: this needs to be set at a span level
			 * @param {Array} fields the fields associated with the rows
			 * @param {Array} rows the data from the dataManager
			 * @param {d3.scale} timeScale the scale to use when rendering the domain (_time)
			 * @param {d3.scale} yScale the scale to use when rendering the range (y-axis)
			 */
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
						//debugger;
						console.log("this ends badly");
					}
					return that.chartController.timeScale(parseFloat(d[timeIndex])); };
				var yScaleMapping = function(d) { return that.chartController.yScale(parseFloat(d[yIndex])); };
				var heightMapping = function(d) { return heightMax - that.chartController.yScale(parseFloat(d[yIndex])); };
				
				var span = deepDiveUtils.getSpan(fields, rows);
				// Calculate column width based on total domain and the columns to render within it
				var columnWidth = ((this.chartController.timeScale(this.timeExtent[1]) - this.chartController.timeScale(this.timeExtent[0])) / rows.length) - 1;
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
					.attr("x", xScaleMapping)
					.attr("width", columnWidth)
					.attr("y", yScaleMapping)
					.attr("height", heightMapping);
				
				// Remove old marker elements
				columns.exit().remove();
			}
		});
		
		return ColumnGraphView;
	}
);