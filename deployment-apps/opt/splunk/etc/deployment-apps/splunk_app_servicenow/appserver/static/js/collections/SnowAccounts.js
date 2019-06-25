/**
 * Created by strong on 6/24/15.
 */
define(
    [
        'jquery',
        'app/collections/BaseCollection',
        'app/models/SnowAccount'
    ],
    function ($, SplunkDsBase, SnowAccount) {
        return SplunkDsBase.extend({
            url: "saas-snow/splunk_app_servicenow_accounts",
            urlRoot: "saas-snow/splunk_app_servicenow_accounts",
            model: SnowAccount,
            initialize: function () {
                SplunkDsBase.prototype.initialize.apply(this, arguments);
            }
        });
    }
);
