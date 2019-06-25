define(function(require, exports, module) {
	var _ = require('underscore');
	var $ = require('jquery');
	var BaseChoiceView = require('splunkjs/mvc/basechoiceview');
    var _displayMessage = require('../palette-dropdown-patches');

	var WildcardedDropdownView = BaseChoiceView.extend({
		moduleId: "WildcardedDropdownView",
		className: "splunk-choice-input",

		options: {
			valueField: "",
			labelField: "",
			"default": "*",
			"choices": [],
			disabled: false,
			value: undefined
		},

		initialize: function() {
			this.options = _.extend({}, BaseChoiceView.prototype.options, this.options);
			BaseChoiceView.prototype.initialize.apply(this, arguments);
		    this._selectRoot = $('<input type="hidden" />');
		},

		_data: [],
        _displayMessage: _displayMessage,
        _deferredSelection: null,

		createView: function() {
			var that = this;
			that.$el.empty();
			that._selectRoot
				.val(that.options.default || '*')
				.appendTo(that.$el)
				.select2({
					minimumResultsForSearch: 1,
					query: function(options) {
						var results = [];

						if (options.term.indexOf('*') !== -1) {
							results.push({
								id: options.term,
								text: options.term
							});
						}

						_.each(that._data, function(datum) {
							if ($.trim(options.term) === '' ||
								(datum.label || '').indexOf($.trim(options.term)) === 0) {

								results.push({
									id: datum.value,
									text: datum.label || ''
								});
							}
						});

						options.callback({ results: results });
					},
					initSelection: function(element, callback) {
						var val = $.trim(element.val());
						var datum = _.find(that.options.choices, function(datum) { return datum.value === val; });
						if (datum) {
							callback({
								id: datum.value,
								text: datum.label || ''
							});
						} else {
							that._deferredSelection = {
								val: val,
								callback: callback
							};
						}
					},
					formatResult: function(item, el) {
						el.attr('title', item.text);
						return item.text;
					},
					formatSelection: function(item, el) {
						el.attr('title', item.text);
						return item.text;
					}					
				})
				.on('change', function(e) {
					that.val(e.val);
				});
			that.val(that.options.default || '*');
			return that._selectRoot;
		},

		updateView: function(viz, data) {
			var that = this;
			that._data = data;
			if (that._deferredSelection) {
				var datum = _.find(data, function(datum) { return datum.value === that._deferredSelection.val; });
				var callback = that._deferredSelection.callback;
				if (datum) {
					callback({
						id: datum.value,
						text: datum.label || ''
					});
				} else {
					callback();
				}

			}
		},

		updateDomVal: function(value) {
			this._selectRoot.val(value);
		}

	});

	return WildcardedDropdownView;
});
