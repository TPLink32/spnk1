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
    'splunk_app_windows_infrastructure/components/ldaprecordview',
  	"splunkjs/mvc/searchmanager",
    'splunkjs/mvc/simplexml/ready!'
], function(_, $, utils, mvc, utils, LDAPRecordView, SearchManager) {

    var report = new LDAPRecordView({
    	"id": "audit_report",
    	"managerid": "audit_query",
    	"el": $("#audit_report")
    }).render();
});