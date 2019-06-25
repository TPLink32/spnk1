/*
 * This file contains the code to provide a step control wizard based wizard for
 * setting up exchange deployment monitoring using the Exchange App
 */
requirejs.config({
    paths: {
        'less': 'contrib/less-1.7.3.min'
    }
});

define([
        'jquery',
        'underscore',
        'backbone',
        'less',
        'collections/Base',
        'models/Base',
        'views/shared/controls/StepWizardControl',
        'splunk_app_windows_infrastructure/setup/introduction_page',
        'splunk_app_windows_infrastructure/setup/pre_requisites_page',
        'splunk_app_windows_infrastructure/setup/check_data_page',
        'splunk_app_windows_infrastructure/setup/customize_page',
        'splunk_app_windows_infrastructure/setup/finish_page'
        ],
        function(
            $,
            _,
            Backbone,
            less,
            BaseCollection,
            BaseModel,
            StepWizardControl,
            IntroductionPage,
            PreRequisitesPage,
            CheckDataPage,
            CustomizePage,
            FinishPage
            )
{   
    var app_setup_wizard = {
        wizardModel: new BaseModel({selectedStep: 'introStep'}),
        
        wizardSteps: undefined,
            
        stepWizard: undefined,
        
        wizardPages: {
            'introStep': IntroductionPage,
            'preReqsStep': PreRequisitesPage,
            'checkDataStep': CheckDataPage,
            'customizeStep': CustomizePage,
            'finishStep': FinishPage
        },
    
        render: function() {
            // Build the list of pages for the setup wizard
            var wizardPagesCollection = [];
            for (var step in this.wizardPages) {
                var page = this.wizardPages[step];
                
                wizardPagesCollection.push({
                    label: page.getPageLabel(),
                    value: step,
                    nextLabel: page.getNextLabel()
                });
            }
            this.wizardSteps = new BaseCollection(wizardPagesCollection);
                
            this.setupWizard = new StepWizardControl({
                label: 'Setup',
                model: this.wizardModel,
                modelAttribute: 'selectedStep',
                collection: this.wizardSteps,
                el: $('#app-setup-wizard'),
                validateNext: this.validateNext.bind(this)
            });
            
            this.wizardModel.on("change:selectedStep", this.updatePage, this);
            
            this.setupWizard.render().el;
            
            // Initially, select the pre-reqs page
            this.updatePage(this.wizardModel, 'introStep');
        },

        validateNext: function() {
            var that = this,
            currentStep = this.wizardModel.get('selectedStep');
            
            return this.wizardPages[currentStep].validateNext();
        },
        
        updatePage: function(model, selectedStep) {
            // Remove all currently displayed wizard page parts
            $('.wizard-page-part').remove();
            
            // Add the currently selected page's parts
            this.wizardPages[selectedStep].addPageParts($('.wizard-page'));
        }
    };
    
    return app_setup_wizard;
});