define([
        'jquery',
        'underscore',
        'splunkjs/mvc/savedsearchmanager',
        'common/statestore/statestorewrapper',
        'common/SearchRunner'
        ],
        function(
            $,
            _,
            SavedSearchManager,
            StateStoreWrapper,
            SearchRunner
        )
{
    var LookupBuilder =  {
        _migratedLookupCollection: 'MsftApps-MigratedLookups',

        migrateLookups: function(migrationSearches, parentPage) {
            StateStoreWrapper.createCollection(this._migratedLookupCollection, []);
            
            parentPage.setTitle('Migrating lookup 1 of ' + migrationSearches.length + '...');

            var that = this;
            StateStoreWrapper.getData(this._migratedLookupCollection, '', function(error, response) {
                var currentIndex = 0;
                var totalTime = 0;
                var buildNext = function() {
                    if (_.isUndefined(error) || _.isNull(error)) {
                        if (currentIndex < migrationSearches.length) {
                            var currentLookupBuilder = migrationSearches[currentIndex];

                            if (_.some(response.data, function(item) {
                                return item.Name == currentLookupBuilder;
                            })) {
                                parentPage.appendContent(currentLookupBuilder + ' already migrated. Skipping...');
                                currentIndex++;
                                buildNext();
                            } else {
                                var migrationSearch = new SavedSearchManager({
                                    searchname: currentLookupBuilder,
                                    autostart: false
                                });
                                
                                var endProcessed = false;
                                
                                var searchRunner = new SearchRunner(
                                    migrationSearch,
                                    null,
                                    /* search fail handler */ function(message) {
                                        parentPage.appendContent(currentLookupBuilder + ' could not be migrated.');
                                        currentIndex++;
                                        buildNext();
                                    },
                                    /* search results handler */ function(data) {
                                    },
                                    /* search start handler */ function() {
                                        parentPage.appendContent('Migrating lookup - ' + currentLookupBuilder + ' ...');
                                        var displayIndex = currentIndex+1;
                                        if (displayIndex !== migrationSearches.length) {
                                            parentPage.setTitle('Migrating lookup ' + displayIndex + ' of ' + migrationSearches.length + '...');
                                        }
                                    },
                                    /* search progress handler */ function(isSearchDone, properties) {
                                        if (isSearchDone && !endProcessed) {
                                            parentPage.appendContent(
												currentLookupBuilder + ' migrated ' + 
												' (took ' + properties.content.runDuration.toFixed(2) + 's).'
												);
                                            currentIndex++;
                                            StateStoreWrapper.setData(that._migratedLookupCollection,
                                                [{
                                                    Name : currentLookupBuilder
                                                }]);
                                            
                                            endProcessed = true;
											totalTime += properties.content.runDuration;
                                            buildNext();
                                        }
                                    }
                                    );
                                
                                searchRunner.runSearch();                            }
                        } else {
                            parentPage.setTitle('Migrating lookups completed (took ' + totalTime.toFixed(2) + 's)');
                            parentPage.markDone();
                        }
                    } else {
                        parentPage.setTitle('Encountered error while migrating');
                        parentPage.appendContent('Attempt to lookup migration status failed with error: "' + 
							error.status + 
                            ' (' + error.error + '): ' + 
                            error.data.messages[0].text + '"'
							);
                        parentPage.markDone();
                    }
                }

                setTimeout(buildNext, 1000);
            });
        },

        buildLookups: function(lookupSearches, parentPage) {
            parentPage.setTitle('Building lookup 1 of ' + lookupSearches.length + '...');
            
            var currentIndex = 0;
            var totalTime = 0;
            var buildNext = function() {
                if (currentIndex < lookupSearches.length) {
                    var currentLookupBuilder = lookupSearches[currentIndex];

                    var lookupSearch = new SavedSearchManager({
                        searchname: currentLookupBuilder,
                        autostart: false
                    });
                    
                    var endProcessed = false;
                    
                    var searchRunner = new SearchRunner(
                        lookupSearch,
                        null,
                        /* search fail handler */ function(message) {
                            parentPage.appendContent(currentLookupBuilder + ' could not be built.');
                            currentIndex++;
                            buildNext();
                        },
                        /* search results handler */ function(data) {
                        },
                        /* search start handler */ function() {
                            parentPage.appendContent('Building lookup - ' + currentLookupBuilder + ' ...');
                            var displayIndex = currentIndex + 1;
                            if (displayIndex !== lookupSearches.length) {
                                parentPage.setTitle('Building lookup ' + displayIndex + ' of ' + lookupSearches.length + '...');
                            }
                        },
                        /* search progress handler */ function(isSearchDone, properties) {
                            if (isSearchDone && !endProcessed) {
                                parentPage.appendContent(
									currentLookupBuilder + ' built.' + 
                            		' (took ' + properties.content.runDuration.toFixed(2) + 's)'
									);
                                currentIndex++;
                                
								totalTime += properties.content.runDuration;
                                endProcessed = true;
                                buildNext();
                            }
                        }
                        );
                    
                    searchRunner.runSearch();
                } else {
                    parentPage.setTitle('Building lookups completed (took ' + totalTime.toFixed(2) + 's).');
                    parentPage.markDone();
                }
            };

            setTimeout(buildNext, 1000);
        }
    };

    return LookupBuilder;
});