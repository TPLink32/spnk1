/*global define */
define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    require('jquery.deparam');
    require('bootstrap.modal');
    var Backbone = require('backbone');

    var TimeRangeView = require('splunkjs/mvc/timerangeview');
    var SearchManager = require('splunkjs/mvc/searchmanager');
    var PostProcessManager = require('splunkjs/mvc/postprocessmanager');
    var TableView = require('splunkjs/mvc/tableview');
    var ChartView = require('splunkjs/mvc/chartview');
    var ResultsLinkView = require('splunkjs/mvc/resultslinkview');
    var PerfmonCounterTableView = require('splunk_app_windows_infrastructure/perfmon/PerfmonCounterTableView');
    var CounterPickerView = require('splunk_app_windows_infrastructure/perfmon/CounterPickerView');
    var TagChartView = require('common/TagChartView');
    var mvc = require('splunkjs/mvc');
    var ListItemModel = require('common/customvisualizations/listpickercontrol/listitemmodel');
    var ListItemCollection = require('common/customvisualizations/listpickercontrol/listitemcollection');
    var SearchRunner = require('common/SearchRunner');
    var TimeShifter = require('common/TimeShifter');
    var TimeComparePickerView = require('common/grayskull/deepdive/DeepDiveTwinTimePickerView');

    // Local models and collections
    var CounterDataModel = Backbone.Model.extend({
        defaults:{
            'host': null,
            'counterId': null,
            'object': null,
            'counter': null,
            'instance': null,
            'color': null,
            'visible': false
        }
    });

    var CounterDataCollection = Backbone.Collection.extend({
        model: CounterDataModel
    });

    var hostSearch = '| inputlookup windows_perfmon_system'; 
    var counterSearch = '| inputlookup windows_perfmon_details | eval id=object+counter+instance | dedup id | sort by object counter instance | table id object counter instance';
    var instanceLookupTemplate = '| inputlookup windows_perfmon_details | search object="<%= object %>" counter="<%= counter %>" | dedup instance | table instance';

    // Search template strings 
    var entitySelectorSearchPartTemplate = '(host="<%= host %>" object="<%= object %>" counter="<%= counter %>" instance="<%= instance %>") ';
    var baseSearchTemplate = 'eventtype=perfmon <%= counterFilter %> ';
    var assignEntitySearchPart = '| eval entity=host+object+counter+instance | eval entity=if(shifted="true", entity+"Prev", entity) ';
    var appendResultsForAvgTemplate = '| append [search earliest=-1d@d latest=@d <%= baseSearch %> | eval avgEvent="true" ]';
    var appendAvgTemplate = '| appendpipe [search avgEvent="true" | eval entity=entity+"Avg" | stats avg(Value) as avg by entity | eval Value=avg | eval _time=now()  ] | search NOT avgEvent="true"';
    var chartSearchPart = '| timechart avg(Value) by entity';

    var lineStyleIndicatorTemplate = '\
        <span>(</span>\
        <svg class="compare-control-svg"><line x1="0" y1="10" x2="40" y2="10" stroke-dasharray="<%= dasharray %>"/></svg>\
        <span>)</span>\
    ';

    var ACTIVE_CHECKBOX_MARKUP = '<i class="icon-box-checked"></i>';    
    var INACTIVE_CHECKBOX_MARKUP = '<i class="icon-box-unchecked"></i>';    

    var PerfmonView = Backbone.View.extend({

        _colors: [
            '#6CB8CA', '#FAC61D', '#D85E3D', '#956E96', '#F7912C',
            '#9AC23C', '#5479AF', '#999755', '#DD87B0', '#65AA82'
        ],

        _comparisonTimeframe: 'Yesterday',

        _compareTime: false,
        _compareAvg: false,

        initialize: function(options){
            var that = this;
            Backbone.View.prototype.initialize.apply(this, arguments);

            this.activeCountersCollection = new CounterDataCollection();

            // Add and remove events call _updateSearchChartTableURL because the search needs to be re-run
            this.listenTo(this.activeCountersCollection, 'add', _.debounce(this._updateSearchChartTableURL));           
            this.listenTo(this.activeCountersCollection, 'remove', _.debounce(this._updateSearchChartTableURL));

            // When counters themselves are changed, the search does not need to be re-run,
            // we call _updateChartTableURL instead, and only re-renders happen    
            this.activeCountersCollection.on('change', _.debounce(_.bind(this._updateChartTableURL, this))); 

            this.timeShifter = new TimeShifter();  

            var queryArgs = window.location.search.substr(1) || '';
            this.params = $.deparam(queryArgs);
            if(this.params['perfmon'] && this.params['perfmon'].length > 0){
                _.each(this.params['perfmon'], function(param){
                    if (param.instance === '*') {
                        var instanceSearchManager = new SearchManager({
                            id: 'instanceSearchManager',
                            autoStart: false,
                            search: _.template(
                                instanceLookupTemplate, 
                                { 
                                    'object': param.object,
                                    'counter': param.counter
                                }
                            )
                        });
                        instanceSearchManager.data('results').on('data', function(results){
                            _.each(results.data().rows, function(row){
                                that._addCountersToActive(
                                    param.host,
                                    [{
                                        'object': param.object,
                                        'counter': param.counter,
                                        'instance': row[0]
                                    }]
                                );
                            });
                        });
                        instanceSearchManager.startSearch();
                    }
                    else {
                        that._addCountersToActive(
                            param.host,
                            [{
                                'object': param.object,
                                'counter': param.counter,
                                'instance': param.instance
                            }]
                        );
                    }
                });
            }

            $('#share-modal').on('shown.bs.modal', function(){
                $('#share-modal-text-field').select();
            });
        },
        
        render: function(){
            var that = this;
            $('#share-button').click(_.bind(this._shareClicked, this));

            this.timerangeView = new TimeRangeView({
                'id': 'timerangeView',
                'earliest_time': this.params.earliest || '-60m',
                'latest_time': this.params.latest || 'now',
                'dialogOptions': {
                    // JIRA: disabling realtime selectors for now because there is a 
                    // bug that makes it impossible for a timepicker to be both
                    // realtime and non-real time. This should be re-enabled when
                    // that bug is fixed. (TAG-2940)
                    'showPresetsRealTime': false,
                    'showCustomRealTime': false,
                    'enableCustomAdvancedRealTime': false
                },
                'value': mvc.tokenSafe('$timeRange$'),
                'el': $('#timerange-div')
            }).render();

            this.timerangeView.on('change', function(e){
                that._updateSearchChartTableURL();
            });

            this.mainChartSearchManager = new SearchManager({
                'id': 'mainChartSearchManager',
                'preview': true,
            });

            this.mainChart = new TagChartView({
                'id': 'mainChart',
                'managerid': 'mainChartSearchManager',
                'el': $('#chart-div'),
                'series': []
            }).render(); 

            var chartResultsLinkView = new ResultsLinkView({
                'id': 'chartResultsLinkView',
                'managerid': 'mainChartSearchManager',
                'el': $('#chart-links-div')
            }).render();

            // Get available hosts
            var hostSearchManager = new SearchManager({
                'id': 'hostSearchManager',
                'search': hostSearch
            });

            // Get avialbable counters
            var countersSearchManager = new SearchManager({
                'id': 'countersSearchManager',
                'search': counterSearch
            });
            
            var countersDfd = $.Deferred();
            var availableCounters = [];
            // TODO: fill in the other handlers here
            // when we've decided on the proper behavior 
            var counterSearchRunner = new SearchRunner(
                countersSearchManager,
                null,
                // Search Failure handler
                function(){ 
                },
                // Search Success Handler: add returned counters
                // to list of available counters
                function(data){
                    _.each(data.rows, function(row){
                        availableCounters.push(that._counterRowToCounterData(row));
                    });
                    countersDfd.resolve(availableCounters);
                },
                // Search Start handler
                function(){},
                // Search Progress handler
                function(){}
            );
            counterSearchRunner.runSearch();

            // Set up counter table
            this.counterTable = new PerfmonCounterTableView({
                'id': 'counterTable',
                'activeCountersCollection': this.activeCountersCollection,
                'showCompare': false,
                'showAverage': false,
                'el': $('#counter-table-div')
            }).render();

            // Visibility clicks return a counterId
            this.counterTable.on('click:visible', this._visibleCheckBoxClicked);
            this.counterTable.on('change:selection', this._tableSelectionChanged);

            // Set up counter picker
            var counterPicker = new CounterPickerView({
                'id': 'counterPicker',
                'hostSearchManager': hostSearchManager,
                'counterPromise': countersDfd.promise(),
                'addItemsCallback': this._addCountersToActive.bind(this),
            });
            $('body').append(counterPicker.render().el);

            $('#add-counters-button').on('click', function(){
                counterPicker.show();
            });

            $('#remove-counters-button').on('click', this._removeClicked.bind(this));

            this.timeCompareControl = new TimeComparePickerView({
                el: $('#compare-time'),
            }); 
            this.timeCompareControl.render();
            this.timeCompareControl.on('toggle', function(timeShiftData){
                that._compareTime = timeShiftData.active;
                that._comparisonTimeframe = timeShiftData.timeframe;
                that._updateSearchChartTableURL();
            });
            $('#compare-time-svg').append(_.template(lineStyleIndicatorTemplate, {dasharray: '6, 3'}));

            // This is hidden until here to reduce pop-in on load
            $('#compare-avg-container').css('display', 'inline-block');
            $('.compare-avg-checkbox-container').on('click', function(){
                if(that._compareAvg) {
                    that._compareAvg = false;
                    $('.compare-avg-checkbox-container').html(INACTIVE_CHECKBOX_MARKUP);
                }
                else {
                    that._compareAvg = true;
                    $('.compare-avg-checkbox-container').html(ACTIVE_CHECKBOX_MARKUP);
                }
                that._updateSearchChartTableURL();
            });
            $('#compare-avg-svg').append(_.template(lineStyleIndicatorTemplate, {dasharray: '2, 4'}));
        },

        _shareClicked: function(){
            $('#share-modal').modal('show');
            $('#share-modal-text-field').val(document.URL);
            $('#share-modal-link').attr('href', document.URL);
        },

        _getTimeRangeFromTokens: function(){
            var defaultTokenNamespace = mvc.Components.get('default');
            return defaultTokenNamespace.get('timeRange');
        },

        _updateURLHash: function(){
            var countersArray = this.activeCountersCollection.map(function(counter){
                return {
                    'host': counter.get('host'),
                    'object': counter.get('object'),
                    'counter': counter.get('counter'),
                    'instance': counter.get('instance')
                }
            });

            var timeRange = this._getTimeRangeFromTokens();

            var urlParametersArray = [
                'earliest=' + timeRange.earliest_time,
                'latest=' + timeRange.latest_time,
                $.param({'perfmon': countersArray})
            ];

            window.history.replaceState(null, null, '?' + urlParametersArray.join('&'));
        },

        // params:
        // host is a host name string
        // counters is a list of counterDatas
        //      {
        //          object: objectName,
        //          counter: counterName,            
        //          instance: instanceName
        //      }
        //
        _addCountersToActive: function(host, counters){
            var that = this;
            _.each(counters, function(counter){
                var counterToAdd = new CounterDataModel({
                    'host': host,
                    'counterId': host.trim() 
                        + counter.object.trim() 
                        + counter.counter.trim()
                        + counter.instance.trim(),
                    'object': counter.object,
                    'counter': counter.counter,
                    'instance': counter.instance,
                    'color': that._getColor(),
                    'visible': true
                });
                if(!_.contains(that.activeCountersCollection.pluck('counterId'), counterToAdd.get('counterId'))) {
                    that.activeCountersCollection.add(counterToAdd);
                }
            });
        },

        // _updateSearchChartTableURL is called when counters are added
        // or removed. The search needs to be re-run in these cases.
        _updateSearchChartTableURL: function(){
            this._updateSearch();
            this._updateChart();
            this._updateTable();
            this._updateURLHash();
        },

        // When a counter is updated, it is a cosmetic change (like visibility)
        // that does not require a re-running of search. The chart and table are
        // re-rendered.
        _updateChartTableURL: function(){
            this._updateChart();
            this._updateTable();
            this._updateURLHash();
        },

        // Searches are built out of various parts, some templated and some not.
        // If a time-comparison is added to the search, a subsearch is appended using
        // many of the same templates. 
        _updateSearch: function(){
            var that = this;
            if(this.activeCountersCollection.length < 1) {
                this.mainChartSearchManager.set('search', null);
                return;
            }

            // Build counter part
            var counterSearchStrings = this.activeCountersCollection.map(function(counterModel){
                return _.template(
                    entitySelectorSearchPartTemplate, 
                    {
                        host: counterModel.get('host'),
                        object: counterModel.get('object'),
                        counter: counterModel.get('counter'),
                        instance: counterModel.get('instance')
                    }
                )
            });
            var countersSearchPart = counterSearchStrings.join('OR ');

            // Gets us the events with no time specified
            var baseSearch = _.template(baseSearchTemplate, {counterFilter: countersSearchPart});

            // Conditionally add averages comparison
            var appendResultsForAvg = '';
            var appendAvgSearchPart = '';
            if(this._compareAvg) {
                appendResultsForAvg = _.template(appendResultsForAvgTemplate, {baseSearch: baseSearch});
                appendAvgSearchPart = appendAvgTemplate;
            }

            var times = this._getTimeRangeFromTokens();
             
            // Getting the search string with time involved is async because we need to talk to the server
            this.timeShifter.getSearchWithTime(
                baseSearch,
                times['earliest_time'],
                times['latest_time'],
                this._compareTime ? this._comparisonTimeframe : null
            )
                .done(function(searchWithTime){
                     var newSearchString = searchWithTime
                        + appendResultsForAvg
                        + assignEntitySearchPart
                        + appendAvgSearchPart 
                        + chartSearchPart;
                    that.mainChartSearchManager.set('search', newSearchString);
                    that.mainChartSearchManager.startSearch();
                });
        },

        _updateChart: function(){
            var updatedSeries = this.activeCountersCollection.map(function(counterModel){
                return {
                    'columnName': counterModel.get('counterId'),
                    'type': 'line',
                    'title': counterModel.get('counterId'),
                    'lineColor': counterModel.get('color'),
                    'visible': counterModel.get('visible'),
                    'animation': false
                }
            });

            // If time comparison is on, add the previous-time series
            if(this._compareTime) {
                updatedSeries = updatedSeries.concat(
                    this.activeCountersCollection.map(function(counterModel){
                        return {
                            'columnName': counterModel.get('counterId') + 'Prev',
                            'type': 'line',
                            'dashStyle': 'shortDash',
                            'title': counterModel.get('counterId'),
                            'lineColor': counterModel.get('color'),
                            'visible': counterModel.get('visible'),
                            'animation': false
                        }
                    })
                );
            }

            // If benchmark comparisons are on, add benchmarks
            var benchmarks = [];
            if(this._compareAvg) {
                benchmarks = this.activeCountersCollection.map(function(counterModel){
                    return {
                        'columnName': counterModel.get('counterId') + 'Avg',
                        'type': 'line',
                        'dashStyle': 'shortDash',
                        'title': counterModel.get('counterId'),
                        'lineColor': counterModel.get('color'),
                        'visible': counterModel.get('visible'),
                        'animation': false,
                    }
                })
            }

            this.mainChart.settings.set('series', updatedSeries);
            this.mainChart.settings.set('benchmarks', benchmarks);
            this.mainChart.render();
        },

        _updateTable: function(){
            this.counterTable.setShowCompare(this._compareTime);
            this.counterTable.setShowAverage(this._compareAvg);
            this.counterTable.render();
        },

        _counterRowToCounterData: function(dataRow){
            return {
                'object': dataRow[1],
                'counter': dataRow[2],
                'instance': dataRow[3]
            }
        },

        _getColor: function(){
            return this._colors.pop() || '#808080';
        },

        _visibleCheckBoxClicked: function(e){
            var counterModel = this.activeCountersCollection.where({'counterId': e})[0];
            if(!counterModel) {
                throw 'No active counter found for ' + e;   
            }
            if(counterModel.get('visible')) {
                counterModel.set('visible', false);
            }
            else {
                counterModel.set('visible', true);
            }
        },

        _tableSelectionChanged: function(e){
            if(e.length > 0) {
                $('#remove-counters-button').prop('disabled', false);
            }
            else {
                $('#remove-counters-button').prop('disabled', true);
            }
        },

        _removeClicked: function(){
            var selectedIds = this.counterTable.getSelectedRowIds();
            var selectedModels = this.activeCountersCollection.filter(function(counterModel){
                return _.contains(selectedIds, counterModel.get('counterId'));
            });
            this.activeCountersCollection.remove(selectedModels);
            
            // Put the color back
            this._colors = _.union(
                this._colors, 
                _.map(selectedModels, function(model){
                    return model.get('color');
                })
            );

            this._tableSelectionChanged([]);
        }
    });

    return PerfmonView;        
});
