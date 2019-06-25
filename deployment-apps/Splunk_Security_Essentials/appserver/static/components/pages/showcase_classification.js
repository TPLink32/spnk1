"use strict";

var _templateObject = _taggedTemplateLiteral(["| loadjob $searchBarSearchJobIdToken$\n                                       | head 1\n                                       | transpose\n                                       | fields column"], ["| loadjob $searchBarSearchJobIdToken$\n                                       | head 1\n                                       | transpose\n                                       | fields column"]),
    _templateObject2 = _taggedTemplateLiteral(["| loadjob $variableSearchJobIdToken$\n                                       | search column != \"column\" AND column != \"_*\""], ["| loadjob $variableSearchJobIdToken$\n                                       | search column != \"column\" AND column != \"_*\""]),
    _templateObject3 = _taggedTemplateLiteral(["| loadjob $variableSearchJobIdToken$\n                                       | search column != \"column\" AND column != $classificationTargetToken|s$ AND (column != \"_*\" OR column = \"_time\")"], ["| loadjob $variableSearchJobIdToken$\n                                       | search column != \"column\" AND column != $classificationTargetToken|s$ AND (column != \"_*\" OR column = \"_time\")"]),
    _templateObject4 = _taggedTemplateLiteral(["| loadjob $searchBarSearchJobIdToken$\n                                       | sample partitions=100"], ["| loadjob $searchBarSearchJobIdToken$\n                                       | sample partitions=100"]),
    _templateObject5 = _taggedTemplateLiteral(["| loadjob $dataPartitionSearchJobIdToken$\n                                       | search partition_number < $trainingSetFractionToken$\n                                       | fields - partition_number\n                                       ", ""], ["| loadjob $dataPartitionSearchJobIdToken$\n                                       | search partition_number < $trainingSetFractionToken$\n                                       | fields - partition_number\n                                       ", ""]),
    _templateObject6 = _taggedTemplateLiteral(["| loadjob $dataPartitionSearchJobIdToken$\n                                       | search partition_number >= $testSetFractionToken$\n                                       | fields - partition_number\n                                       | apply $modelNameToken|s$"], ["| loadjob $dataPartitionSearchJobIdToken$\n                                       | search partition_number >= $testSetFractionToken$\n                                       | fields - partition_number\n                                       | apply $modelNameToken|s$"]),
    _templateObject7 = _taggedTemplateLiteral(["| inputlookup ", "_lookup\n                                       | eval Actions=model_name\n                                       | eval test_fraction = 100-training_fraction\n                                       | eval \"Split for training / test\" = if(test_fraction > 0, training_fraction + \" / \" + test_fraction, \"no split\")\n                                       | eval \"Fields to use for predicting\" = features,\n                                              \"Model name\" = model_name,\n                                              \"Search query\" = search_query,\n                                              \"Field to predict\" = target,\n                                              \"Precision\" = round(precision, 2),\n                                              \"Recall\" = round(recall, 2),\n                                              \"Accuracy\" = round(accuracy, 2),\n                                              \"F1\" = round(f1, 2)"], ["| inputlookup ", "_lookup\n                                       | eval Actions=model_name\n                                       | eval test_fraction = 100-training_fraction\n                                       | eval \"Split for training / test\" = if(test_fraction > 0, training_fraction + \" / \" + test_fraction, \"no split\")\n                                       | eval \"Fields to use for predicting\" = features,\n                                              \"Model name\" = model_name,\n                                              \"Search query\" = search_query,\n                                              \"Field to predict\" = target,\n                                              \"Precision\" = round(precision, 2),\n                                              \"Recall\" = round(recall, 2),\n                                              \"Accuracy\" = round(accuracy, 2),\n                                              \"F1\" = round(f1, 2)"]);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

// Classification page script

require(["jquery", "underscore", "splunkjs/mvc", "splunkjs/mvc/dropdownview", "splunkjs/mvc/singleview", "splunkjs/mvc/tableview", "splunkjs/mvc/textinputview", "components/splunk/AlertModal", "components/splunk/EnhancedMultiDropdownView", "components/splunk/Forms", "components/splunk/KVStore", 'components/splunk/ScheduledSearchModal/Master', 'components/splunk/SearchBarWrapper', "components/splunk/Searches", "Options", "components/data/parameters/ColorPalette", "components/data/parameters/ParseSearchParameters", "components/data/serializers/ShowcaseHistorySerializer", "components/controls/AssistantControlsFooter", "components/controls/AssistantPanel/Master", "components/controls/AssistantPanel/Footer", "components/controls/Modal", "components/controls/Slider", "components/controls/DrilldownLinker", "components/controls/Messages", "components/controls/QueryHistoryTable", "components/controls/SearchStringDisplay", "components/controls/Spinners", "components/controls/Tabs", "components/data/formatters/compactTemplateString", "components/data/formatters/getFieldFromData", "components/data/sampleSearches/SampleSearchLoader"], function ($, _, mvc, DropdownView, SingleView, TableView, TextInputView, AlertModal, EnhancedMultiDropdownView, Forms, KVStore, ScheduledSearchModal, SearchBarWrapper, Searches, Options, ColorPalette, ParseSearchParameters, ShowcaseHistorySerializer, AssistantControlsFooter, AssistantPanel, AssistantPanelFooter, Modal, Slider, DrilldownLinker, Messages, QueryHistoryTable, SearchStringDisplay, Spinners, Tabs, compact, getFieldFromData, SampleSearchLoader) {
    // helper variables

    var showcaseName = 'showcase_classification';
    var defaultModelName = Options.getOptionByName('defaultModelName');
    var smallLoaderScale = Options.getOptionByName('smallLoaderScale');
    var dashboardHistoryTablePageSize = Options.getOptionByName("dashboardHistoryTablePageSize", 5);

    var baseSearchString = null;
    var baseTimerange = null;
    var currentSampleSearch = null;
    var isRunning = false;

    var submitButtonText = 'Fit Model';

    var historyCollectionId = showcaseName + "_history";

    var historySerializer = new ShowcaseHistorySerializer(historyCollectionId, {
        // params
        search_query: null,
        earliest_time: null,
        latest_time: null,
        target: null,
        features: null,
        training_fraction: null,
        model_name: null,

        // results
        _time: null,
        precision: null,
        recall: null,
        accuracy: null,
        f1: null
    }, function () {
        Searches.getSearchManager('queryHistorySearch').startSearch();
    });

    // search functions

    function setupSearches() {
        (function setupSearchBarSearch() {
            Searches.setSearch("searchBarSearch", {
                targetJobIdTokenName: "searchBarSearchJobIdToken",
                autostart: false,
                onStartCallback: function onStartCallback() {
                    hideErrorMessage();
                    hidePanels();
                },
                onDoneCallback: function onDoneCallback(searchManager) {
                    hideErrorMessage();
                    DrilldownLinker.setSearchDrilldown(datasetPreviewTable.$el.prev('h3'), searchManager.search);
                },
                onErrorCallback: function onErrorCallback(errorMessage) {
                    Forms.clearChoiceViewOptions(targetVariableControl);
                    showErrorMessage(errorMessage);
                    hidePanels();
                }
            });
        })();

        (function setupTargetVariableSearch() {
            Searches.setSearch("variableSearch", {
                targetJobIdTokenName: 'variableSearchJobIdToken',
                searchString: compact(_templateObject),
                onErrorCallback: function onErrorCallback(errorMessage) {
                    showErrorMessage(errorMessage);
                    hidePanels();
                }
            });
        })();

        (function setupTargetVariableSearch() {
            Searches.setSearch("targetVariableSearch", {
                searchString: compact(_templateObject2),
                onErrorCallback: function onErrorCallback(errorMessage) {
                    showErrorMessage(errorMessage);
                    hidePanels();
                }
            });
        })();

        (function setupFeaturesVariableSearch() {
            Searches.setSearch("featuresVariableSearch", {
                searchString: compact(_templateObject3),
                onErrorCallback: function onErrorCallback(errorMessage) {
                    showErrorMessage(errorMessage);
                    hidePanels();
                }
            });
        })();

        (function setupDataPartitionSearch() {
            Searches.setSearch("dataPartitionSearch", {
                autostart: false,
                targetJobIdTokenName: "dataPartitionSearchJobIdToken",
                searchString: compact(_templateObject4),
                onStartCallback: function onStartCallback() {
                    updateForm(true);
                },
                onDoneCallback: function onDoneCallback() {
                    Searches.getSearchManager('trainingSearch').startSearch();
                },
                onErrorCallback: function onErrorCallback(errorMessage) {
                    updateForm(false);
                    showErrorMessage(errorMessage);
                    hidePanels();
                }
            });
        })();

        (function setupTrainingSearch() {
            var sharedSearchString = '| fit LogisticRegression $classificationTargetToken|s$ from $classificationFeaturesToken$ into $modelNameToken|s$';

            assistantControlsFooter.controls.openInSearchButton.on('click', function () {
                var search = DrilldownLinker.createSearch([baseSearchString, sharedSearchString], baseTimerange);
                window.open(DrilldownLinker.getUrl('search', search), '_blank');
            });

            assistantControlsFooter.controls.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('trainingSearchStringDisplayModal', 'Fit a model on all your data in search', [baseSearchString, sharedSearchString], [null, 'fit and save a model using the entire dataset and provided parameters'], baseTimerange);
            });

            assistantControlsFooter.controls.scheduleButton.on('click', function () {
                var scheduledSearchModal = new ScheduledSearchModal({
                    searchString: Forms.parseTemplate([baseSearchString, sharedSearchString].join('')),
                    earliestTime: baseTimerange.earliest_time,
                    latestTime: baseTimerange.latest_time
                });

                scheduledSearchModal.render().appendTo($('body')).show();
            });

            Searches.setSearch("trainingSearch", {
                targetJobIdTokenName: "trainingJobIdToken",
                autostart: false,
                searchString: compact(_templateObject5, sharedSearchString),
                onStartCallback: function onStartCallback() {
                    hideErrorMessage();
                },
                onDoneCallback: function onDoneCallback() {
                    Searches.getSearchManager('testingSearch').startSearch();
                },
                onErrorCallback: function onErrorCallback(errorMessage) {
                    updateForm(false);
                    showErrorMessage(errorMessage);
                    hidePanels();
                }
            });
        })();

        (function setupTestingSearch() {
            Searches.setSearch("testingSearch", {
                targetJobIdTokenName: "testingJobIdToken",
                autostart: false,
                searchString: compact(_templateObject6),
                onStartCallback: function onStartCallback() {
                    var classificationFeaturesToken = Forms.getToken('classificationFeaturesToken');
                    var features = classificationFeaturesToken.slice(1, classificationFeaturesToken.length - 1).split("\" \"");

                    var searchAttributes = Searches.getSearchManager('searchBarSearch').search.attributes;

                    var testingSearchSid = Searches.getSid(Searches.getSearchManager('testingSearch'));

                    historySerializer.persist(testingSearchSid, {
                        search_query: searchAttributes.search,
                        earliest_time: searchAttributes.earliest_time,
                        latest_time: searchAttributes.latest_time,
                        target: Forms.getToken('classificationTargetToken'),
                        features: features,
                        training_fraction: parseInt(Forms.getToken('trainingSetFractionToken'), 10),
                        model_name: Forms.getToken('modelNameToken'),
                        _time: parseInt(new Date().valueOf() / 1000, 10)
                    });
                },
                onDoneCallback: function onDoneCallback() {
                    showPanels();
                    startPostProcessingSearches();
                },
                onErrorCallback: function onErrorCallback(errorMessage) {
                    showErrorMessage(errorMessage);
                    hidePanels();
                },
                onFinallyCallback: function onFinallyCallback() {
                    updateForm(false);
                }
            });
        })();

        (function setupDataAndPredictionsTableSearch() {
            var sharedSearchArray = ['| table $classificationTargetToken|s$, $classificationPredictionToken|s$, $classificationFeaturesToken$'];

            var dataAndPredictionsTableModal = null;

            var vizQueryArray = [];
            var vizQuerySearch = null;

            dataAndPredictionsPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch), '_blank');
            });

            dataAndPredictionsPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('dataAndPredictionsTableSearchStringDisplayModal', 'Display the actual and predicted values of the "field to predict"', vizQueryArray, [null, "apply the model to the entire dataset to predict \"" + Forms.getToken('classificationTargetToken') + "\""], baseTimerange);
            });

            dataAndPredictionsPanel.scheduleAlertButton.on('click', function () {
                if (dataAndPredictionsTableModal == null) {
                    (function () {
                        dataAndPredictionsTableModal = new Modal('dataAndPredictionsTableModal', {
                            title: 'Schedule an alert',
                            destroyOnHide: false,
                            type: 'wide'
                        });

                        var dataAndPredictionsTableModalBooleanControl = new DropdownView({
                            id: 'dataAndPredictionsTableModalBooleanControl',
                            el: $('<span>'),
                            labelField: 'label',
                            valueField: 'value',
                            showClearButton: false,
                            choices: [{ value: '=', label: 'is any of' }, { value: '!=', label: "isn't any of" }]
                        }).render();

                        var dataAndPredictionsTableModalValueControl = new EnhancedMultiDropdownView({
                            id: 'dataAndPredictionsTableModalValueControl',
                            el: $('<span>'),
                            width: 300,
                            allowCustomValues: true,
                            choices: []
                        }).render();

                        dataAndPredictionsTableModalValueControl.on('change', function () {
                            dataAndPredictionsTableModal.removeAlert();
                            Messages.setFormInputStatus(dataAndPredictionsTableModalValueControl, true);

                            if (Forms.getChoiceViewChoices(dataAndPredictionsTableModalValueControl).length > 0 && Forms.getChoiceViewChoices(dataAndPredictionsTableModalValueControl, true).length === 0) {
                                dataAndPredictionsTableModal.setAlert('Because you have selected all possible values, this alert will trigger whenever any values are predicted.', 'warning');
                            }
                        });

                        dataAndPredictionsTableModal.body.addClass('mlts-modal-form-inline').append($('<p>').text('Alert me when the predicted value '), dataAndPredictionsTableModalBooleanControl.$el, dataAndPredictionsTableModalValueControl.$el);

                        dataAndPredictionsTableModal.footer.append($('<button>').addClass('mlts-modal-cancel').attr({
                            type: 'button',
                            'data-dismiss': 'modal'
                        }).addClass('btn btn-default mlts-modal-cancel').text('Cancel'), $('<button>').attr({
                            type: 'button'
                        }).on('click', function () {
                            dataAndPredictionsTableModal.removeAlert();

                            var predictedValues = dataAndPredictionsTableModalValueControl.val();

                            var isValid = predictedValues.length > 0;

                            Messages.setFormInputStatus(dataAndPredictionsTableModalValueControl, isValid);

                            if (isValid) {
                                (function () {
                                    var equalityChecker = dataAndPredictionsTableModalBooleanControl.val();
                                    var combiner = equalityChecker === '=' ? 'OR' : 'AND';

                                    var alertCondition = '| where ' + predictedValues.map(function (value) {
                                        return "'$classificationPredictionToken$' " + equalityChecker + " \"" + value + "\"";
                                    }).join(" " + combiner + " ");

                                    var searchString = Forms.parseTemplate(baseSearchString + '| apply $modelNameToken|s$' + alertCondition);

                                    dataAndPredictionsTableModal.hide();

                                    var alertModal = new AlertModal({
                                        searchString: searchString
                                    });

                                    alertModal.render().appendTo($('body')).show();
                                })();
                            } else {
                                dataAndPredictionsTableModal.setAlert('You must select at least one value.');
                            }
                        }).addClass('btn btn-primary mlts-modal-submit').text('Next'));

                        dataAndPredictionsTableModal.$el.on('show.bs.modal', function () {
                            Messages.setFormInputStatus(dataAndPredictionsTableModalValueControl, true);
                            dataAndPredictionsTableModal.removeAlert();

                            dataAndPredictionsTableModalBooleanControl.val('=');
                            dataAndPredictionsTableModalValueControl.val([]);

                            dataAndPredictionsTableModalValueControl.settings.set('choices', []);

                            Searches.getSearchResults('dataPartitionSearch').on('data', function (searchResults, data) {
                                var predictedFieldIndex = data.fields.indexOf(Forms.getToken('classificationTargetToken'));

                                if (predictedFieldIndex > -1) {
                                    var choices = _.uniq(data.rows.map(function (row) {
                                        return row[predictedFieldIndex];
                                    })).map(function (choice) {
                                        return { value: choice };
                                    });
                                    dataAndPredictionsTableModalValueControl.settings.set('choices', choices);
                                }
                            });
                        });
                    })();
                }

                dataAndPredictionsTableModal.show();
            });

            Searches.setSearch('dataAndPredictionsTableSearch', {
                targetJobIdTokenName: 'dataAndPredictionsTableToken',
                autostart: false,
                searchString: ['| loadjob $testingJobIdToken$'].concat(sharedSearchArray),
                onStartCallback: function onStartCallback() {
                    vizQueryArray = [baseSearchString, '| apply $modelNameToken|s$'].concat(sharedSearchArray);
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(dataAndPredictionsPanel.title, vizQuerySearch);
                }
            });
        })();

        (function setupConfusionMatrixTableSearch() {
            var sharedSearchArray = ['| `confusionmatrix($classificationTargetToken|s$,$classificationPredictionToken|s$)`'];

            var vizQueryArray = [];
            var vizQuerySearch = null;

            confusionMatrixPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch), '_blank');
            });

            confusionMatrixPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('confusionMatrixTableSearchStringDisplayModal', 'Display classification results in a confusion matrix', vizQueryArray, [null, "apply the model to the entire dataset to predict \"" + Forms.getToken('classificationTargetToken') + "\"", 'use the `confusionmatrix` macro to show prediction results for each class'], baseTimerange);
            });

            Searches.setSearch("confusionMatrixTableSearch", {
                searchString: ['| loadjob $testingJobIdToken$'].concat(sharedSearchArray),
                autostart: false,
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay(confusionMatrixPanel.viz.$el);

                    vizQueryArray = [baseSearchString, '| apply $modelNameToken|s$'].concat(sharedSearchArray);
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(confusionMatrixPanel.title, vizQuerySearch);
                },
                onFinallyCallback: function onFinallyCallback() {
                    Spinners.hideLoadingOverlay(confusionMatrixPanel.viz.$el);
                }
            });
        })();

        (function setupClassificationstatisticsSearch() {
            var sharedSearchArray = ['| `classificationstatistics($classificationTargetToken|s$, $classificationPredictionToken|s$)`'];

            var vizQueryArray = [];
            var vizQuerySearch = null;

            classificationstatisticsPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch), '_blank');
            });

            classificationstatisticsPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('classificationstatisticsSearchStringDisplayModal', 'Compute precision, recall, accuracy, and F1', vizQueryArray, [null, "apply the model to the entire dataset to predict \"" + Forms.getToken('classificationTargetToken') + "\"", 'use the `classificationstatistics` macro to compute precision, recall, accuracy, and F1'], baseTimerange);
            });

            Searches.setSearch("classificationstatisticsSearch", {
                searchString: ['| loadjob $testingJobIdToken$'].concat(sharedSearchArray),
                autostart: false,
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay([precisionStatisticPanel.viz.$el, recallStatisticPanel.viz.$el, accuracyStatisticPanel.viz.$el, fOneStatisticPanel.viz.$el], smallLoaderScale);

                    vizQueryArray = [baseSearchString, '| apply $modelNameToken|s$'].concat(sharedSearchArray);
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(precisionStatisticPanel.title, vizQuerySearch);
                    DrilldownLinker.setSearchDrilldown(recallStatisticPanel.title, vizQuerySearch);
                    DrilldownLinker.setSearchDrilldown(accuracyStatisticPanel.title, vizQuerySearch);
                    DrilldownLinker.setSearchDrilldown(fOneStatisticPanel.title, vizQuerySearch);
                },
                onDataCallback: function onDataCallback(data) {
                    var evaluationStatistics = {
                        precision: 0,
                        recall: 0,
                        accuracy: 0,
                        f1: 0
                    };

                    if (data.fields != null && data.rows != null && data.rows.length > 0) {
                        Object.keys(evaluationStatistics).forEach(function (key) {
                            var fieldValue = parseFloat(getFieldFromData(data, key)[0]);
                            if (!isNaN(fieldValue)) {
                                evaluationStatistics[key] = fieldValue;
                            }
                        });
                    }

                    var testingSearchSid = Searches.getSid(Searches.getSearchManager('testingSearch'));

                    historySerializer.persist(testingSearchSid, {
                        precision: evaluationStatistics.precision,
                        recall: evaluationStatistics.recall,
                        accuracy: evaluationStatistics.accuracy,
                        f1: evaluationStatistics.f1
                    });
                },
                onFinallyCallback: function onFinallyCallback() {
                    Spinners.hideLoadingOverlay([precisionStatisticPanel.viz.$el, recallStatisticPanel.viz.$el, accuracyStatisticPanel.viz.$el, fOneStatisticPanel.viz.$el]);
                }
            });
        })();
    }

    function startPostProcessingSearches() {
        Searches.startSearch('dataAndPredictionsTableSearch');
        Searches.startSearch('confusionMatrixTableSearch');
        Searches.startSearch('classificationstatisticsSearch');
    }

    (function () {
        Searches.setSearch('queryHistorySearch', {
            searchString: compact(_templateObject7, showcaseName)
        });
    })();

    var searchBarControl = function () {
        return new SearchBarWrapper({
            "id": "searchBarControl",
            "managerid": "searchBarSearch",
            "el": $("#searchBarControl"),
            "autoOpenAssistant": false
        }, {
            "id": "searchControlsControl",
            "managerid": "searchBarSearch",
            "el": $("#searchControlsControl")
        }, function () {
            Forms.clearChoiceView(targetVariableControl, true);
            Forms.clearChoiceView(featuresVariableControl, true);

            Forms.unsetToken('classificationTargetToken', 'classificationFeaturesToken', 'classificationPredictionToken');

            var searchBarSearch = Searches.getSearchManager("searchBarSearch");

            baseSearchString = this.searchBarView.val();
            baseTimerange = this.searchBarView.timerange.val();

            searchBarSearch.settings.unset("search");
            searchBarSearch.settings.set("search", baseSearchString);
            searchBarSearch.search.set(baseTimerange);

            updateForm();

            searchBarSearch.startSearch();
        });
    }();

    var tabsControl = function () {
        return new Tabs($('#dashboard-form-tabs'), $('#dashboard-form-controls'));
    }();

    var targetVariableControl = function () {
        var targetVariableControl = new DropdownView({
            "id": "targetVariableControl",
            "managerid": "targetVariableSearch",
            "el": $("#targetVariableControl"),
            "labelField": "column",
            "valueField": "column",
            showClearButton: false
        });

        targetVariableControl.on("datachange", function () {
            if (currentSampleSearch != null) {
                var targetVariable = currentSampleSearch.targetVariable;
                var choices = Forms.getChoiceViewChoices(targetVariableControl);

                if (choices.indexOf(targetVariable) >= 0) targetVariableControl.val(targetVariable);
            }
        });

        targetVariableControl.on("change", function () {
            Forms.unsetToken(['classificationFeaturesToken', 'classificationTargetToken', 'classificationPredictionToken']);
            Forms.clearChoiceView(featuresVariableControl);

            var value = targetVariableControl.val();

            if (value != null && value.length > 0) {
                Forms.setToken("classificationTargetToken", value);
                Forms.setToken("classificationPredictionToken", "predicted(" + value + ")");
            }

            updateForm();
        });

        targetVariableControl.render();

        return targetVariableControl;
    }();

    var featuresVariableControl = function () {
        var featuresVariableControl = new EnhancedMultiDropdownView({
            "id": "featuresVariableControl",
            "managerid": "featuresVariableSearch",
            "el": $("#featuresVariableControl"),
            "labelField": "column",
            "valueField": "column",
            "width": 400,
            allowCustomValues: true
        });

        featuresVariableControl.on("datachange", function () {
            if (currentSampleSearch != null) {
                var choices = Forms.getChoiceViewChoices(featuresVariableControl);
                var validChoices = Forms.intersect(choices, currentSampleSearch.featuresVariables, true);

                featuresVariableControl.val(validChoices);

                if (currentSampleSearch.autostart !== false) {
                    assistantControlsFooter.controls.submitButton.trigger("submit");
                } else {
                    // if the sample search isn't auto-running, we want to remove it since it's no longer relevant
                    currentSampleSearch = null;
                }
            }
        });

        featuresVariableControl.on("change", function () {
            var values = featuresVariableControl.val();

            if (values != null && values.length > 0) {
                Forms.setToken("classificationFeaturesToken", "\"" + values.join('" "') + "\"");
            } else {
                Forms.unsetToken("classificationFeaturesToken");
            }

            updateForm();
        });

        featuresVariableControl.render();

        return featuresVariableControl;
    }();

    var trainingSetFractionSlider = function () {
        var slider$El = $("#trainingSetFractionSlider");
        var sliderValue$El = $("#trainingSetFractionSliderValue");

        function updateTrainingSetFractionSlider(trainingFraction) {
            var testFraction = 100 - trainingFraction;
            sliderValue$El.text(testFraction > 0 ? trainingFraction + " / " + testFraction : 'no split');
        }

        return new Slider(slider$El, 10, 100, 0, 10, function (value) {
            updateTrainingSetFractionSlider(value);
        }, function (value) {
            Forms.setToken('trainingSetFractionToken', value);
            // allow the training test/split to be 100-0, which causes the same dataset to be used for both training and test
            Forms.setToken('testSetFractionToken', value === 100 ? 0 : value);

            updateTrainingSetFractionSlider(value);
        });
    }();

    var updateForm = function updateForm(newIsRunningValue) {
        // optionally set a new value for isRunning
        if (newIsRunningValue != null) isRunning = newIsRunningValue;

        targetVariableControl.settings.set('disabled', isRunning);
        featuresVariableControl.settings.set('disabled', isRunning);
        trainingSetFractionSlider.setDisabled(isRunning);
        modelNameInputControl.settings.set('disabled', isRunning);

        if (isRunning) {
            assistantControlsFooter.setDisabled(true);
            assistantControlsFooter.controls.submitButton.text('Fitting Model...');
        } else {
            var classificationTargetToken = Forms.getToken('classificationTargetToken');
            var classificationFeaturesToken = Forms.getToken('classificationFeaturesToken');
            var fieldsValid = classificationTargetToken != null && classificationTargetToken.length > 0 && classificationFeaturesToken != null && classificationFeaturesToken.length > 0;

            assistantControlsFooter.setDisabled(!fieldsValid);
            assistantControlsFooter.controls.submitButton.text(submitButtonText);
        }
    };

    var assistantControlsFooter = function () {
        var assistantControlsFooter = new AssistantControlsFooter($('#assistantControlsFooter'), submitButtonText, true);

        assistantControlsFooter.controls.submitButton.on('submit', function () {
            submitForm();
        });

        return assistantControlsFooter;
    }();

    var queryHistoryPanel = new QueryHistoryTable($('#queryHistoryPanel'), 'queryHistorySearch', historyCollectionId, ['Actions', '_time', 'Search query', 'Field to predict', 'Fields to use for predicting', 'Split for training / test', 'Model name', 'Precision', 'Recall', 'Accuracy', 'F1'], submitButtonText, function (params, autostart) {
        var sampleSearch = {
            value: params.data['row.search_query'],
            targetVariable: params.data['row.target'],
            featuresVariables: typeof params.data['row.features'] === 'string' ? [params.data['row.features']] : params.data['row.features'],
            modelName: params.data['row.model_name'],
            trainingFraction: params.data['row.training_fraction'],
            autostart: autostart,
            earliestTime: params.data['row.earliest_time'],
            latestTime: params.data['row.latest_time']
        };

        setCurrentSampleSearch(sampleSearch);
        tabsControl.activate('newModel');
    });

    var modelNameInputControl = function () {
        var modelNameInputControl = new TextInputView({
            id: 'modelNameInputControl',
            el: $('#modelNameInputControl')
        }).render();

        modelNameInputControl.on('change', function () {
            var modelName = modelNameInputControl.val(); // intentionally not using arguments due to synthetic "change" events
            Forms.setToken('modelNameToken', modelName == null || modelName.length === 0 ? defaultModelName : modelName);
        });

        // make sure modelNameToken is initialized
        modelNameInputControl.trigger('change');

        var modelNameInputControl$El = modelNameInputControl.$el.children('input[type="text"]');

        modelNameInputControl$El.attr('placeholder', '(optional)');

        modelNameInputControl$El.on('keyup', function (event) {
            if (event.keyCode === 13) submitForm();
        });

        return modelNameInputControl;
    }();

    function submitForm() {
        if (!assistantControlsFooter.getDisabled()) {
            currentSampleSearch = null;

            hideErrorMessage();
            hidePanels();

            // start with the dataPartitionSearch because we need to partition the data before we can use it to fit
            Searches.getSearchManager('dataPartitionSearch').startSearch();
        }
    }

    function setCurrentSampleSearch(sampleSearch) {
        currentSampleSearch = _.extend({}, {
            trainingFraction: 50
        }, sampleSearch);

        if (currentSampleSearch.modelName != null) modelNameInputControl.val(currentSampleSearch.modelName);

        searchBarControl.setProperties(sampleSearch.value, sampleSearch.earliestTime, sampleSearch.latestTime);

        trainingSetFractionSlider.val(currentSampleSearch.trainingFraction);
    }

    function hidePanels() {
        Forms.unsetToken("showResultPanelsToken");
    }

    function showPanels() {
        Forms.setToken("showResultPanelsToken", true);
    }

    function showErrorMessage(errorMessage) {
        var errorDisplay$El = $("#errorDisplay");
        Messages.setAlert(errorDisplay$El, errorMessage, undefined, undefined, true);
    }

    function hideErrorMessage() {
        var errorDisplay$El = $("#errorDisplay");
        Messages.removeAlert(errorDisplay$El, true);
    }

    // panel renderers

    var datasetPreviewTable = function () {
        return new TableView({
            id: 'datasetPreviewTable',
            el: $('#datasetPreviewPanel'),
            managerid: 'searchBarSearch'
        }).render();
    }();

    var dataAndPredictionsPanel = function () {
        var assistantPanel = new AssistantPanel($('#dataAndPredictionsPanel'), 'Prediction Results', TableView, {
            id: 'dataAndPredictionsTable',
            managerid: 'dataAndPredictionsTableSearch',
            drilldown: 'none'
        }, { footerButtons: { scheduleAlertButton: true } });

        var nonMatchingColor = ColorPalette.getColorByIndex(1);

        // set a custom color for the cells if the actual and predicted value don't match
        assistantPanel.viz.on('rendered', function () {
            var tableRows = assistantPanel.viz.$el.find('tbody').find('tr');

            tableRows.each(function () {
                var confusionMatrixRowCells$El = $(this).children();

                var actualCell = $(confusionMatrixRowCells$El.get(0));
                var predictedCell = $(confusionMatrixRowCells$El.get(1));

                if (actualCell.text() !== predictedCell.text()) {
                    actualCell.css('background-color', nonMatchingColor);
                    predictedCell.css('background-color', nonMatchingColor);
                }
            });
        });

        return assistantPanel;
    }();

    var classificationstatisticsPanel = function () {
        return new AssistantPanelFooter($('#classificationstatisticsPanel'));
    }();

    var precisionStatisticPanel = function () {
        return new AssistantPanel($('#precisionStatisticPanel'), 'Precision', SingleView, {
            id: 'precisionStatisticViz',
            managerid: 'classificationstatisticsSearch',
            field: 'precision',
            numberPrecision: '0.00',
            height: 30
        }, {
            panelWrapper: false,
            footerButtons: false
        });
    }();

    var recallStatisticPanel = function () {
        return new AssistantPanel($('#recallStatisticPanel'), 'Recall', SingleView, {
            id: 'recallStatisticViz',
            managerid: 'classificationstatisticsSearch',
            field: 'recall',
            numberPrecision: '0.00',
            height: 30
        }, {
            panelWrapper: false,
            footerButtons: false
        });
    }();

    var accuracyStatisticPanel = function () {
        return new AssistantPanel($('#accuracyStatisticPanel'), 'Accuracy', SingleView, {
            id: 'accuracyStatisticViz',
            managerid: 'classificationstatisticsSearch',
            field: 'accuracy',
            numberPrecision: '0.00',
            height: 30
        }, {
            panelWrapper: false,
            footerButtons: false
        });
    }();

    var fOneStatisticPanel = function () {
        return new AssistantPanel($('#fOneStatisticPanel'), 'F1', SingleView, {
            id: 'fOneStatisticViz',
            managerid: 'classificationstatisticsSearch',
            field: 'f1',
            numberPrecision: '0.00',
            height: 30
        }, {
            panelWrapper: false,
            footerButtons: false
        });
    }();

    var confusionMatrixPanel = function () {
        var assistantPanel = new AssistantPanel($('#confusionMatrixPanel'), 'Classification Results (Confusion Matrix)', TableView, {
            id: 'confusionMatrixTable',
            managerid: 'confusionMatrixTableSearch',
            drilldown: 'none'
        });

        assistantPanel.viz.on('rendered', function () {
            var tableRows = assistantPanel.viz.$el.find('tbody').find('tr');

            tableRows.each(function () {
                var confusionMatrixRowCells$El = $(this).children();

                var rowTotal = 0;
                var parsedValues = [];

                // collect the combines value of the cells in each row
                confusionMatrixRowCells$El.each(function (cellIndex) {
                    if (cellIndex > 0) {
                        var cell$El = $(this);
                        var cellValue = parseInt(cell$El.text());

                        rowTotal += cellValue;
                        parsedValues[cellIndex] = cellValue;
                    }
                });

                // decorate each cell with the percentage of the total
                confusionMatrixRowCells$El.each(function (cellIndex) {
                    var cellValue = parsedValues[cellIndex];

                    if (cellIndex > 0 && rowTotal > 0 && !isNaN(cellValue)) {
                        var cell$El = $(this);
                        var percentage = cellValue / rowTotal;

                        cell$El.css("background-color", ColorPalette.getGradientColor(37, 36, percentage));
                        cell$El.text(cellValue + " (" + Math.round(percentage * 1000) / 10 + "%)");
                    }
                });
            });
        });

        return assistantPanel;
    }();

    // start searches
    setupSearches();

    // load canned searches from URL bar parameters
    (function setInputs() {
        var searchParams = ParseSearchParameters(showcaseName);

        if (searchParams.mlToolkitDataset != null) {
            SampleSearchLoader.getSampleSearchByLabel(searchParams.mlToolkitDataset).then(setCurrentSampleSearch);
        } else {
            setCurrentSampleSearch(searchParams);
        }
    })();

    // disable the form on initial load
    setTimeout(updateForm, 0);
});