define([
    "jquery",
    "underscore",
    "backbone"
], function(
    $,
    _,
    Backbone
    ) {
    return Backbone.Model.extend({

        urlRoot: Splunk.util.make_url([
            "custom",
            "splunk_app_stream",
            "streamfwdauth"
        ].join('/')),

        validate: function(attrs, options) {

            var errors = [];

            if (attrs.enabled && attrs.authKey === '') {
                errors.push("auth key is required when stream forwarder auth is enabled");
            }

            var invalidWhitespace = attrs.authKey.match(/\s/);

            if (invalidWhitespace != null) {
                errors.push("auth key cannot contain whitepsace");
            }

            var invalidChars = attrs.authKey.match(/[^\s0-9A-z@%+/\\'!#$^?:,(){}[\]~`\-_]/g);

            if (invalidChars != null) {
                errors.push("auth key contains invalid characters: " + _.uniq(invalidChars).join(''));
                errors.push("only alphanumeric chars and @%+/\\'!#$^?:,(){}[]~`-_ are valid");
            }

            return errors.length > 0 ? errors : false;
        }

    });
});
