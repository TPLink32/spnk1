/*global define */
define(function(require){
    var Backbone = require('backbone');
    var _ = require('underscore');
    var $ = require('jquery');
    var console = require('util/console');

    var libraryLoaded = $.Deferred(), div = document.createElement('div'),
        supportsHTML5 = (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)),
        useHTML5 = false, //supportsHTML5 && !/jqueryDD/g.test(window.location),
        SORTABLE = useHTML5 ? 'sortable5' : 'sortable';

    if(useHTML5) {
        console.log('loading html5 sortable');
        require(['splunkjs/contrib/jquery.sortable.html5'], libraryLoaded.resolve);
    } else {
        console.log('loading jquery ui sortable');
        require(['jquery.ui.sortable'], libraryLoaded.resolve);
    }

    return Backbone.View.extend({
        render: function() {
            libraryLoaded.done(this.startDragAndDrop.bind(this));
            return this;
        },

        events: {
            'mouseover .btn-draggable': function(e){
                $(e.target).parents('.dashboard-panel').addClass('drag-hover');
            },
            'mouseout .btn-draggable': function(e){
                $(e.target).parents('.dashboard-panel').removeClass('drag-hover');
            }
        },

        startDragAndDrop: function() {
            this.$el.addClass('dragndrop-enabled');
            _.defer(this.enableDragAndDrop.bind(this));
        },

        maybeEmpty: function() {
            var dashrows = this.$('.dashboard-row');
            if (dashrows.length === 0) {
                this.$el.append($('<div class="dashboard-row empty"></div>'));
            }

            dashrows = this.$('.dashboard-row');
            if ((dashrows.not('.empty').length === 0) && 
                (dashrows.find('.sortable-placeholder-tmp').length == 0)) {
                dashrows.eq(Math.floor(dashrows.length/2)).append($([
                    '<div class="sortable-placeholder sortable-placeholder-tmp dashboard-cell">',
                    '    <div class="dashboard-panel">',
                    _('Drop Panels Here').t(),
                    '    </div>',
                    '</div>'].join('')));
            }
        },

        enableDragAndDrop: function() {
            var that = this;
            var sortable;
            var updateDims = _.debounce(that.updateDimensions.bind(this), 0);
            var enableDragAndDrop = this.enableDragAndDrop.bind(this);

            var onEnd = _.once(function(){
                if(sortable) {
                    try {
                        sortable[SORTABLE]('destroy');
                    } catch(e){}
                    _.defer(enableDragAndDrop);
                    that.$('.sortable-placeholder-tmp').remove();
                    that.trigger('sortupdate', that);
                    sortable = null;
                    $(window).trigger('resize');
                }
            });
            
            this.createNewDropRow();
            that.maybeEmpty();

            sortable = this.$('.dashboard-row')[ SORTABLE ]({
                handle: '.drag-handle',
                connectWith: this.$('.dashboard-row'),
                placeholder: {
                    element: function() {
                        return $('<div class="sortable-placeholder"><div class="dashboard-panel"></div></div>');
                    },
                    update: function(ct, p) {
                        that.updateRow(p.parents('.dashboard-row'));
                    }
                },
                tolerance: "pointer"
            }).on('sort', function(e){
                that.$('.sortable-placeholder-tmp').remove();
                updateDims();
            }).on('sortdeactivate', function(e) {
                onEnd();
            }).on('sortupdate', function(e){
                onEnd();
            }).on('sortstop', function(e){
                onEnd();
            });

            updateDims();
            $(window).trigger('resize');
        },

        destroy: function() {
            this.$el.removeClass('dragndrop-enabled');
            this.cleanupEmptyRows();
            try {
                this.$('.dashboard-row')[SORTABLE]('destroy');
            } catch(e){}
            this.updateDimensions();
        },

        updateRow: function(r) {
            var els = $(r).children().not('.ui-sortable-helper');
            var w = String(Math.floor(10000/(els.not('.sortable-dragging,.ui-draggable').length))/100)+'%';
            els.css({ width: w });

            var items = $(r).find('.dashboard-panel');
            items.css({ 'min-height': 100 }).css({ 'min-height': _.max(_.map(items, function(i){ return $(i).height(); })) });
        },
        
        updateDimensions: function() {
            _(this.$('.dashboard-row')).each(this.updateRow);
        },

        createNewDropRow: function() {
            this.cleanupEmptyRows();
            this.$('.dashboard-row').after($('<div class="dashboard-row empty"></div>'));
            this.$('.dashboard-row').first().before($('<div class="dashboard-row empty"></div>'));
        },
        
        cleanupEmptyRows: function() {
            // console.log('removing empty rows');
            this.$('.dashboard-row').each(function(){
                var r = $(this);
                if(r.is(':empty') || r.html().match(/^\s+$/)) {
                    r.remove();
                }
            });
            this.$('.dashboard-row.empty').removeClass('empty');
        }
    });
});
