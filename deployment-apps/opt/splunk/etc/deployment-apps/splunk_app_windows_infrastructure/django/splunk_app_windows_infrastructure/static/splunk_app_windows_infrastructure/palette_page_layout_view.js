/*global define */

define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    
    var mvc = require('splunkjs/mvc');
    var Backbone = require('backbone');

    // Represents the physical layout of the page.  Listens to the
    // PalettePageConfiguration object for 'change' events, which
    // generally only happen on a fetch, and lays out the panels in
    // rows and columns, but marks them as 'proto'.  It publishes that
    // the layout has changed.

    var paletteHeaderTemplate = _.template([
        '<div class="dashboard-header pull-left<% if (isnew) { %> isnew<% } %>" id="dashboard-title-information">',
        '  <% if (title) { %><h2><%= _.escape(title) %></h2><% } %>',
        '  <% if (description) { %><p><%= _.escape(description) %></p><% } %>',
        '</div>'].join(''));

    var PaletteHeaderView = Backbone.View.extend({
        template: paletteHeaderTemplate,

        initialize: function() {
            Backbone.View.prototype.initialize.apply(this, arguments);
            this.model.on('change', this.render, this);
        },

        render: function() {
            var json = _.extend(this.model.toJSON(), { isnew: false });
            if (this.model.isNew() && _.isEmpty(json.title)) {
                json = _.extend(json, {
                    isnew: true,
                    title: _('Untitled Dashboard').t()});
            }
            this.$el.html(this.template(json));
            return this;
        }
    });
        

    var paletteLayoutTmpl = require('text!./palette_templates/page-layout.html');
    var PaletteLayoutView = Backbone.View.extend({
        id: 'dashboard-body',
        layoutTemplate: _.template(paletteLayoutTmpl),

        initialize: function(options) {
            this.rendered = false;
            Backbone.View.prototype.initialize.apply(this, arguments);
            this.model.on('change:panels', _.debounce(this.render, 0), this);
        },

        render: function() {
            if (this.rendered) {
                return;
            }
            
            this.rendered = true;
            var content = this.model.toJSON();

            if ($('#dashboard-main').data('apptitle')) {
                var contentTile = content.title;
                var pageTitle = '';

                if (!$.trim(content.title)) {
                    pageTitle = 'Dashboard';
                } else if (content.title === '_new') {
                    pageTitle = 'New Dashboard';
                } else {
                    pageTitle = content.title;
                }
                document.title = pageTitle + ' | Splunk';
            }

            function cj(content, name, def) {
                return (content.hasOwnProperty(name) ?
                        JSON.parse(content[name]) : def);
            }

            _.extend(content, {
                'about': this.model.about,
                'description': content.description || "",
                'inputOrdering':     cj(content, 'inputOrdering', []),
                'useTimepicker':     cj(content, 'use_timepicker', 0),
                'timepickerDefault': content.timepicker_default || '-15m'
            });

            // Only the first time through does the layout container
            // get rendered.  The header contains the page name and
            // description.  It will changes those on an update event.

            if (this.$('#dashboard-title-row').length == 0) {
                this.$el.html(this.layoutTemplate(content));
                (new PaletteHeaderView({
                    model: this.model,
                    el: this.$('#dashboard-title-row')})).render();
            }

            var container = this.$('#dashboard-panels-container');
            container.html('');

            this.$el.data({
                use_timepicker: content.use_timepicker || 0,
                inputOrdering: content.inputOrdering,
                timepickerDefault: content.timepickerDefault
            });

            // Fill in the panel collection with prototypes.  It is
            // now the duty of external handlers to populate those
            // prototypes with valid panel objects and associated
            // controls.

            var that = this;
            _.each(this.model.get('panels'), function(row) {
                var rowContainer = $('<div class="dashboard-row row-source"></div>');
                _.each(row, function(panel) {
                    var panelObj = $('<div class="panel-proto" typeof="panel" about="' + 
                                     panel + '"></div>');
                    rowContainer.append(panelObj);
                });
                container.append(rowContainer);
            });

            container.css({'min-height': ($(window).height() - this.$el.offset().top) + 'px'});
            $(window).trigger('resize');
            this.$el.trigger('update');
        }
    });

    return PaletteLayoutView;
});

