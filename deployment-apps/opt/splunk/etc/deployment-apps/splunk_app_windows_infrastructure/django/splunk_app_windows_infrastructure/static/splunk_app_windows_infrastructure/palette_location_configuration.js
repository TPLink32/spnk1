/*global define */

define(function(require, exports, module) {
    var _ = require('underscore');

    /* A small utility class that derives from the URL the palette
     * page requested. */

    var PaletteLocationConfiguration = function(app, pathname) {
        pathname = pathname || window.location.pathname;
        var paths = _.without(pathname.split('/'), "");
        this.app = app;
        this.paths = paths.slice(_.indexOf(paths, this.app) + 1);
        return this;
    };

    _.extend(PaletteLocationConfiguration.prototype, {
        pageName: function() {
            return decodeURIComponent(this.paths[this.paths.length - 1]);
        },

        getCloneSource: function() {
            if (this.pageName() !== '_new') {
                return null;
            }
            
            // Search for one instance of the search key
            // 'source=<encoded url component>' used in the 'clone'
            // code path.  Rather than an entire search string parser,
            // The Firefox recommend the regexp seen below.
            // https://developer.mozilla.org/en-US/docs/Web/API/Window.location

            var sourceKey = new RegExp("^(?:.*[&\\?]source(?:\\=([^&]*))?)?.*$", "i");
            var source = decodeURIComponent(window.location.search.replace(sourceKey, "$1"));
            if (source.length === 0) {
                return null;
            }
            return (new PaletteLocationConfiguration(this.app, source))
                .pageName();
        }

    });
    
    return PaletteLocationConfiguration;
});
