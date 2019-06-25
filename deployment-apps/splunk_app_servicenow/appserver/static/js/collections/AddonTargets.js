/**
 * Created by strong on 7/13/15.
 */
define([
    'jquery',
    'underscore',
    'app/collections/BaseCollection',
    'app/models/AddonTarget',
    'app/utils/MomentUtil'
], function ($, _, SplunkDsBaseCollection, AddonTarget,MomentUtil) {

    return SplunkDsBaseCollection.extend({
        url: "saas-snow/splunk_app_servicenow_targets",
        model: AddonTarget,
        initialize: function () {
            SplunkDsBaseCollection.prototype.initialize.apply(this, arguments);
        },
        comparator: function (targetModel) {
            if (targetModel.entry.content.get('create_time')) {
                var moment = MomentUtil.strptime(targetModel.entry.content.get('create_time'), '%Y-%m-%d %H:%M:%S');
                return moment.unix();
            }
            else {
                return 0;
            }
        }
    });
})