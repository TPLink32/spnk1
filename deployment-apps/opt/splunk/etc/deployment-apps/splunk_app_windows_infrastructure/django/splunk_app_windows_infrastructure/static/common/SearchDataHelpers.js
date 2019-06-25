/*
 * This file contains helper methods that could be used in the app pages
 * to manipulate data returned from searches
 */

define(['jquery', 'underscore'], function($, _) {
    var SearchDataHelpers = {
        
        /*
         * Given a map of fields to html selectors (in fieldsToElSelsMap), search fields
         * returned from running a search (in searchFields), a row returned in the result
         * set of a search (in searchRow) and a html renderer function (in elRenderer) that
         * does specific action to convert result from the search to the html selector
         * specified element, this function extracts the values for the fields from the
         * row and invokes the renderer resulting in the values from a search row
         * being populated to different html elements
         */
        populateSearchBasedFields: function(fieldsToElSelsMap, searchFields, searchRow, elRenderer) {
            _.each(searchFields, function(fieldName, index) {
                var elSel = fieldsToElSelsMap[fieldName];
                if (!_.isUndefined(elSel) && !_.isNull(elSel)) {
                    elRenderer(elSel, searchRow[index]);
                }
            });
        },
    
        /*
         * This is a specialization of populateSearchBasedFields to specifically
         * extract and display search results as sparklines in the html elements
         */
        populateSearchBasedSparklineFields: function(fieldsToSparklineSelsMap, searchFields, searchRow, sparklineSettings) {
            this.populateSearchBasedFields(
                fieldsToSparklineSelsMap,
                searchFields,
                searchRow,
                function(sparklineSel, sparklineData) {
                    $(sparklineSel).empty();
                    
                    var sparks = _.isArray(sparklineData) ? 
                        _.map(sparklineData.slice(1), function(value) {
                            return (value && parseFloat(value)) || 0; 
                        }) : [];
                    
                    $(sparklineSel).sparkline(
                        sparks,
                        sparklineSettings
                        );
                }
                );
        },
        
        /*
         * This is a specialization of populateSearchBasedFields to specifically
         * extract and display search results as texts in the html elements
         */
        populateSearchBasedTextFields: function(fieldsToTextSelsMap, searchFields, searchRow) {
            this.populateSearchBasedFields(
                fieldsToTextSelsMap,
                searchFields,
                searchRow,
                function(textSel, textValue) {
                    $(textSel).text(textValue);
                }
                );
        },
        
        makeDisplayNameFromResultField: function(resultFieldName) {
            // Convert all _ in field name to spaces
            // Capitalize first character of each word part
            var nameParts = resultFieldName.replace('_', ' ').split(' ');
            
            var displayNameParts = _.map(nameParts, function(namePart) {
                if (/^[a-z]/.test(namePart)) {
                    var firstChar = namePart[0].toUpperCase();
                    return firstChar + namePart.substr(1);
                } else {
                    return namePart;
                }
            });
            
            return displayNameParts.join(' ');
        }
    }
    
    return SearchDataHelpers;
});