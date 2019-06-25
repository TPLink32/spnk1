requirejs.config({
    paths: {
        'jqueryui': 'contrib/jquery-ui-1.10.4.min',
        'css': 'splunkjs/contrib/require-css/css',
        'app-common': 'common/grayskull/common',
    }, 
    shim: {
        'jqueryui': {
            deps: ['jquery']
        }
    }
});

define([
        'jquery',
        'jqueryui',
        'underscore',
        'backbone',
        'views/Base',
        'views/shared/controls/ControlGroup',
        'common/Utilities',
        'app-common/controls/multirangeverticalslider/MultiRangeVerticalSliderRangesCollection',
        'css!app-common/controls/multirangeverticalslider/MultiRangeVerticalSlider.css'
    ],
    function (
        $, 
        jqueryui,
        _, 
        Backbone,
        BaseView,
        ControlGroup,
        Utilities,
        MultiRangeVerticalSliderRangesCollection,
        CSS
        ) {
    var MultiRangeVerticalSliderView = BaseView.extend({
        initialize: function(options) {
            /*
             * called when the "new" operator is used on the view object
             * @param {object} options is an object that contains settings for the view
             * @param {model} options.minMaxModel of type MultiRangeVerticalSliderRangeDefinitionModel
             * @param {collection} options.rangesCollection of type MultiRangeVerticalSliderRangesCollection
             */
            BaseView.prototype.initialize.apply(this, arguments);
            
            var that = this;
            
            this.rendered = false;
            this.children = {};
            
            var extractMinMaxValues = function() {
                that.minValue = Utilities.extractNumericValue(that.options.minMaxModel.get('min'));
                that.maxValue = Utilities.extractNumericValue(that.options.minMaxModel.get('max'));
                
                if (that.minValue > that.maxValue) {
                    that.minValue = that.maxValue;
                }
            };
            
            this.minMaxValue = this.options.minMaxModel;
            extractMinMaxValues();
            
            var updateMinMaxModel = function() {
                extractMinMaxValues();
                that.$('.slider-main').slider("destroy");
                that._createSlider();
            };
            
            this.listenTo(this.minMaxValue, 'change:max', function(model, newMax) {
                updateMinMaxModel();
            });
            
            this.listenTo(this.minMaxValue, 'change:min', function(model, newMax) {
                updateMinMaxModel();
            });
            
            this.rangesCollection = this.options.rangesCollection;
            // binds to change event on the collection to listen for model changes.
            // if a change occurs, it calls _updateSlider and sends the model that changed and any options of the model.
            this.listenTo(this.rangesCollection, 'change', this._updateSlider);
        },
        
        render: function() {
            var that = this;
            
            var html=_.template('\
                <div>\
                    <div id="slider-values-pane" class="slider-values-pane">\
                        <div class="slider-value">\
                            <label><span>Max: </span>\
                                <input id="slider-maxValue-value" type="text"></input>\
                            </label>\
                        </div>\
                        <div id="slider-values"></div>\
                        <div class="slider-value">\
                            <label><span>Min: </span>\
                                <input id="slider-minValue-value" type="text"></input>\
                            </label>\
                        </div>\
                    </div>\
                    <div>\
                        <div class="slider-main"></div>\
                    </div>\
                </div>\
                ');
            
            this.$el.append(html);
            
            // this is where the slider actually gets created.
            this._createSlider();
            
            this.$('#slider-maxValue-value').val(this.maxValue);
            this.$('#slider-minValue-value').val(this.minValue);
                        
            this.$('#slider-maxValue-value').on('change', function() {
                var value = Utilities.extractNumericValue(this.value);
                
                if (_.isNaN(value) || that._sortedRanges.length > 0 &&
                    value < (that._sortedRanges[that._sortedRanges.length - 1])) {
                    value = (that._sortedRanges[that._sortedRanges.length - 1]);
                }
                
                this.value = value;
                that.minMaxValue.set('max', value);
            });
            
            this.$('#slider-minValue-value').on('change', function() {
                var value = Utilities.extractNumericValue(this.value);
                
                if (that._sortedRanges.length > 0 && value > that._sortedRanges[0]) {
                    value = _.max([(that._sortedRanges[0]), 0]);
                }
                
                this.value = value;
                that.minMaxValue.set('min', value);
            });
            
            return this;
        },
        
        _processRangesCollection: function(){
            var that = this;
            
            var ranges = {};
            
            this.rangesCollection.forEach(function (model){
                ranges[this.rangesCollection.indexOf(model)] = model.get('value');
            });
            
            return ranges;
        },
        
        _createSlider: function() {
            var that = this;
            
            // Create the dom element to put the slider inside.
            this._sliderEl = this.$('.slider-main');
            
            // since the jqueryui slider expects a list for values, we need to parse the models
            var minValue = this.minValue;
            var maxValue = this.maxValue;
            
            var values = [];
            var ranges = [];
            
            this.rangesCollection.forEach(function (model) {
                var modelIndex = that.rangesCollection.indexOf(model);
                
                values[modelIndex] = model.get('value');
                ranges[modelIndex] = model.get('color');
            });
            
            // The slider assumes models are added to the rangesCollection in the order
            // of the handles required starting with the lowest first
            this._sortedRanges = _.map(values, function(value) {
                return Utilities.extractNumericValue(value);
            });
            
            // This is the actual creation of the jquery slider.  It will create a sliderhandle for every
            // value listed in the startThresholds list.  This does not do any styling.  The slide function
            // is called during any change of the slider.  Right now all models are updated while the slider is 
            // moving.  For performance, we could always change this to a "stop" event.
            this._sliderEl.slider({
                orientation: "vertical",
                min: _.isNaN(minValue) ? 0 : minValue,
                max: _.isNaN(maxValue) ? 0 : maxValue,
                values: this._sortedRanges,
                slide: function (event, ui) {
                    var values = $(this).slider('values');
                    
                    var index = $(ui.handle).siblings('a').andSelf().index(ui.handle);
                    
                    validRanges = (index === 0 || ui.value > values[index - 1]) &&
                        (index === values.length - 1 || ui.value < values[index + 1]);
                    
                    if (validRanges) {
                        that.rangesCollection.at(index).set('value', ui.value);  
                        that._updateSliderSpans(this._sliderEl, ui.values, minValue, maxValue);
                    }
                    
                    return validRanges;
                }
            });
            
            // update handle colors and create / update span colors
            this._sliderEl.find('.slider-range').remove();
            for (var index = 0; index < this._sortedRanges.length; index++) {
                var rangeColor = ranges[index];
                
                this.$('.ui-slider-handle').eq(index).css({'background': rangeColor});
                this.$('.ui-slider-handle').eq(index).addClass('slider-handle-' + index);
                
                var rangeClass = 'slider-range-' + index;
                this._sliderEl.append('<span class="slider-range ' + rangeClass + '"></span>');
                this.$('.' + rangeClass).css({'background': rangeColor});
            }
            
            // updates the span positions
            this._updateSliderSpans(this._sliderEl, this._sortedRanges, minValue, maxValue);
            
            //I don't like doing this, but need some way to deal with new models getting created and triggering the update.
            this.rendered = true;
      
            return true;
        },
        
        _updateSlider: function (model, options) {
            /* 
             * @private
             * @param {model} model is passed by the change event on a collection
             * @param {options} options is passed by the change event on a collection
             * this.rendered is triggers when .render() is called on the view the first time.
             * this flag is used to prevent a race condition where a model will trigger a "change"
             * event the first time it is created.
             */
            if (this.rendered) {
                var currentModelId = this.rangesCollection.indexOf(model);
                this.$('.slider-main').slider('values', currentModelId, model.get('value'));
                this.$('.ui-slider-handle').eq(currentModelId).css({'background':model.get('color')});
                this.$(('.slider-range-' + currentModelId)).css({'background':model.get('color')});
            }
        },
        
        _updateSliderSpans: function (slider, values, minValue, maxValue, specificIndexToCheck) {
            var that = this;
            
            // Fix the sorted ranges first
            for (var index = 0; index < values.length; index++) {
                var sliderValueId = 'slider-value-' + index;
                var valueEl = this.$('#' + sliderValueId);
                
                if (!valueEl.length) {
                    var valueToAppend = '\
                        <div style="color: ' + 
                            this.rangesCollection.at(index).get('color') + '" \
                            class="slider-value">\
                            <label><span>' + 
                                this.rangesCollection.at(index).get('label') + ': \
                                </span>\
                                <input id="' + sliderValueId + '" type="text"> \
                                </input>\
                            </label>\
                        </div>';
                    this.$('#slider-values').prepend(valueToAppend);
                    valueEl = this.$('#' + sliderValueId);
                    
                    this.rangesCollection.at(index).set('uiElId', sliderValueId)
                    
                    this.$('#slider-minValue-value')
                    this.$('#' + sliderValueId).on('change', function() {
                        var value = Utilities.extractNumericValue(this.value);
                        
                        this.value = value;
                        if (that.rendered) {
                            var rangeModel = that.rangesCollection.where({uiElId: $(this).attr('id')});
                            
                            if (_.isArray(rangeModel) && rangeModel.length === 1) {
                                var sortedRangesIndex = that.rangesCollection.indexOf(rangeModel[0]);
                                
                                rangeModel[0].set('value', value);
                                
                                if (sortedRangesIndex !== -1) {
                                    that._sortedRanges[sortedRangesIndex] = value;
                                }
                                
                                that._updateSliderSpans(
                                    that._sliderEl,
                                    that._sortedRanges,
                                    that.minValue,
                                    that.maxValue,
                                    sortedRangesIndex
                                    );
                            }
                        }
                    });
                }
                
                if (!_.isUndefined(specificIndexToCheck) && specificIndexToCheck === index) {
                    // Value for a specific threshold has been changed
                    // Fix the sorted ranges if the value specified doesn't 
                    // comply with sorted order
                    var lowValueToCheck = specificIndexToCheck === 0 ? this.minValue : values[index - 1];
                    var highValueToCheck = specificIndexToCheck === values.length - 1 ? this.maxValue : values[index + 1];
                    
                    if (values[specificIndexToCheck] < lowValueToCheck) {
                        valueEl.val(lowValueToCheck);
                        that._sortedRanges[specificIndexToCheck] = lowValueToCheck;

                        that.rangesCollection.at(index).set('value', lowValueToCheck);
                    }
                    
                    if (values[specificIndexToCheck] > highValueToCheck) {
                        valueEl.val(highValueToCheck);
                        that._sortedRanges[specificIndexToCheck] = highValueToCheck;
                        that.rangesCollection.at(index).set('value', highValueToCheck);
                    }
                } else {
                    valueEl.val(values[index]);
                }
            }
                
            // Apply the fixed ranges
            for (var index = 0; index < values.length; index++) {
                var top = 0;
                
                if (index !== values.length - 1) {
                    top = 100 - computePositionPercentage(
                        values[index + 1] > maxValue ? maxValue : values[index + 1],
                        minValue,
                        maxValue
                        );
                } /* else {
                    For the last threshold, top is always the beginning of the slider.
                    Leave top as 0 for this case.
                } */
                
                var bottom = 100 - computePositionPercentage(
                    values[index],
                    minValue,
                    maxValue
                    );
                
                $('.slider-range-' + index, slider).css({'top': top + '%', 'bottom': bottom + '%'});
                this.$('.ui-slider-handle').eq(index).css({'color': 'light-gray'});
                
                // On some browsers like Chrome on Windows, the heights for the
                // ranges dont get set as expected which cause the ranges to overflow
                // beyond the height of the slider, potentially a jquery slider bug.
                // Set the height manually to prevent overflowing ranges.
                var diff = top > bottom ? top - bottom : bottom - top;
                $('.slider-range-' + index, slider).css({'height': (diff/100 * 250) + 'px'});
            }
            
            function computePositionPercentage(value, min, max) {
                /*
                 * @private
                 * @param {int} value is the value which you wish to lookup the percentage of 
                 * @param {int} min is the min value of range you wish to find the percentage of
                 * @param {int} max the max value of range you wish to find the percentage of
                 */
                return ((max > min && value >= min) ? ((value-min) / (max - min)) * 100 : 0);
            }
        }
    });
    
    return MultiRangeVerticalSliderView;
});

