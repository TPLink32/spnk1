/**
 * Created by strong on 8/31/15.
 */

define(['underscore', 'jquery', 'backbone','app/utils/Util'], function (_, $, Backbone, LinkUtil) {

    var type = {
        MSG_TYPE_ERROR: 'MSG_TYPE_ERROR',
        MSG_TYPE_WARNING: 'MSG_TYPE_WARNING'
    };

    var MSG_UNIVERSAL_TA = _.template('Configuration using a universal forwarder is not supported. Please install the Splunk Add-on for ServiceNow on a heavy forwarder and reconfigure the connection from your search head. <a class="external" target="_blank" href="/help?location=<%= LINK_PREFIX %>snowapp.error.universal_forwarder">Learn more</a>',{"LINK_PREFIX":LinkUtil.getLinkPrefix()});
    return {
        TYPE: type,

        parse: function(message) {

            // Global errors
            if (/HTTP 404 Not Found.*Admin handler.*not found/.test(message)) {
                return {
                    type: type.MSG_TYPE_ERROR,
                    msg: MSG_UNIVERSAL_TA
                }
            }

            // default: return original message
            try {
                var errorMsg = $.parseJSON(message).messages[0].text.replace(/\n/g, ' ');
                var xmlText = errorMsg.match(/(<\?xml|<ErrorResponse xmlns).*<\/(ErrorResponse|Error|Response)>/);

                if (xmlText != null) {
                    var xmlMsg = $.parseXML(xmlText[0]);
                    var errorCode = $(xmlMsg).find('Code').text();
                    var errorMsg = $(xmlMsg).find('Message').text();

                    return {
                        type: type.MSG_TYPE_ERROR,
                        msg: "Unexpected error occurs. " + errorCode + ": " + errorMsg
                    };

                } else {
                    return {
                        type: type.MSG_TYPE_ERROR,
                        msg: "Unexpected error occurs. " + errorMsg
                    };
                }
            } catch(e) {
                return {
                    type: type.MSG_TYPE_ERROR,
                    msg: message
                }
            }

        }
    };
});