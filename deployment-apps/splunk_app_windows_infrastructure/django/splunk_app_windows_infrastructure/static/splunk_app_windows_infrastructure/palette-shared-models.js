define(function(require, exports, module) {
    var sharedModels = require('splunkjs/mvc/sharedmodels');
    var _ = require('underscore');
    var Roles = require('collections/services/authorization/Roles');

    var _STORAGE = {
        roles: {
            model: new Roles(),
            fetch: _.memoize(function() {
                var model = _STORAGE['roles'].model;
                var dfd = model.dfd = model.fetch();
                return dfd;
            })
        }
    };

    return {
        get: function(name) {
            if (_STORAGE.hasOwnProperty(name)) {
                var container = _STORAGE[name];
                container.fetch();
                return container.model;
            }
            return sharedModels.get(name);
        }
    };
});
                             

    
