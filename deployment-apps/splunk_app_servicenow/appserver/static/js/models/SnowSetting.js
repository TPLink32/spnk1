/**
 * Created by strong on 7/29/15.
 */
define(
    [
        'underscore',
        'app/models/BaseModel'
    ],
    function (_, BaseModel) {
        return BaseModel.extend({
            url: "saas-snow/splunk_app_servicenow_setup",
            urlRoot: "saas-snow/splunk_app_servicenow_setup",

            // attributes: name, key_id, secret_key
            initialize: function () {
                BaseModel.prototype.initialize.apply(this, arguments);
            },

            getAttributeNames: function() {
                return [
                    'name',
                    'collection_interval',
                    'loglevel',
                    'since_when'
                ];
            }
        });
    }
);