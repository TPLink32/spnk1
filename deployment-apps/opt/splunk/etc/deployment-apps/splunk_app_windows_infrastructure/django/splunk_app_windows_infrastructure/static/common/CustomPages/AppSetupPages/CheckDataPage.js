/*
 * This file contains the code to implement the check data page for setup
 */

define([
        'jquery',
        'underscore',
        'views/shared/WaitSpinner',
        'splunkjs/mvc/resultslinkview',
        'splunkjs/mvc/searchmanager',
        'common/SearchRunner',
        'common/SearchIconRenderer',
        'common/PageMessagesView',
        'common/SyncTaskQueue'
        ],
        function(
            $,
            _,
            WaitSpinner,
            ResultsLinkView,
            SearchManager,
            SearchRunner,
            SearchIconRenderer,
            PageMessagesView,
            SyncTaskQueue
            )
{   
    var CheckDataPage = {
        _countOfCompletedSections: 0,
        
        _criticalDataMissing: false,
        
        _sections: {
            /*
             * Contains a array of definitions for each section on the page for which
             * data is being checked. Schema:
             * 
             * searches: array of search definitions each containing:
             *      search: search string to run the search for
             *      critical: true when this search is critical and false otherwise.
             *                critical means the search MUST return events else the
             *                check will be marked as failed
             * description: description text for the section
             * helpHref: help link relevant to the section
             * helpText: help text relevant to the section          
             */
        },
        
        _dataCheckSectionTemplate: '\
            <table> \
                <tr> \
                    <td> \
                        <h1 class="inline-heading">Check data coming from your environment  <a \
                            id="redetect" class="btn btn-default icon-rotate" \
                            > Redetect</a> \
                        </h1>\
                        <p>Check data coming into Splunk from the Splunk forwarders</p> \
                    </td> \
                </tr> \
            </table> \
            <div id="bypass" > \
                <input id="bypass-checkbox" type="checkbox"></input> \
                <span><h5 class="inline-heading">Bypass data checks</h5></span> \
                <p>Note: bypassing data checks might result in reduced or limited app functionality</p> \
            </div> \
            <% _.each(sections, function(section, sectionId) { %> \
                <div class="page-section"> \
                    <table><tr> \
                        <td class="icon-container"> \
                            <div id="<%= sectionId %>-state-icon" class="icon-container"> \
                            </div> \
                        </td> \
                        <td> \
                            <div id="<%= sectionId %>-data-check"> \
                                <p class="title"><%= section.description %></p> \
                                <div> \
                                    <p id="<%= sectionId %>-search-status" class="highlighted"> \
                                        Have not yet started search to look for data \
                                    </p> \
                                    <p id="<%= sectionId %>-data-not-found" hidden> \
                                        <span class="invalid-content">No data detected:</span> \
                                         Please make sure Splunk Forwarders are properly configured and sending data \
                                    </p> \
                                    <p id="<%= sectionId %>-data-found" hidden> \
                                        <span class="valid-content">OK: </span> \
                                        <span id="<%= sectionId %>-data-count"></span> or more events detected in the last 24 hours \
                                    </p> \
                                    <div id="<%= sectionId %>-data-failures"></div> \
                                    <p> \
                                        <span style="font-style:italic">Configuring Splunk Forwarders:</span> \
                                        <a href="<%= section.helpHref %>" target="_blank"> \
                                            <%= section.helpText %> \
                                        </a> \
                                    </p> \
                                </div> \
                            </div> \
                        </td> \
                    </tr></table> \
                </div> \
            <% }) %>',
        
        getSectionsCount: function() {
            return _.size(this._sections);
        },
            
        addDataChecks: function(sections, pageSel, pageNextButtonSel) {
            var that = this;
            
            this._sections = sections;
            this._pageNextButtonSel = pageNextButtonSel;
            this._pageSel = pageSel;
            
            this._runDataChecks();
        },
        
        _runDataChecks: function() {
            var that = this;
            
            var htmlForPage = _.template(
                this._dataCheckSectionTemplate,
                { sections: this._sections }
                );
            
            $(this._pageSel).html(htmlForPage);
            
            $('#redetect').addClass('disabled');
            $('#redetect').on("click", function(event) {
                that._runDataChecks();
            });

            $('#bypass-checkbox').click(function() {
                that._bypassClicked($(this));
            });
            
            // Save away selectors from template for all sections
            _.each(this._sections, function(section, sectionId) {
                section['stateIconSel'] = '#' + sectionId + '-state-icon';
                section['statusSel'] = '#' + sectionId + '-search-status';
                section['dataFoundSel'] = '#' + sectionId + '-data-found';
                section['dataNotFoundSel'] = '#' + sectionId + '-data-not-found';
                section['dataCountSel'] = '#' + sectionId + '-data-count';
                section['waitSpinner'] = new WaitSpinner();
                section['waitSpinner'].prependTo($('#' + sectionId + '-state-icon'));
                section['detailsPaneSel'] = '#' + sectionId + '-data-failures';
            });
            
            this._countOfCompletedSections = 0;
            
            // Run the actual data checks which will update results on the page
            _.each(this._sections, function(section, sectionId) {
                that.checkForData(sectionId);
            });
        },
        
        checkForData: function(sectionId) {
            var that = this;
            
            this._sections[sectionId]['searchQueue'] = new SyncTaskQueue();
            this._sections[sectionId]['criticalDataMissing'] = false;
            this._sections[sectionId]['totalDataCount'] = 0;
            this._sections[sectionId]['completed'] = 0;
            $(this._sections[sectionId]['detailsPaneSel']).empty();
            
            // Queue the searches for each section to check data. The searches
            // within a section would be run one by one
            _.each(
                this._sections[sectionId]['searches'],
                function(searchDefinition, searchIndex) {
                    // Preserve the section id within the section for easy lookup
                    that._sections[sectionId]['sectionId'] = sectionId;
                    
                    that._sections[sectionId]['searchQueue'].enqueue(
                        'Data search for Check Data Page',
                        that.runDataSearch,
                        [searchDefinition, searchIndex, that._sections[sectionId], that],
                        null, // default timeout
                        that.searchTaskTimeoutHandler,
                        [searchDefinition, searchIndex, that._sections[sectionId], that]
                        );
                }
            );
        },
        
        runDataSearch: function(taskRunner, searchDefinition, searchIndex, dataCheckSection, that) {
            // This function is invoked by the SyncTaskRunner in the SyncTaskQueue
            // It implements the actual running of a single search in each section
            // of this page and updating the content on the page to reflect the results
            
            searchDefinition['searchManager'] = new SearchManager({
                autostart: true,
                search: searchDefinition['search'],
                earliest_time: '-24h',
                latest_time: 'now',
                preview: true,
                cancelOnUnload: true,
                cache: false
            });
            
            searchDefinition['searchRunner'] = new SearchRunner(
                searchDefinition['searchManager'],
                null,
                /* search fail handler */ function(message) {
                    if (!searchDefinition['completed']) {
                        taskRunner.markCompleted();

                        that.handleSearchFailure(
                            'Search "' + searchDefinition['search'] + '" failed. Error: ' + message,
                            searchDefinition,
                            searchIndex,
                            dataCheckSection
                            );
                    }
                },
                /* search results handler */ function(data) {
                    var rowCount = data.rows.length;
                    
                    if (rowCount > 0 && !searchDefinition['completed']) {
                        dataCheckSection['totalDataCount'] += rowCount;
                        
                        taskRunner.markCompleted();
                        
                        that.handleSearchCompletion(
                            searchDefinition,
                            searchIndex,
                            dataCheckSection
                            );
                    }
                },
                /* search start handler */ function() {
                    var searchNumber = searchIndex + 1;
                    $(dataCheckSection['statusSel']).text(
                        'Running search ' + searchNumber + ' of ' + 
                        dataCheckSection['searches'].length + ': "' +
                        searchDefinition['search'] + '"'
                        );
                    
                    searchDefinition['completed'] = false;
                    
                    dataCheckSection['waitSpinner'].$el['show']();
                    dataCheckSection['waitSpinner']['start']();
                },
                /* search progress handler */ function(isSearchDone, properties) {
                    if (isSearchDone && !searchDefinition['completed']) {
                        if (properties.content.eventCount === 0) {
                            taskRunner.markCompleted();

                            that.handleSearchFailure(
                                'Search "' + searchDefinition['search'] + '" did not return any events',
                                searchDefinition,
                                searchIndex,
                                dataCheckSection
                                );
                        } // else results would have been rendered
                    }
                    
                    dataCheckSection['waitSpinner']['step']();
                }
                );
                
            searchDefinition['searchRunner'].runSearch();
        },
        
        searchTaskTimeoutHandler: function(searchDefinition, searchIndex, dataCheckSection, that) {
            that.handleSearchFailure(
                'Search "' + searchDefinition['search'] + '" has timed out',
                searchDefinition,
                searchIndex,
                dataCheckSection
                );
        },
        
        handleSearchFailure: function(failureMessage, searchDefinition, searchIndex, dataCheckSection) {
            var messageId = dataCheckSection['sectionId'] + '-' + searchIndex + '-error';
            
            var warningHtml = '<span class="warning-content">WARNING: </span>';
            var errorHtml = '<span class="invalid-content">ERROR: </span>';
            
            var inspectorId = dataCheckSection['sectionId'] + '-' + searchIndex + '-inspector';
            
            $(dataCheckSection['detailsPaneSel']).append(' \
                <div><p>' + 
                    (searchDefinition['critical'] ? errorHtml : warningHtml) +
                    '<span id="' + inspectorId + '"></span><span>' + failureMessage +
                    ' in the last 24 hours</span> \
                </div>');
            
            var componentsSearchInspector = new ResultsLinkView({
                el: '#' + inspectorId,
                managerid: searchDefinition['searchManager'].id,
                'link.exportResults.visible' : 'false',
                'link.inspectSearch.visible' : 'false',
                'refresh.link.visible' : 'false',
                'link.openSearch.text': ' ',
                'link.openSearch.visible': 'true'
            }).render();
            
            if (searchDefinition['critical']) {
                dataCheckSection['criticalDataMissing'] = true;
            }
            
            this.handleSearchCompletion(
                searchDefinition,
                searchIndex,
                dataCheckSection
                );
        },
        
        handleSearchCompletion: function(searchDefinition, searchIndex, dataCheckSection) {
            // This function is called when a search with a section for this page
            // completes. The function updates content on the page based on the current search results
            
            dataCheckSection['completed']++;
            searchDefinition['completed'] = true;  
        
            if (dataCheckSection['totalDataCount'] > 0) {
                $(dataCheckSection['dataNotFoundSel']).hide();
                $(dataCheckSection['dataFoundSel']).show();
                $(dataCheckSection['dataCountSel']).text(dataCheckSection['totalDataCount']);
            } else {
                $(dataCheckSection['dataFoundSel']).hide();
                $(dataCheckSection['dataNotFoundSel']).show();
            }
            
            if (dataCheckSection['criticalDataMissing']) {
                this._criticalDataMissing = true;
            }
            
            if (searchIndex === dataCheckSection['searches'].length - 1) {
                // All searches for the section are done
                this._countOfCompletedSections++;
                                
                dataCheckSection['waitSpinner']['stop']();
                dataCheckSection['waitSpinner'].$el['hide']();
                if (dataCheckSection['criticalDataMissing']) {
                    $(dataCheckSection['stateIconSel']).addClass('icon-x');
                    $(dataCheckSection['statusSel']).text('Critical data could not be found');
                } else {
                    $(dataCheckSection['stateIconSel']).addClass('icon-check');
                    $(dataCheckSection['statusSel']).text('All searches have completed');
                }
                
                if (dataCheckSection['totalDataCount'] < 1) {
                    // At this point it is okay to overload this._criticalDataMissing
                    // to include non-critical data and denote when none of the searches
                    // for a section returned any data
                    this._criticalDataMissing = true;
                }
                
                if (this._countOfCompletedSections === this.getSectionsCount()) {
                    $('#redetect').removeClass('disabled');
                    
                    if (!this._criticalDataMissing) {
                        this.enableNextButton();
                    }
                }
            }
        },

        enableNextButton: function() {
            $(this._pageNextButtonSel).removeClass('disabled');
        },

        disableNextButton: function() {
            $(this._pageNextButtonSel).addClass('disabled');
        },

        _bypassClicked: function($checkbox) {
            if ($checkbox.is(':checked')) {
                this.enableNextButton();
            } 
            else {
                if (this._criticalDataMissing) {
                    this.disableNextButton();
                }
            }
        },

        isDataFound: function() { 
            var dataFound = (this._countOfCompletedSections === this.getSectionsCount() && 
                !this._criticalDataMissing);
            return dataFound || $('#bypass-checkbox').is(':checked');
        }
    };
    
    return CheckDataPage;
});