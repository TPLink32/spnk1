/*
 * This file implements a generic page for picking features to include in app's nav
 * based on tests run against the app config and/or user's picks. 
 */

requirejs.config({
    enforceDefine: false,
    paths: {
        'text': './contrib/text',
        'css': 'splunkjs/contrib/require-css/css'
    }
});

define([
        'jquery',
        'underscore',
        'splunkjs/mvc',
        'splunkjs/mvc/searchmanager',
        'splunkjs/mvc/savedsearchmanager',
        'views/shared/dialogs/DialogBase',
        'common/SearchRunner',
        'common/PageMessagesView',
        'common/SyncTaskQueue',
        'common/CustomPages/AppSetupPages/SetupConfigManager',
        'common/CustomPages/AppSetupPages/AppSetupManager',
        'common/CustomPages/AppSetupPages/DetectFeaturesDialog',
        'text!common/CustomPages/AppSetupPages/CustomizeFeatures.html',
        'css!common/CustomPages/AppSetupPages/CustomizeFeatures.css',
        'splunk_app_windows_infrastructure/default'
        ],
        function(
            $,
            _,
            mvc,
            SearchManager,
            SavedSearchManager,
            DialogBase,
            SearchRunner,
            PageMessagesView,
            SyncTaskQueue,
            SetupConfigManager,
            AppSetupManager,
            DetectFeaturesDialog,
            PageMarkup,
            CSS,
            DefaultNav
           )
{   
    var CustomizeFeatures = {
        _customizeSectionTemplate: '\
            <ol> \
                <% _.each(configurableFeatures, function(configurableFeature) { %> \
                    <li class="outer"> \
                        <input type="checkbox" id="<%= configurableFeature.sectionId %>-checkbox" /> \
                            <span><%= configurableFeature.sectionName %></span> \
                        <div class="description"> \
                            <%= configurableFeature.description %> \
                            <a class="learn-more" href="<%= configurableFeature.learnMoreHref %>" \
                                target="_blank">learn more</span> \
                            </a> \
                            <a class="show-details" href="javascript:void(0);" \
                                data-details-list="<%= configurableFeature.sectionId %>-list">show feature details</a> \
                        </div> \
                        <ol id="<%= configurableFeature.sectionId %>-list"> \
                            <% _.each(configurableFeature.features, function(feature) { %> \
                                <li> \
                                    <input type="checkbox" id="<%= feature.name %>-checkbox"/> <span><%= feature.name %></span> \
                                    <div class="description collapsed"> \
                                        <%= feature.description %> \
                                    </div> \
                                </li> \
                            <% }) %> \
                        </ol> \
                    </li> \
                <% }) %> \
            </ol> \
            ',
            
        _detectFeaturesDialogClosed: false,
            
        initialize: function(
            appInfo,
            configurableFeaturesLists,
            lookupBuildersLists,
            lookupMigratorsLists
            ) {
            // arguments passed are validated in SetupConfigManager, so skip here
            SetupConfigManager.build(
                appInfo,
                configurableFeaturesLists,
                lookupBuildersLists,
                lookupMigratorsLists
                );
        },
        
        render: function(parentEl) {
            var that = this;
            
            if (_.isUndefined(parentEl) || _.isNull(parentEl)) {
                throw('Invalid parent element passed in to customize features page');
            }
            
            if (_.isUndefined(PageMarkup) || _.isNull(PageMarkup)) {
                throw('PageMarkup is not valid - this is unexpected');
            }
            
            parentEl.html(PageMarkup);
            
            var path = window.location.pathname;
            var page = path.split("/").pop();
            
            if (page === "customize_features") {
                $('#save-features-button').css('display', 'inline-block');
            }

            $('#app-name').text(SetupConfigManager.getAppName());
            
            var html = _.template(
                this._customizeSectionTemplate, 
                { configurableFeatures: SetupConfigManager.getConfigurableFeatures() }
                );
            
            $('#main-container').replaceWith(html);
            $('li.outer').css('width', Math.floor(100.0 / SetupConfigManager.getConfigurableFeatures().length) + '%');

            this.setupEvents();
            
            // Determine if first time setup
            AppSetupManager.startFirstTimeSetupCheck(SetupConfigManager);
            var firstTimeSetupCheckDone = false;
            var retries = 0;
            
            var waitHandle = setInterval(
                function() {
                    if (retries > 20 /* 50*200ms = 10 seconds */) {
                        that.renderDetectionDialog(); // Consider as first time setup
                        clearInterval(waitHandle);
                    } else {
                        var status = AppSetupManager.getFirstTimeSetupCheckStatus();
                        firstTimeSetupCheckDone = status['completed'];
                            
                        if (firstTimeSetupCheckDone) {
                            clearInterval(waitHandle);
                            if (!_.isNull(status['isFirstTimeSetup'])) {
                                isFirstTimeSetup = status['isFirstTimeSetup'];
                            } else {
                                // Best effort
                                isFirstTimeSetup = true;
                            }
                            
                            if (isFirstTimeSetup) {
                                that.renderDetectionDialog();
                            } else {
                                AppSetupManager.applyFeatureSelectionsFromNav(
                                    SetupConfigManager,
                                    that
                                    );
                            }
                        }
                    }
                    
                    retries++;
                },
                200
                );
        },
        
        setupEvents: function() {
            var that = this;
            
            // Handler to toggle for show/hide of feature details
            $('a.show-details').click(function() {
                var showFeatureDetails = 'show feature details';
                var hideFeatureDetails = 'hide feature details';

                var detailsList = $(this).data('details-list');
                $(this).text($(this).text() === showFeatureDetails ? hideFeatureDetails : showFeatureDetails);
                $('#' + detailsList + ' .description.collapsed').toggle();
            });
            
            // Handler to select section if feature under it is selected
            var sectionIds = _.pluck(
                SetupConfigManager.getConfigurableFeatures(),
                'sectionId'
                );
            
            $("li:not([id])").off('click').click(function() {
                _.each(sectionIds, function(sectionId) {
                    that.updateSectionSelection(sectionId);
                });
            });
            
            // Handler to select/unselect a whole section when section check box is clicked
            _.each(sectionIds, function(sectionId) {
                $("#" + sectionId + '-checkbox').off('click').click((function(sectionId) {
                    return function() {
                        var checkbox = $(this);
                        $('#' + sectionId + '-list').find('input').each(function() {
                            $(this).prop('checked', checkbox.is(':checked'));
                        });
                    }
                })(sectionId));
            });
            
            
            // Handler for detect dialog button
            $('#detect-button').off('click').click(function() {
                that.renderDetectionDialog();
            });

            // Handler for save features button
            $('#save-features-button').off('click').click(function() {
                that.saveChanges(DefaultNav);
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = that.getDefaultLocation();
                }
            });
        },
        
        renderDetectionDialog: function() {
            var detectingDialog = new DetectFeaturesDialog(
                {
                    'parentPage': this,
                    'configurableFeatures': SetupConfigManager.getConfigurableFeatures(),
                    'lookupMigrators': SetupConfigManager.getLookupMigrators(),
                    'lookupBuilders': SetupConfigManager.getLookupBuilders()
                }
                );
            
            detectingDialog.render().show();
            detectingDialog.detectEvents();
        },
        
        saveChanges: function(appDefaultNav) {
            AppSetupManager.saveFeatureSelectionsToNav(appDefaultNav, SetupConfigManager, this);
        },
        
        markFeatureDetection: function(featureName, sectionId, isDetected) {
            var that = this;
            
            var checkboxes = $(
                '#' + sectionId + '-list input[type="checkbox"]'
                );
            
            checkboxes.each(function() {
                var checkbox = $(this);
                if ($.trim(checkbox.next().text()) === featureName) {
                    checkbox.prop('checked', isDetected);
                    if (isDetected) {
                        //  Mark section as selected when all of its features are selected
                        that.updateSectionSelection(sectionId);
                    }
                }                        
            });
        },
        
        resetFeatureSelections: function() {
            $('input[type="checkbox"]').prop('checked', false);
        },
        
        isFeatureSelected: function(featureName, sectionId) {
            return this.isCheckboxChecked(
                '#' + sectionId + '-list input[id="' + featureName + '-checkbox"]'
                );
        },
        
        isSectionSelected: function(sectionId) {
            return this.isCheckboxChecked('#' + sectionId + '-checkbox');
        },
        
        isCheckboxChecked: function(checkboxSel) {
            var checkboxEl = $(checkboxSel);
            return (!_.isUndefined(checkboxEl) && checkboxEl.is(':checked'));
        },
        
        updateSectionSelection: function(sectionId) {
            // Mark a section in a selected state only if all features in it
            // are selected
            var areAllFeaturesSelected = !(_.some(
                $('#' + sectionId + '-list').find('input'),
                function(elCheckbox) {
                    return $(elCheckbox).is(':checked') === false;
                }
                ));

            $('#' + sectionId + '-checkbox').prop('checked', areAllFeaturesSelected);
        },

        getDefaultLocation: function() {
            
            var currentPage = window.location.href;
            if(currentPage.split('/').slice(-2)[0] == "splunk_app_microsoft_exchange"){
                return currentPage.substr(0, currentPage.lastIndexOf('/')) + '/home';    
            }
            return currentPage.substr(0, currentPage.lastIndexOf('/')) + '/infra_home';
        }
    }
    
    return CustomizeFeatures;
});
