/*global define */

define(
    [
        'jquery',
        'underscore',
        'views/shared/controls/ControlGroup',
        'views/shared/Modal',
        'views/shared/PopTart',
        'views/shared/delegates/PairedTextControls',
        './palette-edit-permissions-menu',
        'util/splunkd_utils',
        'splunkjs/mvc/utils'
    ],
    function(
        $,
        _,
        ControlGroup,
        Modal,
        PopTartView,
        PairedTextControls,
        EditPermissionsDialog,
        splunkDUtils,
        mvc_utils
    )
    {
        var EditDescriptionDialog = Modal.extend({
            template: $('#palette-edit-description-tmpl').html(),
            events: _.extend({}, Modal.prototype.events, 
                             { 'click .btn-primary': 'maybeSave' }),

            initialize: function(options) { 
                Modal.prototype.initialize.apply(this, arguments);

                this.orig = this.model;
                this.model = this.orig.clone();

                this.children.titleField = new ControlGroup({
                    controlType: 'Text',
                    controlOptions: {
                        modelAttribute: 'title',
                        model: this.model
                    },
                    label: _('Title').t()
                });

                this.children.descriptionField = new ControlGroup({
                    controlType: 'Textarea',
                    controlOptions: {
                        modelAttribute: 'description',
                        model: this.model,
                        defaultValue: '',
                        placeholder: _('optional').t()
                    },
                    label: _('Description').t()
                });

                this.children.aboutField = new ControlGroup({
                    controlType: 'Label',
                    controlOptions: {
                        modelAttribute: 'name',
                        model: this.model
                    },
                    label: _('ID').t(),
                    tooltip: _('The ID becomes part of the URL and on-disk storage. ' +
                               'It cannot be changed once it has been set.').t()
                });
            },

            maybeSave: function(ev) {
                ev.preventDefault();
                if (!_.isNull(this.model.validate())) {
                    return;
                }
                this.orig
                    .set(_.pick(this.model.toJSON(), ['title', 'description']))
                    .save();
                this.hide();
            },

            render: function() {
                var that = this;
                var rfield = function(name) { 
                    return that.children[name].render().el; 
                };
                this.$el.html(this.compiledTemplate({
                    cancel: Modal.BUTTON_CANCEL,
                    save: Modal.BUTTON_SAVE,
                    _: _
                }));
                _.each(['titleField', 'descriptionField', 'aboutField'], function (f) {
                    that.$('.form').append(rfield(f)); });
            }
        });

        // The Delete Palette Dialog uses the *Stanza*, as that is
        // what we're out to delete.

        var DeletePaletteDialog = Modal.extend({
            template: $('#palette-delete-dialog-tmpl').html(),
            events: _.extend({}, Modal.prototype.events, { 'click .btn-primary': 'maybeDelete' }),
            maybeDelete: function(ev) { 
                var that = this;
                ev.preventDefault();
                $.when(this.model.deleteEntity()).then(function() {
                    window.location.href="/dj/splunk_app_windows_infrastructure/palette/";
                });
            },

            render: function() {
                this.$el.html(this.compiledTemplate({
                    _: _,
                    title: this.model.properties.get('title'),
                    cancel: Modal.BUTTON_CANCEL
                }));
            }
        });

        var paletteEditMenuTemplate = [
            '<div class="arrow"></div>',
            '  <ul class="first-group">',
            '    <li><a href="#" id="edit-description-option"><%- _("Edit Description").t() %></a></li>',
            '    <li><a href="#" id="edit-permission-option"><%- _("Edit Permissions").t() %></a></li>',
            '  </ul>',
            '  <ul class="second-group">',
            '    <li><a href="#" id="delete-palette-option"><%- _("Delete App Dashboard").t() %></a></li>',
            '    <li><a href="<%= path %>#edit" id="clone-palette-option"><%- _("Clone App Dashboard").t() %></a></li>',
            '  </ul>',
            '</div>'].join('\n');

        var paletteUserEditMenuTemplate = [
            '<div class="arrow"></div>',
            '  <ul class="first-group">',
            '    <li><a href="#" id="edit-description-option"><%- _("Edit Description").t() %></a></li>',
            '  </ul>',
            '  <ul class="second-group">',
            '    <li><a href="#" id="delete-palette-option"><%- _("Delete App Dashboard").t() %></a></li>',
            '    <li><a href="<%= path %>#edit" id="clone-palette-option"><%- _("Clone App Dashboard").t() %></a></li>',
            '  </ul>',
            '</div>'].join('\n');

        return PopTartView.extend({
            className: 'dropdown-menu',

            events: {
                'click a#edit-description-option': 'editDescriptionDialog',
                'click a#edit-permission-option': 'editPermissionsDialog',
                'click a#delete-palette-option':  'deletePaletteDialog'
            },

            initialize: function(options) {
                PopTartView.prototype.initialize.apply(this, arguments);
                var defaults = {
                    button: true,
                    showOpenActions: true,
                    deleteRedirect: false
                };
                _.defaults(this.options, defaults);
                this.model.on('change', this.render, this);
            },

            someDialog: function(e, Dialog, model, options) {
                options = _.extend(options || {}, {model: model});
                e.preventDefault();
                this.hide();
                var dialog = new Dialog(options);
                dialog.render().appendTo($('body'));
                dialog.show();
                return this;
            },
                
            editDescriptionDialog: function(e) { 
                return this.someDialog(e, EditDescriptionDialog, this.model.properties); 
            },

            editPermissionsDialog: function(e) {
                return this.someDialog(e, EditPermissionsDialog, this.model.acls, { title: this.model.properties.get('title') });
            },

            deletePaletteDialog: function(e) {
                return this.someDialog(e, DeletePaletteDialog, this.model); 
            },
            
            render: function() { 
                this.template = this.model.canPerm() ? paletteEditMenuTemplate : paletteUserEditMenuTemplate;
                this.compiledTemplate = this.compileTemplate(this.template);
                var pageInfo = mvc_utils.getPageInfo();
                var path = ['', 'dj', pageInfo.locale, pageInfo.app, pageInfo.page, '_new'];
                path = path.join('/') + '?source=' + encodeURIComponent(this.model.paletteUrl());
                this.$el.html(this.compiledTemplate({path: path}));
                return this;
            }
        });
    }
);





