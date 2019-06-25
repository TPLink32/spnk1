/*global define */
define(
    [
        'jquery',
        'underscore',
        'backbone',
        'module',
        'models/ACLReadOnly',
        'models/services/ACL',
        'views/shared/controls/ControlGroup',
        'views/shared/Modal',
        'views/shared/PopTart',
        'views/shared/delegates/PairedTextControls',
        'views/Base',
        'views/shared/controls/SyntheticCheckboxControl',
        './palette-shared-models',
        'util/splunkd_utils'
    ],
    function(
        $,
        _,
        Backbone,
        module,
        ACLReadOnlyModel,
        ACLModel,
        ControlGroup,
        Modal,
        PopTartView,
        PairedTextControls,
        BaseView, 
        SyntheticCheckboxControl,
        sharedModels,
        splunkd_utils
    )
    {

        var EditPermissionAcl = BaseView.extend({
            moduleId: module.id,
            className: 'push-margins',
            initialize: function() {
                BaseView.prototype.initialize.apply(this, arguments);
                
                this.children.read = new BaseView();
                this.children.write = new BaseView();

                this.model.on('change:Everyone.read', function() {
                    this.toggleEveryone('read');
                }, this);

                this.model.on('change:Everyone.write', function() {
                    this.toggleEveryone('write');
                }, this);
            },

            appendRow: function(roleName) {
                var that = this;
                var className = roleName !== "Everyone" ? 'role' : '';
                var trow = $(
                    '<tr class="'+ roleName + '">\
                        <td class="role-name">' + _.escape(roleName) + '</td>\
                        <td class="perms-read"></td>\
                        <td class="perms-write"></td>\
                    </tr>'
                );
                
                _.each(['read', 'write'], function(op) {
                    var checkbox = that.children[op].children[roleName] = new SyntheticCheckboxControl({
                        modelAttribute: roleName +'.' + op,
                        model: that.model,
                        checkboxClassName: className + " " + roleName + " btn " + op
                    });
                    trow.find('td.perms-' + op).append(checkbox.render().el);
                });
                this.$('tbody').append(trow);
                return this;
            },

            toggleEveryone: function(col) {
                var everyoneChecked = this.model.get('Everyone.' + col),
                    view = this.children[col];
                _.each(view.children, function(checkbox, role) {
                    if (role !== 'Everyone') {
                        checkbox[everyoneChecked ? 'disable' : 'enable']();
                    }
                });
                return this;
            },

            render: function() {
                var that = this;
                this.$el.html(this.compiledTemplate({ _: _ }));
                this.appendRow(_("Everyone").t())
                    .collection.each(function(roleModel) {
                        that.appendRow(roleModel.entry.get("name"));
                    });
                this.toggleEveryone('read')
                    .toggleEveryone('write');
                return this;
            },

            template: '\
                <table class="table table-striped table-condensed table-scroll table-border-row">\
                <thead>\
                <tr>\
                <td></td>\
                <th class="perms-read"><%- _("Read").t() %></th>\
                <th class="perms-write"><%- _("Write").t() %></th>\
            </tr>\
            </thead>\
                <tbody>\
            </tbody>\
            </table>\
            '
        });

        var EditPermissionsDialog = Modal.extend({
            template: $('#palette-edit-permissions-tmpl').html(),
            events: _.extend({}, Modal.prototype.events,
                             {'click .btn-primary': 'maybePermit'}),

            initialize: function(options) {
                Modal.prototype.initialize.apply(this, arguments);

                // Preserve the original until 'save'
                this.perms = new Backbone.Model(this.model.toControlPermsObject());
                this.roles = this.model.roles;
                this.orig = this.model;

                this.model = this.model.clone();

                this.orig.on('change', function() {
                    this.perms.set(this.orig.toControlPermsObject());
                    this.model.set(this.orig.toJSON());
                 }, this);

                this.children.name = new ControlGroup({
                    controlType: 'Label',
                    controlOptions: {
                        defaultValue: options.title || "untitled"
                    },
                    label: 'Dashboard'
                });
                
                this.children.owner = new ControlGroup({
                    controlType: 'Label',
                    controlOptions: {
                        modelAttribute: 'owner',
                        model: this.model
                    },
                    label: _('Owner').t()
                });
                
                this.children.app = new ControlGroup({
                    controlType: 'Label',
                    controlOptions: {
                        modelAttribute: 'app',
                        model: this.model
                    },
                    label: _('App').t()
                });
                
                this.children.display_for = new ControlGroup({
                    controlType: 'SyntheticRadio',
                    controlClass: 'controls-thirdblock',
                    controlOptions: {
                        modelAttribute: 'sharing',
                        model: this.model,
                        items: [
                            {
                                label: _('Owner').t(),
                                value: splunkd_utils.USER,
                                className: 'user'
                            },
                            {
                                label: _('App').t(),
                                value: splunkd_utils.APP,
                                className: 'app'
                            }
                        ],
                        save: false
                    },
                    label: _('Display For').t()
                });

                this.children.acl = new EditPermissionAcl({
                    model: this.perms,
                    collection: this.roles
                });

                this.model.on('change:sharing', function() {
                    if (this.model.get("sharing") === splunkd_utils.USER) {
                        this.children.acl.$el.hide();
                    } else {
                        this.children.acl.$el.show();
                    }
                }, this);
            },
            
            maybePermit: function(ev) {
                ev.preventDefault();
                var hide = _.bind(this.hide, this);
                $.when(this.orig.save(this.model.toJSON(), this.perms.toJSON())).then(hide);
                return this;
            },
            
            setView: function() {
                var that = this;
                var fieldDomRel = [["can_share_user", '.user'],
                                   ["can_share_app", '.app']];
                var isNotPermitted = function(r) {
                    return ! that.model.get(r[0]); 
                };
                var thenDisable = function(r) {
                    that.children.display_for.$(r[1]).attr('disabled', true); 
                };

                _.each(_.filter(fieldDomRel, isNotPermitted), thenDisable);
                this.children.acl.$el[this.model.get("sharing") === 'user' ? 'hide' : 'show']();
                return this;
            },

            render: function() {
                var that = this;

                this.$el.html(this.compiledTemplate({
                    cancel: Modal.BUTTON_CANCEL,
                    save: '<a href="#" class="btn btn-primary modal-btn-primary pull-right">' + _('Save').t() + '</a>'
                }));

                var appendViewForField = function(name) { 
                    var view = that.children[name].render().el; 
                    that.$('.form').append(view);
                };

                _.each(['name', 'owner', 'app', 'display_for'], appendViewForField);

                if (! sharedModels.get('user').isFree()) {
                    this.$('.form').append(this.children.acl.render().el);
                }

                return this.setView();
            }

        });

        return EditPermissionsDialog;
    });
