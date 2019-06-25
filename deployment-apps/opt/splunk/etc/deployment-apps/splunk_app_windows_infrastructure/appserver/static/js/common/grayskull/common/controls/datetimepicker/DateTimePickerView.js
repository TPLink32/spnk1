define([
		"jquery",
		"underscore",
		"backbone",
		"module",
		"models/shared/DateInput",
		"views/Base",
		"views/shared/controls/DateControl",
		"common/grayskull/common/controls/datetimepicker/HoursMinutesSecondsView"
	],
	function($, _, Backbone, module, DateTimeModel, Base, DateControl, HoursMinutesSeconds) {
		/**
		 * This is a slight modification of the date picker normally found in
		 * the TimeRangePicker. It has been branched for stability and reuse. 
		 */
		return Base.extend({
			tagName: 'span',
			className: 'timeinput',
			moduleId: module.id,
			initialize: function(options) {
				Base.prototype.initialize.apply(this, arguments);
				this.dateTimeModel = new DateTimeModel();
				this.children.monthDayYear = new DateControl({
					model: this.dateTimeModel,
					className: 'control pull-left',
					inputClassName: this.options.inputClassName || 'date',
					validate: true
				});

				this.children.hoursMinutesSeconds = new HoursMinutesSeconds({
					model: this.dateTimeModel
				});

				this.$el.addClass(this.options.inputClassName || 'earliest');
			},
			render: function() {
				if (!$.trim(this.el.innerHTML)) {
					var template = _.template(this.template, {
						_: _,
						cid: this.cid,
						label: this.options.label
					});
					this.$el.html(template);

					this.children.monthDayYear.render().appendTo(this.$(".time-mdy").last());
					this.children.hoursMinutesSeconds.render().appendTo(this.$(".time-hms").last());
				} else {
					this.children.monthDayYear.render();
					this.children.hoursMinutesSeconds.render();
				}
				return this;
			},
			template: '<% if (label) { %><label class="control-label" title="<%- label %>"><%- label %></label><% } %>' + 
				'<span class="time-datetime-range form-inline">' + 
					'<span class="time-mdy"></span>' + 
					'<span class="time-hms"></span>' + 
				'</div>'
		});
	}
);