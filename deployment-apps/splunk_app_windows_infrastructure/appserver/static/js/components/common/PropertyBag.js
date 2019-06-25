/*
 * This file implements a property bag that could be serialized for use at search
 * time to construct a string representation of 'N' fields to extract and perform
 * post search deserialization
 */

define(['jquery', 'underscore', 'common/Class'], function($, _, Class) {
    
    var PropertyBag = function(searchFieldNames) {
        if (_.isUndefined(searchFieldNames) ||
            _.isNull(searchFieldNames) ||
            !_.isArray(searchFieldNames)) {
            throw('Invalid search fields list passed to PropertyBag');
        }
        
        // The names used here are passed into the search term in 
        // serializeSearchPhrase, so they must be the field names from search
        this._propertyNames = searchFieldNames;
        
        this._separator = '|';
    }
    
    var PropertyBagClass = Class.makeClass(PropertyBag);
         
    PropertyBagClass.serializeToSearchPhrase = function() {
        var that = this;
        
        // Serialize to format: prop1 . "|" . prop2 . "|" . prop3 
        // The resulting search phrase could be used in a search command like
        // eval as is to create the string representation of the concatenated fields
        var searchPhrase = _.reduce(
            this._propertyNames,
            function(propertyName1, propertyName2) {
                return propertyName1 + ' . "' + that._separator + '" . ' + propertyName2;
            }
            );

        return searchPhrase;
    }
    
    PropertyBagClass.deserialize = function(propertyValuesString) {
        var that = this;
        
        if (_.isUndefined(propertyValuesString) || _.isNull(propertyValuesString)) {
            return null;
        }
        
        var propertyValues = propertyValuesString.split(this._separator);
        
        if (_.isArray(propertyValues) &&
            propertyValues.length == this._propertyNames.length) {
            var propertyValuesDict = {};
            
            _.each(propertyValues, function(propertyValue, index) {
                propertyValuesDict[that._propertyNames[index]] = propertyValue;
            });
            
            return propertyValuesDict;
        } else {
            // Since inputs here come from search results, don't throw errors,
            // just return null
            return null;
        }
    }
    
    return PropertyBag; 
});