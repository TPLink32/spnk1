/*
 * This file contains the code to implement the host inventory page
 */

define([
        'underscore',
        'jquery',
        'jquery.sparkline',
        'splunkjs/mvc',
        'splunkjs/mvc/dropdownview',
        'splunkjs/mvc/timepickerview',
        'splunkjs/mvc/searchmanager',
        'common/SearchRunner',
        'common/SearchDataHelpers',
        'common/SearchIconRenderer',
        'common/PageMessagesView',
        'common/SyncTaskQueue',
        'splunk_app_windows_infrastructure/WinfraConstants',
        'splunk_app_windows_infrastructure/page_prechecks'
        ],
        function(
            _,
            $,
            Sparkline,
            mvc,
            DropdownView,
            TimePickerView,
            SearchManager,
            SearchRunner,
            SearchDataHelpers,
            SearchIconRenderer,
            PageMessagesView,
            SyncTaskQueue,
            WinfraConstants,
            PagePreChecks
            )
{   
    var _keyEventDetailsMap = {};
    var _lastEventIndex = 0;

    var _getPerfmonDrilldownFunction = function(object, counter, instance){
        return function(){
            var host = mvc.Components.getInstance('default').get('Host');
            if(host && object && counter) {
                var paramsArray = [{
                    'host': host,
                    'object': object,
                    'counter': counter,
                    'instance': instance || '*'
                }];
                window.open(
                    WinfraConstants.getPerfmonPath() 
                    + $.param({'perfmon': paramsArray})
                );
            }
            else {
                // JIRA: for now when not all parameters are avaiable, we go to an
                // unpopulated perfmon page. This is because the behavior of the perfmon
                // page is undefined if there not all parameters are specified. The JIRA
                // to fix this is (TAG-8642), which is blocked on the JIRA to determine 
                // the right behavior in perfmon with missing parameters (TAG-8641)
                window.open(WinfraConstants.getPerfmonPath()); 
            }
        }
    }
    
    var HostInventory = {
        _countActiveSearches: 0,
        
        _searchDefinitions: 
            /*
             * Contains a array of definitions for each search on the page from which
             * fields for this page are populated. Schema:
             * 
             * search: search to run
             * callbacks: the different search results callback handlers for the search
             *      failureCallback
             *      dataCallback          
             */
            [
                {
                    'search': '\
                        eventtype="hostmon_windows" Type=Computer host="$Host$" \
                        | stats latest(*) by host \
                        ',
                    'callbacks':
                        {
                            'failureCallback': function(message) {
                                console.log(message);
                                
                                $('#computer-name').text('Unknown');
                                $('#domain').text('Unknown');
                                $('#manufacturer').text('Unknown');
                                $('#model').text('(Unknown model)');
                            },
                            'dataCallback' : function(resultFields, resultRows, additionalChecksFn) {
                                if (resultRows.length > 1) {
                                    console.log('Search for computer info returned more than one row unexpectedly, using only first row');
                                }
                                
                                SearchDataHelpers.populateSearchBasedTextFields(
                                    {
                                        'latest(ComputerName)': '#computer-name',
                                        'latest(Domain)': '#domain',
                                        'latest(Manufacturer)': '#manufacturer',
                                        'latest(Model)': '#model'
                                    },
                                    resultFields,
                                    resultRows[0]
                                    );
                                
                                var messageBoard = new PageMessagesView('#message-board');
                                
                                messageBoard.clearAllMessages();
                                
                                var manufacturer = $('#manufacturer').text().toLowerCase();
                                if(manufacturer.indexOf('vmware') > -1) {
                                    var localSplunkd = mvc.createService({'app': 'system'});
                                    
                                    localSplunkd.get(
                                        'apps/local/splunk_for_vmware',
                                        null,
                                        function(error, appInfo) {
                                            if ((_.isUndefined(error) || _.isNull(error)) &&
                                                !_.isUndefined(appInfo) && !_.isNull(appInfo)) {
                                                var hostName = mvc.Components.getInstance("default", {create: true}).get('Host');
                                                
                                                messageBoard.addMessage(
                                                    'The host machine is running as a guest on VMWare platform. \
                                                        <a href="/app/splunk_for_vmware/vm_detail?selectedVirtualMachine=' + 
                                                        hostName + '" target="_blank" \
                                                        >Click here</a> to lookup information about the host \
                                                        in the Splunk App for VMWare.',
                                                    messageBoard.InfoMessageType,
                                                    '#vmware-message'
                                                    );
                                            } else {
                                                messageBoard.addMessage(
                                                    'The host machine is running as a guest on VMWare \
                                                        platform but the search head does not have \
                                                        the Splunk App for VMWare installed. It is highly recommended \
                                                        to install the Splunk App for VMWare. The app will enable \
                                                        scenarios for diagnosis and trouble shooting. \
                                                        <a href="https://apps.splunk.com/app/725/" target="_blank" \
                                                        >Click here</a> \
                                                        to learn about the Splunk App for VMWare.',
                                                    messageBoard.WarningMessageType,
                                                    '#vmware-message'
                                                    );
                                            }
                                        }
                                        );
                                }
                            }
                        }
                },
                {
                    'search': '\
                        eventtype="hostmon_windows" Type=OperatingSystem host="$Host$" \
                        | stats latest(*) by host \
                        | rename "latest(TotalPhysicalMemoryKB)" as TotalPhysicalMemoryKB \
                        | eval TotalPhysicalMemoryMB = tostring(TotalPhysicalMemoryKB / 1024, "commas") \
                        ',
                    'callbacks':
                        {
                            'failureCallback': function(message) {
                                console.log(message);
                                
                                $('#os').text('Unknown');
                                $('#os-arch').text('Unknown architecture');
                                $('#service-pack').text('Unknown');
                                $('#total-ram').text('Unknown');
                            },
                            'dataCallback' : function(resultFields, resultRows) {
                                if (resultRows.length > 1) {
                                    console.log('Search for OS info returned more than one row unexpectedly, using only first row');
                                }
                                
                                SearchDataHelpers.populateSearchBasedTextFields(
                                    {
                                        'latest(OS)': '#os',
                                        'latest(Architecture)': '#os-arch',
                                        'latest(ServicePack)': '#service-pack',
                                        'TotalPhysicalMemoryMB': '#total-ram'
                                    },
                                    resultFields,
                                    resultRows[0]
                                    );
                            }
                        }
                },
                {
                    'search': '\
                        eventtype="hostmon_windows" Type=Disk host="$Host$" \
                        | where FileSystem != "CD-ROM" \
                        | stats latest(TotalSpaceKB) as TotalSpaceKBPerDisk, \
                            latest(FreeSpaceKB) as FreeSpaceKBPerDisk by host, Name \
                        | stats sum(TotalSpaceKBPerDisk) as TotalDiskSpaceKB, \
                            sum(FreeSpaceKBPerDisk) as FreeDiskSpaceKB by host \
                        | eval TotalDiskSpaceMB = tostring(TotalDiskSpaceKB / 1024, "commas") \
                        | eval FreeDiskSpaceMB = tostring(FreeDiskSpaceKB / 1024, "commas") \
                        ',
                    'callbacks':
                        {
                            'failureCallback': function(message) {
                                console.log(message);
                                
                                $('#total-disk').text('Unknown');
                                $('#free-disk').text('Unknown');
                            },
                            'dataCallback' : function(resultFields, resultRows) {
                                if (resultRows.length > 1) {
                                    console.log('Search for disk info returned more than one row unexpectedly, using only first row');
                                }
                                
                                SearchDataHelpers.populateSearchBasedTextFields(
                                    {
                                        'TotalDiskSpaceMB': '#total-disk',
                                        'FreeDiskSpaceMB': '#free-disk'
                                    },
                                    resultFields,
                                    resultRows[0]
                                    );
                            }
                        }
                },
                {
                    'search': '\
                        eventtype="Update_Successful" host="$Host$" | \
                        stats latest(signature) as Signature by host \
                        ',
                    'callbacks':
                        {
                            'failureCallback': function(message) {
                                console.log(message);
                                
                                $('#last-update').text('Unknown');
                            },
                            'dataCallback' : function(resultFields, resultRows) {
                                if (resultRows.length > 1) {
                                    console.log('Search for windows update info returned more than one row unexpectedly, using only first row');
                                }
                                
                                SearchDataHelpers.populateSearchBasedTextFields(
                                    {
                                        'Signature': '#last-update'
                                    },
                                    resultFields,
                                    resultRows[0]
                                    );
                            }
                        }
                },
                {
                    'search': '\
                        eventtype="perfmon_windows" object="Network Interface" \
                            counter="Bytes Total/sec" \
                            host="$Host$" \
                        | stats sparkline(max(Value)) as UsageTrend by host \
                        ',
                    'drilldown': {
                        domid: 'network-trend', 
                        args: [_('Network Interface').t(), _('Bytes Total/sec').t(), null]
                    },
                    'callbacks':
                        {
                            'failureCallback': function(message) {
                                console.log(message);
                                
                                $('#network-trend').empty();
                                $('#network-trend').text('(No info on usage)');
                            },
                            'dataCallback' : function(resultFields, resultRows) {
                                if (resultRows.length > 1) {
                                    console.log('Search for network usage returned more than one row unexpectedly, using only first row');
                                }

                                SearchDataHelpers.populateSearchBasedSparklineFields(
                                    {
                                        'UsageTrend': '#network-trend'
                                    },
                                    resultFields,
                                    resultRows[0],
                                    WinfraConstants.getDefaultSparklineSettings()
                                    );
                            }
                        }                
                },    
                {
                    'search': '\
                        eventtype="perfmon_windows" object="Processor" \
                            counter="% Processor Time" host="$Host$" \
                        | stats sparkline(max(Value)) as UsageTrend by host \
                        ',
                    'drilldown': {
                        domid: 'processors-trend', 
                        args: [_('Processor').t(), _('% Processor Time').t(), '_Total']
                    },
                    'callbacks':
                        {
                            'failureCallback': function(message) {
                                console.log(message);
                                
                                $('#processors-trend').empty();
                                $('#processors-trend').text('(No info on usage)');
                            },
                            'dataCallback' : function(resultFields, resultRows) {
                                if (resultRows.length > 1) {
                                    console.log('Search for processor usage returned more than one row unexpectedly, using only first row');
                                }
                                
                                SearchDataHelpers.populateSearchBasedSparklineFields(
                                    {
                                        'UsageTrend': '#processors-trend'
                                    },
                                    resultFields,
                                    resultRows[0],
                                    WinfraConstants.getDefaultSparklineSettings()
                                    );
                            }
                        }
                },
                {
                    'search': '\
                        eventtype="perfmon_windows" object="Memory" \
                            counter="Available Bytes" host="$Host$" \
                        | stats sparkline(max(Value)) as UsageTrend by host \
                        ',
                    'drilldown': {
                        domid: 'memory-trend', 
                        args: [_('Memory').t(), _('Available Bytes').t(), '0']
                    },
                    'callbacks':
                        {
                            'failureCallback': function(message) {
                                console.log(message);
                                
                                $('#memory-trend').empty();
                                $('#memory-trend').text('(No info on usage)');
                            },
                            'dataCallback' : function(resultFields, resultRows) {
                                if (resultRows.length > 1) {
                                    console.log('Search for memory usage returned more than one row unexpectedly, using only first row');
                                }
                                
                                SearchDataHelpers.populateSearchBasedSparklineFields(
                                    {
                                        'UsageTrend': '#memory-trend'
                                    },
                                    resultFields,
                                    resultRows[0],
                                    WinfraConstants.getDefaultSparklineSettings()
                                    );
                            }
                        }
                },
                {
                    'search': '\
                        eventtype="perfmon_windows" object="LogicalDisk" \
                            counter="Disk Reads/sec" host="$Host$" \
                        | stats sparkline(max(Value)) as UsageTrend by host \
                        ',
                    'drilldown': {
                        domid: 'disk-read-trend', 
                        args: [_('LogicalDisk').t(), _('Disk Reads/sec').t(), '_Total']
                    },
                    'callbacks':
                        {
                            'failureCallback': function(message) {
                                console.log(message);
                                
                                $('#disk-read-trend').empty();
                                $('#disk-read-trend').text('(no info on read usage)');
                            },
                            'dataCallback' : function(resultFields, resultRows) {
                                if (resultRows.length > 1) {
                                    console.log('Search for disk read usage returned more than one row unexpectedly, using only first');
                                }
                                
                                SearchDataHelpers.populateSearchBasedSparklineFields(
                                    {
                                        'UsageTrend': '#disk-read-trend'
                                    },
                                    resultFields,
                                    resultRows[0],
                                    WinfraConstants.getDefaultSparklineSettings()
                                    );
                            }
                        }
                },
                {
                    'search': '\
                        eventtype="perfmon_windows" object="LogicalDisk" \
                            counter="Disk Writes/sec" host="$Host$" \
                        | stats sparkline(max(Value)) as UsageTrend by host, counter \
                        ',
                    'drilldown': {
                        domid: 'disk-write-trend', 
                        args: [_('LogicalDisk').t(), _('Disk Writes/sec').t(), '_Total']
                    },
                    'callbacks':
                        {
                            'failureCallback': function(message) {
                                console.log(message);
                                
                                $('#disk-write-trend').empty();
                                $('#disk-write-trend').text('(no info on write usage)');
                            },
                            'dataCallback' : function(resultFields, resultRows) {
                                if (resultRows.length > 1) {
                                    console.log('Search for disk write usage returned more than one row unexpectedly, using only first');
                                }
                                
                                SearchDataHelpers.populateSearchBasedSparklineFields(
                                    {
                                        'UsageTrend': '#disk-write-trend'
                                    },
                                    resultFields,
                                    resultRows[0],
                                    WinfraConstants.getDefaultSparklineSettings()
                                    );
                            }
                        }
                },
                {
                    'search': 'tag="Key_Events_On_Hosts" host="$Host$" | sort -_time',
                    'callbacks':
                        {
                            'failureCallback': function(message) {
                                console.log('Search for key events returned failure: ' + message);
                                $('#key-events-updating').text('');
                                $('#key-events-count').text('0');
                            },
                            'dataCallback' : function(resultFields, resultRows) {
                                if (resultRows.length < 1) {
                                    console.log('Search for key events returned no results');
                                    $('#left-pane #no-key-events').show();
                                    $('#right-pane #no-key-events').show();
                                }
                                
                                $('#key-events-count').text(resultRows.length);
                                
                                $('#left-pane #no-key-events').hide();
                                $('#right-pane #no-key-events').hide();
                                
                                // Display each key event as a list item in left pane
                                // and show details of a picked list item as detailed
                                // view for the event in the right pane
                                
                                _.each(resultRows, function(resultRow, rIndex) {
                                
                                    // Define an id for the html element to be added
                                    // for the event in both left and right pane.
                                    // Since both panes use the same id for same event,
                                    // identifying the events is simplified
                                    var eventElId = 'key-event-' + _lastEventIndex;

                                    $('#key-events-list').append(
                                        '<li id="' + eventElId + '"></li>'
                                        );
                                    
                                    // Define the click handler for the event on the left pane
                                    // which must show the corresponding event on the right pane
                                    $('#key-events-list li#' + eventElId).on('click', function() {
                                        $('#key-events-list li').removeClass('chosen-item');
                                        
                                        $('#key-event-details').html(
                                            _keyEventDetailsMap[eventElId]
                                            );
                                        $(this).addClass('chosen-item');
                                    });
                                    
                                    var reservedFields = [
                                        'linecount',
                                        'sourcetype',
                                        'source',
                                        'host',
                                        'index',
                                        'splunk_server',
                                        'Keywords',
                                        'ComputerName'
                                        ];
                                    
                                    
                                    var isFirstFieldInRow = true;
                                    
                                    var rowTitle = '';
                                    var eventDetails = '<table><tbody>';
                                    
                                    // Display each field of the event for detailed view
                                    _.each(resultFields, function(resultField, fIndex) {
                                        if((resultField.indexOf('_') !== 0 || resultField === '_time') && /* filter out internal fields like _raw except _time */
                                            !_.contains(reservedFields, resultField) /* filter out reserved fields */
                                            ) {
                                            if (isFirstFieldInRow) {
                                                eventDetails += '<tr>';
                                            }
                                            
                                            var fieldDisplayValue = (
                                                _.isNull(resultRow[fIndex]) || 
                                                _.isUndefined(resultRow[fIndex])
                                                ) ? '' : resultRow[fIndex];
                                            
                                            var fieldDisplayName = SearchDataHelpers.makeDisplayNameFromResultField(resultField);
                                            
                                            eventDetails += ' \
                                                <td><div class="key-event-cell">' + 
                                                    '<span class="field-name">' + 
                                                        fieldDisplayName + ': \
                                                        </span>' + fieldDisplayValue + 
                                                '</div></td>';
                                            
                                            if (!isFirstFieldInRow) {
                                                eventDetails += '</tr>';
                                            }
                                            
                                            // Display two fields per row - so alternate every time we add a field
                                            isFirstFieldInRow = !isFirstFieldInRow;
                                            
                                            // Concoct an event title
                                            // If result field is certain special fields, 
                                            // display their values as title for the event, 
                                            // since there is no single field that
                                            // can act as a real title
                                            var potentialTitleFields = [
                                                'signature',
                                                'status',
                                                'LogName',
                                                'SourceName',
                                                'EventCode',
                                                'Cmdlet',
                                                'CmdletError',
                                                'Error'
                                                ];
                                            
                                            if (_.contains(potentialTitleFields, resultField) &&
                                                !_.isUndefined(fieldDisplayValue) &&
                                                !_.isNull(fieldDisplayValue) &&
                                                fieldDisplayValue.length > 0) {
                                                if (rowTitle.length > 0) {
                                                    rowTitle += ', ';
                                                }
                                                
                                                rowTitle += fieldDisplayName + ': ' + fieldDisplayValue;
                                            }
                                        }
                                    });
                                    eventDetails += '</tbody></table></div>'; 
                                    
                                    // Apply the concocted title for the row
                                    if (rowTitle.length < 1) {
                                        rowTitle = 'Key event #' + _lastEventIndex;
                                    }
                                    
                                    $('#key-events-list li#' + eventElId).text(rowTitle);
                                    
                                    var eventDetailsHtml = '<div id="' + eventElId + '"> \
                                        <div> \
                                            <h5 id="key-event-title" class="key-event-title">' +
                                            rowTitle + '</h5> \
                                        </div>' + eventDetails;
                                    
                                    if(_lastEventIndex === 0) {
                                        $('#key-events-list li#' + eventElId).addClass('chosen-item');
                                        $('#key-event-details').html(eventDetailsHtml);
                                    }
                                            
                                    _keyEventDetailsMap[eventElId] = eventDetailsHtml;
                                    
                                    _lastEventIndex++;
                                });

                                $('#key-events-updating').text('Search for key events has completed');
                            }
                        }
                }
            ],
            
        _searchQueue: new SyncTaskQueue(),
        
        render: function(args) {
            var that= this;
            
            PagePreChecks.runChecks();
            
            this._tokens = mvc.Components.getInstance("default", {create: true});
            
            this.populateSearchFields();
            
            this._hostsSearchManager = new SearchManager(
                {
                    autostart: true,
                    search: '\
                        eventtype="hostmon_windows" Type=OperatingSystem \
                        | stats latest(ComputerName) as ComputerName by host \
                        ',
                    earliest_time: '-24h',
                    latest_time: 'now',
                    preview: true,
                    cancelOnUnload: true,
                    cache: false
                },
                {tokens:true}
                ).startSearch();
            
            this._hostDropdown = new DropdownView({
                id: 'host-index',
                managerid: this._hostsSearchManager.id,
                labelField: 'ComputerName',
                valueField: 'host',
                showClearButton: false,
                value: mvc.tokenSafe('$Host$'),
                default: args.host,
                el: $("#host-filter")
            }).render();
            
            this._timePickerView = (new TimePickerView({
                el: $('#page-timepicker')
            })).render();

            this._timePickerView.on('change', function() {
                that._tokens.set('page_earliest_time', that._timePickerView.val()['earliest_time']);
                that._tokens.set('page_latest_time', that._timePickerView.val()['latest_time']);
            });

            this._timePickerView.val({
                earliest_time: args.earliest_time || '-24h',
                latest_time: args.latest_time || 'now'
            });

            _.each(_.filter(this._searchDefinitions, function(definition) { return _.has(definition, 'drilldown'); }),
                   function(definition) {
                       $('#' + definition.drilldown.domid)
                           .on('click', 'canvas', _getPerfmonDrilldownFunction.apply(null, definition.drilldown.args));
                   });
        },
        
        populateSearchFields: function() {
            var that = this;
            
            _.each(this._searchDefinitions, function(searchDefinition, index) {
                that._searchQueue.enqueue(
                    'Search to populate Host Inventory fields',
                    that.runSearch,
                    [searchDefinition, that],
                    null, // default timeout
                    that.searchTimeoutHandler,
                    [searchDefinition]
                    );
            });
        },
        
        runSearch: function(taskRunner, searchDefinition, that) {
            // This function is invoked by the SyncTaskRunner in the SyncTaskQueue
            // It implements the actual running of each single search for this page 
            // and updating the content on the page to reflect the results
            
            searchDefinition['searchManager'] = new SearchManager(
                {
                    autostart: true,
                    search: searchDefinition['search'],
                    earliest_time: mvc.tokenSafe("$page_earliest_time$"),
                    latest_time: mvc.tokenSafe('$page_latest_time$'),
                    preview: true,
                    cancelOnUnload: true,
                    cache: false
                },
                {tokens:true}
                );
            
            searchDefinition['searchRunner'] = new SearchRunner(
                searchDefinition['searchManager'],
                null,
                /* search fail handler */ function(message) {
                    searchDefinition['callbacks']['failureCallback'](message);
                    
                    if (message.indexOf('The search returned error "Search is waiting for input...".' === 0)) {
                        // Search is waiting on input
                        taskRunner.markCompleted();
                    }
                },
                /* search results handler */ function(data) {
                    var rowCount = data.rows.length;
                    
                    if (rowCount > 0) {
                        searchDefinition['callbacks']['dataCallback'](
                            data.fields,
                            data.rows,
                            that._doAdditionalChecks
                            );
                        
                        taskRunner.markCompleted();    
                    } // else search completion would be handled
                },
                /* search start handler */ function() {
                    // Be resilient to more events per search in processing this counter
                    that._countActiveSearches = that._countActiveSearches >= 0 ? that._countActiveSearches + 1 : 0;
                    $('#host-updating').text('Searching for host information ...');
                    $('#key-events-updating').text('Searching for key events on the host ...');
                    $('#key-events-list').empty();
                    $('#key-event-details').empty();
                    $('#left-pane #no-key-events').show();
                    $('#right-pane #no-key-events').show();
                    $('#key-events-count').text('0');
                    _lastEventIndex = 0;
                },
                /* search progress handler */ function(isSearchDone, properties) {
                    if (isSearchDone) {
                        if (properties.content.eventCount === 0) {
                            searchDefinition['callbacks']['failureCallback'](
                                'No results found for search: "' + properties.name
                                );                            
                        } //else results would have been rendered
                        
                        if (--that._countActiveSearches < 1) {
                            $('#host-updating').text('Search for host information has completed');
                        }
                        
                        taskRunner.markCompleted();
                    }
                }
                );
                
            searchDefinition['searchRunner'].runSearch();
        },
        
        searchTimeoutHandler: function(searchDefinition) {
            searchDefinition['callbacks']['failureCallback']('Search has timed out. Search: "' + searchDefinition['search'] + '"');
        }
    };
    
    return HostInventory;
});
