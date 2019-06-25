define(["underscore", "jquery", "backbone", "splunkjs/mvc/searchmanager"], 
	function (_, $, Backbone, SearchManager) {
		
		/**
		 * DataManagers are the sultans of search manager management. They act 
		 * as an abstraction layer on top of the splunkjs SearchManager infrastructure 
		 * allowing for iterative updating of splunk search results. 
		 * 
		 * Note that in order to use a DataManager's incremental update feature 
		 * the latest time of the search must be set to now AND the keepUpdated 
		 * attr of the DataManager must be set to true. Note that searches using 
		 * this feature should always have a set span.
		 */
		var DataManagerModel = Backbone.Model.extend({
			//
			// Overrides of Backbone Methods
			//
			/**
			 * Called when the DataManager is instantiated. The 
			 * @param {Object} attributes are the tracked properties of the model, 
			 *     they include the following fields: 
			 *         data: the search results as an Array of Arrays
			 *         fields: the fields in the search results as an Array
			 *         search: the search string to use when fetching results
			 *         earliestTime: the earliest time setting for the search
			 *         latestTime: the latest time setting for the search
			 *         keepUpdated: indicates if a search should be kept updated (requires _time in data and latestTime=now)
			 *         minUpdateInterval: if a search is kept updated, this throttles the number of updates per time
			 * @param {Object} options are the constructor parameters for the model
			 */
			initialize: function(attributes, options) {
				// Call Parent Class initialize method
				Backbone.Model.prototype.initialize.apply(this, arguments);
				
				// if id is not set in our attributes then we set it to our client id
				this.id = this.id || this.cid;
				
				// Create a search manager with no token namespace/its own token namespace and set it up with our attrs
				this.searchManager = new SearchManager({
					id: this.id + "_manager",
					earliest_time: this.get("earliestTime"),
					latest_time: this.get("latestTime"),
					preview: false,
					cache: 60,
					status_buckets: 0,
					search : this.get("search"),
					time_format : "%s.%Q"
				}, {tokens:true});
				
				// Bind to search manager's events
				this.resultsModel = this.searchManager.data('preview', {
					output_mode: 'json_rows',
					count: this.returnCount,
					offset: this.returnOffset,
					output_time_format: "%s.%Q"
				});
				
				this.searchManager.on("search:start", this._onSearchStart, this);
				this.searchManager.on("search:progress", this._onSearchProgress, this);
				this.searchManager.on("search:cancelled", this._onSearchCancelled, this);
				this.searchManager.on("search:error", this._onSearchError, this);
				this.searchManager.on("search:fail", this._onSearchFailed, this);
				this.searchManager.on("search:done", this._onSearchDone, this);
				this.resultsModel.on("data", this._onDataChanged, this);
				this.resultsModel.on("error", this._onSearchError, this);
				
				this.searchManager.replayLastSearchEvent(this);
				
				// Keep Updated if we are asked to
				if (attributes.keepUpdated) {
					this._onKeepUpdatedChange();
				}
				
				// Bind to internal settings
				this.listenTo(this, "change:search change:earliestTime change:latestTime", this._onSearchPropertyChange);
				this.listenTo(this, "change:keepUpdated", this._onKeepUpdatedChange);
				
				// Initialize Private Props
				this._timeWindow = {
					minTime: null,
					maxTime: null,
					originalMinTime: this.get("earliestTime"),
					originalMaxTime: this.get("latestTime"),
					dataCache: null
				};
			},
			
			defaults: {
				data: [],
				fields: [],
				search: "*",
				earliestTime: "-4h",
				latestTime: "now",
				keepUpdated: false,
				minUpdateInterval: 60
			},
			
			//
			// Internal Properties
			//
			/**
			 * The search manager used to communicate with splunkd
			 * @type {?Object}
			 * @private
			 */
			searchManager: null,
			
			/**
			 * returnCount and returnOffset
			 * The params used to fetch/paginate results. By default we grab everything.
			 * Right now this is not exposed and changing it does nothing.
			 * @type {number}
			 * @private
			 */
			returnCount: 0,
			returnOffset: 0,
			
			/**
			 * stores the current refresh timer variable
			 * @type {?number}
			 * @private
			 */
			_refreshTimerVariable: null,
			
			/**
			 * stores the lookback time for search refresh updates
			 * @type {string}
			 * @private
			 */
			_refreshLookback: "-20m",
			
			/**
			 * stores the timing for the search completion
			 * @type {Object}
			 * @private
			 */
			_searchTiming: {
				start: null,
				finish: null
			},
			
			/**
			 * stores the current time window information
			 * @private
			 */
			_timeWindow: {
				minTime: null,
				maxTime: null,
				originalMinTime: null,
				originalMaxTime: null,
				dataCache: null
			},
			//
			// Internal Callbacks/Methods
			//
			/**
			 * safely dispose of the internal props of this object that will 
			 * not be caught by the garbage collector, note once called this
			 * thing is worthless and will not work again. 
			 * @public
			 */
			dispose: function() {
				this._teardownDataRefresh();
				this.stopListening(this);
				if (this.searchManager !== null) {
					this.searchManager.dispose();
				}
			},
			
			/**
			 * returns the last search event from our search manager
			 * @returns {string|null} the last search event name or null if none
			 * @public
			 */
			getLastSearchEvent: function() {
				if (this.searchManager instanceof Object && this.searchManager.hasOwnProperty("_lastSearchEvent")) {
					return this.searchManager._lastSearchEvent[0];
				}
				else {
					return null;
				}
			},
			
			/**
			 * replay the last search event on the search manager
			 * @public
			 */
			replayLastSearchEvent: function() {
				this.searchManager.replayLastSearchEvent(this);
			},
			
			/**
			 * Immediately filter the data to the time window and reset the 
			 * search time range to get higher-rez data.
			 * If any arg is null, disable the time window.
			 * 
			 * @param {number|null} minTime the starting time of the time window
			 * @param {number|null} maxTime the ending time of the time window
			 * @public
			 */
			windowTimeRange: function(minTime, maxTime) {
				if (minTime === this._timeWindow.minTime && maxTime === this._timeWindow.maxTime) {
					// Everything is the same, no op
					return;
				}
				
				if (minTime === null || maxTime === null) {
					if (this._timeWindow.dataCache instanceof Array) {
						this.set("data", this._timeWindow.dataCache);
					}
					
					this._timeWindow.minTime = null;
					this._timeWindow.maxTime = null;
					this._timeWindow.dataCache = null;
					// Revert Time Window
					this.set({
						earliestTime: this._timeWindow.originalMinTime,
						latestTime: this._timeWindow.originalMaxTime
					});
				}
				else {
					// Filter the current data property
					this._timeWindow.minTime = minTime;
					this._timeWindow.maxTime = maxTime;
					var fields = this.get("fields");
					var rows = this.get("data");
					if (fields instanceof Array && rows instanceof Array) {
						var timeIndex = _.indexOf(fields, "_time");
						var minIndex = _.sortedIndex(rows, minTime, function(row) { return row instanceof Array ? Number(row[timeIndex]) : Number(row); });
						var maxIndex = _.sortedIndex(rows, maxTime, function(row) { return row instanceof Array ? Number(row[timeIndex]) : Number(row); });
						this.set("data", rows.slice(minIndex,maxIndex));
					}
					if (this._timeWindow.dataCache === null) {
						// This is the first time windowing for this data so preserve it
						this._timeWindow.originalMinTime = this.get("earliestTime");
						this._timeWindow.originalMaxTime = this.get("latestTime");
						this._timeWindow.dataCache = rows;
					}
					this.set({
						earliestTime: minTime,
						latestTime: maxTime
					});
				}
			},
			
			/**
			 * When the search attribute of the data manager changes we need to 
			 * change the search on the search manager and set it to the proper 
			 * time range. We also neeed to clear the search data if the search 
			 * has changed.
			 * @private
			 */
			_onSearchPropertyChange: function() {
				if (this.changed.hasOwnProperty("search")) {
					this.set({data: [], fields: []});
				}

				var searchSettings = {
					search: this.get("search"),
					earliest_time: this.get("earliestTime"),
					latest_time: this.get("latestTime"),
					cache: 60
				};

				this.searchManager.set(searchSettings, {tokens: true});
				this._onKeepUpdatedChange();
			},
			
			/**
			 * When we are constructed or modified with keepUpdated set to true 
			 * we need to set up continuous search calls based on our data. 
			 * @private
			 */
			_onKeepUpdatedChange: function() {
				if (this.get('keepUpdated')) {
					if (this.get("latestTime") !== "now") {
						var errorString = "Data Manager: " + this.id + " cannot be set keepUpdated=true since latestTime is not now (it is" + this.get('latestTime') + ")";
						throw errorString;
					}
					if (this.get("data").length === 0) {
						// If we don't have data yet set up after we do
						this.once("change:data", this._setupDataRefresh, this);
					}
					else {
						this._setupDataRefresh();
					}
				}
				else {
					this._teardownDataRefresh();
				}
			},
			
			/**
			 * Given the data we have, setup a search refresh timeout. 
			 * @private
			 */
			_setupDataRefresh: function() {
				// Clean up any previously setup refreshes
				this._teardownDataRefresh();
				
				var rows = this.get("data");
				var fields = this.get("fields");
				// Validate that we already have data, if not, wait to setup until we do
				if (!rows || !fields) {
					this.once("change:data", this._setupDataRefresh, this);
					return;
				}
				var timeIndex = _.indexOf(fields, "_time");
				var spanIndex = _.indexOf(fields, "_span");
				
				// First we get our time bucket span
				var span = null;
				if (timeIndex === -1) {
					// No time field in the data means we can't iteratively update
					console.warn("Data Manager:", this.id, "cannot keep search updated efficiently without _time in the fields (search is", this.get("search"), ")");
					span = -1;
				}
				else {
					if (spanIndex === -1) {
						// Deduce the span from the last two elements in the time series data
						if (rows.length > 1) {
							var sample = _.last(rows, 2);
							span = Math.abs(Number(sample[0][timeIndex]) - Number(sample[1][timeIndex]));
						}
						else {
							console.warn("Data Manager:", this.id, "cannot keep search updated without _span in the fields nor multiple rows of data (search is", this.get("search"), ")");
							span = -1;
						}
					}
					else {
						// If span is the data we trust it to give us our buckets
						span = Number(rows[0][spanIndex]) || -1;
					}
				}
				var calculateTimeout = function(span, searchDuration) {
					var spanMs = span * 1000;
					if (spanMs < searchDuration) {
						// In this case the search takes longer than a single time bucket of the search, we need to dispatch almost immediately
						return 5;
					}
					else {
						return spanMs - searchDuration;
					}
				};
				// Now we setup the timeout based on the span
				var searchDuration = (this._searchTiming.finish - this._searchTiming.start) || 0;
				if (span < 1) {
					// Since our span is not recognizable we need to redispatch the entire search every fifteen minutes
					this._refreshTimerVariable = window.setInterval(this._refreshAllData.bind(this), (900 * 1000) - searchDuration);
				}
				else {
					// Throttle our update span to the minUpdateInterval
					if (span < this.get("minUpdateInterval")) {
						span = this.get("minUpdateInterval");
					}
					
					// Check that the search data has a total range > 20 minutes
					var dataRange = null;
					if (rows.length > 1) {
						dataRange = Math.abs(Number(_.first(rows)[timeIndex]) - Number(_.last(rows)[timeIndex]));
					}
					if (1200 > dataRange || span > dataRange) {
						// Data does not cover a time range greater than 20 minutes or the span, so just redispatch everything
						this._refreshTimerVariable = setTimeout(this._refreshAllData.bind(this), calculateTimeout(span, searchDuration));
					}
					else {
						if (span > (20 * 60)) {
							// Span is greater than 20 minutes, thus we need a much bigger look back and wait
							this._refreshLookback = "-" + (span * 2).toString() + "s";
						}
						else {
							// Span is smaller than twenty minutes so we just need to tack on the span to the 20 minutes
							this._refreshLookback = "-" + (span + (20 * 60)).toString() + "s";
						}
						this._refreshTimerVariable = setTimeout(this._refreshPartialData.bind(this), calculateTimeout(span, searchDuration));
					}
				}
			},
			
			/**
			 * Teardown any pending search refresh timeouts. 
			 * @private
			 */
			_teardownDataRefresh: function() {
				if (this._refreshTimerVariable !== null) {
					clearTimeout(this._refreshTimerVariable);
					this._refreshTimerVariable = null;
				}
			},
			
			/**
			 * Refresh all of the data in a given search by redispatching the 
			 * entirety of the search.
			 * @private
			 */
			_refreshAllData: function() {
				this.searchManager.startSearch();
				this.trigger("dataupdate:full:start");
				console.log("Data Manager:", this.id, " dataupdate:full:start");
				
				//Once we receive an update we will need to re-setup
				this.once("dataupdate:partial:complete dataupdate:full:complete", this._setupDataRefresh, this);
			},
			
			_refreshPartialData: function() {
				var searchSettings = {
					earliest_time: this._refreshLookback,
					latest_time: "now",
					cache: false
				};
				// Since we are going to force the search manager to start our set need be silent 
				this.searchManager.set(searchSettings, {silent: true});
				this.searchManager.startSearch();
				this.trigger("dataupdate:partial:start");
				console.log("Data Manager:", this.id, " dataupdate:partial:start");
				
				//Once we receive an update we will need to re-setup
				this.once("dataupdate:partial:complete dataupdate:full:complete", this._setupDataRefresh, this);
			},
			
			//
			// Search Manager Callbacks
			//
			/**
			 * Callback for when our search manager returns us data. 
			 * Most important feature here is to merge the new data with any 
			 * existing data.
			 * @private
			 */
			_onDataChanged: function() {
				this._searchTiming.finish = Date.now();
				
				var finalData = {
					fields: [],
					rows: []
				};
				
				//Parse out the fresh data from splunk
				var freshData = this.resultsModel.data();
				
				//Get our current state
				var currentData = {
					fields: this.get("fields") || [],
					rows: this.get("data") || []
				};
				var timeIndex = _.indexOf(currentData.fields, "_time");
				
				// Backbone's deep equality checking for change could prevent us from getting a data event on cached data retrieval, so we force a change event by unsetting here
				this.unset("data", {silent: true});
				
				if (this.get("keepUpdated") && currentData.fields.length > 0 && currentData.rows.length > 0 && timeIndex !== -1) {
					var chrono = this.getChronologicalFunctions(currentData.rows, timeIndex);
					//Check that the fields match
					if (!this.areArraysIdentical(currentData.fields, freshData.fields)) {
						console.warn("Data Manager:", this.id, "fields from update do not match current fields exactly (search is", this.get("search"), ")");
						var missingFields = _.difference(currentData.fields, freshData.fields);
						if (missingFields.length > 0) {
							throw "fresh data field set is missing base data fields: " + missingFields.toString();
						}
						else {
							//This means we have at least the proper fields, just not in the proper order so we sort. 
							var baseFieldSort = function(row, fieldIndex) {
								//Grab the field name of the current field
								var freshField = freshData.fields[fieldIndex];
								var newIndex = _.indexOf(currentData.fields, freshField);
								if (newIndex === -1) {
									// If it is a new field, dump it at the back
									newIndex = freshData.fields.length + fieldIndex;
								}
								return newIndex;
							};
							
							//Set our sorted superset of fields as the final fields
							finalData.fields = _.sortBy(freshData.fields, baseFieldSort);
							
							_.each(freshData.data, function(row, rowIndex, data) {
								row = _.sortBy(row, baseFieldSort);
							});
						}
					}
					else {
						finalData.fields = currentData.fields;
					}
					
					// Get the index after which in time we will stick the freshData
					var ii;
					var timeValue;
					var row;
					var currentLatestClipIndex; 
					var freshEarliest = Number(chrono.earliest(freshData.rows)[timeIndex]);
					if (chrono.order === "chronological") {
						for (ii=currentData.rows.length; ii > 0; ii--) {
							row = currentData.rows[ii - 1];
							timeValue = Number(row[timeIndex]);
							if (freshEarliest > timeValue) {
								currentLatestClipIndex = ii;
								break;
							}
						}
					}
					else {
						for (ii=0; ii < currentData.rows.length; ii++) {
							row = currentData.rows[ii];
							timeValue = Number(row[timeIndex]);
							if (freshEarliest > timeValue) {
								currentLatestClipIndex = ii;
								break;
							}
						}
					}
					
					
					// Get the index before which in time we will drop the data
					var freshRange = Math.abs(Number(chrono.latest(freshData.rows)[timeIndex]) - Number(chrono.latest(currentData.rows)[timeIndex]));
					var currentCutoff = Number(chrono.earliest(currentData.rows)[timeIndex]) + freshRange;
					var currentEarliestClipIndex;
					if (chrono.order === "chronological") {
						for (ii=0; ii < currentData.rows.length; ii++) {
							row = currentData.rows[ii];
							timeValue = Number(row[timeIndex]);
							if (currentCutoff < timeValue) {
								currentEarliestClipIndex = ii;
								break;
							}
						}
					}
					else {
						for (ii=currentData.rows.length; ii > 0; ii--) {
							row = currentData.rows[ii - 1];
							timeValue = Number(row[timeIndex]);
							if (currentCutoff < timeValue) {
								currentEarliestClipIndex = ii;
								break;
							}
						}
					}
					
					
					// Merge the data
					if (chrono.order === "chronological") {
						if (currentLatestClipIndex >= currentData.rows.length) {
							currentLatestClipIndex = undefined;
						}
						finalData.rows = currentData.rows.slice(currentEarliestClipIndex, currentLatestClipIndex).concat(freshData.rows);
					}
					else {
						if (currentEarliestClipIndex >= currentData.rows.length) {
							currentEarliestClipIndex = undefined;
						}
						finalData.rows = freshData.rows.concat(currentData.rows.slice(currentLatestClipIndex,currentEarliestClipIndex));
					}
					this.set({
						fields: finalData.fields,
						data: finalData.rows
					});
					console.log("Data Manager:", this.id, " dataupdate:partial:complete");
					this.trigger("dataupdate:partial:complete");
				}
				else {
					finalData = freshData;
					this.set({
						fields: finalData.fields,
						data: finalData.rows
					});
					console.log("Data Manager:", this.id, " dataupdate:full:complete");
					this.trigger("dataupdate:full:complete");
				}
			},
			/**
			 * Callback for when our search manager triggers a progress event. 
			 * Passes the event through to any of our subscribers. 
			 * @private
			 */
			_onSearchProgress: function(state, job) {
				var content = state.content;
				this._isJobDone = content.isDone || false;
				this.trigger("search:progress", state, job);
				console.log(this.id + 'search:progress');
			},

			_onSearchDone: function(state, job) {
				var content = state.content;
				this.trigger("search:done", state, job);
				console.log(this.id + 'search:done');
			},
			
			/**
			 * Callback for when our search manager triggers a start event. 
			 * Passes the event through to any of our subscribers. 
			 * @private
			 */
			_onSearchStart: function() {
				this._searchTiming.start = Date.now();
				this._isJobDone = false;
				this.trigger("search:start");
				console.log(this.id + 'search:start');
			},
			
			/**
			 * Callback for when our search manager triggers a cancel event. 
			 * Passes the event through to any of our subscribers. 
			 * @private
			 */
			_onSearchCancelled: function() {
				this._isJobDone = false;
				if (!this.get("keepUpdated")) {
					// Do not clear if we want to aggregate
					this.set({
						data: null,
						fields: null
					});
				}
				this.trigger("search:cancel");
				console.log(this.id + 'search:cancel');
			},
			
			/**
			 * Callback for when our search manager triggers an error event. 
			 * Passes the event through to any of our subscribers. 
			 * @private
			 */
			_onSearchError: function(message, err) {
				this._isJobDone = false;
				this.set({
					data: null,
					fields: null
				});
				this.trigger("search:error", message, err);
				console.log(this.id + 'search:error');
			},
			
			/**
			 * Callback for when our search manager triggers a fail event. 
			 * Passes the event through to any of our subscribers. 
			 * @private
			 */
			_onSearchFailed: function(state, job) {
				this._isJobDone = false;
				this.set({
					data: null,
					fields: null
				});

				this.trigger("search:fail", state, job);
                if (state && state.content && state.content.messages && state.content.messages.length) {
				    console.log(this.id + 'search:fail "' + state.content.messages[0].text + '"');
                    return;
                }

				console.log(this.id + 'search:fail');
			},
			//
			// Utilities
			//
			getChronologicalFunctions: function(rows, timeIndex) {
				if (rows.length < 1 || !isFinite(timeIndex) || isNaN(timeIndex)) {
					throw "DataManager:" + this.id + " cannot determine chronological ordering of data without both rows and a timeIndex";
				}
				if (Number(_.first(rows)[timeIndex]) > Number(_.last(rows)[timeIndex])) {
					return {
						order: "reverse_chronological",
						earliest: _.last,
						latest: _.first
					};
				}
				else {
					return {
						order: "chronological",
						earliest: _.first,
						latest: _.last
					};
				}
			},
			areArraysIdentical: function(arr1, arr2) {
				if (arr1.length !== arr2.length) {
					return false;
				}
				for (var ii = 0; ii < arr1.length; ii++) {
					if (arr1[ii] !== arr2[ii]) {
						return false;
					}
				}
				return true;
			}
		});
		
		
		
		return DataManagerModel;
	}
);
