/*
 * This file contains the code to add a search icon to launch a search in the
 * Splunk Search app to any parent container
 */

define([
        'jquery',
        'underscore',
        'splunkjs/mvc',
        'splunkjs/mvc/searchmanager'
        ],
        function($, _, mvc, SearchManager)
{
    var SearchIconRenderer = {
        /*
         * The render function takes as input a parentContainer in which to
         * add a search icon which wwhen clicked on would run the search specified
         * in the searchManager passed in within the Splunk Search app.
         */
        render: function(parentContainer, searchManager) {
            if (_.isUndefined(searchManager) || _.isNull(searchManager) ||
                _.isUndefined(parentContainer) || _.isNull(parentContainer)) {
                throw('SearchIconRenderer.render called with invalid arguments');
            }   
            
            var $searchIcon = $('\
                <a href="#" title="Search"><i class="icon-search"></i></a>\
                ')
                .css({
                    "padding": "0",
                    "height": "20px",
                    "line-height": "20px",
                    "width": "22px",
                    "font-size": "15px",
                    "text-align": "center"
                })
                .appendTo(parentContainer)
                .off('click')
                .click(function() {
                    var parentSearchId = searchManager.get('managerid');
                    var sid = null;
                    if (!_.isUndefined(searchManager.job) && !_.isNull(searchManager.job)) {
                        sid = searchManager.job.sid;
                    }
                    var earliest = searchManager.get('earliest_time');
                    var latest = searchManager.get('latest_time');
                    var query = (searchManager.settings || searchManager.query).get('search');
    
                    // If it's a post process, we need the prefix query
                    if (parentSearchId) {
                        var parentSearch = mvc.Components.getInstance(parentSearchId);
                        query = (parentSearch.settings || parentSearch.query).get('search') + ' | ' + query;
                    }
    
                    window.open(
                        "/app/splunk_app_microsoft_exchange/search?" +
                        "sid=" + encodeURIComponent(sid) + "&" +
                        "q=" + encodeURIComponent(query) + "&" +
                        "earliest=" + encodeURIComponent(earliest) + "&" +
                        "latest=" + encodeURIComponent(latest)
                    );
                })
                .hide();
    
            // It's already resolved if settings.search (splunk 6.1) or query.search (splunk 6.0)
            var alreadyResolved = (searchManager.settings || searchManager.query).get('search');
    
            // Inline searches that are already resolved by now AND saved searches should just show the icon
            if (alreadyResolved) {
                $searchIcon.show();
            }
    
            // listen for tokens to change to show/hide the search icon
            // Otherwise the search icon will show when it's not actually tied to a valid search
            (searchManager.settings || searchManager.query).on('change:search', function(settings, newSearch) {
                $searchIcon[newSearch ? 'show' : 'hide']();
            });
        }
    }
    
    return SearchIconRenderer;  
});