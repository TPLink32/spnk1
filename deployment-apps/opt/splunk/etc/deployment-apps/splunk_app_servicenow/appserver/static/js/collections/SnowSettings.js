/**
 * Created by strong on 7/29/15.
 */
define(
    [
        'jquery',
        'app/collections/BaseCollection',
        'app/models/SnowSetting'
    ],
    function ($, SplunkDsBase, SnowSetting) {
        return SplunkDsBase.extend({
            url: "saas-snow/splunk_app_servicenow_setup",
            urlRoot: "saas-snow/splunk_app_servicenow_setup",
            model: SnowSetting,
            initialize: function () {
                SplunkDsBase.prototype.initialize.apply(this, arguments);
            }
        });
    }
);
