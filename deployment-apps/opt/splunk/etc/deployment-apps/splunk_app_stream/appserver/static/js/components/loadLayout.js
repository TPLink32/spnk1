define(['underscore', 'requirejs'], function(_, requirejs) {

    var cachedLayout;

    /**
     * Loads the layout component, first checking if it exists on the server,
     * then falling back to one built into the app if it not.
     *
     * @param {Function} callback - Will be invoked with the layout component.
     */
    return function(callback) {
        if (cachedLayout) {
            // Ensure the callback is always invoked asynchronously for a
            // consistent api.
            return _.defer(callback, cachedLayout);
        }
        // Try to load the layout dynamically from the version of splunk that is
        // currently running.
        requirejs(['api/layout'], function(layout) {
            cachedLayout = layout;
            callback(layout);
        }, function(err) {
            // If the current version of splunk does not have the layout component
            // (pre-honeybuzz), then use a statically linked version. This will
            // be built with the app, but loaded asynchronously, when the former
            // fails.
            require(['api/layout'], function(layout) {
                cachedLayout = layout;
                callback(layout);
            });
        });
    };
});
