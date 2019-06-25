define([
		'underscore',
		'jquery',
		'backbone',
		'views/shared/dialogs/TextDialog',
		'splunk.util',
		'app-components/deepdive/DeepDiveLaneSettingsCollection'
	],
	function (
		_,
		$,
		Backbone,
		TextDialog,
		splunkUtils,
		DeepDiveLaneSettingsCollection
	) {
		// Set up template
		var compiledTemplate = _.template('<a><%- _("Delete Lane").t() %></a>');
		/**
		 * The EditLaneActionView encapsulates the link for editing a lane and 
		 * the logic for wiring it up between all the Views. 
		 */
		var DeepDiveEditLaneActionView = Backbone.View.extend({
			//
			// Overrides of Backbone Methods
			//
			tagName: 'li',
			className: 'deep-dive-lane-action',
			/**
			 * Called when the EditLaneActionView is instantiated. 
			 * @param {Object} options are the constructor parameters for the view
			 * @param {DeepDiveLaneView} options.lane the lane we are acting on 
			 */
			initialize: function(options) {
				// Keep a reference to our lane
				this._lane = options.lane;
			},
			render: function() {
				// Pass in our underscore for i18n
				var markup = compiledTemplate({ _ : _ });
				this.$el.html(markup);
				return this;
			},
			events: {
				"click a": function(e) {
					e.preventDefault();
					// Open up a delete dialog for this lane
					var deleteDialog = new TextDialog({id: this.id + "_edit_lane_modal"});
					//override DialogBase dialogShown to put focus on the Delete button
					deleteDialog.dialogShown = function() {
						this.trigger("show");
						// Apply focus to the first text input in the dialog.
						_.debounce(function() {
							this.$('.btn-primary:first').focus();
						}.bind(this), 0)();
						return;
					};
					
					deleteDialog.settings.set("primaryButtonLabel", _("Delete").t());
					deleteDialog.settings.set("cancelButtonLabel", _("Cancel").t());
					deleteDialog.settings.set("titleLabel", _("Delete Lane").t());
					deleteDialog.setText(splunkUtils.sprintf(_('Are you sure you want to delete %s?').t(), '<em>' + this._lane.laneSettings.get('title') + '</em>'));
					
					deleteDialog.on('click:primaryButton', function() {
							var laneSettings = this._lane.laneSettings;
							var laneCollection = laneSettings.collection;
							if (laneCollection instanceof DeepDiveLaneSettingsCollection) {
								laneCollection.remove(laneSettings);
							}
							deleteDialog.hide();
						}, this);
					deleteDialog.on("hidden", function(){
							deleteDialog.remove();
						}, this);

					$("body").append(deleteDialog.render().el);
					deleteDialog.show();
				}
			}
		});
		
		return  DeepDiveEditLaneActionView;
	}
);