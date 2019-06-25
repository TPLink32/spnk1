define([
    'jquery',
    'underscore',
    'backbone',
    'common/grayskull/common/contrib/d3/d3.amd',
    'common/grayskull/deepdive/DeepDiveUtils'
], function(
    $, 
    _, 
    Backbone,
    d3,
    deepDiveUtils) {

    // A simple proxy manager that allows us to pick overlays (or
    // allows overlays to pick themselves) from a priority list.

    var DeepDiveInteractiveOverlays = function(overlays) {
        this.overlays = overlays;
        this.current = null;
    };


    _.extend(DeepDiveInteractiveOverlays.prototype, {
        start: function(coordinates, graphData) {
            var overlay = _.find(this.overlays, function(overlay) { return overlay.criteria(coordinates, graphData); });
            if (! overlay) {
                return;
            }

            this.current = overlay;
            this.current.start(coordinates, graphData);
            // Activation may fail.  There *has* to be a better way to
            // accomplish this.
            if (! this.current.isActive() ) {
                this.current = null;
                return;
            }
        },

        end: function(coordinates, graphData) {
            if (! this.current) {
                return; 
            }
            if (! this.current.isActive() ) {
                this.current = null;
                return;
            }
            this.current.end(coordinates, graphData);
            this.current = null;
        },

        cleanup: function() {
            if (! this.current) { 
                return;
            }
            this.current.cleanup();
        },

        move: function(coordinates, graphData) {
            if (! this.current) {
                return;
            }

            if (! this.current.isActive() ) {
                this.current = null;
                return;
            }
            this.current.move(coordinates, graphData);
        }
    });

    return DeepDiveInteractiveOverlays;
});
