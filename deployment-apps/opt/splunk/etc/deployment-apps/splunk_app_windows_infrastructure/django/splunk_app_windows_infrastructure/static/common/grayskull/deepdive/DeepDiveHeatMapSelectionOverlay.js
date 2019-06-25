define([
    'jquery',
    'underscore',
    'backbone',
    'app-contrib/d3/d3.amd',
    'app-components/deepdive/DeepDiveUtils'
], function(
    $, 
    _, 
    Backbone,
    d3,
    deepDiveUtils) {

    var topOffset = 40;



    var DeepDiveHeatMapSelectionOverlay = function(overlay, details, controller) {
        this._overlay = overlay;
        this._overlayDetails = details;
        this._viewController = controller;
        this._active = false;
        this._home = null;
    };

    _.extend(DeepDiveHeatMapSelectionOverlay.prototype, Backbone.Events, {
        criteria: function(coordinates, graphData) {
            if (! d3.event.shiftKey) { return false; }
            return _.any(graphData, function(gd) {
                var dims = gd.view.lastKnownBodyDims();
                return ((coordinates[1] >= dims.top + topOffset) && (coordinates[1] < (dims.top + topOffset + dims.height)));
            });
        },

        start: function(coordinates, graphData) {
            d3.event.preventDefault();
            this._active = true;

            var laneWidth = this._overlayDetails.overlayWidth;
            var x = coordinates[0];

            var isInLanes = (coordinates[0] >= 1 && coordinates[0] <= laneWidth + 15 && 
                             coordinates[1] < this._overlayDetails.overlayHeight && coordinates[1] > 0);

            var isTimeAThingYet = (deepDiveUtils.isNum(this._viewController.get("minPlotDomain")) && 
                                   deepDiveUtils.isNum(this._viewController.get("maxPlotDomain")));
            
            if (! (isInLanes && isTimeAThingYet)) {
                this.cleanup();
                return;
            }

            this._home = coordinates;
        },

        _generateGraphData: function(coordinates, graphData) {
            var isHeatmap = function(g) { 
                return (g.settings.get('overlayType') || g.settings.get('graphType')) === 'heatmap'; 
            };

            var region = { 
                x1: this._home[0] < coordinates[0] ? this._home[0] : coordinates[0],
                y1: this._home[1] < coordinates[1] ? this._home[1] : coordinates[1],
                x2: this._home[0] <= coordinates[0] ? coordinates[0] : this._home[0],
                y2: this._home[1] <= coordinates[1] ? coordinates[1] : this._home[1]              
            };

            // Basic Gap detection.
            var isInSelectedRegion = function(g) {
                return (g.x < region.x2 && g.x + g.w > region.x1 &&
                        g.y < region.y2 && g.y + g.h > region.y1);
            };

            var oneGraphToData = function(g) {
                var fields = g.view.dataManager.get("fields");
                var rows = g.view.dataManager.get("data");
                var timeScale = g.view.timeScale;
                var extent = g.view.getTimeExtent();
                var dims = g.view.lastKnownBodyDims();
                var timeIndex = _.indexOf(fields, "_time");
                var spanIndex = _.indexOf(fields, "_span");
                var lane = g.settings.get('title');
                var columnWidth = Math.max(parseInt(((timeScale(extent[1]) - 
                                                      timeScale(extent[0])) / rows.length) - 1, 10), 1);

                return _.map(rows, function(row) {
                    var x = timeScale(parseFloat(row[timeIndex]));
                    var y = dims.top + topOffset;
                    return { 
                        x: x, y: y, 
                        w: columnWidth, h: dims.height, 
                        lane: lane,
                        time: row[timeIndex], span: row[spanIndex],
                        key:  x + "%" + y
                    };
                });
            };

            return _.chain(graphData)
                .filter(isHeatmap)
                .map(oneGraphToData)
                .flatten()
                .filter(isInSelectedRegion)
                .value();
        },
            
        move: function(coordinates, rawGraphData) {

            var highlights = this._overlay.selectAll("g.heatmap-overlay-indicator")
                .data(this._generateGraphData(coordinates, rawGraphData), 
                      function(k) { return k.key; });

            highlights.enter().append("g").each(function(g) {
                var group = d3.select(this);
                
                group.attr("class", "heatmap-overlay-indicator")
                    .attr("opacity", "1e-6");

                group.append("rect")
                    .attr("opacity", 1)
                    .attr("x", 1)
                    .attr("y", 1)
                    .attr("height", g.h - 2)
                    .attr("width", g.w - 2)
                    .attr("fill-opacity", 0)
                    .attr("stroke", "yellow")
                    .attr("stroke-width", "2");
            });

            highlights.exit().remove();

            highlights.each(function(g) {
                d3.select(this)
                    .attr("transform", "translate(" + g.x + ", " + g.y + ")")
                    .attr("opacity", "1");
            });
        },
        
        isActive: function() { return this._active; },

        /**
         * mouseout handler for ending the time window
         * @private
         */
        end: function(coordinates, rawGraphData) {
            var graphData = this._generateGraphData(coordinates, rawGraphData);
            var max = _.max(graphData, function(x) { return parseInt(x.time, 10); });
            var min = _.min(graphData, function(x) { return parseInt(x.time, 10); });
            var settings = {
                rows: _.keys(_.reduce(graphData, function(m, v) { m[v.lane] = 1; return m; }, {})),
                earliest_time: parseInt(min.time, 10),
                latest_time: parseInt(max.time, 10) + parseInt(max.span, 10)
            };
            $('#deepdive-component-event-table').data('settings', settings).trigger('update', settings);
            this.cleanup();
        },
        
        /**
         * clear out any time windowing and disable the time windowing behavior
         * @private
         */
        cleanup: function() {
            var highlights = this._overlay.selectAll("g.heatmap-overlay-indicator");
            highlights.remove();
            this._home = null;
            this._active = false;
        }
    });

    return DeepDiveHeatMapSelectionOverlay;
});
