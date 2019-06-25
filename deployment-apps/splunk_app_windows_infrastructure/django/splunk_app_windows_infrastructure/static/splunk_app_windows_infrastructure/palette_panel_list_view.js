/*global require, define */

require.config({
    paths: {
        'jqueryui': 'splunk_app_windows_infrastructure/jquery-ui-1.10.3.min'
    }, 
    shim: {
        'jqueryui': {
            deps: ['jquery']
        }
    }
});

define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var Backbone = require('backbone');
    var Dropdown = require('splunkjs/mvc/dropdownview');
    var Accordion = require('views/shared/delegates/Accordion');
    
    require('jqueryui');

    //  ___               _          __  __   ___               
    // | _ \__ _ _ _  ___| |_ _ ___ / _| \ \ / (_)_____ __ _____
    // |  _/ _` | ' \/ -_) | '_/ -_)  _|  \ V /| / -_) V  V (_-<
    // |_| \__,_|_||_\___|_|_| \___|_|     \_/ |_\___|\_/\_//__/
    //                                                          

    // Provides a simple handle for the Filter dropdown in panel, and
    // allows the views to observe changes to the filter drop-down
    // value.  Has a single key, 'filter', which can be an empty
    // string, a single string against which all objects in the filter
    // view will match, or a colon-separated pair; the left side
    // should read "panel, app, key", and the right can contain an
    // arbitrary string.

    // Has one function, filter(), which returns a function that can
    // be used by any backbone collection of "panels" to return a
    // filter list of the collection's panels.

    var FilterModel = Backbone.Model.extend({


        filter: function() { 
            var value = this.get('filter') || '';
            if (value === '') {
                return function(panel) { return true; };
            };

            var key = '';
            var pv = value.split(/:/);
            if (pv.length > 1) {
                key = pv[0];
                value = pv.slice(1).join(':');
            }

            var matchFeature = function(type) {
                return function(v) {
                    var matcher = new RegExp(v, 'i');
                    return function(panel) {
                        return ((panel.properties.get(type) || '').search(matcher) !== -1);
                    };
                };
            };
            
            var matchers = {
                'panel': matchFeature('title'),
                'app': matchFeature('application'),
                'key': function(v) {
                    return function(panel) {
                        return _.contains(panel.categories() || [], v);
                    };
                }
            };
            
            var matchall = function(value) {
                var handlers = _.map(['panel', 'app', 'key'], function(i) { return matchers[i](value); });
                return function (e) {
                    var x = _.map(handlers, function(match) { return match(e); });
                    return _.any(x, _.id);
                };
            };
            return ((key !== '') && (matchers.hasOwnProperty(key))) ? matchers[key](value) : matchall(value);
        }
    });

    var panelFilterInputFormTemplate = [
        '<form id="palette-panel-listing-filter" class="search-query-control shared-tablecaption-input ui-front">',
        '<input type="text" id="palette-panel-list-select" class="input-medium search-query selectbox" placeholder="' + _('Filter by keyword or name').t() + '"/>',
        '<a href="#" id="palette-panel-list-clear" class="search-query-clear" style=""><i class="icon-x-circle"></i></a>',
        '</form>'].join('\n');

    // Customizes the input widget drop-down to have categorical
    // headers.

    $.widget( 'custom.catcomplete', $.ui.autocomplete, {
        _renderMenu: function( ul, items ) {
            var that = this,
            currentCategory = '';
            $.each( items, function( index, item ) {
                if ( item.category !== currentCategory ) {
                    ul.append( "<li class='ui-autocomplete-category'>" + item.category + '</li>' );
                    currentCategory = item.category;
                }
                item = _.clone(item);
                item.label = item.label.replace(/^\w{3}:\s*/, '');
                that._renderItemData( ul, item );
            });
        }
    });

    var PalettePanelListFilterView = Backbone.View.extend({
        content: panelFilterInputFormTemplate,
        className: 'input-block-level clearfix',

        events: {
            'submit': 'handle',
            'keyup #palette-panel-list-select': 'iconCheck',
            'click #palette-panel-list-clear': 'clear'
        },

        initialize: function() { 
            Backbone.View.prototype.initialize.apply(this, arguments);
            this.collection.on('reset', this.render, this);
        },

        iconCheck: function() {
            // Hide/show the clear button when the input is empty.
            this.$el[(this.$('input').val().length == 0) ? 'removeClass' : 'addClass']('input-active');
        },

        handle: function(ev) {
            ev.preventDefault();
            this.model.set({'filter': this.autocomplete.val()});
        },

        clear: function(ev) {
            ev.preventDefault();
            this.$('#palette-panel-list-select').val('');
            this.$('#palette-panel-listing-filter').trigger('submit');
            this.iconCheck();
        },

        render: function() {
            var that = this;
            var hasLabel = function(v) { return v.label; };

            // Create the 'app:', 'panel:', and 'key:' subsections of
            // the drop-down.
            
            var makeAppLabels = function(v) { 
                return {
                    label: 'app:' + v.properties.get('application'), 
                    value: 'app:' + v.properties.get('application'), 
                    category: 'Applications' 
                }; 
            };

            var applications = this.collection
                    .chain()
                    .map(makeAppLabels)
                    .uniq(hasLabel)
                    .value();
            
            var makeKeyLabels = function(m, v) {
                _.each(v.categories(), 
                       function(c) { 
                           m.push({label: 'key:' + c, 
                                   value: 'key:' + c, 
                                   category: 'Keywords'}); });
                return m;
            };
            
            var choices = this.collection.chain()
                    .reduce(makeKeyLabels, [])
                    .uniq(hasLabel)
                    .value();

            var makePanelLabels = function(p) {
                var name = p.properties.get('title');
                return {label: 'panel:' + name, value: 'panel:' + name, category: 'Panels'};
            };

            var panels = this.collection
                    .chain()
                    .map(makePanelLabels)
                    .value();

            this.$el.html('');
            this.$el.append($(this.content));
            var actarget = this.$('#palette-panel-list-select');

            // The keyup function here 
            this.autocomplete = actarget.catcomplete({
                appendTo: $('#dashboard-main'),
                delay: 0,
                source: applications.concat(choices).concat(panels),
                minLength: 1,
                messages: {
                    noResults: '',
                    results: function() {}
                },
                select: function() { 
                    _.defer(function() { 
                        actarget.trigger('change'); 
                    }); 
                }
            })
                .keyup(function (e) {
                    if (e.which === 13) {
                        $(".ui-menu.ui-autocomplete").hide();
                    }
                });
            this.iconCheck();
            return this;
        }
    });


    var panelOneItemTemplate = _.template([
        '<div class="btn">',
        '    <div class="palette-panel-list-title"><span class="handle"> </span><%= panel.title %></div>',
        '</div>'].join('\n'));

    var panelDraggableTemplate = _.template([
        '<div class="panel-proto ui-draggable sortable-dragging ui-draggable-dragging" typeof="panel" property="<%= panel.name %>">',
        '  <div>',
        '    <!-- Panel menu -->',
        '    <div class="panel-menu" draggable="true">',
        '      <div class="btn">',
        '        <div>',
        '          <span><%= panel.title %></span>',
        '        </div>',
        '      </div>',
        '      <div style="clear:both;"></div>',
        '    </div>',
        '  </div>',
        '</div>'].join('\n'));

    var PanelItemView = Backbone.View.extend({
        tagName: 'li',
        className: 'btn-combo row-fluid panel-proto',
        template: panelOneItemTemplate,
        dragtemplate: panelDraggableTemplate,
        
        initialize: function(options) {
            this.listenTo(this.model, 'change', this.render);
        },
    
        render: function() {
            var that = this;

            var draggedRepresentation = function() {
                return that.dragtemplate({panel: that.model.properties.toJSON()});
            };

            this.$el.html(this.template({panel: this.model.properties.toJSON()}));
            this.$el.attr({ 'typeof': 'panel', 'about': this.model.id});
            this.$el.data({ 
                'categories': _.map(this.model.categories(), function(i) { return i.toLowerCase(); }),
                'application': (this.model.properties.get('application') || '').toLowerCase(),
                'name': this.model.properties.get('title').toLowerCase()
            });
            this.$el.draggable({
                appendTo: 'body',
                helper: draggedRepresentation,
                connectToSortable: '.dashboard-row',
                opacity: 0.75,
                revert: 'invalid',
                scroll: true,
                revertDuration: 1
            });
            return this;
        }
    });

    var accordionTemplate = _.template([
        '<div class="accordion-group submenu">',
        '    <div class="accordion-heading">',
        '      <a class="accordion-toggle" href="#">',
        '        <i class="icon-accordion-toggle"></i><%- name %>&nbsp;(<%= panels.length %>)',
        '      </a>',
        '    </div>',
        '    <ul class="accordion-body submenu-items">',
        '    </ul>',
        '</div>'].join('\n'));

    var PalettePanelAccordionView = Backbone.View.extend({
        id: 'panel-listing-container',
        className: 'accordion sidebar-nav panel-menu relative',
        template: accordionTemplate,
        
        initialize: function(options) {
            Backbone.View.prototype.initialize.apply(this, arguments);
            this.collection.on('reset', this.render, this);
            this.model.on('change', this.render, this);
            $(window).on('resize', _.bind(this.resize, this));
            this.render();
            _.defer(_.bind(this.resize, this));
            return this;
        },
        
        resize: function() {
            var listing = $('#panel-listing-container');
            var headheight = 0;
            $('#panel-listing-container .accordion-heading').each(function(i, o) {
                headheight = headheight + $(o).height();
            });

            var maxheight = _.min([parseInt(($(window).height() - (headheight + listing.offset().top)) * .95), 475]);
            this.$('.accordion-body').css({'max-height': maxheight + 'px'});
        },

        render: function() {
            var that = this;
            var groupedPanels = this.collection.groupByApplication();

            var buildOneGroup = function(group) {
                var gdom = $(that.template(group));
                gdom.find('.accordion-body')
                    .append(_.chain(group.panels).map(function(panel) {
                        return (new PanelItemView({model: panel})).render().$el;
                    }).value());
                return gdom;
            };

            this.$el.html('');
            this.$el.append(_.map(this.collection.groupByApplication(this.model.filter()),
                                  buildOneGroup));
            this.accordion = new Accordion({el: this.el});
            _.defer(_.bind(this.resize, this));
            return this;
        }
    });


    var palettePanelFull = [
        '<div class="palette-dashboard-header dashboard-header clearfix">',
        '    <div class="pull-left"><h3>Add Panels</h3></div>',
        '    <div class="pull-right"><h3><a id="palette-collapse-btn" href="#preview"><img src="/dj/static/splunk_app_windows_infrastructure/left.png"></a></h3></div>',
        '</div>',
        '<div class="palette-panel-body"></div>',
        '<div class="palette-panel-story">Splunk<span>&gt;</span> Palette</div>'
    ].join('\n');

    var PalettePanelFullView = Backbone.View.extend({
        className: 'palette-panel-full',
        id: 'palette-panel-full',
        content: palettePanelFull,

        initialize: function(options) {
            Backbone.View.prototype.initialize.apply(this, arguments);
            var filterModel = new FilterModel();
            this.filter = new PalettePanelListFilterView(_.extend({}, options, {model: filterModel})); 
            this.accordion = new PalettePanelAccordionView({collection: options.collection,
                                                            model: filterModel});
            this.render();
            return this;
        },

        render: function() {
            this.$el.html(this.content);
            var body = this.$('.palette-panel-body');
            body.append(this.filter.render().$el);
            body.append(this.accordion.render().$el);
            return this;
        }
        
    });

    var palettePanelPreview = _.template([
        '<div class="palette-dashboard-header dashboard-header clearfix">',
        '    <div class="pull-right"><h2><a id="palette-expand-btn" href="#edit"><img src="/dj/static/splunk_app_windows_infrastructure/right.png"></a></h2></div>',
        '</div>',
        '<div class="palette-panel-preview-rotate">',
        '    <% _.each(groups, function(group) { %>',
        '    <span class="panel-preview-group"><%- group.name %>&nbsp;(<%= group.panels.length %>)</span>',
        '    <% }); %>',
        '</div>'].join('\n'));

    var PalettePanelPreView = Backbone.View.extend({ 
        className: 'palette-panel-preview',
        id: 'palette-panel-preview',
        template: palettePanelPreview,
        
        initialize: function(options) {
            Backbone.View.prototype.initialize.apply(this, arguments);
            this.render();
            return this;
        },

        render: function() {
            this.$el.html(this.template({groups: this.collection.groupByApplication()}));
        }
    });

    var PalettePanelListView = Backbone.View.extend({
        className: 'white-outline relative palette-panel-list-view',
        id: 'palette-panel-list-viewport',
        
        initialize: function(options) {
            Backbone.View.prototype.initialize.apply(this, arguments);
            this.preview = new PalettePanelPreView(options);
            this.fullview = new PalettePanelFullView(options);
            this.$el.append(this.preview.$el);
            this.$el.append(this.fullview.$el);
        },

        render: function() {
            this.preview.render();
            this.fullview.render();
            return this;
        }
    });

    return PalettePanelListView;
});


