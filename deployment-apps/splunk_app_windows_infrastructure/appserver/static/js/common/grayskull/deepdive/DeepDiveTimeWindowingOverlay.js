define([
    'jquery',
    'underscore',
    'backbone',
    'common/grayskull/common/contrib/d3/d3.amd',
    'common/grayskull/deepdive/DeepDiveUtils'
], function(
    $, 
    _, 
    Backbone,
    d3,
    deepDiveUtils) {

    var DeepDiveTimeWindowingOverlay = function(overlay, details, controller) {
        this._overlay = overlay;
        this._overlayDetails = details;
        this._viewController = controller;
        this._active = false;
    };

    _.extend(DeepDiveTimeWindowingOverlay.prototype, Backbone.Events, {
        criteria: function() {
            return (! d3.event.shiftKey);
        },

        start: function(coordinates) {
            d3.event.preventDefault();
            this._active = true;
            
            var topOffset = 40;
            var laneHeight = 60;
            var laneWidth = this._overlayDetails.overlayWidth;
            var x = coordinates[0];

            var isInLanes = (coordinates[0] >= 1 && coordinates[0] <= laneWidth + 15 && 
                             coordinates[1] < this._overlayDetails.overlayHeight && coordinates[1] > 0);

            var isTimeAThingYet = (deepDiveUtils.isNum(this._viewController.get("minPlotDomain")) && 
                                   deepDiveUtils.isNum(this._viewController.get("maxPlotDomain")));

            if (! (isInLanes && isTimeAThingYet)) {
                this.cleanup();
            }

            // In chart area, set the window boundary
            var timeWindowMarkerStart = this._overlay.select(".time-window-container")
                    .selectAll(".time-window-marker-start")
                    .data([x]);
            
            timeWindowMarkerStart.enter()
                .append("rect")
                .attr("class", "time-window-marker-start time-window-marker")
                .attr("width", 1)
                .attr("fill", "#000000")
                .attr("x", x)
                .attr("y", 40);
            
            timeWindowMarkerStart.attr("height", this._overlayDetails.overlayHeight - 40);
            
            // Instantiate the window box
            var timeWindowBox = this._overlay.select(".time-window-container")
                    .selectAll(".time-window-marker-box")
                    .data([{startCoordinate: x}]);
            
            timeWindowBox.enter()
                .append("rect")
                .attr("class", "time-window-marker-box time-window-marker")
                .attr("width", 1)
                .attr("height", this._overlayDetails.overlayHeight - 40)
                .attr("opacity", 0.5)
                .attr("fill", "#DDDDDD")
                .attr("x", x)
                .attr("y", 40);
            
            timeWindowBox
                .attr("x", function(d) {
                    return (d.startCoordinate <= x) ? x : d.startCoordinate - (x - d.startCoordinate); })
                .attr("height", this._overlayDetails.overlayHeight - 40)
                .attr("width", function(d) {
                    return Math.abs(x - d.startCoordinate); });
        },

        move: function(coordinates) {
            this._overlay.select(".time-window-container")
                .selectAll(".time-window-marker-box")
                .attr("height", this._overlayDetails.overlayHeight - 40)
                .attr("x", function(d) {
                    if (d.startCoordinate < coordinates[0]) {
                        return d.startCoordinate;
                    }
                    else {
                        return coordinates[0];
                    }
                })
                .attr("width", function(d) {
                    return Math.abs(coordinates[0] - d.startCoordinate);
                });
        },
        
        isActive: function() { return this._active; },

        /**
         * mouseout handler for ending the time window
         * @private
         */
        end: function(coordinates) {
            var topOffset = 40;
            var laneHeight = 60; 
            var laneWidth = this._overlayDetails.overlayWidth;
            
            if (coordinates[0] < -15 || coordinates[0] > (laneWidth + 10) || !this._active || 
                coordinates[1] > this._overlayDetails.overlayHeight || coordinates[1] < 0) {
                // We're done here, not inside the lanes at start/end
                this.cleanup();
                return;
            }
            
            var timeWindowData = this._overlay.select(".time-window-container")
                    .select(".time-window-marker-box")
                    .datum();
            
            // New Window Coordinates
            var startCoordinate = timeWindowData.startCoordinate;
            var endCoordinate = coordinates[0];
            
            if (Math.abs(startCoordinate - endCoordinate) < 5) {
                //We're done here, the time window is less than five pixels, it's a mistake
                this.cleanup();
                return;
            }
            
            // Current Time Information
            var primaryMinTime = this._viewController.get("minPlotDomain");
            var primaryMaxTime = this._viewController.get("maxPlotDomain");
            var windowedMaxTime = this._viewController.get("maxWindowedPlotDomain") || primaryMaxTime;
            var windowedMinTime = this._viewController.get("minWindowedPlotDomain") || primaryMinTime;
            
            var epochReverseScale = d3.scale.linear()
                    .domain([0, laneWidth])
                    .range([windowedMinTime, windowedMaxTime])
                    .clamp(true);
            
            this.cleanup();

            var genPlotDomain = function(coord) { return deepDiveUtils.roundNumber(epochReverseScale(coord), 3); };

            var timeWindowSettings = {
                minWindowedPlotDomain: genPlotDomain(startCoordinate < endCoordinate ? startCoordinate : endCoordinate),
                maxWindowedPlotDomain: genPlotDomain(startCoordinate < endCoordinate ? endCoordinate : startCoordinate)
            };

            this._viewController.set(timeWindowSettings);
        },
        
        /**
         * clear out any time windowing and disable the time windowing behavior
         * @private
         */
        cleanup: function() {
            this._overlay.select(".time-window-container")
                .selectAll(".time-window-marker")
                .remove();
            this._active = false;
        }
    });

    return DeepDiveTimeWindowingOverlay;
});
