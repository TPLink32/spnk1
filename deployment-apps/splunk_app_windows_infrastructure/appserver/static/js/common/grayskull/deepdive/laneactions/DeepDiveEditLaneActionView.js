define([
		'underscore',
		'jquery',
		'backbone',
		'common/grayskull/deepdive/DeepDiveLaneSettingsModalView'
	],
	function (
		_,
		$,
		Backbone,
		DeepDiveLaneSettingsModalView
	) {
		// Set up template
		var compiledTemplate = _.template('<a><%- _("Edit Lane").t() %></a>');
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
			 * @param {Modal} options.ModalView hte modal to open for edit
			 */
			initialize: function(options) {
				// Keep a reference to our lane
				this._lane = options.lane;
				
				// Keep a reference to our Modal
				this._ModalView = options.ModalView || DeepDiveLaneSettingsModalView;
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
					// Open up an edit dialog for this lane
					var modal = new this._ModalView({
						id: this.id + "_edit_lane_modal",
						modalTitle: _('Edit Lane').t(),
						modalPrimaryButtonText: _('Finished').t(),
						laneSettings: this._lane.laneSettings
					});
					$("body").append(modal.render().el);
					modal.show();
				}
			}
		});
		
		return  DeepDiveEditLaneActionView;
	}
);