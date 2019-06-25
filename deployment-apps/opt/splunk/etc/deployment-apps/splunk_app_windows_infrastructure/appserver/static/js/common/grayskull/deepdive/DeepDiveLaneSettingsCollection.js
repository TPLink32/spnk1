define([
    'jquery',
    'backbone',
    'underscore',
    'common/grayskull/deepdive/DeepDiveLaneSettingsModel'
],
    function(
    $, 
    Backbone, 
    _, 
    DeepDiveLaneSettingsModel
    ) {
    /**
     * DeepDiveLaneCollection represents a group of DeepDiveLaneModels. 
     */
    var DeepDiveLaneSettingsCollection = Backbone.Collection.extend({
    model: DeepDiveLaneSettingsModel
    });
    
    return DeepDiveLaneSettingsCollection;
    }
);
