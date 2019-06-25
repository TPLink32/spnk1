define(function(require, exports, module) {
	'use strict';

	var field2dom = {
		"OS": "os-text",
		"TotalPhysicalMemoryKB": "total-physical-memory-text",
		"OSArchitecture": "os-architecture-text",
		"FreePhysicalMemoryKB": "free-physical-memory-text",
		"Version": "version-text",
		"TotalVirtualMemoryKB": "total-virtual-memory-text",
		"ServicePack": "service-pack-text",
		"FreeVirtualMemoryKB": "free-virtual-memory-text",
		"SerialNumber": "serial-number-text",
		"ComputerManufacturer": "os-manufacturer-text",
		"Manufacturer": "manufacturer-text",
		"InstallDate": "install-date-text",
		"Model": "model-text",
		"LastBootUpTime": "last-boot-time-text",
		"Domain": "domain-text",
		"Architecture": "architecture-text",
		"Name": "processor-name-text",
		"ClockSpeedMHz": "speed-text",
		"NumberOfCores": "cores-text",
		"NumberOfProcessors": "processors-text"
	};

	require(['splunkjs/ready!'], function() {
		var $ = require('jquery');
		var _ = require('underscore');
		var mvc = require('splunkjs/mvc');

		var queryArgs = window.location.search.substr(1) || '';
		var params = $.deparam(queryArgs) || {};

		var host = params.host;
		var tokenModel = mvc.Components.getInstance('default');
		// TODO warn if host not defined

		var computerProcessorSearch = mvc.Components.getInstance('computer-and-processor');
		var diskInformationSearch = mvc.Components.getInstance('disk-information');
		var networkInformationSearch = mvc.Components.getInstance('network-information');
		tokenModel.set('Host', host);

		var datasource = computerProcessorSearch.data('results', {
			output_mode: 'json',
			count: 0
		});

		datasource.on('data', function(results) {

			var info = results.data().results[0]; // this is weird
			console.dir(info);
			_.each(_.keys(info), function(key) {
				$('#' + field2dom[key]).text(info[key]);
			});
		});

		computerProcessorSearch.startSearch();
		diskInformationSearch.startSearch();
		networkInformationSearch.startSearch();

		$('a.info-links').each(function() {
			$(this).attr('href', $(this).attr('href').replace('$HostMonitoringHost$', encodeURIComponent(host)));
		}).css('visibility', 'visible');
	});






	

});