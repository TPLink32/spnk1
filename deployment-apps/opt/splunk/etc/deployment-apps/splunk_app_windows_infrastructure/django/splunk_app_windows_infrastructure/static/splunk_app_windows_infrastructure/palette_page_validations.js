define(function(require, exports, module) {
    var _ = require('underscore');
    var Backbone = require('backbone');

    var slugRegex = /^[\-_\w]+$/;
    
    return Backbone.Model.extend({
        validate: function(attributes) {
            attributes = attributes || this.toJSON();

            var errors = [];
            var found = false;

            var mkvalidation = _.bind(function(cond, key, msg) {
                found = found || (!cond);
                var trigger = 'attributeValidated:' + key;
                this.trigger.apply(this, cond ? [trigger, true, key, ''] : [trigger, false, key, msg]);
            }, this);

            if (attributes.hasOwnProperty('name')) {
                mkvalidation(
                    (attributes.name.search(slugRegex) == 0),
                    'name',
                    "The ID property may contain only letters, numbers, the dash or underscore separators.");
            }
            
            if (attributes.hasOwnProperty('title')) {
                mkvalidation(
                    (! (/^\s*$/.test(attributes.title))),
                    'title',
                    "The page title may not be left blank.");
            }
            return (this._errors = found ? found : null);
        }
    });
});
    

