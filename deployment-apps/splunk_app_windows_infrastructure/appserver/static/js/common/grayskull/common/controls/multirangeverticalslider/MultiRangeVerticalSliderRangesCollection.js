define([
        'backbone',
        'common/grayskull/common/controls/multirangeverticalslider/MultiRangeVerticalSliderRangesModel',
        ],
        function(
            Backbone,
            MultiRangeVerticalSliderRangesModel
            )
{   
    var MultiRangeVerticalSliderRangesCollection = Backbone.Collection.extend({
        model: MultiRangeVerticalSliderRangesModel
    });
    
    return MultiRangeVerticalSliderRangesCollection;
});