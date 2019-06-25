define([
    'underscore',
    'backbone',
    'common/grayskull/common/contrib/d3/d3.amd',
    'common/grayskull/deepdive/DeepDiveUtils'
], function(
    _, 
    Backbone,
    d3,
    deepDiveUtils
) {

    var DeepDiveViewController = Backbone.Model.extend({
        defaults: {
            minPlotDomain: null,
            maxPlotDomain: null,
            minWindowedPlotDomain: null,
            maxWindowedPlotDomain: null,
            minOriginalPlotDomain: null,
            maxOriginalPlotDomain: null
        },

        initialize: function(attributes, options) {
            Backbone.Model.prototype.initialize.apply(this, arguments);

            Object.defineProperty(this, "timeAxisData", {
                get: _.bind(this._getTimeAxisData, this),
                enumerable: false
            });
        },

        /* 
         * All the data needed by a variety of features to accurately
         * display time, time ranges, and locations in a given lane.
         */
        _getTimeAxisData: function(laneContentWidth) {
            var minTime = this.get("minPlotDomain");
            var maxTime = this.get("maxPlotDomain");
            var epochScale = d3.scale.linear()
                    .domain([minTime, maxTime])
                    .range([0, laneContentWidth]);
            var windowDuration = maxTime - minTime;
            var windowDurationString = deepDiveUtils.formatTimeDuration(windowDuration);
            var timeExtent = [minTime, maxTime];
            var start = deepDiveUtils.convertEpochToDate(timeExtent[0]);
            var end = deepDiveUtils.convertEpochToDate(timeExtent[1]);
            var dateScale = d3.time.scale().domain([start, end]).range([0, laneContentWidth]);
            var axis = d3.svg.axis()
                    .scale(dateScale)
                    .ticks(6)
                    .innerTickSize(0)
                    .outerTickSize(0);

            return {
                laneWidth: laneContentWidth,
                axis: axis,
                dateScale: dateScale,
                maxTime: maxTime,
                minTime: minTime,
                windowDuration: windowDuration,
                windowDurationString: windowDurationString,
                epochScale: epochScale
            };
        }
    });

    return DeepDiveViewController;
});
