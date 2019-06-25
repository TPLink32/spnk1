define([
    'jquery',
    'underscore',
    'backbone',
    'jquery.ui.sortable',
    'splunkjs/mvc/timerangeview',
    'app-contrib/d3/d3.amd',
    'app-common/DataManagerModel',
    'app-components/deepdive/DeepDiveLaneSettingsCollection',
    'app-components/deepdive/DeepDiveLaneView',
    'app-components/deepdive/DeepDiveOverlayView',
    'app-components/deepdive/DeepDiveLaneSettingsModalView',
    'app-components/deepdive/DeepDiveViewController',
    'app-components/deepdive/DeepDiveUtils',
    'text!app-components/deepdive/DeepDiveLaneCollectionView.html',
    'css!app-components/deepdive/DeepDiveLaneCollectionView.css'
    ],
    function(
        $, 
        _, 
        Backbone,
        jQueryUISortable,
        TimeRangeView,
        d3,
        DataManagerModel,
        DeepDiveLaneSettingsCollection,
        DeepDiveLaneView,
        DeepDiveOverlayView,
        DeepDiveLaneSettingsModalView,
        DeepDiveViewController,
        deepDiveUtils,
        collectionMarkup,
        CSS
    ) {
        /**
         * DeepDiveLaneCollectionView acts as the controller for a set of lanes. 
         * It provides UI for adding and removing lanes we well as state serialization.
         * It acts as the chart controller for the domain axis (time axis) for all lanes' graphs. 
         * It provides coordination for cross lane functionality
         */
        var DeepDiveLaneCollectionView = Backbone.View.extend({
            //
            // Overrides of Backbone Methods
            //
            /**
             * Called when the Collection Controller is instantiated. 
             * @param {Object} options are the constructor parameters for the collection
             * @param {Object} options.laneSettingsCollection a reference to a DeepDiveLaneSettingsCollection
             * @param {Object} options.AddLaneModal a reference to a valid modal view for adding lanes, defaults to DeepDiveLaneSettingsModalView
             * @param {string} options.earliestTime is the earliest time for all searches
             * @param {string} options.latestTime is the latest time for all searches
             */
            initialize: function(options) {
                // Call Parent Class initialize method
                Backbone.View.prototype.initialize.apply(this, arguments);
                this.id = this.id || this.cid;
                
                // Initialize instance properties
                this._laneViewManifest = {};
                this._dataManagerManifest = {};
                this._timeWindowed = false;
                this._sortActive = false;
                
                // Store necessary state in a model for lane coordination
                this.viewController = options.viewController || new DeepDiveViewController({
                    minPlotDomain: null,
                    maxPlotDomain: null,
                    minWindowedPlotDomain: null,
                    maxWindowedPlotDomain: null
                });

                // Setup for configurable modals
                /**
                 * This is the view which is used to create the add lane modal
                 * @type {Object}
                 * @private
                 */
                this._AddLaneModal = options.AddLaneModal || DeepDiveLaneSettingsModalView;

                this._overlay = (_.isUndefined(options.overlay) ? 
                                 (new DeepDiveOverlayView({ parent: this, viewController: this.viewController, el: this.el })) : 
                                 options.overlay);

                this.listenTo(this.viewController, "change:minWindowedPlotDomain change:maxWindowedPlotDomain", this._windowTimeRange);
                
                //TODO: time must be handled here
                this._earliestTime = options.earliestTime || "-60m";
                this._latestTime = options.latestTime || "now";
                
                this.laneSettingsCollection = options.laneSettingsCollection;                
                this.listenTo(this.laneSettingsCollection, "add", this._onLaneAdd);
                this.listenTo(this.laneSettingsCollection, "remove", this._onLaneRemove);
                this.listenTo(this.laneSettingsCollection, "reset", this._resetAllLanes);
            },
            
            events: {
                "click #deep-dive-add-lane": "onAddLaneClick"
            },
            
            /**
             * Set up the DOM
             * @public
             */
            render: function() {
                this.$el.addClass("deep-dive-collection")
                    .append(collectionMarkup);

                if (this._overlay) {
                    this._overlay.render();
                }

                this._onResize();
                // Bind to the window resize
                var lazyOnResize = _.debounce(this._onResize, 150);
                $(window).resize(lazyOnResize.bind(this));

                // Build time range picker
                this._primaryTimePicker = new TimeRangeView({
                    id: 'deep-dive-primary-time-range-picker',
                    el: this.$('.deep-dive-primary-time-picker'),
                    earliest_time: this._earliestTime,
                    latest_time: this._latestTime
                });
                this._primaryTimePicker.render();
                this._primaryTimePicker.on("change", this._onPrimaryTimeRangeChange, this);
                
                // Refresh lane coordination
                this._refreshLaneCoordination();
            },
            
            //
            // Backbone Handled Event Callbacks
            //
            onAddLaneClick: function(e) {
                e.preventDefault();
                var modal = new this._AddLaneModal({
                    id: this.id + "_add_lane_modal",
                    modalTitle: _('Add New Lane').t(),
                    modalPrimaryButtonText: _('Create Lane').t(),
                    laneSettingsCollection: this.laneSettingsCollection
                });
                $("body").append(modal.render().el);
                modal.show();
            },

            _describeToUrl: function() {
                deepDiveUtils.updateUrlState({
                    laneOrder: (this.$('.deep-dive-lane-title').map(function(i, v) {
                        return encodeURIComponent($(v).text()); }).get()).join('&'),
                    lanesCollapsed: (this.$('.deep-dive-lane-collapsed').map(function(i, v) {
                        return encodeURIComponent($('.deep-dive-lane-title', v).text());}).get()).join('&')
                });
            },

            recalculateGeometry: function() {
                _.each(this._laneViewManifest, function(laneView) { laneView.resize(); });
                this._describeToUrl();
            },

            _onResize: function() { 
                this.trigger('resize'); 
                this.recalculateGeometry();
            },
            
            //
            // Time Range Change Callbacks
            //
            /**
             * Adjust the time range of all searches when time range changes
             * @private
             */
            _onPrimaryTimeRangeChange: function() {
                var pickerVal = this._primaryTimePicker.val();
                var sanitaryTimeValues = {
                    earliestTime: pickerVal.earliest_time,
                    latestTime: pickerVal.latest_time
                };
                this._earliestTime = sanitaryTimeValues.earliestTime;
                this._latestTime = sanitaryTimeValues.latestTime;
                
                // Disable the time window and the now defunct full time domain
                this.viewController.set({
                    minWindowedPlotDomain: null,
                    maxWindowedPlotDomain: null,
                    minPlotDomain: null,
                    maxPlotDomain: null
                }, {silent: true});
                
                _.each(this._dataManagerManifest, function(dm) {
                    dm.set(sanitaryTimeValues);
                });
            },
            
            /**
             * window the time range of data managers to our min and max viewport
             * @private
             */
            _windowTimeRange: function() {
                var minTime = this.viewController.get("minWindowedPlotDomain");
                var maxTime = this.viewController.get("maxWindowedPlotDomain");

                /* Time management for the viewport display purpose only. */
                if (minTime === null && maxTime === null) {
                    this.viewController.set('minOriginalPlotDomain', null);
                    this.viewController.set('maxOriginalPlotDomain', null);
                } else if (this.viewController.get('minOriginalPlotDomain') === null &&
                           this.viewController.get('maxOriginalPlotDomain') === null) {
                    this.viewController.set('minOriginalPlotDomain', this.viewController.get('minPlotDomain'));
                    this.viewController.set('maxOriginalPlotDomain', this.viewController.get('maxPlotDomain'));
                }

                _.each(this._dataManagerManifest, function(dm) {
                    dm.windowTimeRange(minTime, maxTime);
                });
            },

            /**
             * Compute the data for each lane's marker based on the
             * domain position specified.  This is a much richer
             * object than the original, and a much more absolute one.
             * The inspector is no longer guessing where a swimlane is
             * on the screen; it now knows.  It also knows what kind
             * of swimlane it is, and can pick different overlay types
             * as necessary.
             *
             * @private
             * @param {number} timePosition the actual position on the domain for which to get the data
             */
            _getLaneInspectorData: function(timePosition) {
                var makeInspectorData = function(laneSettings) {
                    var laneView = this._laneViewManifest[laneSettings.id];
                    return {
                        settings: laneSettings,
                        view: laneView
                    };
                }.bind(this);

                var canInspectData = function(laneSettings) { 
                    return this._laneViewManifest[laneSettings.id].canRender();
                }.bind(this);

                return _.map(this.laneSettingsCollection.filter(canInspectData), makeInspectorData);
            },

            //
            // Internal Properties
            //
            /**
             * keeps track of all lane views initialized
             * @private
             */
            _laneViewManifest: {},
            
            /**
             * keeps track of all data managers initialized
             * @private
             */
            _dataManagerManifest: {},
            
            /**
             * stores the earliest time for all searches
             * @private
             */
            _earliestTime: "-60m",
            
            /**
             * stores the latest time for all searches
             * @private
             */
            _latestTime: "now",
            
            /**
             * flag for whether user is currently creating a time window
             * @type {boolean}
             * @private
             */
            _timeWindowed: false,
            
            //
            // Lane Collection Management Methods
            //
            /**
             * register a lane as under our management
             * @param {DeepDiveLaneView} lane the deep dive lane to register
             * @private
             */
            _registerLaneView: function(lane) {
                this._laneViewManifest[lane.id] = lane;
            },
            
            /**
             * deregister a lane from our management
             * @param {DeepDiveLaneView|string} lane the deep dive lane to deregister or its id
             * @private
             */
            _deregisterLaneView: function(lane) {
                var id;
                if (lane instanceof DeepDiveLaneView) {
                    id = lane.id;
                }
                else {
                    id = lane;
                }
                delete this._laneViewManifest[id];
            },
            
            /**
             * register a data manager as under our management
             * @param {DataManagerModel} dm the data manager model to register
             * @private
             */
            _registerDataManager: function(dm) {
                this._dataManagerManifest[dm.id] = dm;
            },
            
            /**
             * deregister a data manager as under our management
             * @param {DataManagerModel|string} dm the data manager model to deregister or its id
             * @private
             */
            _deregisterDataManager: function(dm) {
                var id;
                if (dm instanceof DataManagerModel) {
                    id = dm.id;
                }
                else {
                    id = dm;
                }
                delete this._dataManagerManifest[id];
            },
            
            /**
             * event handler for the addition of a lane to the laneSettingsCollection
             * @param {DeepDiveLaneModel} laneSettings the lane model added
             * @private 
             */
            _onLaneAdd: function(laneSettings, updateGeometry) {
                updateGeometry = _.isUndefined(updateGeometry) ? true : updateGeometry;
                // Augment the laneSettings with an id
                // Note that id from the settings are not audited for safe selector don't use an unsafe selector
                var laneId = laneSettings.id || _.uniqueId('lane-');
                laneSettings.set("id", laneId);
                
                // Compute a time range for the lane such that it matches the other existent lanes
                var dataEarliest = this.viewController.get('minPlotDomain') || this._earliestTime;
                var dataLatest = this.viewController.get('maxPlotDomain') || this._latestTime;
                
                var searchMode = laneSettings.get('searchMode');
                var dm = ((searchMode === 'sharedSearchMgr') ? laneSettings.get('searchMgr') :
                    new DataManagerModel({
                        earliestTime: dataEarliest,
                        latestTime: dataLatest,
                        search: laneSettings.get('search'),
                        id: laneId
                    })
                );
                
                // Window the time range if it is currently windowed
                if (this.viewController.get('minWindowedPlotDomain') !== null && this.viewController.get('maxWindowedPlotDomain') !== null) {
                    dm.windowTimeRange(this.viewController.get('minWindowedPlotDomain'), this.viewController.get('maxWindowedPlotDomain'));
                }
                
                // Create a container for the lane
                this.$(".deep-dive-lanes-container-list").append('<div id="' + laneId + '" class="deep-dive-lane-container"></div>');

                // Create the Deep Dive Lane
                var lane = new DeepDiveLaneView({
                    id: laneId,
                    el: this.$("#" + laneId),
                    laneSettings: laneSettings,
                    searchMode: searchMode,
                    dataManager: dm,
                    laneController: this,
                    viewController: this.viewController
                });
                
                this._registerDataManager(dm);
                this._registerLaneView(lane);
                
                // Render the lane
                lane.render();
                
                // Update collection overlay
                if (updateGeometry) {
                    this._onResize();
                }
            },
            
            /**
             * event handler for removal of a lane from the laneSettingsCollection
             * repsonsible for the safe destruction of all the things
             * @param {DeepDiveLaneModel} laneSettings the lane model removed
             * @private
             */
            _onLaneRemove: function(laneSettings) {
                var laneId = laneSettings.id;
                this._destroyLane(laneId);
                
                // Update collection overlay
                this._onResize();
            },
            
            /**
             * helper method for common functionality of destroying a lane and 
             * its associated data manager
             * @param {string} laneId the id of the lane to destroy
             * @private
             */
            _destroyLane: function(laneId) {
                // Clean up the lane view
                if (!this._laneViewManifest.hasOwnProperty(laneId)) {
                    throw "DeepDiveLaneCollectionView cannot remove lane that is not under management";
                }
                var laneView = this._laneViewManifest[laneId];
                laneView.remove();
                this._deregisterLaneView(laneId);
                
                // Clean up the lane view's container
                this.$("#" + laneId).remove();
                
                // Clean up the lane's data manager only in standalone mode
                // This leaves stale shared data managers in the manifest,
                // but those should be rare
                if (laneView.searchMode === 'standalone') {
                    var dm = this._dataManagerManifest[laneId];
                    dm.dispose();
                    this._deregisterDataManager(laneId);
                }
            },
            
            /**
             * safely remove all currently rendered lanes from DOM and memory
             * @private
             */
            _resetAllLanes: function() {
                var that = this;
                var keys = _.keys(this._laneViewManifest);
                _.each(keys, function(laneId) {
                    that._destroyLane(laneId);
                });
                this.laneSettingsCollection.each(function(lane) {
                    that._onLaneAdd(lane, false);
                });
                this._onResize();
            },
            
            //
            // Lane Coordination Methods
            //
            /**
             * Set up any multi lane functionality such as sortability
             * @private
             */
            _refreshLaneCoordination: function() {
                $(".deep-dive-lanes-container-list", this.$el).sortable({
                    handle: ".deep-dive-lane-handle,.deep-dive-lane-header",
                    cancel: ".deep-dive-lane-messages, .deep-dive-lane-actions-container",
                    helper: "clone",
                    items: ".deep-dive-lane-container",
                    axis: "y",
                    delay: 150,
                    start: this._onLaneSortStart.bind(this),
                    stop: this._onLaneSortStop.bind(this)
                });
            },
            
            /**
             * Handler for sort start, give the mock lane a top border
             * and set the sort active
             * @param {Event} e the event object
             * @param {Object} ui the jQuery UI informational object
             * @private
             */
            _onLaneSortStart: function(e, ui) {
                // Suppress lane inspector
                if (this._overlay) { this._overlay.hide(); }
                this._sortActive = true;
                $(".deep-dive-lane", ui.helper).css('border-top-width','1px');
            },
            
            /**
             * Handler for sort stop, adjust the models position in the collection
             * @param {Event} e the event object
             * @param {Object} ui the jQuery UI informational object
             * @private
             */
            _onLaneSortStop: function(e, ui) {
                this._sortActive = false;
                
                // Index is the DOM element index - 1 due to our overlay div
                var newLaneIndex = ui.item.index() - 1;
                var laneId = ui.item.attr("id");
                var laneSettings = this.laneSettingsCollection.get(laneId);
                this.laneSettingsCollection.remove(laneSettings, {silent: true});
                this.laneSettingsCollection.add(laneSettings, {
                    silent: true,
                    at: newLaneIndex
                });
                _.each(this._laneViewManifest, function(laneView) { laneView.reposition(); });
                this._describeToUrl();
            },
            
            /**
             * compute the extents of all lanes and return the composite time extent
             * @returns {Array} time extent of all lanes as [minTime, maxTime]
             * @public
             */
            getTimeExtent: function() {
                var timeData = [];
                _.each(this._laneViewManifest, function(lane) {
                    timeData = timeData.concat(lane.getTimeExtent());
                });
                
                var timeExtent = d3.extent(timeData, function(d) {
                    return deepDiveUtils.isNum(d) ? d : undefined;
                });
                
                // Update our state for any of our subscribers
                this.viewController.set({
                    minPlotDomain: timeExtent[0],
                    maxPlotDomain: timeExtent[1]
                });
                
                return timeExtent;
            },
            
            handleAddLane: function() {
                throw "not implemented probably don't need it but whatever it is for the add button on the lane";
            }
        });
        
        return DeepDiveLaneCollectionView;
    }
);
