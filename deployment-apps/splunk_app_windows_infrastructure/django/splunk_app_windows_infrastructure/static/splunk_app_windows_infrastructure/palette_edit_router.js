/*global define */

define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var EditDetailsMenu = require('./palette-edit-menus');
    var SaveAsDialog = require('./palette-save-as-dialog');
    var Backbone = require('backbone');
    var PalettePanelListView = require('./palette_panel_list_view');
    var PaletteLayoutEditor = require('./palette_page_editor');
    var mvcUtils = require('splunkjs/mvc/utils');
    var _EditPermissionsDialog = require('./palette-edit-permissions-menu');
    var sharedModels = require('./palette-shared-models');
    require('bootstrap.modal');

    var EditPermissionsDialog = _EditPermissionsDialog.extend({
        maybePermit: function(ev) {
            ev.preventDefault();
            var hide = _.bind(this.hide, this);
            $.when(this.orig.setWithPerms(this.model.toJSON(), this.perms.toJSON())).then(hide);
            return this;
        }
    });

    var hasBeenSavedTemplate = _.template([
        '<div class="modal hide fade" id="has-been-saved">',
        '  <div class="modal-header">',
        '    <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>',
        '    <h3>Success</h3>',
        '  </div>',
        '  <div class="modal-body">',
        '    <p>Your application page <strong><%- title %></strong> has been saved.</p>',
        '  </div>',
        '  <div class="modal-footer">',
        '    <a href="#" class="btn" data-dismiss="modal">Close</a>',
        '  </div>',
        '</div>'].join('\n'));

    var cloneButtonTemplate  = _.template('<div class="btn-group"><a class="btn" id="pebv-edit" href="<%= path %>#edit">' + 
                                          _('Clone').t() + '</a></div>');

    var editButtonTemplate   = [
        '<div class="btn-group" id="pebv-edit-group">',
        '    <a class="btn" id="pebv-edit" href="#edit">' + _('Edit').t() + '</a>',
        '</div>'].join('');

    var PaletteEditButtonsView = Backbone.View.extend({
        id: "palette-edit-button-view",
        className: "pull-right btn-group",

        events: {
            'click #pebv-save': 'savePage',
            'click #pebv-save-as': 'saveAs',
            'click #pebv-detail': 'editDetails',
            'click #pebv-edit-permissions': 'editPermissions'
        },

        initialize: function(options) {
            this.model.on('change', this.render, this);
            this.editDetailsMenu = new EditDetailsMenu(_.extend({}, options, {
                model: this.model
            }));
            this.render();
            $('body').append(this.editDetailsMenu.render().el);
        },

        editDetails: function(ev) {
            ev.preventDefault();
            if (this.editDetailsMenu && this.editDetailsMenu.shown) {
                this.editDetailsMenu.hide();
                return;
            }

            var target = $(ev.target);
            target.addClass('active');
            this.editDetailsMenu.show(target);
            this.editDetailsMenu.on('hide', function() {
                target.removeClass('active');
            }, this);
        },

        savePage: function(ev) {
            ev.preventDefault();
            var that = this;
            $.when(this.model.properties.save()).then(function() {
                $('#dashboard-main').data({'dirty': false});
                $('#has-been-saved').remove();
                $('body').append(hasBeenSavedTemplate({title: that.model.properties.get('title')}));
                $('#has-been-saved').modal('show');
            });
            return;
        },

        saveAs: function(ev) {
            ev.preventDefault();
            var that = this;
            var saveAsDialog = new SaveAsDialog({
                model: this.model.properties
            });
            saveAsDialog.once('saved', function() {
                $('#dashboard-main').data({'dirty': false});
                window.location.href="/dj/splunk_app_windows_infrastructure/palette/" + that.model.paletteUrl() + "#edit";
            });
            saveAsDialog.render().show();
        },

        editPermissions: function(ev) {
            ev.preventDefault();
            var that = this;
            var editPermsDialog = new EditPermissionsDialog({
                model: this.model.acls
            });
            editPermsDialog.render().show();
        },
            
        renderRules: function() {
            var canAdminAll = (_.indexOf(sharedModels.get('user').entry.content.get('capabilities'), 
                                         'admin_all_objects') !== -1);

            if (! this.model.canWrite()) {
                var pageInfo = mvcUtils.getPageInfo();
                var path = ['', 'dj', pageInfo.locale, pageInfo.app, pageInfo.page, '_new'];
                path = path.join('/') + '?source=' + encodeURIComponent(this.model.paletteUrl());
                return [viewMode = cloneButtonTemplate({path: path}), ''];
            }

            var detailsButtons =  ['<div class="btn-group" id="pebv-details-group">'];

            if (this.model.isNew()) {
                if (canAdminAll) {
                    detailsButtons.push('  <a class="btn" id="pebv-edit-permissions">' + _('Set new permissions').t() + '</a>');
                }
                detailsButtons.push('  <a class="btn btn-primary" id="pebv-save-as">' + _('Save ...').t() + '</a>');
            } else {
                detailsButtons.push('  <a class="btn" id="pebv-detail">' + _('Edit Details').t() + '<span class="caret"></span></a>');
                detailsButtons.push('  <a class="btn btn-primary" id="pebv-save">' + _('Save').t() + '</a>');
            }

            detailsButtons.push('  <a class="btn" id="pebv-view" href="#view">' + _('View').t() + '</a>');
            detailsButtons.push('</div>');
            return [detailsButtons.join(''), editButtonTemplate];
        },

        render: function() {
            var viewMode;
            var editMode;
            
            var viewMode = this.renderRules();
            this.$el.html('');
            this.$el.append(viewMode[0], viewMode[1]);
            return this;
        }
    });

    var PaletteConfigurationRouter = Backbone.Router.extend({

        initialize: function(options) {
            this.el = options.el;
            this.$el = $(options.el);

            this.model = options.model;
            this.buttons = new PaletteEditButtonsView({ model: options.model });
            this.layout = new PaletteLayoutEditor({model: options.model.properties});
            this.panels = new PalettePanelListView({collection: options.panels});
            this.$el.append(this.buttons.$el);
            this.$el.append(this.panels.$el);
            this.$el.append(this.layout.$el);
            var startHistory = _.bind(_.once(function() { 
                $('#dashboard-main').off('update', '#dashboard-body', startHistory);
                Backbone.history.start(); 
            }), this);
            $('#dashboard-main').on('update', '#dashboard-body', startHistory);
        },

        routes: {
            "preview": "preview",
            "edit": "edit",
            "view": "view",
            "":  "view"
        },

        // The large sidebar.
        edit: function() { 
            if (! this.model.canWrite()) { return this.view(); }
            $('#dashboard-main').removeClass('palette-preview').addClass('palette-edit');
            this.layout.activateEditor();
            return this;
        },

        // The small sidebar.
        preview: function() {
            if (! this.model.canWrite()) { return this.view(); }
            var pppr = $('.palette-panel-preview-rotate');
            var w = pppr.width();
            pppr.css({'top': (w + 35) + 'px'});
            this.layout.activateEditor();
            $('#dashboard-main').removeClass('palette-edit').addClass('palette-preview');
            return this;
        },

        // No Sidebar.
        view: function() { 
            $('#dashboard-main').removeClass('palette-preview').removeClass('palette-edit');
            this.layout.deactivateEditor();
            return this;
        }
    });

    return PaletteConfigurationRouter;
});
