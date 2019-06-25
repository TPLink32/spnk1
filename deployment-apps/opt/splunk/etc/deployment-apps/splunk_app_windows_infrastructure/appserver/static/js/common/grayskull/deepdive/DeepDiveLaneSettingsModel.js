define(["underscore", "jquery", "backbone"], 
	function (_, $, Backbone) {
		
		/**
		 * DeepDiveLaneModel holds the state of a particular lane. 
		 */
		var DeepDiveLaneSettingsModel = Backbone.Model.extend({
			//
			// Overrides of Backbone Methods
			//
			/**
			 * Called when the DeepDiveLaneModel is instantiated. 
			 * @param {Object} attributes are overrides of the default attribute values to set on the model
			 * @param {Object} options are the constructor parameters for the model
			 */
			initialize: function(attributes, options) {
				// Call Parent Class initialize method
				Backbone.Model.prototype.initialize.apply(this, arguments);
			},
			
	         /**
             * Default lane setting values
             * This also acts as the catalog of valid settings
             * 
             * LANE ONLY
             * title: the title of the lane to display
             * subtitle: the subtitle of the lane to display
             * graphType: the type of graph to render
             * searchMode: "standalone" - indicates this lane retrieves results
             *                          from a standalone search defined in "search"
             *           "sharedSearchMgr" - indicates this lane retrieves results
             *                          from a shared search manager defined in "searchMgr"
             *                          whose "searchMgrRowIdx"th row corresponds to data
             *                          for this lane
             * search: the search (standalone) to use to get data
             * searchMgr: the shared DataManagerModel object to retrieve result from.
             *          this is used when the results for this lane are returned
             *          as a row from the search running in the searchMgr. This
             *          allows sharing data manager across multiple lanes.
             * customActions: array of classes for custom views to add to menu for the lane
             * 
             * ALL GRAPH TYPES:
             * graphColor: the color of the graph to render
             * 
             * LINE, COLUMN, AREA
             * graphSeries: the field in the data which to plot as the range
             * 
             * @protected
             */
			defaults: {
				title: "New Lane",
				subtitle: "",
				statusColor: "gray",
				searchMode: "standalone",
				search: " * | timechart count",
				graphType: "line",
				graphColor: "#6AB7C7",
				graphSeries: null,
				latestScore: null,
				scoreUnits: null,
				customActions: null
			}
		});
		
		
		
		return DeepDiveLaneSettingsModel;
	}
);