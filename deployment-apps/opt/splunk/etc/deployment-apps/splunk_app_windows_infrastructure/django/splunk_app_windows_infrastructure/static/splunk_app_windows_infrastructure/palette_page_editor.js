/*global define, $ */

define(function(require, exports, module) {
    var _ = require('underscore');
    require('jquery.ui.droppable');
    
    var DragNDropView = require('./drag-n-drop');
    var PaletteLayoutView = require('./palette_page_layout_view');

    // Extends the Palette Page Layout View to have the power to
    // arbitrarily add and delete panels.  Listens for add and delete
    // panel events, and publishes when the layout has changed.
    
    var PaletteLayoutEditor = PaletteLayoutView.extend({

        events: {
            'click .palette-panel-delete-btn': 'deletePanel',
            'activate': 'activateEditor',
            'deactivate': 'deactivateEditor',
            'rendered': 'afterRendering'
        },

        initialize: function(options) {
            PaletteLayoutView.prototype.initialize.apply(this, arguments);
            this.dragnDrop = null;
            this._enabled  = false;
        },

        isEnabled: function() {
            return this._enabled;
        },

        // In reality, this is WRONG.  The page editor should have all
        // this crap BEFORE the panel manager goes off and does its
        // thing.

        afterRendering: function() {
            var that = this;
            this.model.set({'panels': _.chain(this.$('.dashboard-row')).map(function(row){
                return _(that.$(row).find('.dashboard-cell')).map(function(panel){
                    return that.$(panel).attr('about');
                });

            }).filter(function(row) { return row.length; }).value()});
        },

        enableDragNDrop: function() {
            var that = this;
            this.dragnDrop = new DragNDropView({
                el: this.$el.find('#dashboard-panels-container')
            });
            this.dragnDrop.on('sortupdate', _.debounce(function() { that.addNewPanel.apply(that, arguments); }));
            this.dragnDrop.render();
        },

        disableDragNDrop: function() {
            if (this.dragnDrop) {
                this.dragnDrop.destroy();
            }
            this.dragnDrop = null;
        },
        
        addNewPanel: function() {
            var that = this;
            
            // Remove any prototypes that would duplicate functionality.
            var current = this.$('#dashboard-panels-container .dashboard-cell').map(
                function(i, panel) { return $(panel).attr('about'); });
        
            this.$('#dashboard-panels-container .panel-proto').each(function(index, panel) {
                if (_.contains(current, that.$(panel).attr('about'))) {
                    that.$(panel).remove();
                }
            });

            // Turn them into proper prototypes
            var newpanels = this.$('#dashboard-panels-container .panel-proto')
                .map(function(index, panel) {
                    var np = $('<div>').addClass('panel-proto').attr({
                        'typeof': 'panel',
                        'about': $(panel).attr('about')
                    });
                    $(panel).replaceWith(np);
                    return np;
                }).get();

            this.model.parent.setDirty();
            if (newpanels.length > 0) {
                this.$el.trigger('update');
            }
        },
        
        // Delete only one panel.
        
        deletePanel: function(ev) {
            ev.preventDefault();
            var row = $(ev.target).closest('.dashboard-row');
            $(ev.target).closest('.dashboard-cell').remove();
            if (row.is(':empty')) { row.addClass('empty'); }
            // Trigger the default drop zone, if necessary.  This is
            // an ugly hack.  See MSAPP-1750. 
            this.afterRendering();
            this.dragnDrop.maybeEmpty();
            this.$el.trigger('update');
        },

        activateEditor: function (ev) {
            if (ev) {
                ev.preventDefault();
            }
            this._enabled = true;
            this.enableDragNDrop();
        },

        deactivateEditor: function(ev) {
            if (ev) {
                ev.preventDefault();
            }
            this._enabled = false;
            this.disableDragNDrop();
        }
    });

    return PaletteLayoutEditor;

});
