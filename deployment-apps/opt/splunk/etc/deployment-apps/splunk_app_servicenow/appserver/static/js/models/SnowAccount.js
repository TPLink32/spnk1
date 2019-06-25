/**
 * Created by strong on 6/24/15.
 */

define(
    [
        'underscore',
        'app/models/BaseModel'
    ],
    function (_, BaseModel) {
        return BaseModel.extend({
            url: "saas-snow/splunk_app_servicenow_accounts",
            urlRoot: "saas-snow/splunk_app_servicenow_accounts",

            // attributes: name, key_id, secret_key
            initialize: function () {
                BaseModel.prototype.initialize.apply(this, arguments);
            },

            getAttributeNames: function() {
                return [
                    'name',
                    'snow_url',
                    'release',
                    'username',
                    'password'
                ];
            }
        });
    }
);