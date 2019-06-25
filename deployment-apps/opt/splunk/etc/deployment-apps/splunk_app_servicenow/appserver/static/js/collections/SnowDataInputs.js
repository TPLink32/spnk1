/**
 * Created by strong on 8/4/15.
 */
define(
    [
        'jquery',
        'app/collections/BaseCollection',
        'app/models/SnowDataInput'
    ],
    function ($, SplunkDsBase, SnowDataInput) {
        return SplunkDsBase.extend({
            url: "saas-snow/splunk_app_servicenow_inputs",
            urlRoot: "saas-snow/splunk_app_servicenow_inputs",
            model: SnowDataInput,
            initialize: function () {
                SplunkDsBase.prototype.initialize.apply(this, arguments);
            }
        });
    }
);