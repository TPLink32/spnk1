/**
 * Created by hshen on 7/25/16.
 */
require([
    '../app/splunk_app_servicenow/js/lib/ui-metrics-collector/ui-metrics-collector',
    '../app/splunk_app_servicenow/js/utils/RememberInputView',
    '../app/splunk_app_servicenow/js/utils/MultiSelectHelper',
    "splunkjs/mvc/simplexml/ready!",
], function (
             UIMetricsCollector,
             RememberInputView
             ) {

    // Remember user input and set the value automatically in other dashboards
    RememberInputView.addRemEl('time');

    // start UI Metrics Collector
    UIMetricsCollector.start();

});
