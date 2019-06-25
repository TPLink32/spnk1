define([
    'jquery',
    'underscore',
    'backbone',
    'module',
    'views/shared/Modal',
    'views/shared/controls/ControlGroup',
    'views/shared/controls/TextControl',
    'views/shared/FlashMessages',
    'splunkjs/mvc/utils',
    'uri/route',
    'common/grayskull/deepdive/DeepDiveLaneSettingsModel',
    'common/grayskull/deepdive/DeepDiveLaneSettingsCollection',
    'css!common/grayskull/deepdive/DeepDiveLaneSettingsModalView.css'
    ],
    function (
    $, 
    _, 
    Backbone,
    module, 
    Modal, 
    ControlGroup, 
    TextControl, 
    FlashMessagesView, 
    splunkjsUtils,
    route,
    DeepDiveLaneSettingsModel,
    DeepDiveLaneSettingsCollection,
    CSS
    ) {
    /**
     * DeepDiveLaneSettingsModalView renders the add/edit dialog for a deep dive lane
     */
    return Modal.extend({
    //
    // Overrides of Parent Methods
    //
    moduleId: module.id,
    
    /**
     * Called when the DeepDiveLaneSettingsModalView is instantiated. 
     * @param {Object} options are the constructor parameters for the view
     * @param {string} options.modalTitle the string to put as the title of the modal
     * @param {string} options.modalPrimaryButtonText the string to put as the text on the primary button of the modal
     * @param {DeepDiveLaneSettingsCollection|undefined|null} options.laneSettingsCollection the collection to which we add lane settings models, if null like, we add to nothing
     * @param {DeepDiveLaneSettingsModel|undefined|null} options.laneSettings the model we will edit, if null like we will create an empty one
     */
    initialize: function (options) {
    Modal.prototype.initialize.apply(this, arguments);
    
    /**
     * the string that will be rendered as the title of the modal
     * @type {string}
     * @private
     */
    this._title = options.modalTitle || _("Lane Settings").t();
    
    /**
     * the string that will be rendered as the primary button text of the modal
     * @type {string}
     * @private
     */
    this._primaryButtonText = options.modalPrimaryButtonText || _("Save").t();
    
    /**
     * the laneSettings model that will be built from this modal
     * @type {DeepDiveLaneSettingsCollection|null}
     * @private
     */
    this._laneSettingsCollection = options.laneSettingsCollection;
    
    /**
     * the laneSettings model that will be built from this modal
     * @type {DeepDiveLaneSettingsModel}
     * @private
     */
    if (options.laneSettings instanceof DeepDiveLaneSettingsModel) {
    this._laneSettings = options.laneSettings;
    }
    else {
    this._laneSettings = new DeepDiveLaneSettingsModel();
    }
    
    this.titleTextControl = new TextControl({
    modelAttribute: 'title',
    model: this._laneSettings
    });
    
    this.children.title = new ControlGroup({
    label: _("Title").t(),
    controls: this.titleTextControl
    });
    
    this.children.subtitle = new ControlGroup({
    controlType: 'Text',
    controlOptions: {
    modelAttribute: 'subtitle',
    model: this._laneSettings,
    placeholder: _('optional').t()
    },
    label: _("Subtitle").t()
    });
    
    this.children.search = new ControlGroup({
    controlType: 'Textarea',
    controlOptions: {
    modelAttribute: 'search',
    model: this._laneSettings
    },
    label: _("Search").t(),
    help: '<a class="run-search">'+ _("Run Search").t() + ' <i class="icon-external"></i></a>'
    });
    
    this.children.search = new ControlGroup({
    controlType: 'Textarea',
    controlOptions: {
    modelAttribute: 'search',
    model: this._laneSettings
    },
    label: _("Search").t(),
    help: '<a class="run-search">'+ _("Run Search").t() + ' <i class="icon-external"></i></a>'
    });
    
    var vizDropdownContent = [
    { value: 'line', label: _("Line").t(), icon: 'chart-line' },
    { value: 'area', label: _("Area").t(), icon: 'chart-area' },
    { value: 'column', label: _("Column").t(), icon: 'chart-column' },
    { value: 'heatmap', label: _("Heat Map").t(), icon: 'chart-column' }
    ];
    this.children.visualizationType = new ControlGroup({
    controlType: 'SyntheticSelect',
    controlOptions: {
    model: this._laneSettings,
    modelAttribute: 'graphType',
    className: 'btn dropdown-toggle',
    items: vizDropdownContent,
    popdownOptions: {
    attachDialogTo: 'body'
    }
    },
    label: 'Graph Type'
    });
    
    var colorDropdownContent = [
    { value: '#6AB7C7', label: _("Blue").t(), icon: 'box-filled deep-dive-color-blue' },
    { value: '#5379AF', label: _("Dark Blue").t(), icon: 'box-filled deep-dive-color-darkblue' },
    { value: '#9AC23C', label: _("Green").t(), icon: 'box-filled deep-dive-color-green' },
    { value: '#D8593C', label: _("Red").t(), icon: 'box-filled deep-dive-color-red' },
    { value: '#FAC51C', label: _("Yellow").t(), icon: 'box-filled deep-dive-color-yellow' },
    { value: '#F7902B', label: _("Orange").t(), icon: 'box-filled deep-dive-color-orange' },
    { value: '#DD86AF', label: _("Pink").t(), icon: 'box-filled deep-dive-color-pink' },
    { value: '#956D95', label: _("Purple").t(), icon: 'box-filled deep-dive-color-purple' }
    ];
    this.children.visualizationColor = new ControlGroup({
    controlType: 'SyntheticSelect',
    controlOptions: {
    model: this._laneSettings,
    modelAttribute: 'graphColor',
    className: 'btn dropdown-toggle',
    items: colorDropdownContent,
    popdownOptions: {
    attachDialogTo: 'body'
    }
    },
    label: 'Graph Color'
    });
    
    this.children.flashMessages = new FlashMessagesView({
    model: {
    laneSettings: this._laneSettings
    }
    });
    },
    events: $.extend({}, Modal.prototype.events, {
    'click a.modal-btn-primary': function (e) {
    // FIXME: needs to adds the validations here!
    if (typeof(this._laneSettingsCollection) != "undefined") {
    this._laneSettingsCollection.add(this._laneSettings);
    }
    this.hide();
    this.remove();
    e.preventDefault();
    },
    'click a.run-search': function(e) {
    e.preventDefault();
    var search = this._laneSettings.get('search');
    if (!search) {
    return;
    }
    var params = {
    q: search,
    earliest: "-60m",
    latest: "now"
    };
    var pageInfo = splunkjsUtils.getPageInfo();
    var url = route.search(pageInfo.root, pageInfo.locale, pageInfo.app, { data: params });
    splunkjsUtils.redirect(url, true);
    }
    }),
    render: function () {
    this.$el.html(Modal.TEMPLATE);
    this.$(Modal.HEADER_TITLE_SELECTOR).html(this._title);
    this.$(Modal.BODY_SELECTOR).prepend(this.children.flashMessages.render().el);
    this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);
    this.$(Modal.BODY_FORM_SELECTOR).append(this.children.title.render().el);
    this.$(Modal.BODY_FORM_SELECTOR).append(this.children.subtitle.render().el);
    this.$(Modal.BODY_FORM_SELECTOR).append(this.children.search.render().el);
    this.$(Modal.BODY_FORM_SELECTOR).append(this.children.visualizationType.render().el);
    this.$(Modal.BODY_FORM_SELECTOR).append(this.children.visualizationColor.render().el);
    this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
    this.$(Modal.FOOTER_SELECTOR).append('<a class="btn btn-primary modal-btn-primary">' + this._primaryButtonText + '</a>');
    return this;
    }
    });
    }
);
