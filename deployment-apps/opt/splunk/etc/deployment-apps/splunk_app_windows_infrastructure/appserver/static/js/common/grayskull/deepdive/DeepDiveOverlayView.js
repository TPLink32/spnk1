define([
    'jquery',
    'underscore',
    'backbone',
    'common/grayskull/common/contrib/d3/d3.amd',
    'common/grayskull/deepdive/DeepDiveUtils',
    'common/grayskull/deepdive/DeepDiveGraphOverlayView',
    'common/grayskull/deepdive/DeepDiveTimeWindowingOverlay',
    'common/grayskull/deepdive/DeepDiveHeatMapSelectionOverlay',
    'common/grayskull/deepdive/DeepDiveInteractiveOverlays'
], function(
    $, 
    _, 
    Backbone,
    d3,
    deepDiveUtils,
    deepDiveGraphOverlay,
    DeepDiveTimeWindowingOverlay,
    DeepDiveHeatMapSelectionOverlay,
    DeepDiveInteractiveOverlays
) {

    function isValidDateObject(d) { 
        return (Object.prototype.toString.call(d) === "[object Date]") && (! isNaN(d.getTime()));
    }

    var DeepDiveOverlayView = Backbone.View.extend({

        /**
         * Updates our time axes to represent the current state of the data
         * @private
         */

        initialize: function(options) {
            this._sizeInfoCache = {
                overlayWidth: null,
                overlayHeight: null
            };

            this.parent = options.parent;
            this.viewController = options.viewController;
            this.listenTo(options.parent, 'resize', this._onResize);
            this._d3el = null;
            var watching = ("change:minPlotDomain change:maxPlotDomain " +
                            "change:minWindowedPlotDomain change:maxWindowedPlotDomain");
            this.viewController.on(watching, this._renderTimeAxes, this);
        },

        render: function() {
            this._d3el = d3.select(this.$el.get(0));
            this._d3overlay = this._d3el.select(".deep-dive-lane-collection-overlay");
            this._d3timebar = this._d3overlay.select(".lane-investigator-time-label");

            this._d3el.select(".deep-dive-lane-collection-time-axis-bottom")
                .select(".viewport-background")
                .on("click", function() {
                    // Clear any time window currently active
                    this.viewController.set({
                        minWindowedPlotDomain: null,
                        maxWindowedPlotDomain: null
                    });
                }.bind(this));

            this._interactives = new DeepDiveInteractiveOverlays(
                [new DeepDiveTimeWindowingOverlay(
                    this._d3overlay, 
                    this._sizeInfoCache, 
                    this.viewController),
                new DeepDiveHeatMapSelectionOverlay(
                    this._d3overlay, 
                    this._sizeInfoCache,
                    this.viewController)]);

            var moveHandler = function() {
                if (this.parent._sortActive) {
                    return;
                }
                var coordinates = d3.mouse(this._d3overlay.node());
                var graphData = this.parent._getLaneInspectorData();
                this._inspectLanes(coordinates, graphData);
                this._interactives.move(coordinates, graphData);
            }.bind(this);

            var downHandler = function() {
                if (this.parent._sortActive) {
                    return;
                }
                var coordinates = d3.mouse(this._d3overlay.node());
                var graphData = this.parent._getLaneInspectorData();
                this._interactives.start(coordinates, graphData);
            }.bind(this);

            var upHandler = function() {
                if (this.parent._sortActive) {
                    return;
                }
                var coordinates = d3.mouse(this._d3overlay.node());
                var graphData = this.parent._getLaneInspectorData();
                this._interactives.end(coordinates, graphData);
            }.bind(this);

            // Bind d3 style events for easier mouse interactions
            d3.select(this.$el.get(0)).on("mousemove", moveHandler)
                .on("mouseout", this._destroyLaneInspector.bind(this))
                .on('mousedown', downHandler);

            // Allow some overlap of the main content
            d3.select(window).on('mouseup', upHandler);

            return this;
        },

        hide: function() {
            this._d3overlay.attr("opacity", "1e-6");
        },

        //
        // DOM/Lane Investigator Callbacks
        //
        /**
         * when the screen resizes we need to set the overlay's size
         * @private
         */
        _onResize: function() {
            var $overlay = this.$(".deep-dive-lane-collection-overlay");
            // Note that we get the total width and subtract the static header width of 260 and footer
            var $lanesContainer = this.$(".deep-dive-lanes-container");
            var overlayWidth = Math.floor($lanesContainer.width() - 260 - this.$(".deep-dive-lane-footer").width());
            // Note that we take into account the top and bottom 1 px border on lanes and the top overlap
            var overlayHeight = $lanesContainer.height() - 1 + 40;
            
            this._sizeInfoCache.overlayWidth = overlayWidth;
            this._sizeInfoCache.overlayHeight = overlayHeight;
            
            this.$(".deep-dive-lane-collection-overlay")
                .width(overlayWidth)
                .height(overlayHeight);
            
            // Update time axes
            this._renderTimeAxes();
        },


        _renderTimeAxes: function() {
            if (! this._d3el) { 
                return;
            }

            // Compute our time data
            var windowedMinTime = this.viewController.get("minPlotDomain");
            var windowedMaxTime = this.viewController.get("maxPlotDomain");

            // Top Axis
            var timeExtent = [windowedMinTime, windowedMaxTime];
            var start = deepDiveUtils.convertEpochToDate(timeExtent[0]);
            var end = deepDiveUtils.convertEpochToDate(timeExtent[1]);
            if (! isValidDateObject(start)) {
                return;
            }

            var laneWidth = this._sizeInfoCache.overlayWidth;
            var primaryMinTime = this.viewController.get("minOriginalPlotDomain") || this.viewController.get("minPlotDomain");
            var primaryMaxTime = this.viewController.get("maxOriginalPlotDomain") || this.viewController.get("maxPlotDomain");
            var primaryEpochScale = d3.scale.linear()
                    .domain([primaryMinTime, primaryMaxTime])
                    .range([0, laneWidth]);

            var dateScale = d3.time.scale().domain([start, end]).range([0, laneWidth]);
            var axis = d3.svg.axis()
                    .scale(dateScale)
                    .ticks(6)
                    .innerTickSize(0)
                    .outerTickSize(0);

            this._d3el.select(".deep-dive-lane-collection-time-axis-top")
                .select(".axis-container")
                .call(axis);
            
            // Bottom Axis
            timeExtent = [primaryMinTime, primaryMaxTime];
            start = deepDiveUtils.convertEpochToDate(timeExtent[0]);
            end = deepDiveUtils.convertEpochToDate(timeExtent[1]);
            dateScale = d3.time.scale().domain([start, end]).range([0, laneWidth]);
            var d3timeAxisBottom = this._d3el.select(".deep-dive-lane-collection-time-axis-bottom");
            d3timeAxisBottom.select(".viewport-background").attr("width", laneWidth);
            d3timeAxisBottom.select(".viewport-right-border").attr("x", laneWidth + 1);
            d3timeAxisBottom.select(".axis-container")
                .call(axis.scale(dateScale).outerTickSize(1));

            var windowDuration = windowedMaxTime - windowedMinTime;
            var windowDurationString = deepDiveUtils.formatTimeDuration(windowDuration);
            
            // Viewport Window Box
            if (deepDiveUtils.isNum(windowedMaxTime) && deepDiveUtils.isNum(windowedMinTime)) {
                var viewportWindowBoxWidth = primaryEpochScale(windowedMaxTime) - primaryEpochScale(windowedMinTime);
                
                // Viewport box
                d3timeAxisBottom.select(".viewport-window-box")
                    .attr('x', primaryEpochScale(windowedMinTime) + 1)
                    .attr('width', viewportWindowBoxWidth);
                // Viewport box label
                d3timeAxisBottom.select(".viewport-window-label")
                    .attr('x', primaryEpochScale(windowedMinTime + (windowDuration / 2)) + 1)
                    .each(function() {
                        var d3this = d3.select(this);
                        
                        // Try big text
                        d3this.text("Viewport: " + windowDurationString);
                        if (viewportWindowBoxWidth > this.getBBox().width) {
                            return;
                        }
                        
                        // Try small text
                        d3this.text(windowDurationString);
                        if (viewportWindowBoxWidth > this.getBBox().width) {
                            return;
                        }
                        
                        // Fall back on no text
                        d3this.text("");
                    });
            }
        },
        
        /**
         * Position and draw the "current time" indicator
         * @private
         */
        _drawTimeLabel: function(x) {
            var minPlotDomain = this.viewController.get("minPlotDomain");
            var maxPlotDomain = this.viewController.get("maxPlotDomain");
            var laneWidth = this._sizeInfoCache.overlayWidth;

            var generateCurrentTimeText = function() {
                if (! (deepDiveUtils.isNum(minPlotDomain) && deepDiveUtils.isNum(maxPlotDomain))) {
                    return '';
                }
                var timeFormat = (maxPlotDomain - minPlotDomain) > (60 * 60 * 24 * 2) ? '%a %b %e %I:%M:%S %p' : '%I:%M:%S %p';
                var dateScale = d3.time.scale()
                        .domain([deepDiveUtils.convertEpochToDate(minPlotDomain), 
                                 deepDiveUtils.convertEpochToDate(maxPlotDomain)])
                        .range([0, laneWidth]);
                return d3.time.format(timeFormat)(dateScale.invert(x));
            };
                
            var generateTextPositionAnchor = function() {
                var labelSize = this.getBBox().width;
                var pastEnd = ((labelSize / 2) + x) > laneWidth;
                return (pastEnd ? "end" : (x < (labelSize / 2)) ? "start" : "middle");
            };

            this._d3timebar
                .attr("height", "17px")
                .text(generateCurrentTimeText)
                .attr("transform", 'translate(' + (x - 1) + ', 0)')
                .transition()
                .attr('text-anchor', generateTextPositionAnchor);
        },

        /**
         * set up the lane investigator over all the lanes
         * @private
         */
        _inspectLanes: function(coordinates, graphData) {
            var topOffset = 40;
            var laneWidth = this._sizeInfoCache.overlayWidth;
            var coordinates = d3.mouse(this._d3overlay.node());
            
            this._d3overlay.attr("opacity", "1");
            
            // Draw the "pointer time" indicator
            this._drawTimeLabel(coordinates[0]);

            // Draw the per-lane overlays.
            deepDiveGraphOverlay(graphData, coordinates, this._d3overlay);

        },

        /**
         * get rid of the lane inspector
         * @private
         */
        _destroyLaneInspector: function() {
            var coordinates = d3.mouse(this._d3overlay.node());
            // Handle event system that fires mouseouts with reckless abandon
            if ((coordinates[0] > this._sizeInfoCache.overlayWidth) || (coordinates[0] < 0) || 
                (coordinates[1] > this._sizeInfoCache.overlayHeight) || (coordinates[1] < 0)) {
                this.hide();
                if (coordinates[0] > (this._sizeInfoCache.overlayWidth + 15) || coordinates[0] < -15) {
                    // Also destroy any incomplete time window
                    this._interactives.cleanup();
                }
            }
        }
    });

    return DeepDiveOverlayView;
});
