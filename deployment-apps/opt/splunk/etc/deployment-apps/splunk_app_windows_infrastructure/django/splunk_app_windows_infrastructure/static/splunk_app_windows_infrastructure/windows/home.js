define(function(require, exports, module) {
	'use strict';

	// utilities
	var _ = require('underscore');
	var $ = require('jquery');


	// framework components
	var SearchListerView = require('splunk_app_windows_infrastructure/windows/searchlisterview'); // TODO rename to searchlisterview
	var SingleView = require('splunkjs/mvc/singleview');
	var SearchManager = require('splunkjs/mvc/searchmanager');
	var TimePickerView = require('splunkjs/mvc/timepickerview');
	var PaginatorView = require('splunkjs/mvc/paginatorview');
	var SplunkConfig = require('splunk.config');

	var singles = {
		"event": [
			{ 
				prefix: 'hosts', 
				search: '| inputlookup windows_event_system' +
					' | dedup Host' +
					' | stats count',
				label: 'Host',
				linkSearch: 'eventtype="wineventlog_windows" earliest=@d' +
					' | stats values(LogName) as "Event Logs" by host'
			},
			{
				prefix: 'lognames',
				search: '| inputlookup windows_event_details' +
					' | dedup LogName' +
					' | stats count',
				label: 'Log Name',
				linkSearch: '| inputlookup windows_event_details' +
					' | dedup LogName' +
					' | table LogName' +
					' | sort LogName'
			},
			{
				prefix: 'eventids',
				search: '| inputlookup windows_event_details' +
					' | stats count',
				label: 'Event ID',
				linkSearch: '| inputlookup windows_event_details' +
					' | table LogName, SourceName, TaskCategory, EventCode' +
					' | sort LogName, TaskCategory, EventCode'
			}
		],
		"performance": [
			{
				prefix: 'hosts',
				search: '| inputlookup windows_perfmon_system | stats count',
				label: 'Host',
				linkSearch: 'eventtype="perfmon_windows" object=* earliest=@d ' + 
					'| stats dc(counter) as dccount by object, Host' +
					' | eval comb=object." (Total Counters = ".dccount.")"' +
					'| stats values(comb) as Perfmon_Counter_Category by Host' +
					' | table Host, Perfmon_Counter_Category'
			},
			{
				prefix: 'objects',
				search: '| inputlookup windows_perfmon_details' +
					' | dedup object' +
					' | stats count',
				label: 'Object',
				linkSearch: 'eventtype="perfmon_windows" object=* earliest=@d' +
					' | stats dc(counter) as Number by object, host' +
					' | sort -Number'
			},
			{
				prefix: 'counters',
				search: '| inputlookup windows_perfmon_details' +
					' | dedup counter' +
					' | stats count',
				label: 'Counter',
				linkSearch: '| inputlookup windows_perfmon_details' +
					' | eval Perfmon_Counter=counter' +
					' | eval Perfmon_Counter_Category=object' +
					' | dedup Perfmon_Counter, instance' +
					' | table Perfmon_Counter_Category, Perfmon_Counter, instance' +
					' | sort Perfmon_Counter_Category, Perfmon_Counter, instance'
			}
		]
	};

	_.each(_.keys(singles), function(singleKey) {
		var group = singles[singleKey];
		_.each(group, function(widget) {
			var prefix = singleKey + '-' + widget.prefix + '-';

			// create the search
			var searchContext = new SearchManager({
				search: widget.search,
				preview: false
			});

			// create the ui
			new SingleView({
				managerid: searchContext.name,
				el: $('#' + prefix + 'single-container'),
				afterLabel: function(value) { 
					return parseInt(value) === 1 ? this.label : this.label + 's'; 
				}.bind(widget),
				linkSearch: widget.linkSearch,
				linkFields: ['afterlabel', 'result'],
				linkView: '/app/' + SplunkConfig.APP + '/flashtimeline' 
			}).render();
		});
	});

	var timepicker = new TimePickerView({
		el: $('#timepicker-master-container'),
		earliest_time: '@d',
		latest_time: 'now'
	}).render();

	var queuedSearches = [];

	_.each(['source', 'sourcetype', 'host'], function(type) {
		var searchListerPaginator = new PaginatorView({
			el: $('#searchlister-' + type + 's-paginator-container')
		}).render();

		// TODO metadata searches are currently broken -- keep eye on this
		var searchListerManager = new SearchManager({
			'search': '| metadata type=' + type + 's (eventtype="perfmon_windows" OR eventtype="wineventlog_windows") | table ' + type + ', totalCount | dedup ' + type + ' | eval key=' + type + ' | eval value=totalCount',
			autostart: false,
			cache: true
		});
		queuedSearches.push(searchListerManager); 

		new SearchListerView({
			managerid: searchListerManager.name,
			el: $('#searchlister-' + type + 's-container'),
			paginator: searchListerPaginator.name
		}).render();
	});

	timepicker.on('change', function() {
		_.each(queuedSearches, function(search) {
			search.search.set(timepicker.val());
			search.startSearch();
		});
	});

	_.each(queuedSearches, function(search) {
		search.search.set(timepicker.val());
		search.startSearch();
	});
});

