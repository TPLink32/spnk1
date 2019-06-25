/**
 * Created by strong on 6/17/15.
 */

define(function (require, exports, module) {
    var SERVICES = {
        SNOW_ACCOUNTS: 'snow_accounts',
        SNOW_INPUTS: 'snow_inputs'
    };
    return {
        load: function (name, req, onLoad, config) {
            if (config.isBuild) {
                //!! no jquery reference in this path, otherwise build will fail.
                onLoad(null);
            }
            else {
                require(['app/utils/ContextResolver'], function (ContextResolver) {
                    ContextResolver.getContext(function (context) {
                        onLoad({
                            APP: context.app,
                            OWNER: context.owner,
                            TARGET: context.target,
                            CONTEXT: context,
                            SERVICES:SERVICES
                        });
                    },function(err){
                        onLoad({
                            ERROR: err,
                            SERVICES: SERVICES
                        })
                    });
                });
            }
        }
    };
});