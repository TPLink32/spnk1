define(function(require, exports, module) {
	var _ = require('underscore');
	var $ = require('jquery');
	var TextInputView = require('splunkjs/mvc/textinputview');

	var TooltipTextboxView = TextInputView.extend({
		moduleId: "TooltipTextboxView",

		options: {
			tooltipText: ''
		},

		initialize: function() {
			this.options = _.extend({}, TextInputView.prototype.options, this.options);
			TextInputView.prototype.initialize.apply(this, arguments);
		},

		createView: function() {
			var viz = TextInputView.prototype.createView.apply(this, arguments);

			if ($.trim(this.options.tooltipText)) {
				var $tooltipEl = $('<span class="icon-question-circle"></span>').css({
					'cursor': 'pointer',
					'color': '#5379af',
					'font-size': '20px',
					'padding-left': '3px'
				}).mouseover(function() {
					$(this).css('color', '#32496a');
				}).mouseout(function() {
					$(this).css('color', '#5379af');
				});
				$tooltipEl.attr('title', this.options.tooltipText);
				this.$el.append($tooltipEl);
			}

			return viz;
		}

	});

	

	return TooltipTextboxView;
});
