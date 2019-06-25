requirejs.config({
    paths: {
        'app-common': 'common/grayskull/common',
    }
});

define([
        'backbone',
        'app-common/controls/multirangeverticalslider/MultiRangeVerticalSliderRangesModel',
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