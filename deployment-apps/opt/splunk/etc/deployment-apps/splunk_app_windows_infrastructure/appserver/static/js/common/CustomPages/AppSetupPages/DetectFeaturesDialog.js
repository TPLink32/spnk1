/*
 * This file implements the detecting features dialog in customize features page. 
 */

define([
        'jquery',
        'underscore',
        'splunkjs/splunk',
        'splunkjs/mvc',
        'splunkjs/mvc/searchmanager',
        'views/shared/dialogs/DialogBase',
        'common/SearchRunner',
        'common/CustomPages/AppSetupPages/LookupBuilder'
        ],
        function(
            $,
            _,
            SplunkSdk,
            mvc,
            SearchManager,
            DialogBase,
            SearchRunner,
            LookupBuilder
           )
{   
    var DetectFeaturesDialog = DialogBase.extend({
        /**
         * Called when the domain_aliases_edit_action is instantiated. 
         * @param {Object} options are the constructor parameters for the view
         * @param {configurableFeatures} configurableFeatures config
         * @param {lookupBuilders} lookup builders config
         */
        initialize: function(options) {
            var that = this;
            
            this.$el.modal({
                show: false,
                keyboard: false,
                backdrop: 'static'
                });
            
            DialogBase.prototype.initialize.apply(this, arguments);
            
            this._parentPage = options['parentPage'];
            this._configurableFeatures = options['configurableFeatures'];
            this._lookupBuilders = options['lookupBuilders'];
            this._lookupMigrators = options['lookupMigrators'];
            
            this._detectFeaturesDialogClosed = false;
            this._customizeFeaturesOnly = false;

            var path = window.location.pathname;
            var page = path.split("/").pop();
            
            if (page === "customize_features") {
                that._customizeFeaturesOnly = true;
            }
            
            this.settings.set(
                "titleLabel",
                "Detecting 1 of " + 
                    _.chain(this._configurableFeatures).pluck('features').flatten().filter(
                        function(feature) {
                            return !_.isUndefined(feature.baseSearch); 
                        }).value().length + " ..."
                );
            
            this.settings.set("cancelButtonLabel", "Cancel");
            
            this.renderBody = function($el) {
                $el.html('<pre class="detect-output"></pre>');
            };
            
            if (!that._customizeFeaturesOnly) {
                this.renderFooter = function($el) {
                    DialogBase.prototype.renderFooter.apply(this, arguments);
                    $el.append('<div class="pull-right current-step">Step 1 of 3</div>');
                };
            }
            
            this.on("click:closeButton", function(e) {
                that._detectFeaturesDialogClosed = true;
            });
            
            this.on("click:cancelButton", function(e) {
                that._detectFeaturesDialogClosed = true;
            });
        },
        
        detectEvents: function() {
            var that = this;
            
            var currentDetection = 1;
            
            var allNonDetectableFeatures = [];
            
            // Setup full list of features to detect
            var allDetectableFeatures = _.chain(this._configurableFeatures).map(
                function(configurableFeature) {
                    configurableFeature.features = _.map(
                        configurableFeature.features,
                        function(feature) { 
                            feature.configurableFeature = configurableFeature; 
                            feature.configurableFeatureName = configurableFeature.sectionName;
                            return feature; 
                        });
                        return configurableFeature;
                    }).pluck('features').flatten().filter(function(feature) {
                        if (_.isUndefined(feature.baseSearch)) {
                            allNonDetectableFeatures.push(feature);
                            return false;
                        }
                        
                        return true;
                    }).value();
            
            this._parentPage.resetFeatureSelections();
            
            // Features that can't be detected, enable them by default
            _.each(allNonDetectableFeatures, function(feature) {
                that._parentPage.markFeatureDetection(
                    feature.name,
                    feature.configurableFeature.sectionId,
                    true
                    );
            });
            
            // Detect each feature and save results on parent page
            var detectFeature = function(feature, done) {
                that.$('.detect-output').append(
                    'Detecting ' + feature.name + ' ...<br />'
                    );
                
                that.$('.detect-output').animate({ scrollTop: '99999px' });

                var searchManager = new SearchManager({
                    search: feature.baseSearch + " | head 1 | stats count",
                    auto_finalize_ec: "1",
                    earliest_time: "-4h",
                    latest_time: "now",
                    cancelOnUnload: true,
                    cache: false
                });

                var resultsModel = searchManager.data('results', {
                    output_mode: 'json'
                });

                resultsModel.on('data', function() {
                    if (resultsModel.hasData() && !that._detectFeaturesDialogClosed) {
                        var result = resultsModel.data();

                        if (parseInt(result.results[0].count) === 0) {
                            that._parentPage.markFeatureDetection(
                                feature.name,
                                feature.configurableFeature.sectionId,
                                false
                                );
                            that.$('.detect-output').append(
                                feature.configurableFeatureName + ': ' + 
                                feature.name + ' not found.<br />'
                                );
                        } else {
                            that._parentPage.markFeatureDetection(
                                feature.name,
                                feature.configurableFeature.sectionId,
                                true
                                );
                            that.$('.detect-output').append(
                                feature.configurableFeatureName + ': ' + 
                                feature.name + ' found.<br />'
                                );
                        }
                        
                        that.$('.detect-output').animate({
                            scrollTop: '999999px'
                        });

                        currentDetection++;
                        if (currentDetection <= allDetectableFeatures.length) {
                            that.$('.modal-header .text-dialog-title').text(
                                "Detecting " + currentDetection + " of " + 
                                allDetectableFeatures.length + " ..."
                                );
                        }
                        done();
                    }

                    console.log("resultsModel data raised");

                });
            };
            
            var lookupBuilderHandlers = {
                setTitle: function(titleText) {
                    that.$('.modal-header .text-dialog-title').text(titleText);
                },
                
                appendContent: function(message) {
                    that.$('.detect-output').append(message + '</br>');
                    
                    that.$('.detect-output').animate({
                        scrollTop: '999999px'
                    });
                }
            };


            if (that._customizeFeaturesOnly) {
                setTimeout(function() {
                    SplunkSdk.Async.series(
                        _.flatten([
                            _.map(allDetectableFeatures, function(feature) {
                                return function(done) { detectFeature(feature, done); };
                            })
                        ]),
                        function() {
                            // Feature detection and building lookups are both done
                            that.$('.modal-header .text-dialog-title').text("Done with setup.");
                            that.$('div.modal-footer .btn-dialog-cancel').text("Close");
                        }
                    );
                },
                1000
                );
            }
            else {
                setTimeout(function() {
                    SplunkSdk.Async.series(
                        _.flatten([
                            _.map(allDetectableFeatures, function(feature) {
                                return function(done) { detectFeature(feature, done); };
                            }),
                            function(done) {
                                // Feature detection has completed, now migrate the lookups
                                $('.modal-footer .current-step').text('Step 2 of 3');
                                done();
                            },
                            function(done) {
                                lookupBuilderHandlers.markDone = function() {
                                    done();
                                }
                                
                                LookupBuilder.migrateLookups(that._lookupMigrators, lookupBuilderHandlers);
                            },
                            function(done) {
                                // Migrating lookups has completed, now build lookups
                                $('.modal-footer .current-step').text('Step 3 of 3');
                                done();
                            },
                            function(done) {
                                lookupBuilderHandlers.markDone = function() {
                                    done();
                                }
                                
                                LookupBuilder.buildLookups(that._lookupBuilders, lookupBuilderHandlers);
                            }
                        ]),
                        function() {
                            // Feature detection and building lookups are both done
                            that.$('.modal-header .text-dialog-title').text("Done with setup.");
                            that.$('div.modal-footer .btn-dialog-cancel').text("Close");
                        }
                    );
                },
                1000
                );
            }
        }
    });
    
    return DetectFeaturesDialog;
});