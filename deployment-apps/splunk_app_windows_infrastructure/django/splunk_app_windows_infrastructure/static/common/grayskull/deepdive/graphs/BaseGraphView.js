define([
    "underscore", 
    "jquery", 
    "backbone", 
    "app-contrib/d3/d3.amd", 
    "app-common/DataManagerView", 
    "app-components/deepdive/DeepDiveUtils"
], function (_, $, Backbone, d3, DataManagerView, deepDiveUtils) {
    
    /**
     * BaseGraphView is the abstract class for graph views.
     * Graph views are used to render single graphs on a particular chart.
     * That chart must be given as the chart controller and establishes the 
     * container for the graph to render in. In addition the chart controller
     * is responsible for setting up scale objects. Graphs are responsible for
     * communicating the extents of the data they intend to render to the 
     * chart controller. 
     * 
     * Graph views provide a destroy method that removes them from existence.
     * 
     * Graph views are expected to render inside a single container g
     */
    var BaseGraphView = DataManagerView.extend({
        //
        // Overrides of Backbone Methods
        //
        /**
         * Called when the DataManagerView is instantiated. 
         * @param {Object} options are the constructor parameters for the model
         * @param {Object} options.dataManager DataManager reference from which we will derive data
         * @param {Object} options.laneSettings DeepDiveLaneModel reference from which we understand our rendering properties
         * @param {Object} options.chartController object reference that implements the chartController interface
         */
        initialize: function(options) {
            // Set up id
            this.id = this.id || this.cid;
            
            // Set up lane settings model
            this.laneSettings = options.laneSettings;
            this.listenTo(this.laneSettings, "change:graphColor", this.updateGraph);
            
            // Set up chart controller
            this.chartController = options.chartController;
            this.chartController.registerGraph(this.id, this);
            
            // Call Parent Class initialize method
            DataManagerView.prototype.initialize.apply(this, arguments);
        },
        
        /**
         * Overload to setup anything initially required by the graph
         * @public
         * @returns {Object} this for chaining
         */
        render: function() {
            return this;
        },
        
        //
        // Overrides of DataManagerView Methods
        //
        /**
         * Render the data of our given data manager
         * @protected
         */
        renderData: function() {
            var fields = this.dataManager.get("fields");
            var rows = this.dataManager.get("data");
            //Validate we can actually render something
            if (rows instanceof Array && fields instanceof Array && fields.length > 0 && rows.length > 0) {
                // Get Scales
                var timeExtent = this.getTimeExtent(fields, rows);
                this.timeExtent = timeExtent;
                var yExtent = this.getYExtent(fields, rows);
                this.yExtent = yExtent;
                this.chartController.renderGraphs(true);
                
                // Lazy Render 
                //var lazyRenderGraphs = _.debounce(this.chartController.renderGraphs(), 150);
                //lazyRenderGraphs();
            }
            else {
                this._renderNoData();
            }
        },
        
        /**
         * This is the callback for when searches return nothing.
         * @protected
         */
        renderNoResults: function() {
            this.displayMessage("no-results");
        },
        
        /**
         * This is the callback for when search is still running and indicating progress
         * @protected
         */
        renderProgress: function() {
            this.displayMessage("waiting");
        },
        
        /**
         * delegate all messaging to the chart controller, and enforce 
         * compactness. 
         * @protected
         */
        displayMessage: function(msg) {
            if (msg instanceof Object) {
                msg = _.extend(msg, {compact: true});
            }
            return this.chartController.displayMessage(msg);
        },
        
        //
        // Internal Properties
        //
        /**
         * reference to this graph's chart controller
         * @protected
         */
        chartController: null,
        
        /**
         * reference to this graph's lane's settings
         * @protected
         */
        laneSettings: null,
        
        /**
         * cached extent of time
         * @public
         */
        timeExtent: null,
        
        /**
         * cached extent of y
         * @public
         */
        yExtent: null,
        
        //
        // Internal Methods/Callbacks
        //
        /**
         * updates the graph for the current settings state
         * @public
         */
        updateGraph: function() {
            var fields = this.dataManager.get("fields");
            var rows = this.dataManager.get("data");
            
            //Validate we can render something
            if (rows instanceof Array && fields instanceof Array && fields.length > 0 && rows.length > 0 && this.timeExtent !== null && this.yExtent !== null) {
                //show our stuff
                d3.select(this.$el.get(0)).attr("opacity", "1");
                this.renderGraph(fields, rows, this.chartController.timeScale, this.chartController.yScale);
            }
            else {
                this._renderNoData();
            }
        },
        
        /**
         * compute the extent of the time data
         * @param {Array} fields the fields associated with the rows
         * @param {Array} rows the data from the dataManager
         * @returns {Array} [earliestTimeEpoch, latestTimeEpoch]
         */
        getTimeExtent: function(fields, rows) {
            var timeIndex = _.indexOf(fields,"_time");
            var timeExtent = d3.extent(rows, function(d) { return Number(d[timeIndex]); });
            
            // Note that in splunk statistical data represents the value from timestamp to timestamp + span, so we need to add the span to the scale
            var span = deepDiveUtils.getSpan(fields, rows);
            timeExtent[1] = timeExtent[1] + span;
            
            return timeExtent;
        },
        
        /**
         * compute the extent of the range data, this may be overloaded per graph's expected data format
         * this implementation will pull the extents of all numeric, not _time values in every row
         * @param {Array} fields the fields associated with the rows
         * @param {Array} rows the data from the dataManager
         * @returns {Array} [minOfYData, maxOfYData]
         */
        getYExtent: function(fields, rows) {
            var that = this;
            var timeIndex = _.indexOf(fields, "_time");
            var yMin = d3.min(rows, function(d) { 
                return d3.min(d, function(datum, index) {
                    if (index === timeIndex) {
                        return undefined;
                    }
                    else {
                        return that.isNum(datum) ? Number(datum) : undefined;
                    }
                });
            });
            var yMax = d3.max(rows, function(d) { 
                return d3.max(d, function(datum, index) {
                    if (index === timeIndex) {
                        return undefined;
                    }
                    else {
                        return that.isNum(datum) ? Number(datum) : undefined;
                    }
                });
            });
            var yExtent = [yMin, yMax];
            return yExtent;
        },
        
        /**
         * get the index at which the yValue can be found in the data
         * @param {Array} fields the fields associated with the rows
         * @public
         */
        getYIndex: function(fields) {
            var graphSeries = this.laneSettings.get("graphSeries");
            var graphSeriesIndex = -1;
            if (graphSeries !== undefined && graphSeries !== null) {
                graphSeriesIndex = _.indexOf(fields, graphSeries);
            }
            if (graphSeriesIndex === -1) {
                // Fall back on first non time/span field in the fields
                graphSeriesIndex = deepDiveUtils.indexWhere(fields, function(item) {
                    return item !== "_time" && item !== "_span";
                });
            }
            return graphSeriesIndex;
        },
        
        /**
         * render the data from the data manager into your particular format
         * @param {Array} fields the fields associated with the rows
         * @param {Array} rows the data from the dataManager
         * @param {d3.scale} timeScale the scale to use when rendering the domain (_time)
         * @param {d3.scale} yScale the scale to use when rendering the range (y-axis)
         * @private
         */
        renderGraph: function(fields, rows, timeScale, yScale) {
            throw "BaseGraphView:" + this.id + " _renderGraph not implemented";
        },
        
        /**
         * render something when there is no data returned
         * @private
         */
        _renderNoData: function() {
            //Hide any old graph
            d3.select(this.$el.get(0)).attr("opacity", "1e-6");
            var lastSearchEvent = this.dataManager.getLastSearchEvent();
            if (lastSearchEvent === 'search:progress' || lastSearchEvent === 'search:done') {
                if (this.dataManager._isJobDone) {
                    this.renderNoResults();
                }
                else {
                    this.renderProgress();
                }
            }
            else {
                // replay last search event to get a nice message
                this.dataManager.replayLastSearchEvent();
            }
        },
        
        //
        // Public Methods
        //
        /**
         * remove the current graph and safely destruct it
         * @public
         */
        destroy: function() {
            this.unsetDataManager();
            this.chartController.deregisterGraph(this.id);
            this.stopListening();
            this.chartController = null;
            this.laneSettings = null;
            // Preserve the container g we were given to render in
            this.$el.children().remove();
        },
        
        //
        // Utilities
        //
        /**
         * Check that n can be parsed as a finite number
         * @param {?} n
         * @returns {Boolean} true if can be parsed as a finite number, false otherwise
         */
        isNum: deepDiveUtils.isNum
    });
    
    return BaseGraphView;
});
