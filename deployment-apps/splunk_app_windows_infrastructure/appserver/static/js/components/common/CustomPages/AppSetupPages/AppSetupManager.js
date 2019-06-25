/*
 * AppSetupManager implements APIs to query/manage app setup related information 
 */

define([
        'jquery',
        'underscore',
        'splunkjs/mvc',
        'common/SyncTaskRunner',
        'common/CustomPages/AppSetupPages/SetupHelpers'
        ],
        function(
            $,
            _,
            mvc,
            SyncTaskRunner,
            SetupHelpers
            )
{   
    var AppSetupManager = {
        _firstTimeSetupCheckDone: false,
        
        _isFirstTimeSetup: true,
        
        _splunkService: mvc.createService(),
        
        startFirstTimeSetupCheck: function(setupConfigManager) {
            var that = this;
            
            this._isFirstTimeSetup = true;
            this._firstTimeSetupCheckDone = false;
            
            new SyncTaskRunner(
                'CheckSetupStatus',
                this.firstTimeSetupCheckTask,
                [setupConfigManager, this],
                null, // default timeout,
                function() { /* do nothing on timeout */ },
                null /* no timeout args */
                ).start();
        },
        
        firstTimeSetupCheckTask: function(taskRunner, setupConfigManager, that) {
            SetupHelpers.isAppSetupRequired(
                setupConfigManager.getAppRestId(),
                function(isFirstTimeSetup, appBuild) {
                    that._firstTimeSetupCheckDone = true;
                    that._isFirstTimeSetup = isFirstTimeSetup;
                    that._appBuild = appBuild;
                    taskRunner.markCompleted();
                }
                );
        },
        
        getFirstTimeSetupCheckStatus: function() {
            var result = this._firstTimeSetupCheckDone ? this._isFirstTimeSetup : null;
            return {
                'completed': this._firstTimeSetupCheckDone,
                'isFirstTimeSetup': result
            }
        },
        
        getNav: function(setupConfigManager, navCallback) {
            var navEntity = new splunkjs.Service.Entity(
                this._splunkService, 
                "data/ui/nav/default",
                this.getAppNamespace(setupConfigManager)
            );

            navEntity.fetch({}, function(error, resource) {
                var nav = {
                    data: null,
                    
                    getSection: function(sectionName) {
                        var xml = $.parseXML(this.data),
                        $xml = $(xml),
                        $section = $xml.find("collection[label='" + sectionName + "']");
                        
                        return $section;
                    },
                    
                    getSectionFeatures: function(sectionName) {
                        var featureNames = [];
                        
                        this.getSection(sectionName).children().each(function() {
                            var child = $(this);
                            var name = '';
        
                            if (child.prop('tagName') === 'a') {
                                name = child.text();
                            } else { // tagName == collection
                                name = child.attr('label');
                            }
                            
                            featureNames.push(name);
                        });
                        
                        return featureNames;
                    },
                    
                    isSectionInNav: function(sectionName) {
                        var section = this.getSection(sectionName);
                        return (section.length > 0);
                    },
                    
                    isFeatureInNav: function(sectionName, featureName) {
                        return _.contains(this.getSectionFeatures(sectionName), featureName);
                    }
                };
                
                if (_.isUndefined(error) || _.isNull(error)) {
                    nav.data = resource.properties()['eai:data'];
                } 
                
                navCallback(nav);
            });
        },
        
        applyFeatureSelectionsFromNav: function(setupConfigManager, featureSelectionPage) {
            this.getNav(setupConfigManager, function(nav) {
                _.each(setupConfigManager.getConfigurableFeatures(), function(configurableFeature) {
                    _.each(nav.getSectionFeatures(configurableFeature.sectionName), function(featureName) {
                        var ignoreNavs = ["Tools & Settings", "Dashboards", "Overview"];
                        
                        if (!_.contains(ignoreNavs, featureName)) {
                            featureSelectionPage.markFeatureDetection(
                                featureName,
                                configurableFeature.sectionId,
                                true
                                );
                        }
                    });
                });
            });
        },
        
        saveFeatureSelectionsToNav: function(appDefaultNav, setupConfigManager, featureSelectionPage) {
            var that = this;
            
            var navEntity = new splunkjs.Service.Entity(
                this._splunkService, 
                "data/ui/nav/default",
                this.getAppNamespace(setupConfigManager)
                );
            
            // Start with default nav with all features and remove the ones not required
            var navXmlDoc = $.parseXML(appDefaultNav.nav);
            var navXml = $(navXmlDoc);

            _.each(setupConfigManager.getConfigurableFeatures(), function(configurableFeature) {
                var xmlSectionName = configurableFeature.sectionName;
                var sectionId = configurableFeature.sectionId;
                
                var isAtleastOneFeatureSelected = false;
                
                _.each(configurableFeature.features, function(feature) {
                    var featureName = feature.name;
                    
                    if (!featureSelectionPage.isFeatureSelected(featureName, sectionId)) {
                        var NON_COLLECTION_ITEMS = ["Event Monitoring", "Performance Monitoring"];
                        if (_.contains(NON_COLLECTION_ITEMS, featureName)) {
                            navXml.find("collection[label='" + xmlSectionName + "'] a:contains('" + featureName + "')").remove();
                        } else {
                            navXml.find("collection[label='" + xmlSectionName + "'] collection[label='" + featureName + "']").remove();
                        }
                    } else {
                        isAtleastOneFeatureSelected = true;
                    }
                });

                if (!isAtleastOneFeatureSelected) {
                    navXml.find("collection[label='" + xmlSectionName + "']").remove();
                }
            });

            var newXml = (new XMLSerializer()).serializeToString(navXmlDoc); 

            // Persist nav to conf file for nav - default.xml (in navEntity)
            navEntity.update(
                {
                    'eai:data': newXml
                },
                function(err) {
                    var appEntity = new splunkjs.Service.Application(
                        that._splunkService,
                        setupConfigManager.getAppRestId()
                        );
                
                    appEntity.fetch({}, function(error, entity) {
                        if (_.isUndefined(error) || _.isNull(error)) {
                            entity.update(
                                {
                                    'configured': true
                                },
                                function(error) {
                                    that.saveLastNavRevBuild(setupConfigManager);
                                }
                                );
                        }
                    });
                }
                );
            
            return true;
        },
        
        saveLastNavRevBuild: function(setupConfigManager) {
            var that = this;
            
            var confs = that._splunkService.configurations(
                that.getAppNamespace(setupConfigManager)
                );
                
            if (!_.isUndefined(confs)) {
                var msftAppConfFile = confs.instantiateEntity({
                    name: 'splunk_msftapp',
                    acl: that.getAppNamespace(setupConfigManager)
                });
                
                if (!_.isUndefined(msftAppConfFile)) {
                    var settingsStanza = msftAppConfFile.instantiateEntity({
                        name: 'settings',
                        acl: that.getAppNamespace(setupConfigManager)
                    });
                    
                    if (!_.isUndefined(settingsStanza)) {
                        settingsStanza.update(
                            {
                                'last_nav_rev': that._appBuild
                            },
                            function(error, stanza) { 
                                // Ignore, next saveFeatureSelectionsToNav will attempt again
                                if (!_.isUndefined(error) && !_.isNull(error)) {
                                    console.log('Failed to save last nav rev. Error: ' + error);
                                }
                            }
                            );
                    } // else ignore, next saveFeatureSelectionsToNav will attempt again
                } // else ignore, next saveFeatureSelectionsToNav will attempt again
            } // else ignore, next saveFeatureSelectionsToNav will attempt again
        },
        
        getAppNamespace: function(setupConfigManager) {
            return {
                owner: 'admin', // only admin can make the kind of calls made here
                app: setupConfigManager.getAppRestId(),
                sharing: 'app'
            };
        }
    }
    
    return AppSetupManager;
});