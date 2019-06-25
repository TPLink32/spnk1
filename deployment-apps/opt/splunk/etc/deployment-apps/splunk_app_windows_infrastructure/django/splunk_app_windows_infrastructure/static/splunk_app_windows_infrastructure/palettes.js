/*global define */

define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var Backbone = require('backbone');
    var mvc = require('splunkjs/mvc');
    var sdk = require('splunkjs/splunk');
    var splunkd_utils = require('util/splunkd_utils');
    var splunk_util = require('splunk.util');
    var moment = require('moment');
    var sharedModels = require('./palette-shared-models');
    var PopTartView = require('views/shared/PopTart');

    var appRoot = splunk_util.getConfigValue('DJANGO_ROOT_PATH', 'dj/');

    function concat(ss) { return String.prototype.concat.apply("", ss); }
    function contem(ss) { return _.template(concat(ss)); }
    
    var userModel = sharedModels.get('user');
    var currentUser;
    
    var PaletteModel = Backbone.Model.extend({
        url: function() {
            return splunk_util.make_url(appRoot, this.get('app'), 'palette', this.get('id'));
        }

    });
    
    var PaletteList = Backbone.Collection.extend({
        model: PaletteModel,

        initialize: function(options) {
            options = options || {};
            this.namespace = {
                app: options.app || 'splunk_app_windows_infrastructure',
                owner: '-'
            };
            this.service = mvc.createService(this.namespace);
        }, 

        fetch: function() {
            var dfd = $.Deferred();
            var that = this;

            this.panelconf = new sdk.Service.ConfigurationFile(
                this.service, 
                'palettepalettes', 
                this.namespace);

            this.panelconf.fetch(function(err, panels) {
                if (err) { return dfd.reject(err); }
                return dfd.resolve(panels);
            });

            $.when.apply($, [sharedModels.get('user'), dfd.promise()]).then(function(user, panels) {
                that.user = user.entry;
                that.reset(_.map(panels.list(), function(panel) {
                    return _.extend(
                        { 'id': panel.name, 'author': panel.author() }, 
                        _.pick(panel.properties(), 'title', 'isDefault'),
                        _.pick(panel.acl(), 'app', 'owner', 'sharing', 'can_write'),
                        {   
                            published: panel.published(),
                            updated: panel.updated()
                        }
                    );
                }));
            });
        }
    });


    var captionTemplate = '<div class="table-caption-inner"></div>';
    var countTemplate = '<h3><%- count %> ' + _('Dashboards').t() + '</h3>';

    var PaletteListCaption = Backbone.View.extend({
        className: 'table-caption',

        initialize: function(options) {
            Backbone.View.prototype.initialize(this, arguments);
            this.ownerview = options.ownerview;
            this.template = _.template(captionTemplate);
            this.countTemplate = _.template(countTemplate);
            this.collection.on('reset destroy', _.debounce(this.render), this);
        },

        render: function() {
            this.$el.html(this.template());
            var inner = $(this.$('.table-caption-inner'));
            inner.append(this.countTemplate({ count: this.collection.filter(this.model.getFilter()).length }));
            inner.append(this.ownerview.render().$el);
            return this;
        }
    });

    var listHeaderTypeTemplates = {
        html: '<th class="<%= classes %>"><%- value %></th>',
        sort: '<th data-key="<%- key %>" class="<%= classes %>"><a href="#"><%- value %><i class="icon-sorts <%- activeClassName %>"></i></a></th>'
    };

    var listHeaderTemplate = '<tr><%= cells %></tr>';

    var PaletteListHeader = Backbone.View.extend({
        tagName: 'thead',

        columns: [
            { label: _("Title").t(), sortKey: 'title'},
            { label: _("Actions").t(), className: 'col-actions'},
            { label: _("Owner").t(), sortKey: 'owner,title', className: 'col-owner'},
            { label: _("Sharing").t(), sortKey: 'sharing,title', className: 'col-sharing'}
        ],

        initialize: function(options) {
            Backbone.View.prototype.initialize.apply(this, arguments);
            this.model.on('change:sortKey change:sortDirection', _.debounce(this.render), this);
            this.template = _.template(listHeaderTemplate);
            this.templates = _.reduce(
                listHeaderTypeTemplates, 
                function(m, v, k) { m[k] = _.template(v); return m; }, {}
            );
        },

        events: {
            'click th': 'setSort'
        },

        setSort: function(ev) {
            ev.preventDefault();
            var key = $(ev.currentTarget).data('key');
            if (key) { 
                this.model.set({
                    sortKey: key, 
                    sortDirection: $(ev.currentTarget).hasClass('asc') ? 'desc' : 'asc'
                });
            }
            return this;
        },

        render: function() {
            var that = this;
            var sortKey = this.model.get('sortKey');
            var sortDir = this.model.get('sortDirection');

            var oneColumn = function(column) {
                var sortable = column.hasOwnProperty('sortKey');
                var template = that.templates[column.hasOwnProperty('sortKey') ? 'sort' : 'html'];
                var active = sortable && column.sortKey === sortKey ? "active " + sortDir + ' ' : '';
                var classes = ((sortable ? 'sorts ' : '') + 
                               active +
                               (column.className ? column.className + ' ' : ''));

                return template({
                    key: column.sortKey,
                    classes: classes,
                    value: column.label,
                    activeClassName: active
                });
            };

            this.$el.html(this.template({
                cells: (_.map(this.columns, oneColumn)).join('\n')
            }));
            return this;
        }
    });

    var editMenuTemplate = contem([
        '<div class="arrow"></div>',
        '<div class="popdown-dialog-body">',
        '  <ul class="first-group">',
        '    <li><a href="<%= url %>#edit"><%- _("Edit Dashboard").t() %></a></li>',
        '    <li><a href="_new?source=<%= url %>#edit"><%- _("Clone Dashboard").t() %></a></li>',
        '  </ul>',
        '</div>']);

    var EditMenu = PopTartView.extend({
        className: 'dropdown-menu palette-edit-menu',
        initialize: function() {
            PopTartView.prototype.initialize.apply(this, arguments);
            this.template = editMenuTemplate;
        },

        render: function() {
            this.$el.html(this.template({ url: this.model.url()}));
            return this;
        }
    });

    var listRowTemplate = contem([
        '<td class="title"><a href="<%= url %>"><%- title %></a></td>',
        '<td class="actions"><div class="actions-control"></div></td>',
        '<td class="owner"><%= owner %></td>',
        '<td class="sharing"><%= sharing %></td>']);

    var cloneTemplate = '<a href="_new?source=<%- url %>#edit"><%- label %></a>';
    var editTemplate = '<a class="editbutton" href="#"><%- label %> <span class="caret"></span></a>';

    var PaletteListRow = Backbone.View.extend({
        tagName: 'tr',
        className: 'dashboards-table-tablerow',
        initialize: function(options) {
            options = options || {};
            Backbone.View.prototype.initialize.apply(this, arguments);
            this.template = listRowTemplate;
            this.cloneTemplate = _.template(cloneTemplate);
            this.editTemplate = _.template(editTemplate);
            this.editMenu = null;
            this.model.on('change', _.debounce(this.render), this);
        },
        
        events: {
            'click .editbutton': 'edit'
        },

        edit: function(ev) {
            ev.preventDefault();
            if (! this.editMenu) {
                return;
            }

            var target = $(ev.target);
            target.addClass('active');
            this.editMenu.on('hide', function() {
                target.removeClass('active');
            }, this);
            this.editMenu.show(target);
        },

        render: function() {
            var json = this.model.toJSON();
            var nobody = (json.owner === 'nobody');

            json = _.extend(json, {
                owner: nobody ? _('No Owner').t() : json.owner,
                sharing: nobody ? '' : json.sharing == 'user' ? _('Private').t() : _('App').t(),
                url: this.model.url()
            });

            this.$el.html(this.template(json));

            if (json.can_write && (!json.isDefault)) {
                this.editMenu = new EditMenu({model: this.model});
                this.$('.actions-control').append(
                    this.editTemplate({ url: json.url, label: _('Edit').t()}), 
                    this.editMenu.render().$el);
            } else {
                this.$('.actions-control').append(
                    this.cloneTemplate({ url: json.url, label: _('Clone').t()}));
            }
            
            return this;
        }
    });

    var PaletteListFilter = Backbone.Model.extend({
        getComparator: function() {
            var mkey = this.get('sortKey').split(',');
            var mdir = this.get('sortDirection') === 'asc' ? 1 : -1;
            return function(a, b) {
                var a1, b1;
                for(var i=0, l=mkey.length; i<l; ++i) {
                    a1 = a.get(mkey[i]);
                    b1 = b.get(mkey[i]);
                    if (a1 < b1) return mdir;
                    if (b1 < a1) return -1 * mdir;
                }
                return 0;
            };
        },

        getFilter: function() {
            var ret = function(panel) { return true; };
            switch (this.get('owner')) {
                case 'standard': 
                    ret = function(panel) { return panel.get('isDefault') === '1'; };
                    break;
                case 'custom':
                    ret = function(panel) { return panel.get('isDefault') !== '1'; };
                    break;
                case 'yours':
                    ret = function(panel) { return panel.get('owner') === currentUser; };
                    break;
                default:
                    break;
            }
            return ret;
        }
    });

    var paletteOwnerButtonTemplate = [
        '<div class="btn-group" id="palette-list-filter">',
        '  <a class="btn" data-filter="all" href="#">' + _('All').t() + '</a>',
        '  <a class="btn" data-filter="standard" href="#">' + _('Prebuilt').t() + '</a>',
        '  <a class="btn" data-filter="custom" href="#">' + _('Custom').t() + '</a>',
        '  <a class="btn" data-filter="yours" href="#">' + _('Yours').t() + '</a>',
        '</div>'].join('');

    var PaletteOwnerFilterView = Backbone.View.extend({
        id: "palette-list-filter-group",
        className: 'control-group shared-controls-controlgroup',

        events: {
            'click a': 'setFilter'
        },

        initialize: function(options) {
            Backbone.View.prototype.initialize.apply(this, arguments);
            this.model.on('change:owner', this.render, this);
        },
        
        setFilter: function(ev) {
            ev.preventDefault();
            this.model.set({'owner': $(ev.target).attr('data-filter')});
            return this;
        },

        render: function() {
            this.$el.html('');
            this.$el.append($(paletteOwnerButtonTemplate));
            this.$('a[data-filter=' + this.model.get('owner') + ']').addClass('active');
            this.delegateEvents();
            return this;
        }
    });

    var listTemplate = contem([
        '<table class="table table-chrome table-striped table-row-expanding" id="palette-dashboards-table">',
        '<tbody class="dashboards-listings"></tbody>',
        '</table>']);

    var PaletteListView = Backbone.View.extend({
        el: '#panel-body',
        
        initialize: function(options) {
            options = options || {};
            Backbone.View.prototype.initialize.apply(this, arguments);
            this.template = listTemplate;
            this.filter = new PaletteListFilter({
                'sortKey': 'title',
                'sortDirection': 'desc',
                'sharing': 'none',
                'owner': 'all',
                'title': ''
            });

            this.collection.comparator = this.filter.getComparator();

            this.filter.on('change:sortKey change:sortDirection', function() { 
                this.collection.comparator = this.filter.getComparator();
                this.collection.sort();
            }, this);

            this.filter.on('change:owner change:sharing change:title', _.debounce(this.render), this);

            this.caption = new PaletteListCaption({
                ownerview: new PaletteOwnerFilterView({model: this.filter}),
                collection: this.collection,
                model: this.filter
            });

            this.collection.on('reset sort', _.debounce(this.render), this);
        },

        renderRows: function(body) {
            this.collection.chain().filter(this.filter.getFilter()).each(function(row) {
                body.append((new PaletteListRow({model: row, body: body})).render().$el);
            });
        },

        render: function() {
            this.$el.html('');
            this.$el.append('<div class="divider"></div>');
            this.$el.append(this.caption.render().$el);

            var dom = $(this.template({}));
            dom.prepend((new PaletteListHeader({model: this.filter})).render().$el);
            this.renderRows(dom.find('tbody'));
            this.$el.append(dom);
            return this;
        }
    });
    
    $.when(userModel.dfd).then(function() {
        currentUser = userModel.entry.get('name');
    });
    
    var paletteList = new PaletteList();
    var paletteListView = new PaletteListView({collection: paletteList});
    return paletteList.fetch();
});

