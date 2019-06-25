define(['underscore', 'jquery'], function (_, $) {

    var APP_NAME = 'splunk_app_servicenow';
    var APP_VERSION = '4.0.3'

    var APP_PREFIX = encodeURIComponent('[' + APP_NAME + ':' + APP_VERSION + ']');

    return {
        /**
         * insert [app_name:app_version] before the link.
         * @param link
         * @returns new link
         */
        buildLink: function(link) {
            var s = link.indexOf('help?location=');

            if (s < 0) {
                return link;
            }

            var e = s+'help?location='.length;

            var newLink = link.substr(0, e) + APP_PREFIX + link.substr(e);

            return newLink;
        },

        getLinkPrefix: function() {
            return APP_PREFIX;
        }
    };

});