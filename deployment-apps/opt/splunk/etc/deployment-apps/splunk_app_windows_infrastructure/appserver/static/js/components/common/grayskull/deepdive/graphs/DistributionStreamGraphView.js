define(["underscore", "jquery", "backbone", "app-contrib/d3/d3.amd", "app-components/deepdive/graphs/BaseGraphView", "app-components/deepdive/DeepDiveUtils"], 
	function (_, $, Backbone, d3, BaseGraphView, deepDiveUtils) {
		
		/**
		 * Renders an area graph
		 */
		var DistributionStreamGraphView = BaseGraphView.extend({
			//
			// Overrides of Backbone Methods
			//
			/**
			 * Overload to setup anything initially required by the graph
			 * @public
			 */
			render: function() {
				var d3stage = d3.select(this.$el.get(0));
				
				d3stage.append("path")
					.attr("class", "distribution-stream-graph-outer")
					.attr("fill", "blue");
				d3stage.append("path")
					.attr("class", "distribution-stream-graph-inner")
					.attr("fill", "steelblue");
				
				return this;
			},
			
			/**
			 * compute the extent of the range data. 
			 * range data is statically defined as the upper_extreme and lower_extreme fields
			 * @param {Array} fields the fields associated with the rows
			 * @param {Array} rows the data from the dataManager
			 */
			getYExtent: function(fields, rows) {
				var that = this;
				var upperExtremeIndex = _.indexOf(fields, "upper_extreme");
				var lowerExtremeIndex = _.indexOf(fields, "lower_extreme");
				
				var yExtent = [
					d3.min(rows, function(d) { return deepDiveUtils.isNum(d[lowerExtremeIndex]) ? Number(d[lowerExtremeIndex]) : undefined; }), 
					d3.max(rows, function(d) { return deepDiveUtils.isNum(d[upperExtremeIndex]) ? Number(d[upperExtremeIndex]) : undefined; })
				];
				
				return yExtent;
			},
			
			/**
			 * get the index at which the yValue can be found in the data, the median of the data
			 * @param {Array} fields the fields associated with the rows
			 * @public
			 */
			getYIndex: function(fields) {
				return _.indexOf(fields, "center");
			},
			
			/**
			 * render the data from the data manager into a distribution stream
			 * @param {Array} fields the fields associated with the rows
			 * @param {Array} rows the data from the dataManager
			 * @param {d3.scale} timeScale the scale to use when rendering the domain (_time)
			 * @param {d3.scale} yScale the scale to use when rendering the range (y-axis)
			 */
			renderGraph: function(fields, rows, timeScale, yScale) {
				/*
				 * Our data must have the following fields:
				 * -> lower_quartile - defines the lower boundary of the inner stream
				 * -> upper_quartile - defines the upper boundary of the inner stream
				 * -> lower_extreme - defines the lower boundary of the outer stream
				 * -> upper_extreme - defines the upper boundary of the outer stream
				 * -> center - defines the centerline of the stream (median)
				 * -> _time - defines the time axis/domain of the data
				 */
				
				//Get the fields we care about
				var timeIndex = _.indexOf(fields, "_time");
				var upperQuartileIndex = _.indexOf(fields, "upper_quartile");
				var lowerQuartileIndex = _.indexOf(fields, "lower_quartile");
				var upperExtremeIndex = _.indexOf(fields, "upper_extreme");
				var lowerExtremeIndex = _.indexOf(fields, "lower_extreme");
				
				//Transform the row data into the unique streams
				var innerStreamData = [];
				var outerStreamData = [];
				var ii, row, datum, t, y0, y1;
				for (ii = 0; ii < rows.length; ii++) {
					row = rows[ii];
					t = row[timeIndex];
					
					y0 = row[lowerQuartileIndex];
					y1 = row[upperQuartileIndex];
					if (deepDiveUtils.isNum(t) && deepDiveUtils.isNum(y0) && deepDiveUtils.isNum(y1)) {
						innerStreamData.push([Number(t), Number(y0), Number(y1)]);
					}
					
					y0 = row[lowerExtremeIndex];
					y1 = row[upperExtremeIndex];
					if (deepDiveUtils.isNum(t) && deepDiveUtils.isNum(y0) && deepDiveUtils.isNum(y1)) {
						outerStreamData.push([Number(t), Number(y0), Number(y1)]);
					}
				}
				
				var chartController = this.chartController;
				var area = d3.svg.area()
					.x(function(d) { return chartController.timeScale(d[0]); })
					.y0(function(d) { return chartController.yScale(d[1]); })
					.y1(function(d) { return chartController.yScale(d[2]); });
				
				var d3stage = d3.select(this.$el.get(0));
				
				d3stage.select("path.distribution-stream-graph-outer")
					.datum(outerStreamData)
					.attr("d", area)
					.attr("opacity", 1);
				
				d3stage.select("path.distribution-stream-graph-inner")
					.datum(innerStreamData)
					.attr("d", area)
					.attr("opacity", 1);
			}
		});
		
		return DistributionStreamGraphView;
	}
);