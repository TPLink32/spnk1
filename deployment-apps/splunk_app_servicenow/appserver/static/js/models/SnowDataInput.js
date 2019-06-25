/**
 * Created by strong on 8/4/15.
 */
define(
    [
        'underscore',
        'app/models/BaseModel'
    ],
    function (_, BaseModel) {
        return BaseModel.extend({
            url: "saas-snow/splunk_app_servicenow_inputs",
            urlRoot: "saas-snow/splunk_app_servicenow_inputs",

            // attributes: name, key_id, secret_key
            initialize: function () {
                BaseModel.prototype.initialize.apply(this, arguments);
            },

            getAttributeNames: function() {
                return [
                    'name',
                    'exclude',
                    'duration',
                    'since_when',
                    "timefield",
                    "index",
                    "host",
                    "disabled"
                ];
            }
        });
    }
);