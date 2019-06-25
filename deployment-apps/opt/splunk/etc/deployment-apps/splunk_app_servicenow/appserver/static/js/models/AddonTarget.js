define([
    'jquery',
    'underscore',
    'app/models/BaseModel'
], function ($, _, BaseModel) {

    return BaseModel.extend({
        url: "saas-snow/splunk_app_servicenow_targets",
        initialize: function () {
            BaseModel.prototype.initialize.apply(this, arguments);
        }
    });
})