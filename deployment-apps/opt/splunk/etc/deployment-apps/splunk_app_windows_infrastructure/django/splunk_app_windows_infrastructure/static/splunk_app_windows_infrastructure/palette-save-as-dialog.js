/*global define, require */

define(
    [
        'jquery',
        'underscore',
        'backbone',
        'views/shared/controls/ControlGroup',
        'views/shared/Modal',
        'views/shared/PopTart',
        'views/shared/delegates/PairedTextControls',
        './palette_page_validations',
        'views/shared/FlashMessages',
        'util/splunkd_utils'
    ],
    function(
        $,
        _,
        Backbone,
        ControlGroup,
        Modal,
        PopTartView,
        PairedTextControls,
        PalettePageValidations,
        FlashMessages,
        splunkDUtils
    )
    {

        var SaveAsDialog = Modal.extend({
            template: $('#palette-save-description-tmpl').html(),
            events: _.extend({}, Modal.prototype.events, 
                             { 'click .btn-primary': 'maybeSave' }),

            initialize: function(options) { 
                Modal.prototype.initialize.apply(this, arguments);

                this.properties = new PalettePageValidations(
                    _.extend(_.pick(this.model.toJSON(), ['title', 'description']),
                             {'name': ''}));

                this.children.flashMessage = new FlashMessages({model: this.properties});

                this.children.titleField = new ControlGroup({
                    controlType: 'Text',
                    controlOptions: {
                        modelAttribute: 'title',
                        model: this.properties
                    },
                    label: _('Title').t()
                });

                this.children.descriptionField = new ControlGroup({
                    controlType: 'Textarea',
                    controlOptions: {
                        modelAttribute: 'description',
                        model: this.properties,
                        placeholder: _('optional').t()
                    },
                    label: _('Description').t()
                });

                this.children.aboutField = new ControlGroup({
                    controlType: 'Text',
                    controlOptions: {
                        modelAttribute: 'name',
                        model: this.properties,
                        defaultValue: '',
                        placeholder: _('').t()
                    },
                    label: _('ID').t(),
                    tooltip: _('The ID becomes part of the URL and on-disk storage. ' +
                               'It cannot be changed once it has been set.').t()
                });

                this.pairedTextControls = new PairedTextControls({
                    sourceDelegate: this.children.titleField.childList[0],
                    destDelegate: this.children.aboutField.childList[0],
                    transformFunction: splunkDUtils.nameFromString
                });
            },

            maybeSave: function(e) {
                var that = this;
                e.preventDefault();
                if (!_.isNull(this.properties.validate())) {
                    return;
                }
                this.model.set(this.properties.toJSON());
                $.when(this.model.save()).then(
                    function() { that.trigger('saved', this); },
                    function() { 
                        that.children.aboutField.error(true, "An App Dashboard with that ID already exists.");
                        that.properties.trigger('validated', false, that.properties, 
                                                {'name': 'An App Dashboard with that ID already exists.' });
                    }
                );
            },

            render: function() {
                var that = this;
                var rfield = function(name) { return that.children[name].render().el; };
                this.$el.html(this.compiledTemplate({
                    cancel: Modal.BUTTON_CANCEL,
                    save: Modal.BUTTON_SAVE
                }));
                that.$('.flashmessage').append(this.children['flashMessage'].render().el);
                _.each(['titleField', 'descriptionField', 'aboutField'], function (f) {
                    that.$('.form').append(rfield(f)); });
                return this;
            }
        });

        return SaveAsDialog;
    }
);





