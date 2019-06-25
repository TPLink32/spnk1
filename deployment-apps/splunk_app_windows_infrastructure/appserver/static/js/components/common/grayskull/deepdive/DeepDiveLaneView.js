define([
		"underscore", 
		"jquery", 
		"backbone", 
		"app-contrib/d3/d3.amd", 
		"splunkjs/mvc/messages",
		"app-common/DataManagerView", 
		"app-components/deepdive/DeepDiveUtils", 
		"app-components/deepdive/DeepDiveLaneSettingsModel", 
		"app-components/deepdive/laneactions/DeepDiveLaneActionsView", 
		"app-components/deepdive/graphs/LineGraphView", 
		"app-components/deepdive/graphs/AreaGraphView", 
		"app-components/deepdive/graphs/ColumnGraphView", 
		"app-components/deepdive/graphs/HeatMapGraphView", 
		"app-components/deepdive/graphs/KeyEventsGraphView", 
		"app-components/deepdive/graphs/DistributionStreamGraphView", 
		"text!app-components/deepdive/DeepDiveLaneView.html", 
		"css!app-components/deepdive/DeepDiveLaneView.css"
	], 
	function (
		_, 
		$, 
		Backbone, 
		d3, 
		Messages,
		DataManagerView, 
		deepDiveUtils, 
		DeepDiveLaneSettingsModel,
		DeepDiveLaneActionsView,
		LineGraphView,
		AreaGraphView,
		ColumnGraphView,
		HeatMapGraphView,
        KeyEventsGraphView,
		DistributionStreamGraphView, 
		laneMarkup,
		CSS
	) {
		/**
		 * DeepDiveLaneView renders the entirety of a swimlane
		 */

		var graphTypes = {
			'line': LineGraphView,
			'area': AreaGraphView,
			'column': ColumnGraphView,
			'heatmap': HeatMapGraphView,
            'event': KeyEventsGraphView,
			'distributionStream': DistributionStreamGraphView
		};

		var DeepDiveLaneView = DataManagerView.extend({
			//
			// Overrides of Backbone Methods
			//
			/**
			 * Called when the DeepDiveLane is instantiated. 
			 * @param {Object} options are the constructor parameters for the view
			 * @param {DataManagerModel} options.dataManager DataManager reference from which we will derive data
			 * @param {DeepDiveLaneSettingsModel} options.laneSettings the initial settings for the lane (like chart type)
			 * @param {DeepDiveLaneCollectionView} options.laneController the lane collection controller to obey 
			 */
			initialize: function(options) {
				// Call Parent Class initialize method
				DataManagerView.prototype.initialize.apply(this, arguments);
				
				// Set up lane settings model
				if (options.laneSettings instanceof DeepDiveLaneSettingsModel) {
					this.laneSettings = options.laneSettings;
				}
				else if (options.laneSettings instanceof Object) {
					this.laneSettings = new DeepDiveLaneSettingsModel(options.laneSettings, {});
				}
				else{
					this.laneSettings = new DeepDiveLaneSettingsModel({}, {});
				}
				this.listenTo(this.laneSettings, "change:title", this._updateLane);
				this.listenTo(this.laneSettings, "change:subtitle", this._updateLane);
				this.listenTo(this.laneSettings, "change:graphType", this._createGraph);
				this.listenTo(this.laneSettings, "change:search", this._updateSearch);

                this.laneController = options.laneController;
				
				// Set up Lane Collection Controller
				if (options.viewController !== null && options.viewController !== undefined) {
					this.viewController = options.viewController;
					this.listenTo(this.viewController, "change:minPlotDomain change:maxPlotDomain", this.renderGraphs);
				}
				else {
					// Stand alone lane (maninly only for testing)
					this.viewController = null;
				}
				
				// Set up other instance properties
				this._graphManifest = {};
				this._bodySize = {
					height: 0,
					width: 0
				};
			},
			
			/**
			 * creates the basic shell of the lane and gets it running
			 * @public
			 */
			render: function() {
			    var that = this;
			    
				this.$el.html(laneMarkup);
				
				// Set up message container
				this._$messageContainer = this.$(".deep-dive-lane-messages");
				
				// Reflect lane settings state and sizing
				this.resize();
				this._updateLane();

				// Initialize graph
				this._createGraph();
				
				// Initialize the actions menu
				this._actionsView = new DeepDiveLaneActionsView({
					el: this.$(".deep-dive-lane-actions-container"),
					lane: this
				});
				this._actionsView.render();
				/**
				 * flag for actions menu to tell lane to keep it up
				 * @type {Boolean}
				 * @public
				 */
				this.keepActionsShown = false;
				
				// Add the collapser handler
                this.$el.find('.deep-dive-lane-collapser a').on("click", function(event) {
                    that._onCollapserClick(this);
                    event.preventDefault();
                });
			},
			
			events: {
				"mouseover .deep-dive-lane-header, .deep-dive-lane-handle" : "onMouseoverTitle",
				"mouseover .deep-dive-lane-messages" : "onMouseoverMessages",
				"mouseout .deep-dive-lane-header, .deep-dive-lane-handle" : "onMouseoutTitle"
			},
			
			//
			// DOM Event Handlers
			//
			onMouseoverMessages: function(e) {
				// Prevent messages hover from triggering header hover
				e.stopPropagation();
			},
			
			onMouseoverTitle: function() {
				this.$(".deep-dive-lane-actions-container").show();
                this.$(".deep-dive-lane-handle").show();
				this.$(".deep-dive-lane-collapser").show();
			},
			
			onMouseoutTitle: function() {
				if (!this.keepActionsShown) {
					this.$(".deep-dive-lane-actions-container").hide();
				}
				this.$(".deep-dive-lane-handle").hide();
                this.$(".deep-dive-lane-collapser").hide();
			},
			
			_onCollapserClick: function(collapser) {
			    var $collapserIcon = $(collapser).find('i');
                
			    var iconClassToExpand = 'icon-chevron-down';
                var iconClassToCollapse = 'icon-chevron-up';
                
                var iconClassToAdd = iconClassToExpand;
                var iconClassToRemove = iconClassToCollapse;
                
                if($collapserIcon.hasClass(iconClassToExpand)) {
                    var temp = iconClassToAdd;
                    iconClassToAdd = iconClassToRemove;
                    iconClassToRemove = temp;
                    this.expandLane();
                } else {
                    this.collapseLane();
                }
                
                $collapserIcon.removeClass(iconClassToRemove).addClass(iconClassToAdd);
                $(collapser).attr('title', iconClassToAdd === iconClassToExpand ? 'show' : 'hide');
                this.laneController.recalculateGeometry();
            },
            
            collapseLane: function() {
                var $lane = this.$(".deep-dive-lane");
                
                $lane.find('.deep-dive-lane-body').hide(400);
                $lane.find('.deep-dive-lane-footer').hide(400);
                
                $lane.addClass('deep-dive-lane-collapsed');
                this.$(".deep-dive-lane-header").attr(
                    'title',
                    this.laneSettings.get("title")
                    );              
            },
            
            expandLane: function() {
                var $lane = this.$(".deep-dive-lane");
                
                $lane.find('.deep-dive-lane-body').show(400);
                $lane.find('.deep-dive-lane-footer').show(400);
                
                $lane.removeClass('deep-dive-lane-collapsed');
                this.$(".deep-dive-lane-header").attr(
                    'title',
                    this.laneSettings.get("titleTooltip")
                    );  
            },
			
			//
			// Internal Properties (note that they are made instance properties in initialize, the following is for documentation only)
			//
			/**
			 * settings model for the deep dive lane
			 * describes how to render the lane
			 * @public
			 */
			laneSettings: null,
			
			/**
			 * graph subview responsible for the rendering of data
			 * @private
			 */
			_graphView: null,
			
			/**
			 * the current size of the lane body {width: Number, height: Number}
			 * @private
			 */
			_bodySize: {
				height: 0,
				width: 0
			},
			//
			// Rendering Methods
			//
			/**
			 * callback for the window resize, sets up the internal size info 
			 * and sets the proper width for the lane body
			 * @public
			 */

            reposition: function() {
				var headerWidth = 260;
				var footerWidth = this.$(".deep-dive-lane-footer").width();
				var $lane = this.$(".deep-dive-lane");
				var bodyWidth = Math.floor($lane.width() - headerWidth - footerWidth);
				var bodyHeight = $lane.height();
                var position = this.$el.position();

                this._bodySize.top = position.top;
                this._bodySize.left = position.left + headerWidth;
				this._bodySize.height = bodyHeight;
				this._bodySize.width = bodyWidth;

                return this.lastKnownBodyDims();
            },

			resize: function() {
				// Note that we simply get the total width and subtract the static
				// header width of 260 and the border and the static footer width of 200
			    var dims = this.reposition();
				this.$(".deep-dive-lane-body").width(dims.width).height(dims.height);
				this.$(".deep-dive-lane-chart").width(dims.width).height(dims.height);
				this.$(".deep-dive-lane-messages").width(dims.width);
				this.$(".deep-dive-lane-footer").css({left: dims.width});
				this.$(".deep-dive-time-axis-container").css('max-width:' + dims.width);

				// Re-render Charts
				this.renderGraphs();
			},

			lastKnownBodyDims: function() {
                return {
                    'top': this._bodySize.top,
                    'left': this._bodySize.left,
                    'height': this._bodySize.height,
                    'width': this._bodySize.width
                };
            },

			/**
			 * update the lane to match the current model state
			 * @private
			 */
			_updateLane: function() {
				this.$(".deep-dive-lane-title").text(this.laneSettings.get("title"));
				this.$(".deep-dive-lane-header").attr('title', this.laneSettings.get("titleTooltip"));
				this.$(".deep-dive-lane-subtitle").text(this.laneSettings.get("subtitle"));
                this.$(".deep-dive-lane-status-box").css("background-color", this.laneSettings.get('statusColor'));
                
                this.$(".deep-dive-lane-footer").html(this.laneSettings.get('footerHtml'));
                this.$(".deep-dive-lane-footer").attr('title', this.laneSettings.get("footerTooltip"));
			},
			
			/**
			 * update the data manager to match the current model state for the search
			 * @private
			 */
			_updateSearch: function() {
				this.dataManager.set("search", this.laneSettings.get("search"));
			},
			
			/**
			 * Create the graph sub view
			 * @private
			 */
			_createGraph: function() {
				//Clean up anything existent
				this._destroyGraphs();
				
				//Create new graph based on settings
				var graphType = this.laneSettings.get("graphType");
				var graphSettings = {
					el: this.$(".deep-dive-lane-graph"),
					laneSettings: this.laneSettings,
					dataManager: this.dataManager,
					chartController: this
				};

				this._graphView = (graphTypes[graphType]) ? new (graphTypes[graphType])(graphSettings) : undefined;
				if (this._graphView === undefined) {
					throw "DeepDiveLane: " + this.id + " received an unknown/invalid graphType of " + graphType;
				}
				
				this._graphView.render();
			},
			
			//
			// Chart Controller Properties/Methods/Callbacks
			//
			/**
			 * vertical scale for the rendering of data to svg coordinates
			 * @public
			 */
			yScale: null,
			
			/**
			 * time scale for the rendering of data to svg coordinates
			 * @public
			 */
			timeScale: null,
			
			/**
			 * maintains a manifest of the graph objects under control
			 * @private
			 */
			_graphManifest: {},
			
			/**
			 * the container in which to render messages by default
			 * @private
			 */
			_$messageContainer: null,
			
			/**
			 * custom messages to display to the user outside of the splunk default/provided messages
			 * @private
			 */
			_customMessages: {
				'cancelled': {
					icon: "info-circle",
					level: "info",
					message: _("Search was cancelled.").t(),
					compact: true
				},
				'empty': {
					icon: "blank",
					level: "nothing",
					message: "",
					compact: true
				},
				'unresolved-search': {
					icon: "warning-sign",
					level: "error",
					message: _("Search query is not fully resolved.").t(),
					compact: true
				},
				'no-events': {
					icon: "info-circle",
					level: "info",
					message: _("Search did not return any events.").t(),
					compact: true
				},
				'no-results': {
					icon: "blank",
					level: "info",
					message: _("No results found.").t(),
					compact: true
				},
				'no-search': {
					icon: "info-circle",
					level: "info",
					message: _("No search set.").t(),
					compact: true
				},
				'no-stats': {
					icon: "warning-sign",
					level: "error",
					message: _("Search isn't generating any statistical results.").t(),
					compact: true
				},
				'not-started': {
					icon: "info-circle",
					level: "info",
					message: _("No search started.").t(),
					compact: true
				},
				'waiting': {
					icon: "blank",
					level: "info",
					message: _("Waiting for data...").t(),
					compact: true
				},
				'waiting-queued': {
					icon: "info-circle",
					level: "info",
					message: _("Waiting for search to start: job is queued.").t(),
					compact: true
				},
				'waiting-preparing': {
					icon: "info-circle",
					level: "info",
					message: _("Waiting for search to start: job is preparing.").t(),
					compact: true
				},
				"no-cheeseburger" : {
					icon: "warning-sign",
					level: "error",
					message: "But... but... i wantz cheeseburger, sad face :(",
					compact: true
				}
			},
			
			/**
			 * safely destroy our subview graph
			 * @private
			 */
			_destroyGraphs: function() {
				// Safely iterate over our _graphManifest since we will be destroying things in it
				var keys = _.keys(this._graphManifest);
				_.each(keys, function(graphId) {
					var graph = this._graphManifest[graphId];
					graph.destroy();
				}, this);
			},
			
			/**
			 * signs up a particular graph with this chart controller
			 * @param {string|Object} id for the graph or the graph itself
			 * @param {Object} the graph to register, if passed as first arg this is ignored
			 * @public
			 */
			registerGraph: function(graphId, graph) {
				if (typeof graphId !== "string") {
					graph = graphId;
					graphId = graph.id;
				}
				
				this._graphManifest[graphId] = graph;
			},
			
			/**
			 * removes a particular graph from the manifest
			 * @param {string} the id of the graph to remove
			 * @public
			 */
			deregisterGraph: function(graphId) {
				if (!this._graphManifest.hasOwnProperty(graphId)) {
					throw "DeepDiveLane: " + this.id + " cannot deregister graph, graph is not registered graphId=" + graphId;
				}
				delete this._graphManifest[graphId];
			},
			
			/**
			 * call a graph update on all sub graphs
			 * @param {Boolean} dataChanged indicates if a render is due to a data change or not
			 * @public
			 */
			renderGraphs: function(dataChanged) {
				// Setup the needsRender
				var needsRender = {
					domainChanged: false,
					rangeChanged: false,
					dataChanged: false
				};
				
				var oldTimeScale = this.timeScale || d3.scale.linear().domain([null, null]).range([null, null]);
				var oldYScale = this.yScale || d3.scale.linear().domain([null, null]).range([null, null]);
				
				// Update scales
				this.updateTimeScale();
				this.updateYScale();
				
				
				// Check for data change
				if (dataChanged === true) {
					needsRender.dataChanged = true;
				}
				else {
					// Check for scale change only if data is same
					needsRender.domainChanged = deepDiveUtils.areArraysIdentical(oldTimeScale.domain(), this.timeScale.domain()) && deepDiveUtils.areArraysIdentical(oldTimeScale.range(), this.timeScale.range());
					needsRender.rangeChanged = deepDiveUtils.areArraysIdentical(oldYScale.domain(), this.yScale.domain()) && deepDiveUtils.areArraysIdentical(oldYScale.range(), this.yScale.range());
				}
				var canRender = _.all(this.timeScale.domain(), deepDiveUtils.isNum) && _.all(this.yScale.domain(), deepDiveUtils.isNum);
				if (_.any(needsRender) && canRender) {
					this.displayMessage("empty");
					_.each(this._graphManifest, function(graph) {
						graph.updateGraph();
					});
				}
			},
			
			/**
			 * given the new yExtent data available update the scale if necessary
			 * @returns {d3.scale} the y-axis scale
			 * @public
			 */
			updateYScale: function() {
				var yData = [];
				_.each(this._graphManifest, function(graph) {
					yData = yData.concat(graph.yExtent);
				});
				
				var yExtent = d3.extent(yData);
				this.yScale = d3.scale.linear()
					.domain(yExtent)
					.range([this._bodySize.height, 0]);
				
				return this.yScale;
			},
			
			/**
			 * given the new timeExtent data available update the scale if necessary
			 * @returns {d3.scale} the time-axis scale
			 * @public
			 */
			updateTimeScale: function() {
				var timeExtent;
				if (this.laneController === null) {
					// Stand alone lane mode
					timeExtent = this.getTimeExtent();
				}
				else {
					timeExtent = this.laneController.getTimeExtent();
				}
				
				this.timeScale = d3.scale.linear()
					.domain(timeExtent)
					.range([0, this._bodySize.width]);
				
				return this.timeScale;
			},
			
			/**
			 * get the available time extent data from member graphs
			 * @returns {Array} the time-extent as [minTime, maxTime]
			 * @public
			 */
			getTimeExtent: function() {
				var timeData = [];
				_.each(this._graphManifest, function(graph) {
					timeData = timeData.concat(graph.timeExtent);
				});
				
				var timeExtent = d3.extent(timeData);
				
				return timeExtent;
			},
			
			/**
			 * return the yValue and yPosition for a given timePosition
			 * @param {number} timePosition the actual position on the time scale's range
			 * @return {Object} yInfo formatted {yValue: number, yPosition: number}
			 * @public
			 */
            getYInfoForTimePosition: function(timePosition) {
				var timeValue = this.timeScale.invert(timePosition);
				var yScale = this.yScale;
				var yInfo = _.map(this._graphManifest, function(graph, graphId) {
					var fields = graph.dataManager.get("fields");
					var data = graph.dataManager.get("data");
					if (! (data instanceof Array)) {
                        return { yValue: undefined, yPosition: 0 };
                    }
					var timeIndex = _.indexOf(fields, "_time");
					var timeInsertIndex = _.sortedIndex(
                        data, timeValue, 
                        function(row) { return row instanceof Array ? Number(row[timeIndex]) : Number(row); });
					var timeValueIndex = timeInsertIndex - 1;
					if (timeValueIndex === -1) {
                        return { yValue: undefined, yPosition: 0 };
                    }
                    var yValue = Number(data[timeValueIndex][graph.getYIndex(fields)]);
                    return { 
                        yValue: yValue,
                        yPosition: yScale(yValue) 
                    };
                });
                if (yInfo.length === 0) {
                    return { yValue: undefined, yPosition: 0 };
                }
                return yInfo[0];
            },

            getXZoneForTimePosition: function(timePosition) {
                var timeScale = this.timeScale;

				var xInfo = _.map(this._graphManifest, function(graph, graphId) {
                    var timeExtent = graph.timeExtent;
					var data = graph.dataManager.get("data");
                    var fields = graph.dataManager.get("fields");
                    var yIndex = graph.getYIndex(fields);
			        var timeIndex = _.indexOf(fields, "_time");
			        var spanIndex = _.indexOf(fields, "_span");
			        var columnWidth = ((timeScale(timeExtent[1]) - 
								        timeScale(timeExtent[0])) / data.length) - 1;

                    var timeDataInRange = function(d) { 
                        return ((timePosition >= timeScale(parseFloat(d[timeIndex]))) && 
                                (timePosition <= timeScale(parseFloat(d[timeIndex]) + parseFloat(d[spanIndex]))) &&
                                (d[yIndex] > 0));
                    };

                    var timeDataToPosition = function(d) { 
                        var pos = timeScale(parseFloat(d[timeIndex]));
                        return {
                            pos: pos, 
                            width: columnWidth, 
                            time: parseFloat(d[timeIndex], 10), 
                            span: parseFloat(d[spanIndex], 10)
                        };
                    };

                    var pos = _.map(_.filter(data, timeDataInRange), timeDataToPosition);
                    return pos.length === 0 ? {pos: null, width: null, time: null} : pos[0];
                });

                return xInfo.length === 0 ? {pos: null, width: null, time: null} : xInfo[0];
            },
			
			/**
			 * test if we have data and scales computed
			 * @returns {Boolean} true if can render, false otherwise
			 * @public
			 */
			canRender: function() {
				return this.yScale instanceof Object && this.timeScale instanceof Object && this.dataManager.get('data') instanceof Array && this.dataManager.get('data').length > 0;
			},
			
			/**
			 * Displays a message to the user over the lane
			 * @param {Object|string} info a splunk message style object or a string indicating the message
			 * @param {?Object} text an object used to render a templated message, if null no template is rendered
			 * @param {?jQuery} $container the jQuery selection in which to render the message, if null uses the default message container
			 * @public
			 */
			displayMessage: function(info, text, $container) {
				if ($container === null || $container === undefined) {
					$container = this._$messageContainer;
				}
				if (this._customMessages.hasOwnProperty(info)) {
					var info_obj = _.clone(this._customMessages[info]);
					if (text !== null && text !== undefined) {
						info_obj.message = info_obj.message_template(text, {variable: "text"});
					}
					Messages.render(info_obj, $container);
				}
				else {
					Messages.render(info, $container);
				}
				
				return this;
			},
			
			/**
			 * when our data manager is set we need to set it on our children as well
			 * @public
			 */
			setDataManager: function(dm) {
				DataManagerView.prototype.setDataManager.apply(this, arguments);
				var keys = _.keys(this._graphManifest);
				_.each(keys, function(graphId) {
					var graph = this._graphManifest[graphId];
					graph.setDataManager(dm);
				}, this);
			},
			
			/**
			 * when our data manager is unset we need to unset it on the children as well
			 * @public
			 */
			unsetDataManager: function() {
				DataManagerView.prototype.unsetDataManager.apply(this, arguments);
				var keys = _.keys(this._graphManifest);
				_.each(keys, function(graphId) {
					var graph = this._graphManifest[graphId];
					graph.unsetDataManager();
				}, this);
			},
			
			/**
			 * DataManagerModel required callback
			 * @protected
			 */
			renderData: function() {
				return this;
			}
		});

		return DeepDiveLaneView;
	}
);
