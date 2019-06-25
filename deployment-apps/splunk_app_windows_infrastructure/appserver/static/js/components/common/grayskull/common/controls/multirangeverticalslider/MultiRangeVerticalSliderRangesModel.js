define(["backbone"], function (Backbone) {
    /*
     * Defines a model for the ranges to be used with MultiRangeVerticalSlider 
     * Each rangeIndex is a value between the min value defined in MultiRangeVerticalSliderRangeDefinitionModel
     * going up to max value defined in MultiRangeVerticalSliderRangeDefinitionModel
     * and has a color associated to the range in the slider.
     */
    var MultiRangeVerticalSliderRangesModel = Backbone.Model.extend({
         /**
          * Default setting values
          * This also acts as the catalog of valid settings
          * @protected
          */
        defaults: {
            value: NaN,
            color: 'black',
            name: '',
            label: '',
            uiElId: ''
        }
    });
    
    return MultiRangeVerticalSliderRangesModel;
});
