/**
 * Created by strong on 7/14/15.
 */
define([
    'jquery',
    'underscore',
    'app/collections/AddonTargets',
    'app/utils/ErrorDispatcher',
    'splunk.util'
], function ($, _, Targets, ErrorDispatcher, util) {

    var dfd = $.Deferred();

    var DEFAULT_TARGET = '127.0.0.1';
    var DEFAULT_OWNER = 'nobody';
    var NOT_FOUND_MESSAGE = _("This app requires the <a href='https://splunkbase.splunk.com/app/1928/?'>Splunk Add-on for ServiceNow</a>, but it is not installed on this server. Please install the add-on or contact an administrator.").t();
    var app = util.getCurrentApp();
    var owner = DEFAULT_OWNER;
    var targets = new Targets();
    targets.fetch({
        data: {
            app: app,
            owner: owner
        },
        success: function (targets) {
            if (targets.models.length > 0) {
                // chose the latest one as it newly added target
                var target = _.last(targets.models).entry.content.get('host');
                dfd.resolve(buildContext(target, app, owner));
            }
            else {
                ErrorDispatcher.raise("No target Splunk instance found");
                dfd.resolve(buildContext(DEFAULT_TARGET, app, owner)); // this will cause unpredictable error
            }
        },
        error: function (model, resp) {
            var errorMessage = resp["responseJSON"].messages[0].text;
            if(errorMessage.indexOf("not found on server")>=0){
                errorMessage = NOT_FOUND_MESSAGE;
            }
            ErrorDispatcher.raise(errorMessage);
            dfd.reject(errorMessage);
            //dfd.resolve(buildContext(DEFAULT_TARGET, app, owner)); // this will cause unpredictable error
        }
    });

    var buildContext = function (target, app, owner) {
        return {
            app: app,
            owner: owner,
            target: target
        }
    };

    return {
        getContext: function (successFn,failFn) {
            dfd.done(successFn);
            dfd.fail(failFn);
        }
    };
});