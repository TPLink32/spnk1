define(["underscore", "jquery", "backbone", "common/grayskull/common/contrib/d3/d3.amd", "common/grayskull/deepdive/graphs/BaseGraphView"], 
	function (_, $, Backbone, d3, BaseGraphView) {
		
		/**
		 * Renders a line graph
		 */
		var LineGraphView = BaseGraphView.extend({
			//
			// Overrides of Backbone Methods
			//
			/**
			 * Overload to setup anything initially required by the graph
			 * @public
			 */
			render: function() {
				var d3stage = d3.select(this.$el.get(0));
				
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
			 * render the data from the data manager into a line
			 * @param {Array} fields the fields associated with the rows
			 * @param {Array} rows the data from the dataManager
			 * @param {d3.scale} timeScale the scale to use when rendering the domain (_time)
			 * @param {d3.scale} yScale the scale to use when rendering the range (y-axis)
			 */
			renderGraph: function(fields, rows, timeScale, yScale) {
				var chartController = this.chartController;
				var timeIndex = _.indexOf(fields, "_time");
				var yIndex = this.getYIndex(fields);
				
				var line = d3.svg.line()
					.x(function(d) { return chartController.timeScale(Number(d[timeIndex])); })
					.y(function(d) { return chartController.yScale(Number(d[yIndex])); });
				
				var d3stage = d3.select(this.$el.get(0));
				
				// Bind in our single row for now, will need to break up the data if we have multi-series
				var d3graphs = d3stage.selectAll("path.line-graph")
					.data([rows]);
				
				d3graphs.enter()
					.append("path")
					.attr("fill", "none")
					.attr("stroke-width", 2)
					.attr("class", "line-graph");
				
				d3graphs.attr("d", line)
					.attr("stroke", this.laneSettings.get("graphColor"))
					.attr("opacity", 1);
				
				d3graphs.exit().remove();
			}
		});
		
		return LineGraphView;
	}
);