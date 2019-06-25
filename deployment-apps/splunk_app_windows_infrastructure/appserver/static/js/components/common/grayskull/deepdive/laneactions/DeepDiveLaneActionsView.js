define([
		'underscore',
		'jquery',
		'backbone',
		'app-components/deepdive/laneactions/DeepDiveEditLaneActionView',
		'app-components/deepdive/laneactions/DeepDiveDeleteLaneActionView',
		'views/shared/delegates/Popdown',
		'text!app-components/deepdive/laneactions/DeepDiveLaneActionsView.html',
		'css!app-components/deepdive/laneactions/DeepDiveLaneActionsView.css'
	],
	function (
		_,
		$,
		Backbone,
		DeepDiveEditLaneActionView,
		DeepDiveDeleteLaneActionView,
		Popdown,
		actionsMarkup,
		CSS
	) {
		var CustomPopdown = Popdown.extend({
			initialize: function(options) {
				this._lane = options.lane || {};
				Popdown.prototype.initialize.apply(this, arguments);
			},
			toggle: function() {
				var superFlag = Popdown.prototype.toggle.apply(this, arguments);
				if (superFlag) {
					this._lane.keepActionsShown = true;
					this._lane.$(".deep-dive-lane-actions-container").show();
				}
				return superFlag;
			},
			hearHide: function() {
				var superFlag = Popdown.prototype.hearHide.apply(this, arguments);
				this._lane.keepActionsShown = false;
				this._lane.$(".deep-dive-lane-actions-container").hide();
				return superFlag;
			}
		});
		/**
		 * The DeepDiveLaneActionsView acts as the controller for the lane 
		 * actions menu items. It provides actions specific to the configuration 
		 * and utilization of the lane that owns it. 
		 */
		var DeepDiveLaneActionsView = Backbone.View.extend({
			//
			// Overrides of Backbone Methods
			//
			/**
			 * Called when the DeepDiveLaneActionsView is instantiated. 
			 * @param {Object} options are the constructor parameters for the view
			 * @param {DeepDiveLaneView} options.lane the lane we are acting on
			 * @param {customActions} options.customActions the custom actions to replace for the lane 
			 * #TODO: document the extensibility of the menu once you figure it out most likely an array of custom actions
			 */
			initialize: function(options) {
				// Keep a reference to our lane
				this._lane = options.lane;
				
				// Track our children as an array of views to add to our menu
				this.children = [];
				
				var laneActions = this._lane.laneSettings.attributes.customActions;
				if (_.isUndefined(laneActions) || _.isNull(laneActions)) {
    				this.children.push(new DeepDiveEditLaneActionView({lane: this._lane}));
    				this.children.push(new DeepDiveDeleteLaneActionView({lane: this._lane}));
				} else {
				    var that = this;
				    _.each(laneActions, function(laneAction, laneActionsIndex) {
				        that.children.push(laneAction);
				    });
				}
			},
			render: function() {
				this.$el.html(actionsMarkup);
				this.popdown = new CustomPopdown({
					lane: this._lane,
					el: this.el,
					attachDialogTo:'body'
				});
				
				// Add in our base actions
				var $baseActionList = this.$('.deep-dive-lane-base-actions');
				_.each(this.children, function(actionView) {
					$baseActionList.append(actionView.render().$el);
                    actionView.delegateEvents();
				}, this);
				
				return this;
			}
		});
		
		return  DeepDiveLaneActionsView;
	}
);
