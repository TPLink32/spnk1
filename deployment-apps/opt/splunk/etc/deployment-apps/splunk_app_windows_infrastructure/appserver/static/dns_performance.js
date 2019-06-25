require.config({
    paths: {
        "common": "../app/splunk_app_windows_infrastructure/js/common",
        "splunk_app_windows_infrastructure": "../app/splunk_app_windows_infrastructure/js/splunk_app_windows_infrastructure",
    },
});
require([
    'underscore',
    'jquery',
    'splunkjs/mvc/utils',
    'splunkjs/mvc',
    "splunkjs/mvc/utils",
    'splunk_app_windows_infrastructure/components/dnsperformanceview',
  	"splunkjs/mvc/searchmanager",
    'splunkjs/mvc/simplexml/ready!'
], function(_, $, utils, mvc, utils, DNSPerformanceView, SearchManager) {

    var report = new DNSPerformanceView({
    	"id": "dns_performance_chart",
    	"managerid": "dns_performance_query",
    	"el": $("#dns_performance_chart")
    }).render();
});