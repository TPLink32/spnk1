define(['underscore', 'jquery'], function (_, $) {

    _.mixin({
        isMeaningless: function(v) { return (_.isUndefined(v) || _.isEmpty(v) || (v === "")); }
    });

    var Utilities = {
        extractNumericValue: function(value) {
            if (_.isNumber(value)) {
                return value;
            }
            
            return (value === '' ? 0 : parseInt(this.removeNonNumericCharacters(value), 10));
        },
        
        removeNonNumericCharacters: function(text) {
            return text.replace(/\D/g, '');
        },

        updateUrlState: function(parameters, statename) {
            statename = (! _.isUndefined(statename)) ? statename : "default";
            var queryArgs = window.location.search.substr(1) || '';
            var deleteEmpties = function(m, v, k) { 
                if (! (_.isMeaningless(v))) { m[k] = v; }
                return m;
            };
            var params = _.reduce(_.extend($.deparam(queryArgs) || {}, parameters), deleteEmpties, {});
            window.history.replaceState(params, statename, window.location.href.replace(/\?.*$/, '') + '?' + $.param(params));
        }
    };
    
    return Utilities;
});
