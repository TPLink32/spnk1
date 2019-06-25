"use strict";

var _templateObject = _taggedTemplateLiteral(["| loadjob $searchBarSearchJobIdToken$,\n                                       | head 1\n                                       | transpose\n                                       | fields column"], ["| loadjob $searchBarSearchJobIdToken$,\n                                       | head 1\n                                       | transpose\n                                       | fields column"]),
    _templateObject2 = _taggedTemplateLiteral(["| loadjob $variableSearchJobIdToken$\n                                       | search column != \"column\" AND column != \"_*\""], ["| loadjob $variableSearchJobIdToken$\n                                       | search column != \"column\" AND column != \"_*\""]),
    _templateObject3 = _taggedTemplateLiteral(["| loadjob $variableSearchJobIdToken$\n                                       | search column != \"column\" AND column != $regressionTargetToken|s$ AND (column != \"_*\" OR column = \"_time\")"], ["| loadjob $variableSearchJobIdToken$\n                                       | search column != \"column\" AND column != $regressionTargetToken|s$ AND (column != \"_*\" OR column = \"_time\")"]),
    _templateObject4 = _taggedTemplateLiteral(["| loadjob $searchBarSearchJobIdToken$\n                                       | sample partitions=100"], ["| loadjob $searchBarSearchJobIdToken$\n                                       | sample partitions=100"]),
    _templateObject5 = _taggedTemplateLiteral(["| loadjob $dataPartitionJobIdToken$\n                                       | search partition_number < $trainingSetFractionToken$\n                                       | fields - partition_number\n                                       ", ""], ["| loadjob $dataPartitionJobIdToken$\n                                       | search partition_number < $trainingSetFractionToken$\n                                       | fields - partition_number\n                                       ", ""]),
    _templateObject6 = _taggedTemplateLiteral(["| loadjob $dataPartitionJobIdToken$\n                                       | search partition_number >= $testSetFractionToken$\n                                       | fields - partition_number\n                                       | apply $modelNameToken|s$"], ["| loadjob $dataPartitionJobIdToken$\n                                       | search partition_number >= $testSetFractionToken$\n                                       | fields - partition_number\n                                       | apply $modelNameToken|s$"]),
    _templateObject7 = _taggedTemplateLiteral(["| where '$regressionPredictionToken$' ", " ", " \n                                                        ", " $regressionPredictionToken|s$ ", " ", ""], ["| where '$regressionPredictionToken$' ", " ", " \n                                                        ", " $regressionPredictionToken|s$ ", " ", ""]),
    _templateObject8 = _taggedTemplateLiteral(["| loadjob $testingJobIdToken$ ", ""], ["| loadjob $testingJobIdToken$ ", ""]),
    _templateObject9 = _taggedTemplateLiteral(["| inputlookup ", "_lookup\n                                       | eval Actions=model_name\n                                       | eval test_fraction = 100-training_fraction\n                                       | eval \"Split for training / test\" = if(test_fraction > 0, training_fraction + \" / \" + test_fraction, \"no split\")\n                                       | eval \"Fields to use for predicting\" = features,\n                                              \"Model name\" = model_name,\n                                              \"Search query\" = search_query,\n                                              \"Field to predict\" = target,\n                                              \"R² Statistic\" = round(r_squared, 4),\n                                              \"RMSE\" = round(rmse, 2)"], ["| inputlookup ", "_lookup\n                                       | eval Actions=model_name\n                                       | eval test_fraction = 100-training_fraction\n                                       | eval \"Split for training / test\" = if(test_fraction > 0, training_fraction + \" / \" + test_fraction, \"no split\")\n                                       | eval \"Fields to use for predicting\" = features,\n                                              \"Model name\" = model_name,\n                                              \"Search query\" = search_query,\n                                              \"Field to predict\" = target,\n                                              \"R² Statistic\" = round(r_squared, 4),\n                                              \"RMSE\" = round(rmse, 2)"]),
    _templateObject10 = _taggedTemplateLiteral(["", "\n                                          | apply $modelNameToken|s$\n                                          | search $regressionTargetToken|s$=", " $regressionPredictionToken|s$=", ""], ["", "\n                                          | apply $modelNameToken|s$\n                                          | search $regressionTargetToken|s$=", " $regressionPredictionToken|s$=", ""]);

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

// Linear Regression page script
require(["jquery", "underscore", "splunkjs/mvc/dropdownview", "splunkjs/mvc/singleview", "splunkjs/mvc/tableview", "splunkjs/mvc/textinputview", "splunkjs/mvc/visualizationregistry", "components/splunk/AlertModal", "components/splunk/EnhancedMultiDropdownView", "components/splunk/Forms", 'components/splunk/ScheduledSearchModal/Master', 'components/splunk/SearchBarWrapper', "components/splunk/Searches", 'components/splunk/KVStore', "Options", "components/data/formatters/getFieldFromData", "components/data/formatters/compactTemplateString", "components/data/parameters/ParseSearchParameters", "components/data/serializers/ShowcaseHistorySerializer", "components/controls/AssistantControlsFooter", "components/controls/AssistantPanel/Master", "components/controls/AssistantPanel/Footer", "components/controls/Slider", "components/controls/DrilldownLinker", "components/controls/Messages", "components/controls/Modal", "components/controls/QueryHistoryTable", "components/controls/SearchStringDisplay", "components/controls/Spinners", "components/controls/Tabs", "components/data/sampleSearches/SampleSearchLoader", "components/data/validators/NumberValidator"], function ($, _, DropdownView, SingleView, TableView, TextInputView, VisualizationRegistry, AlertModal, EnhancedMultiDropdownView, Forms, ScheduledSearchModal, SearchBarWrapper, Searches, KVStore, Options, getFieldFromData, compact, ParseSearchParameters, ShowcaseHistorySerializer, AssistantControlsFooter, AssistantPanel, AssistantPanelFooter, Slider, DrilldownLinker, Messages, Modal, QueryHistoryTable, SearchStringDisplay, Spinners, Tabs, SampleSearchLoader, NumberValidator) {
    // helper variables

    var showcaseName = 'showcase_linear_regression';
    var appName = Options.getOptionByName('appName');
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
        r_squared: null,
        rmse: null
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

        (function setupVariableSearch() {
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
                targetJobIdTokenName: "dataPartitionJobIdToken",
                autostart: false,
                searchString: compact(_templateObject4),
                onStartCallback: function onStartCallback() {
                    hideErrorMessage();
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
            var sharedSearchString = '| fit LinearRegression $regressionTargetToken|s$ from $regressionFeaturesToken$ into $modelNameToken|s$';

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
                onStartCallback: function onStartCallback(searchManager) {
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
                    var regressionFeaturesToken = Forms.getToken('regressionFeaturesToken');
                    var features = regressionFeaturesToken.slice(1, regressionFeaturesToken.length - 1).split("\" \"");

                    var testingSearchId = Searches.getSid('testingSearch');

                    historySerializer.persist(testingSearchId, {
                        search_query: baseSearchString,
                        earliest_time: baseTimerange.earliest_time,
                        latest_time: baseTimerange.latest_time,
                        target: Forms.getToken('regressionTargetToken'),
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
            var sharedSearchArray = ["| eval $regressionPredictionToken$ = round('$regressionPredictionToken$', 2)", "| eval residual = '$regressionTargetToken$' - '$regressionPredictionToken$'", '| table $regressionTargetToken|s$, $regressionPredictionToken|s$, residual, $regressionFeaturesToken$'];

            var dataAndPredictionsTableModal = null;

            var vizQueryArray = [];
            var vizQuerySearch = null;

            dataAndPredictionsPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch), '_blank');
            });

            dataAndPredictionsPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('dataAndPredictionsTableSearchStringDisplayModal', 'Display the actual and predicted values of the "field to predict"', vizQueryArray, [null, "apply the model to the entire dataset to predict \"" + Forms.getToken('regressionTargetToken') + "\"", null, 'calculate the prediction error'], baseTimerange);
            });

            dataAndPredictionsPanel.scheduleAlertButton.on('click', function () {
                if (dataAndPredictionsTableModal == null) {
                    (function () {
                        dataAndPredictionsTableModal = new Modal('dataAndPredictionsTableModal', {
                            title: 'Schedule an alert',
                            destroyOnHide: false,
                            type: 'wide'
                        });

                        var valueRangeDropdownControl = new DropdownView({
                            id: "valueRangeDropdownControl",
                            el: $('<span>'),
                            showClearButton: false,
                            choices: [{ label: 'greater than', value: '>' }, { label: 'less than', value: '<' }, { label: 'between', value: '> AND <' }, { label: 'not between', value: '< OR >' }]
                        }).render();

                        var firstValueControl = new TextInputView({
                            id: 'firstValueControl',
                            el: $('<span>')
                        }).render();

                        var secondValueControl = new TextInputView({
                            id: 'secondValueControl',
                            el: $('<span>')
                        }).render();

                        valueRangeDropdownControl.on('change', function (value) {
                            if (value === '>' || value === '<') {
                                firstValueControl.$el.nextAll().hide();
                            } else {
                                firstValueControl.$el.nextAll().show();
                            }
                        });

                        dataAndPredictionsTableModal.body.addClass('mlts-modal-form-inline').append($('<p>').text('Alert me when the predicted value is'), valueRangeDropdownControl.$el, firstValueControl.$el, $('<p>').text('and'), secondValueControl.$el);

                        dataAndPredictionsTableModal.footer.append($('<button>').addClass('mlts-modal-cancel').attr({
                            type: 'button',
                            'data-dismiss': 'modal'
                        }).addClass('btn btn-default mlts-modal-cancel').text('Cancel'), $('<button>').attr({
                            type: 'button'
                        }).on('click', function () {
                            dataAndPredictionsTableModal.removeAlert();

                            var valueRange = valueRangeDropdownControl.val();

                            var searchString = '';

                            var validationOptions = { allowFloats: true };

                            var firstValue = firstValueControl.val();
                            var isValid = NumberValidator.validate(firstValue, validationOptions);

                            Messages.setFormInputStatus(firstValueControl, isValid);

                            if (valueRange === '>' || valueRange === '<') {
                                searchString = "| where '$regressionPredictionToken$' " + valueRange + " " + firstValue;
                            } else if (valueRange === '> AND <' || valueRange === '< OR >') {
                                var secondValue = secondValueControl.val();
                                var secondValueValid = NumberValidator.validate(secondValue, validationOptions);

                                Messages.setFormInputStatus(secondValueControl, secondValueValid);

                                isValid = isValid && secondValueValid;

                                // split valueRange into three parts
                                valueRange = valueRange.split(' ');

                                // build a search by substituting the values of the two inputs between the valueRange parts
                                // Math.min and Math.max ensure that "between 5 and 0" is parsed as "between 0 and 5"
                                // ex. where [PREDICTED] [>] [X] [AND] [PREDICTED] [<] [Y]
                                searchString = compact(_templateObject7, valueRange[0], Math.min(firstValue, secondValue), valueRange[1], valueRange[2], Math.max(firstValue, secondValue));
                            }

                            if (searchString.length > 0) {
                                if (isValid) {
                                    searchString = Forms.parseTemplate(vizQueryArray.concat([searchString]).join(' '));

                                    dataAndPredictionsTableModal.hide();

                                    var alertModal = new AlertModal({
                                        searchString: searchString
                                    });

                                    alertModal.render().appendTo($('body')).show();
                                } else {
                                    dataAndPredictionsTableModal.setAlert('Predicted value must be a number.');
                                }
                            }
                        }).addClass('btn btn-primary mlts-modal-submit').text('Next'));

                        dataAndPredictionsTableModal.$el.on('show.bs.modal', function () {
                            dataAndPredictionsTableModal.removeAlert();
                            Messages.setFormInputStatus([firstValueControl, secondValueControl], true);

                            valueRangeDropdownControl.val('>');
                            firstValueControl.val(0);
                            secondValueControl.val(0);
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

        (function setupActualVsPredictedScatterPlotSearch() {
            var sharedSearchArray = ['| table $regressionTargetToken|s$ $regressionPredictionToken|s$'];

            var vizQueryArray = [];
            var vizQuerySearch = null;

            var vizOptions = DrilldownLinker.parseVizOptions({
                category: 'custom',
                type: appName + ".ScatterLineViz"
            });

            actualVsPredictedScatterLinePanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch, vizOptions), '_blank');
            });

            actualVsPredictedScatterLinePanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('actualVsPredictedScatterSearchStringDisplayModal', 'Plot actual vs. predicted values on a scatter chart', vizQueryArray, [null, "apply the model to the entire dataset to predict \"" + Forms.getToken('regressionTargetToken') + "\""], baseTimerange, vizOptions);
            });

            Searches.setSearch("actualVsPredictedScatterPlotSearch", {
                searchString: ['| loadjob $testingJobIdToken$'].concat(sharedSearchArray),
                autostart: false,
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay(actualVsPredictedScatterLinePanel.viz.$el);

                    vizQueryArray = [baseSearchString, '| apply $modelNameToken|s$'].concat(sharedSearchArray);
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(actualVsPredictedScatterLinePanel.title, vizQuerySearch, vizOptions);
                },
                onFinallyCallback: function onFinallyCallback() {
                    Spinners.hideLoadingOverlay(actualVsPredictedScatterLinePanel.viz.$el);
                }
            });
        })();

        (function setupActualVsPredictedAndResidualSearch() {
            var sharedSearchArray = ["| eval residual = '$regressionTargetToken$' - '$regressionPredictionToken$'", '| table _time, $regressionTargetToken|s$, $regressionPredictionToken|s$, residual', '$actualVsPredictedSortByToken$'];

            Searches.setSearch("actualVsPredictedAndResidualSearch", {
                searchString: ['| loadjob $testingJobIdToken$'].concat(sharedSearchArray),
                autostart: false,
                targetJobIdTokenName: 'actualVsPredictedAndResidualToken',
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay([actualVsPredictedLinesPanel.viz.$el, residualsLinePanel.viz.$el]);
                },
                onDoneCallback: function onDoneCallback() {
                    Searches.getSearchManager('actualVsPredictedLinesPlotSearch').startSearch();
                    Searches.getSearchManager('residualsLinePlotSearch').startSearch();
                },
                onErrorCallback: function onErrorCallback() {
                    Spinners.hideLoadingOverlay([actualVsPredictedLinesPanel.viz.$el, residualsLinePanel.viz.$el]);
                }
            });
        })();

        (function setupActualVsPredictedLinesPlotSearch() {
            var vizQueryArray = [];
            var vizQuerySearch = null;

            var vizOptions = DrilldownLinker.parseVizOptions({
                category: 'custom',
                type: appName + ".LinesViz"
            });

            actualVsPredictedLinesPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch, vizOptions), '_blank');
            });

            actualVsPredictedLinesPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('actualVsPredictedLinesSearchStringDisplayModal', 'Plot actual vs. predicted values on a line chart', vizQueryArray, [null, "apply the model to the entire dataset to predict \"" + Forms.getToken('regressionTargetToken') + "\"", 'select the fields to plot'], baseTimerange, vizOptions);
            });

            Searches.setSearch("actualVsPredictedLinesPlotSearch", {
                searchString: ['| loadjob $actualVsPredictedAndResidualToken$', '$actualVsPredictedSortByEvalToken$', '| table _time, $regressionTargetToken|s$, $regressionPredictionToken|s$, _sortBy'],
                autostart: false,
                onStartCallback: function onStartCallback() {
                    vizQueryArray = [baseSearchString, '| apply $modelNameToken|s$', '| table _time, $regressionTargetToken|s$, $regressionPredictionToken|s$'];
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(actualVsPredictedLinesPanel.title, vizQuerySearch, vizOptions);
                },
                onFinallyCallback: function onFinallyCallback() {
                    Spinners.hideLoadingOverlay(actualVsPredictedLinesPanel.viz.$el);
                }
            });
        })();

        (function setupResidualsLinePlotSearch() {
            var sharedSearchArray = ['| table _time, residual'];

            var vizQueryArray = [];
            var vizQuerySearch = null;

            var vizOptions = DrilldownLinker.parseVizOptions({
                category: 'custom',
                type: appName + ".LinesViz"
            });

            residualsLinePanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch, vizOptions), '_blank');
            });

            residualsLinePanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('residualsLineSearchStringDisplayModal', 'Plot prediction errors on a line chart', vizQueryArray, [null, "apply the model to the entire dataset to predict \"" + Forms.getToken('regressionTargetToken') + "\"", 'calculate the prediction error'], baseTimerange, vizOptions);
            });

            Searches.setSearch("residualsLinePlotSearch", {
                searchString: ['| loadjob $actualVsPredictedAndResidualToken$'].concat(sharedSearchArray),
                autostart: false,
                onStartCallback: function onStartCallback() {
                    vizQueryArray = [baseSearchString, '| apply $modelNameToken|s$', "| eval residual = '$regressionTargetToken$' - '$regressionPredictionToken$'"].concat(sharedSearchArray);

                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(residualsLinePanel.title, vizQuerySearch, vizOptions);
                },
                onFinallyCallback: function onFinallyCallback() {
                    Spinners.hideLoadingOverlay(residualsLinePanel.viz.$el);
                }
            });
        })();

        (function setupResidualsHistogramPlotSearch() {
            var sharedSearchArray = ["| eval residual = '$regressionTargetToken$' - '$regressionPredictionToken$'", '| `histogram(residual, 100)`', '| rename count as "Sample Count", residual as "Residual Error"'];

            var vizQueryArray = [];
            var vizQuerySearch = null;

            var vizOptions = DrilldownLinker.parseVizOptions({
                category: 'custom',
                type: appName + ".HistogramViz"
            });

            residualsHistogramPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch, vizOptions), '_blank');
            });

            residualsHistogramPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('residualsHistogramPlotSearchStringDisplayModal', 'Plot prediction errors on a histogram chart', vizQueryArray, [null, "apply the model to the entire dataset to predict \"" + Forms.getToken('regressionTargetToken') + "\"", 'calculate the prediction error', 'use the `histogram` macro to format the prediction error'], baseTimerange, vizOptions);
            });

            Searches.setSearch('residualsHistogramPlotSearch', {
                searchString: ['| loadjob $testingJobIdToken$'].concat(sharedSearchArray),
                autostart: false,
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay(residualsHistogramPanel.viz.$el);

                    vizQueryArray = [baseSearchString, '| apply $modelNameToken|s$'].concat(sharedSearchArray);
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(residualsHistogramPanel.title, vizQuerySearch, vizOptions);
                },
                onFinallyCallback: function onFinallyCallback() {
                    Spinners.hideLoadingOverlay(residualsHistogramPanel.viz.$el);
                }
            });
        })();

        (function setupFitModelSummaryTableSearch() {
            var sharedSearchArray = ['| summary $modelNameToken|s$', '| table feature coefficient', '| rename feature as "Prediction Feature", coefficient as "Linear Regression Coefficient"'];

            var vizQuerySearch = null;

            fitModelSummaryPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch), '_blank');
            });

            fitModelSummaryPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('fitModelSummaryTableSearchStringDisplayModal', 'Inspect the model coefficients', sharedSearchArray, ['load the model coefficients']);
            });

            Searches.setSearch("fitModelSummaryTableSearch", {
                searchString: sharedSearchArray,
                autostart: false,
                onStartCallback: function onStartCallback(searchManager) {
                    vizQuerySearch = DrilldownLinker.createSearch(sharedSearchArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(fitModelSummaryPanel.title, vizQuerySearch);
                }
            });
        })();

        (function setupRegressionstatisticsSearch() {
            var sharedSearchString = "| `regressionstatistics($regressionTargetToken|s$, $regressionPredictionToken|s$)`";

            var vizQueryArray = [];
            var vizQuerySearch = null;

            regressionStatisticsPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch), '_blank');
            });

            regressionStatisticsPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('regressionstatisticsSearchStringDisplayModal', 'Compute R² and root mean squared error (RMSE)', vizQueryArray, [null, "apply the model to the entire dataset to predict \"" + Forms.getToken('regressionTargetToken') + "\"", 'use the `regressionstatistics` macro to compute R² and RMSE'], baseTimerange);
            });

            Searches.setSearch('regressionstatisticsSearch', {
                searchString: compact(_templateObject8, sharedSearchString),
                autostart: false,
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay([r2StatisticPanel.viz.$el, rootMeanSquaredErrorStatisticPanel.viz.$el], smallLoaderScale);

                    vizQueryArray = [baseSearchString, '| apply $modelNameToken|s$', sharedSearchString];
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(r2StatisticPanel.title, vizQuerySearch);
                    DrilldownLinker.setSearchDrilldown(rootMeanSquaredErrorStatisticPanel.title, vizQuerySearch);
                },
                onDataCallback: function onDataCallback(data) {
                    var testingSearchId = Searches.getSid(Searches.getSearchManager('testingSearch'));

                    historySerializer.persist(testingSearchId, {
                        r_squared: parseFloat(getFieldFromData(data, 'rSquared')),
                        rmse: parseFloat(getFieldFromData(data, 'RMSE'))
                    });
                },
                onFinallyCallback: function onFinallyCallback() {
                    Spinners.hideLoadingOverlay([r2StatisticPanel.viz.$el, rootMeanSquaredErrorStatisticPanel.viz.$el], smallLoaderScale);
                }
            });
        })();
    }

    function startPostProcessingSearches() {
        Searches.startSearch('dataAndPredictionsTableSearch');
        Searches.startSearch('actualVsPredictedScatterPlotSearch');
        Searches.startSearch('actualVsPredictedAndResidualSearch');
        Searches.startSearch('residualsHistogramPlotSearch');
        Searches.startSearch('fitModelSummaryTableSearch');
        Searches.startSearch('regressionstatisticsSearch');
    }

    (function () {
        Searches.setSearch('queryHistorySearch', {
            searchString: compact(_templateObject9, showcaseName)
        });
    })();

    // setup form input controls
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

            Forms.unsetToken(['regressionTargetToken', 'regressionFeaturesToken', 'regressionPredictionToken', 'actualVsPredictedSortByEvalToken', 'actualVsPredictedSortByToken']);

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
                var choices = Forms.getChoiceViewChoices(targetVariableControl);

                if (choices.indexOf(currentSampleSearch.targetVariable >= 0)) {
                    targetVariableControl.val(currentSampleSearch.targetVariable);
                }
            }
        });

        targetVariableControl.on("change", function () {
            Forms.unsetToken(["regressionFeaturesToken", "regressionTargetToken", "regressionPredictionToken"]);
            Forms.clearChoiceView(featuresVariableControl);

            var targetVariable = targetVariableControl.val();

            if (targetVariable != null && targetVariable.length > 0) {
                Forms.setToken("regressionTargetToken", targetVariable);
                Forms.setToken("regressionPredictionToken", "predicted(" + targetVariable + ")");
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
                Forms.setToken("regressionFeaturesToken", "\"" + values.join('" "') + "\"");
            } else {
                Forms.unsetToken("regressionFeaturesToken");
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

    var assistantControlsFooter = function () {
        var assistantControlsFooter = new AssistantControlsFooter($('#assistantControlsFooter'), submitButtonText, true);

        assistantControlsFooter.controls.submitButton.on('submit', function () {
            submitForm();
        });

        return assistantControlsFooter;
    }();

    var queryHistoryPanel = new QueryHistoryTable($('#queryHistoryPanel'), 'queryHistorySearch', historyCollectionId, ['Actions', '_time', 'Search query', 'Field to predict', 'Fields to use for predicting', 'Split for training / test', 'Model name', "R² Statistic", 'RMSE'], submitButtonText, function (params, autostart) {
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

    var submitForm = function submitForm() {
        if (!assistantControlsFooter.getDisabled()) {
            currentSampleSearch = null;

            hideErrorMessage();
            hidePanels();

            // if the "sort by" dropdown isn't initialized, do that; else fire a change event on it
            if (actualVsPredictedLinesPanel.sortByControl.val() == null) {
                actualVsPredictedLinesPanel.sortByControl.val(Forms.getChoiceViewChoices(actualVsPredictedLinesPanel.sortByControl)[0]);
            } else {
                actualVsPredictedLinesPanel.sortByControl.trigger('change');
            }

            // start with the dataPartitionSearch because we need to partition the data before we can use it to fit
            Searches.getSearchManager('dataPartitionSearch').startSearch();
        }
    };

    function setCurrentSampleSearch(sampleSearch) {
        currentSampleSearch = _.extend({}, {
            trainingFraction: 50
        }, sampleSearch);

        if (currentSampleSearch.modelName != null) modelNameInputControl.val(currentSampleSearch.modelName);

        searchBarControl.setProperties(sampleSearch.value, sampleSearch.earliestTime, sampleSearch.latestTime);

        trainingSetFractionSlider.val(currentSampleSearch.trainingFraction);
    }

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
            var regressionTargetToken = Forms.getToken('regressionTargetToken');
            var regressionFeaturesToken = Forms.getToken('regressionFeaturesToken');
            var fieldsValid = regressionTargetToken != null && regressionTargetToken.length > 0 && regressionFeaturesToken != null && regressionFeaturesToken.length > 0;

            assistantControlsFooter.setDisabled(!fieldsValid);
            assistantControlsFooter.controls.submitButton.text(submitButtonText);
        }
    };

    var hidePanels = function hidePanels() {
        Forms.unsetToken("showResultPanelsToken");
    };

    var showPanels = function showPanels() {
        Forms.setToken("showResultPanelsToken", true);
    };

    var showErrorMessage = function showErrorMessage(errorMessage) {
        var errorDisplay$El = $("#errorDisplay");
        Messages.setAlert(errorDisplay$El, errorMessage, undefined, undefined, true);
    };

    var hideErrorMessage = function hideErrorMessage() {
        var errorDisplay$El = $("#errorDisplay");
        Messages.removeAlert(errorDisplay$El, true);
    };

    // panel renderers

    var datasetPreviewTable = function () {
        return new TableView({
            id: 'datasetPreviewTable',
            el: $('#datasetPreviewTable'),
            managerid: 'searchBarSearch'
        }).render();
    }();

    var dataAndPredictionsPanel = function () {
        return new AssistantPanel($('#dataAndPredictionsPanel'), 'Prediction Results', TableView, {
            id: 'dataAndPredictionsTable',
            managerid: 'dataAndPredictionsTableSearch',
            drilldown: 'none'
        }, { footerButtons: { scheduleAlertButton: true } });
    }();

    var actualVsPredictedLinesPanel = function () {
        var LinesViz = VisualizationRegistry.getVisualizer(appName, 'LinesViz');

        var assistantPanel = new AssistantPanel($('#actualVsPredictedLinesPanel'), 'Actual vs. Predicted Line Chart', LinesViz, {
            id: 'actualPredictedLinesViz',
            managerid: 'actualVsPredictedLinesPlotSearch'
        });

        function setSortByToken(sortBy) {
            var sortByString = sortBy != null && sortBy.length > 0 ? " | sort " + sortBy : '';
            Forms.setToken('actualVsPredictedSortByToken', Forms.parseTemplate(sortByString));
        }

        var sortByControl$El = $('<div>');

        assistantPanel.sortByWrapper = $('<div>').attr('id', 'actualVsPredictedLinesSortBy').append($('<label>').text('Sort by:'), sortByControl$El);

        assistantPanel.sortByWrapper.insertAfter(assistantPanel.title);

        var choices = [{
            label: 'Default Sort',
            value: ''
        }, {
            label: 'Actual Value',
            value: '$regressionTargetToken|s$'
        }, {
            label: 'Predicted Value',
            value: '$regressionPredictionToken|s$'
        }];

        assistantPanel.sortByControl = new DropdownView({
            id: 'actualVsPredictedLinesSortByControl',
            el: sortByControl$El,
            showClearButton: false,
            labelField: 'column',
            valueField: 'column',
            choices: choices
        });

        assistantPanel.sortByControl.on('change', function () {
            var sortBy = assistantPanel.sortByControl.val();

            if (sortBy != null && sortBy.length > 0) {
                Forms.setToken('actualVsPredictedSortByEvalToken', Forms.parseTemplate(" | eval _sortBy = " + sortBy));
                Forms.setToken('actualVsPredictedSortByToken', Forms.parseTemplate(" | sort 0 " + sortBy));
            } else {
                Forms.setToken('actualVsPredictedSortByEvalToken', '');
                Forms.setToken('actualVsPredictedSortByToken', '');
            }

            Searches.getSearchManager('actualVsPredictedAndResidualSearch').startSearch();
        }).render();

        return assistantPanel;
    }();

    var residualsLinePanel = function () {
        var LinesViz = VisualizationRegistry.getVisualizer(appName, 'LinesViz');

        return new AssistantPanel($('#residualsLinePanel'), 'Residuals Line Chart', LinesViz, {
            id: 'residualsLineViz',
            managerid: 'residualsLinePlotSearch'
        });
    }();

    var actualVsPredictedScatterLinePanel = function () {
        var vizName = 'ScatterLineViz';

        var ScatterLineViz = VisualizationRegistry.getVisualizer(appName, vizName);

        return new AssistantPanel($('#actualVsPredictedScatterLinePanel'), 'Actual vs. Predicted Scatter Chart', ScatterLineViz, _defineProperty({
            id: 'actualVsPredictedScatterLineViz',
            managerid: 'actualVsPredictedScatterPlotSearch'
        }, appName + "." + vizName + ".onClick", function undefined(pointData) {
            var actualValue = Forms.escape(pointData.originalX != null ? pointData.originalX : pointData.x);
            var predictedValue = Forms.escape(pointData.originalX != null ? pointData.originalY : pointData.y);

            var searchString = compact(_templateObject10, baseSearchString, actualValue, predictedValue);

            var search = DrilldownLinker.createSearch(searchString, baseTimerange);

            var searchUrl = DrilldownLinker.getUrl('search', search);

            window.open(searchUrl, "_blank");
        }));
    }();

    var residualsHistogramPanel = function () {
        var HistogramViz = VisualizationRegistry.getVisualizer(appName, 'HistogramViz');

        return new AssistantPanel($('#residualsHistogramPanel'), 'Residuals Histogram', HistogramViz, {
            id: 'residualsHistogramViz',
            managerid: 'residualsHistogramPlotSearch'
        });
    }();

    var regressionStatisticsPanel = function () {
        return new AssistantPanelFooter($('#regressionStatisticsPanel'));
    }();

    var r2StatisticPanel = function () {
        return new AssistantPanel($('#r2StatisticPanel'), 'R<sup>2</sup> Statistic', SingleView, {
            id: 'r2StatisticViz',
            managerid: 'regressionstatisticsSearch',
            field: 'rSquared',
            numberPrecision: '0.0000',
            height: 30
        }, {
            panelWrapper: false,
            footerButtons: false
        });
    }();

    var rootMeanSquaredErrorStatisticPanel = function () {
        return new AssistantPanel($('#rootMeanSquaredErrorStatisticPanel'), 'Root Mean Squared Error (RMSE)', SingleView, {
            id: 'rootMeanSquaredErrorStatisticViz',
            managerid: 'regressionstatisticsSearch',
            field: 'RMSE',
            numberPrecision: '0.00',
            height: 30
        }, {
            panelWrapper: false,
            footerButtons: false
        });
    }();

    var fitModelSummaryPanel = function () {
        return new AssistantPanel($('#fitModelSummaryPanel'), 'Fit Model Parameters Summary', TableView, {
            id: 'fitModelSummaryTable',
            managerid: 'fitModelSummaryTableSearch',
            pageSize: 5
        });
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