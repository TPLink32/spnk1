define(["backbone"], function (Backbone) {
    /*
     * Defines a model for the range definition to be used with MultiRangeVerticalSlider 
     */
    var MultiRangeVerticalSliderRangeDefinitionModel = Backbone.Model.extend({
        /**
          * Default setting values
          * This also acts as the catalog of valid settings
          * @protected
          */
        defaults: {
            min: 0,
            max: 99999999
        }
    });
    
    return MultiRangeVerticalSliderRangeDefinitionModel;
});
