requirejs.config({
    paths: {
        'text': './contrib/text'
    }
});
define([
		'jquery',
		'underscore',
		'backbone',
		'views/shared/delegates/Popdown',
		'common/grayskull/common/controls/datetimepicker/DateTimePickerView',
		'common/grayskull/deepdive/DeepDiveUtils',
		'text!common/grayskull/deepdive/DeepDiveTwinTimePickerView.html',
		'css!common/grayskull/deepdive/DeepDiveTwinTimePickerView.css'
	],
	function (
		$,
		_,
		Backbone,
		Popdown,
		DateTimePicker,
		deepDiveUtils,
		template,
		CSS
	) {

		/**
		 * Provides event routing for the popdown since it mutates the DOM on creation
		 */
		var PopdownEventRouter = Backbone.View.extend({
			/**
			 * Initialized the View
			 * @param {Object} options, the construction options for the Backbone.View
			 * @param {DeepDiveTwinTimePickerView} twinTimePicker, a reference to the twin time picker for which we are routing events
			 */
			initialize: function(options) {
				this.parent = options.twinTimePicker;
			},
			events: {
				"click a.twin-time-picker-preset": function(e) {
					var preset = $(e.target).data("time-preset");
					
					this.parent.setTwinsiesActive(preset);
					
					// Reach around to our popdown to hide it when a preset is clicked
					this.parent.popdown.hide();
				},
				"click a.deep-dive-twin-time-picker-anchor-apply": function(e) {
					e.preventDefault();
					
					var epochAnchor = this.parent.dateTimePicker.dateTimeModel.strftime("%s");
					
					this.parent.setTwinsiesActive(epochAnchor);
					
					// Reach around to our popdown to hide it when a preset is clicked
					this.parent.popdown.hide();
				}
		 	},
		});
		
		/**
		 * provides indication that twinsies is active
		 * @constant
		 * @type {string}
		 */
		var ACTIVE_CHECKBOX_MARKUP = '<i class="icon-box-checked"></i>';
		
		/**
		 * provides indication that twinsies is inactive
		 * @constant
		 * @type {string}
		 */
		var INACTIVE_CHECKBOX_MARKUP = '<i class="icon-box-unchecked"></i>';
		
		/**
		 * The TwinTimePicker enables the selection of an end time anchor point 
		 * for the generation of "twin" lanes in deep dive.
		 * @type {Backbone.View}
		 */
		var DeepDiveTwinTimePickerView = Backbone.View.extend({
			/**
			 * Called when the picker is initialized
			 * @param {Object} options, the initialization options
			 */
			initialize: function(options) {
				/**
				 * reference to the lane collection controller
				 * @public
				 * @type {DeepDiveLaneCollectionView}
				 */
				this.laneCollection = options.laneCollection;
				
				/**
				 * indicates if twinsies is active or not
				 * @private
				 * @type {boolean}
				 */
				this._twinsiesActive = false;
				
				/**
				 * store the last picked preset/timerange for people who click the checkbox
				 * @private
				 * @type {string}
				 */
				this._lastTwinTime = "Yesterday";

				/**
				 * label
				 * @private
				 * @type {string}
				 */
				this.label = options.label || "Compare to" ;
				
				/**
				 * give users the option to pick an anchor point in time using a date time picker
				 * @public
				 * @type {DateTimePickerView}
				 */
				this.dateTimePicker = new DateTimePicker({
					label: ""
				});
			},
			
			events: {
				"click .deep-dive-twin-time-picker-checkbox-container" : "toggleTwinsies"
			},
			
			/**
			 * 
			 */
			render: function() {

				this.$el.html(_.template(template, {
					_ : _,
					label: this.label
				}));

				this.popdown = new Popdown({
					el: this.el,
					mode: "dialog",
					ignoreClasses: ["ui-datepicker"],
					attachDialogTo:'body',
					toggle: ".deep-dive-twin-time-picker-toggle",
					dialog: ".deep-dive-twin-time-picker-popdown"
				});

				/**
				 * handles the event scoping since the popdown moves around
				 * @type {PopdownEventRouter}
				 * @private
				 */
				this._popdownEventRouter = new PopdownEventRouter({
					el: this.popdown.$(".deep-dive-twin-time-picker-content"),
					twinTimePicker: this
				});
				
				this.dateTimePicker.setElement(this.popdown.$(".deep-dive-twin-time-picker-anchor"));
				this.dateTimePicker.render();
				
				return this;
			},
			//
			// Event Handlers
			//
			toggleTwinsies: function() {
				if (this._twinsiesActive) {
					this.setTwinsiesInactive();
				}
				else {
					var isPreset = !deepDiveUtils.isNum(this._lastTwinTime);
					
					this.setTwinsiesActive(this._lastTwinTime);
				}
			},
			
			//
			// Public Utilities
			//
			/**
			 * set the checkbox to checked showing that twinsies is active
			 * @public
			 */
			setTwinsiesActive: function(twinTime) {
				this._twinsiesActive = true;
				this.$(".deep-dive-twin-time-picker-checkbox-container").html(ACTIVE_CHECKBOX_MARKUP);
				this._lastTwinTime = twinTime;
				// We know the preset is in the translation table since the list itself is translated
				var anchorLabel = deepDiveUtils.isNum(twinTime) ? _("Custom Time Anchor").t() : _(twinTime).t();
				this.$(".deep-dive-twin-time-picker-active-val").text(anchorLabel);
				this.trigger('toggle', {active: this._twinsiesActive, timeframe: this._lastTwinTime});
			},
			/**
			 * set the checkbox to checked showing that twinsies is inactive
			 * @public
			 */
			setTwinsiesInactive: function() {
				this._twinsiesActive = false;
				this.$(".deep-dive-twin-time-picker-checkbox-container").html(INACTIVE_CHECKBOX_MARKUP);
				this.trigger('toggle', {active: this._twinsiesActive, timeframe: this._lastTwinTime});
			}
		});
		
		return DeepDiveTwinTimePickerView;
	}
);
