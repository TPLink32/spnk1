define(["underscore", "jquery", "backbone", "splunkjs/mvc/messages", "common/grayskull/common/DataManagerModel"], 
	function (_, $, Backbone, Messages, DataManager) {
		
		/**
		 * DataManagerView is the abstract class for any view that wishes to 
		 * render the results of a search controlled by a DataManagerModel. 
		 * 
		 * The implementation of this view must overload the renderData method 
		 * to handle fresh data from the bound DataManagerModel. 
		 */
		var DataManagerView = Backbone.View.extend({
			//
			// Overrides of Backbone Methods
			//
			/**
			 * Called when the DataManagerView is instantiated. 
			 * @param {Object} options are the constructor parameters for the model
			 * @param {Object} options.dataManager DataManager reference from which we will derive data
			 * @param {string} options.searchMode:
			 *             "standalone" - indicates this lane retrieves results
             *                            from a standalone search defined in "search"
             *             "sharedSearchMgr" - indicates this lane retrieves results
             *                            from a shared search manager defined in "searchMgr"
			 */
			initialize: function(options) {
				// Call Parent Class initialize method
				Backbone.View.prototype.initialize.apply(this, arguments);
				this.id = this.id || this.cid;
				
				this.searchMode = 'standalone';
				if (options.searchMode !== null && options.searchMode !== undefined) {
                    this.searchMode = options.searchMode;
                }
				
				if (options.dataManager !== null && options.dataManager !== undefined) {
					this.setDataManager(options.dataManager);
				}
				
			},
			//
			// Internal Properties
			//
			/**
			 * This is the data manager the view will derive all data from. 
			 * Do not set this property directly! use the mutator methods. 
			 * @protected
			 */
			dataManager: null,
			
            /**
             * See options.searchMode in initialize. 
             * Do not set this property directly! use the mutator methods. 
             * @protected
             */
			searchMode: null,
			
			//
			// Protected Callbacks
			//
			
			/**
			 * Overloaded by the inheritors of the class. This is the callback 
			 * for when new data is available.
			 * @protected
			 */
			renderData: function() {
				throw "DataManagerView:" + this.id + " renderData not implemented";
			},
			
			/**
			 * Overloaded by the inheritors of the class. This is the callback 
			 * for when searches return nothing.
			 * @protected
			 */
			renderNoResults: function() {
				return this;
			},
			
			/**
			 * Overloaded by the inheritors of the class. This is the callback 
			 * for when search is still running and indicating progress
			 * @protected
			 */
			renderProgress: function() {
				return this;
			},
			
			/**
			 * Overloaded by inheritors of the class. This is the callback for 
			 * displaying search/error messages regarding this component.
			 * @protected
			 */
			displayMessage: function(msg) {
				return this;
			},
			
			//
			// Private Search Handlers
			//
			
			/**
			 * when data manager issues search progress determine if we have 0 results or still waiting for data
			 * @private
			 */
			_onSearchProgress: function(properties) {
				properties = properties || {};
				var content = properties.content || {};
				var previewCount = content.resultPreviewCount || 0;
				var isJobDone = content.isDone || false;
				
				if (previewCount === 0 && isJobDone) {
					this.renderNoResults(properties);
				}
				else {
					this.renderProgress(properties);
				}
			},
			
			/**
			 * display a message for search start
			 * @private
			 */
			_onSearchStart: function() {
				this._isJobDone = false;
				this.displayMessage('waiting');
			},
			
			/**
			 * display a message for search cancelled
			 * @private
			 */
			_onSearchCancelled: function() {
				this._isJobDone = false;
				this.displayMessage('cancelled');
			},
			
			/**
			 * display a message for when the search errors out
			 * @private
			 */
			_onSearchError: function(message, err) {
				this._isJobDone = false;
				var msg = Messages.getSearchErrorMessage(err) || message;
				this.displayMessage({
					level: "error",
					icon: "warning-sign",
					message: msg
				});
			},
			
			/**
			 * display a message for a search failure
			 * @private
			 */
			_onSearchFailed: function(state, job) {
				var msg = Messages.getSearchFailureMessage(state);
				this.displayMessage({
					level: "error",
					icon: "warning-sign",
					message: msg
				});
			},
			
			//
			// Public Methods
			//
			/**
			 * Set a given data manager as the main data manager for the view
			 * @param {Object} dataManager DataManager reference to which to bind the view
			 * @public
			 */
			setDataManager: function(dataManager) {
				// Validate Args
				if (!(dataManager instanceof DataManager)) {
					throw "DataManagerView:" + this.id + " cannot set dataManager to non data manager object";
				}
				
				if (this.dataManager instanceof DataManager && this.searchMode !== 'standalone') {
				    throw "DataManagerView:" + this.id + " cannot change dataManager since it is not in standalone search mode";
				}
				
				this.unsetDataManager();
				this.dataManager = dataManager;
				this.listenTo(dataManager, "change:data", this.renderData);
				this.listenTo(dataManager, "search:progress", this._onSearchProgress);
				this.listenTo(dataManager, "search:start", this._onSearchStart);
				this.listenTo(dataManager, "search:cancelled", this._onSearchCancelled);
				this.listenTo(dataManager, "search:error", this._onSearchError);
				this.listenTo(dataManager, "search:fail", this._onSearchFailed);
				
				if (this.dataManager.get("data").length > 0) {
					// We are late to the party, run our data render
					this.renderData();
				}
			},
			
			/**
			 * Remove the event bindings and associations with the current 
			 * dataManager and set it to null. Note that any binding done with 
			 * a listenTo style syntax will be unbound.
			 * @public
			 */
			unsetDataManager: function() {
				// If we have a valid data manager stop listening to it
				if (this.dataManager instanceof DataManager) {
					this.stopListening(this.dataManager);
				}
				this.dataManager = null;
			},
			
			//
			// Utilities
			//
			foo: function() {
				return "foo";
			}
		});
		
		
		
		return DataManagerView;
	}
);