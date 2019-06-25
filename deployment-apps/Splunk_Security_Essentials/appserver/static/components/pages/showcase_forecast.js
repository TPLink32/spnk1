'use strict';

var _templateObject = _taggedTemplateLiteral(["| `modvizpredict($predictFieldsToken|s$, $predictAlgorithmToken|s$, $futureTimespanToken|s$,\n                                             $holdbackToken|s$, $periodValueToken|s$, $confidenceIntervalToken|s$)`"], ["| \\`modvizpredict($predictFieldsToken|s$, $predictAlgorithmToken|s$, $futureTimespanToken|s$,\n                                             $holdbackToken|s$, $periodValueToken|s$, $confidenceIntervalToken|s$)\\`"]),
    _templateObject2 = _taggedTemplateLiteral(["| loadjob $searchBarSearchJobIdToken$\n                                   | head 1\n                                   | transpose\n                                   | fields column \n                                   | search column != \"column\" AND column != \"_*\""], ["| loadjob $searchBarSearchJobIdToken$\n                                   | head 1\n                                   | transpose\n                                   | fields column \n                                   | search column != \"column\" AND column != \"_*\""]),
    _templateObject3 = _taggedTemplateLiteral(["| where prediction ", " ", " \n                                                    ", " prediction ", " ", ""], ["| where prediction ", " ", " \n                                                    ", " prediction ", " ", ""]),
    _templateObject4 = _taggedTemplateLiteral(["| eval isOutlier = if(prediction!=\"\" AND '$predictFieldsToken$' != \"\"\n                                                            AND ('$predictFieldsToken$' < 'lower$confidenceIntervalToken$(prediction)'\n                                                            OR '$predictFieldsToken$' > 'upper$confidenceIntervalToken$(prediction)'), 1, 0)"], ["| eval isOutlier = if(prediction!=\"\" AND '$predictFieldsToken$' != \"\"\n                                                            AND ('$predictFieldsToken$' < 'lower$confidenceIntervalToken$(prediction)'\n                                                            OR '$predictFieldsToken$' > 'upper$confidenceIntervalToken$(prediction)'), 1, 0)"]),
    _templateObject5 = _taggedTemplateLiteral(["| inputlookup ", "_lookup\n                                   | eval \"Search query\"=search_query,\n                                   \"Field to predict\"=field_to_predict, Method=method, Withhold=withhold,\n                                   \"Forecast next k values\"=future_values,\"Confidence Interval\"=confidence_interval,\n                                   \"Period\"=period,\"R² Statistic\"=r_squared, \"RMSE\"=rmse, \"# of outliers\"=outliers_count,\n                                   \"Actions\"=actions"], ["| inputlookup ", "_lookup\n                                   | eval \"Search query\"=search_query,\n                                   \"Field to predict\"=field_to_predict, Method=method, Withhold=withhold,\n                                   \"Forecast next k values\"=future_values,\"Confidence Interval\"=confidence_interval,\n                                   \"Period\"=period,\"R² Statistic\"=r_squared, \"RMSE\"=rmse, \"# of outliers\"=outliers_count,\n                                   \"Actions\"=actions"]);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

require(["jquery", "underscore", "splunkjs/mvc/dropdownview", "splunkjs/mvc/singleview", "splunkjs/mvc/textinputview", "splunkjs/mvc/checkboxview", "splunkjs/mvc/tableview", "splunkjs/mvc/visualizationregistry", "components/splunk/Searches", "components/splunk/Forms", "components/data/parameters/ParseSearchParameters", "components/data/formatters/getFieldFromData", "components/data/serializers/ShowcaseHistorySerializer", "components/controls/DrilldownLinker", "components/controls/Messages", 'components/splunk/AlertModal', 'components/splunk/KVStore', 'components/splunk/SearchBarWrapper', "Options", "components/controls/AssistantControlsFooter", "components/controls/AssistantPanel/Master", "components/controls/AssistantPanel/Footer", "components/controls/Modal", "components/controls/QueryHistoryTable", "components/controls/SearchStringDisplay", "components/controls/Spinners", "components/controls/Tabs", "components/data/formatters/compactTemplateString", "components/data/sampleSearches/SampleSearchLoader", "components/data/validators/NumberValidator"], function ($, _, DropdownView, SingleView, TextInputView, CheckboxView, TableView, VisualizationRegistry, Searches, Forms, ParseSearchParameters, getFieldFromData, ShowcaseHistorySerializer, DrilldownLinker, Messages, AlertModal, KVStore, SearchBarWrapper, Options, AssistantControlsFooter, AssistantPanel, AssistantPanelFooter, Modal, QueryHistoryTable, SearchStringDisplay, Spinners, Tabs, compact, SampleSearchLoader, NumberValidator) {

    var showcaseName = 'showcase_forecast';
    var searchManagerId = 'predictSearch';
    var appName = Options.getOptionByName('appName');
    var smallLoaderScale = Options.getOptionByName('smallLoaderScale');

    var historyCollectionId = showcaseName + "_history";

    var predictSearchStrings = compact(_templateObject);

    var modvizpredictExplain = 'forecast using a macro that formats the `predict` command output for a different visualization';

    var submitButtonText = 'Forecast';

    var isRunning = false;
    var currentSampleSearch = null;
    var baseSearchString = null;
    var baseTimerange = null;

    var controlValidity = function () {
        var controlValidityStore = {};

        return {
            set: function set(id, value) {
                controlValidityStore[id] = value;
            },
            /**
             * Checks whether all entries in controlValidityStore are true
             * @returns {boolean}
             */
            getAll: function getAll() {
                return Object.keys(controlValidityStore).every(function (validity) {
                    return controlValidityStore[validity];
                });
            }
        };
    }();

    var historySerializer = new ShowcaseHistorySerializer(historyCollectionId, {
        _time: null,
        search_query: null,
        earliest_time: null,
        latest_time: null,
        field_to_predict: null,
        method: null,
        withhold: null,
        future_values: null,
        confidence_interval: null,
        period: null,
        r_squared: null,
        rmse: null,
        outliers_count: null
    }, function () {
        Searches.getSearchManager('queryHistorySearch').startSearch();
    });

    function setupSearches() {
        (function setupSearchBarSearch() {
            Searches.setSearch("searchBarSearch", {
                targetJobIdTokenName: "searchBarSearchJobIdToken",
                onStartCallback: function onStartCallback() {
                    hideErrorMessage();
                    hidePanels();
                },
                onDoneCallback: function onDoneCallback(searchManager) {
                    DrilldownLinker.setSearchDrilldown(datasetPreviewTable.$el.prev('h3'), searchManager.search);
                },
                onErrorCallback: function onErrorCallback(errorMessage) {
                    showErrorMessage(errorMessage);
                    hidePanels();
                }
            });
        })();

        (function setupPredictionFieldsSearch() {
            Searches.setSearch("predictionFieldsSearch", {
                searchString: compact(_templateObject2),
                onStartCallback: function onStartCallback() {
                    hideErrorMessage();
                },
                onErrorCallback: function onErrorCallback(errorMessage) {
                    showErrorMessage(errorMessage);
                    hidePanels();
                }
            });
        })();

        (function setupPredictSearch() {
            var vizQuerySearch = null;
            var vizQueryArray = [];

            var forecastVizAlertModal = null;

            var vizOptions = DrilldownLinker.parseVizOptions({
                category: 'custom',
                type: appName + ".ForecastViz"
            });

            function openInSearch() {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch, vizOptions), '_blank');
            }

            function showSPL(e) {
                // adjust the modal title depending on whether or not the modal is from the plot or not
                var modalTitle = forecastPanel.showSPLButton.first().is($(e.target)) ? 'Plot forecast' : 'Calculate the forecast';

                SearchStringDisplay.showSearchStringModal(searchManagerId + "Modal", modalTitle, vizQueryArray, [null, [modvizpredictExplain]], baseTimerange, vizOptions);
            }

            assistantControlsFooter.controls.openInSearchButton.on('click', openInSearch);
            assistantControlsFooter.controls.showSPLButton.on('click', showSPL);

            forecastPanel.openInSearchButton.on('click', openInSearch);
            forecastPanel.showSPLButton.on('click', showSPL);

            forecastPanel.scheduleAlertButton.on('click', function () {
                if (forecastVizAlertModal == null) {
                    (function () {
                        forecastVizAlertModal = new Modal('forecastVizAlertModal', {
                            title: 'Schedule an alert',
                            destroyOnHide: false,
                            type: 'wide'
                        });

                        var futurePredictionsDropdownControl = new DropdownView({
                            id: 'futurePredictionsDropdownControl',
                            el: $('<span>'),
                            showClearButton: false,
                            choices: [{ label: 'greater than', value: '>' }, { label: 'less than', value: '<' }, { label: 'between', value: '> AND <' }, { label: 'not between', value: '< OR >' }]
                        }).render();

                        var futurePredictionsFirstValueControl = new TextInputView({
                            id: 'futurePredictionsFirstValueControl',
                            el: $('<span>')
                        }).render();

                        var futurePredictionsSecondValueControl = new TextInputView({
                            id: 'futurePredictionsSecondValueControl',
                            el: $('<span>')
                        }).render();

                        futurePredictionsDropdownControl.on('change', function (value) {
                            if (value === '>' || value === '<') {
                                futurePredictionsFirstValueControl.$el.nextAll().hide();
                            } else {
                                futurePredictionsFirstValueControl.$el.nextAll().show();
                            }
                        });

                        forecastVizAlertModal.body.addClass('mlts-modal-form-inline').append($('<p>').text('Alert me when a future prediction is '), futurePredictionsDropdownControl.$el, futurePredictionsFirstValueControl.$el, $('<p>').text('and'), futurePredictionsSecondValueControl.$el);

                        forecastVizAlertModal.footer.append($('<button>').addClass('mlts-modal-cancel').attr({
                            type: 'button',
                            'data-dismiss': 'modal'
                        }).addClass('btn btn-default mlts-modal-cancel').text('Cancel'), $('<button>').attr({
                            type: 'button'
                        }).on('click', function () {
                            forecastVizAlertModal.removeAlert();

                            var valueRange = futurePredictionsDropdownControl.val();

                            var searchString = '';

                            var firstValue = futurePredictionsFirstValueControl.val();

                            var isValid = NumberValidator.validate(firstValue);

                            Messages.setFormInputStatus(futurePredictionsFirstValueControl, isValid);

                            if (valueRange === '>' || valueRange === '<') {
                                searchString = "| where prediction " + valueRange + " " + firstValue;
                            } else if (valueRange === '> AND <' || valueRange === '< OR >') {
                                var secondValue = futurePredictionsSecondValueControl.val();
                                var secondValueValid = NumberValidator.validate(secondValue);

                                Messages.setFormInputStatus(futurePredictionsSecondValueControl, secondValueValid);

                                isValid = isValid && secondValueValid;

                                // split valueRange into three parts
                                valueRange = valueRange.split(' ');

                                // build a search by substituting the values of the two inputs between the valueRange parts
                                // Math.min and Math.max ensure that "between 5 and 0" is parsed as "between 0 and 5"
                                // ex. where [PREDICTED] [>] [X] [AND] [PREDICTED] [<] [Y]
                                searchString = compact(_templateObject3, valueRange[0], Math.min(firstValue, secondValue), valueRange[1], valueRange[2], Math.max(firstValue, secondValue));
                            }

                            if (searchString.length > 0) {
                                if (isValid) {
                                    searchString = Forms.parseTemplate(getFullSearchQueryArray().concat(['| tail $futurePointsToken$', searchString]).join(' '));

                                    forecastVizAlertModal.hide();

                                    var alertModal = new AlertModal({
                                        searchString: searchString
                                    });

                                    alertModal.render().appendTo($('body')).show();
                                } else {
                                    forecastVizAlertModal.setAlert('Predicted value must be a number.');
                                }
                            }
                        }).addClass('btn btn-primary mlts-modal-submit').text('Next'));

                        forecastVizAlertModal.$el.on('show.bs.modal', function () {
                            forecastVizAlertModal.removeAlert();
                            Messages.setFormInputStatus([futurePredictionsFirstValueControl, futurePredictionsSecondValueControl], true);

                            futurePredictionsDropdownControl.val('>');
                            futurePredictionsFirstValueControl.val(0);
                            futurePredictionsSecondValueControl.val(0);
                        });
                    })();
                }

                forecastVizAlertModal.show();
            });

            Searches.setSearch(searchManagerId, {
                autostart: false,
                targetJobIdTokenName: "predictJobIdToken",
                searchString: "| loadjob $searchBarSearchJobIdToken$ " + predictSearchStrings,
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay(forecastPanel.viz.$el);

                    hideErrorMessage();
                    updateForm(true);

                    currentSampleSearch = null;

                    var searchManager = Searches.getSearchManager(searchManagerId);
                    var jobId = Searches.getSid(searchManager);

                    var searchAttributes = Searches.getSearchManager('searchBarSearch').search.attributes;

                    var collection = {
                        _time: parseInt(new Date().valueOf() / 1000, 10),
                        search_query: searchAttributes.search,
                        earliest_time: searchAttributes.earliest_time,
                        latest_time: searchAttributes.latest_time,
                        field_to_predict: predictFieldsControl.val(),
                        method: predictAlgorithmControl.val(),
                        withhold: holdbackControl.val(),
                        future_values: futureTimespanControl.val(),
                        confidence_interval: confidenceIntervalControl.val(),
                        period: periodCheckboxControl.val() && periodValueControl.val() || 0
                    };
                    historySerializer.persist(jobId, collection);

                    vizQueryArray = getFullSearchQueryArray();
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(forecastPanel.title, vizQuerySearch, vizOptions);
                },
                onDoneCallback: function onDoneCallback() {
                    showPanels();

                    Searches.getSearchManager("predictionOutliersSearch").startSearch();
                    Searches.getSearchManager("regressionstatisticsSearch").startSearch();
                },
                onErrorCallback: function onErrorCallback(errorMessage) {
                    showErrorMessage(errorMessage);
                    hidePanels();
                },
                onFinallyCallback: function onFinallyCallback() {
                    updateForm(false);
                    Spinners.hideLoadingOverlay(forecastPanel.viz.$el);
                }
            });
        })();

        (function setupPredictionOutliersSearch() {
            var identifyOutliersSearchQueryArray = [compact(_templateObject4)];

            var findOutliersSearchQueryArray = identifyOutliersSearchQueryArray.concat(['| where isOutlier=1', '| fields - isOutlier']);

            var outlierExplain = 'find the outliers among events that have both an actual and a predicted value';

            var vizQueryArray = [];
            var vizQuerySearch = null;

            var outliersOverTimeVizOptions = DrilldownLinker.parseVizOptions({
                category: 'custom',
                type: appName + ".LinesViz"
            });
            var outliersOverTimeSearch = null;

            predictionOutliersStatisticPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch), '_blank');
            });

            predictionOutliersStatisticPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('predictionOutliersSearchStringDisplayModal', 'Show forecast outliers', vizQueryArray, [null, modvizpredictExplain, outlierExplain], baseTimerange);
            });

            predictionOutliersStatisticPanel.plotOutliersOverTimeButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', outliersOverTimeSearch, outliersOverTimeVizOptions), '_blank');
            });

            Searches.setSearch("predictionOutliersSearch", {
                autostart: false,
                searchString: ['| loadjob $predictJobIdToken$'].concat(findOutliersSearchQueryArray, ['| stats count']),
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay(predictionOutliersStatisticPanel.viz.$el, smallLoaderScale);

                    var searchArray = getFullSearchQueryArray();

                    vizQueryArray = searchArray.concat(findOutliersSearchQueryArray);
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    outliersOverTimeSearch = DrilldownLinker.createSearch(searchArray.concat(identifyOutliersSearchQueryArray, ['| table _time, isOutlier']), baseTimerange);

                    DrilldownLinker.setSearchDrilldown(predictionOutliersStatisticPanel.title, vizQuerySearch);
                },
                onDataCallback: function onDataCallback(data) {
                    var searchManager = Searches.getSearchManager(searchManagerId);
                    var jobId = Searches.getSid(searchManager);

                    var resultIndex = data.fields.indexOf('count');
                    var collection = {
                        outliers_count: data.rows[0][resultIndex]
                    };

                    historySerializer.persist(jobId, collection);
                },
                onFinallyCallback: function onFinallyCallback() {
                    Spinners.hideLoadingOverlay(predictionOutliersStatisticPanel.viz.$el);
                }
            });
        })();

        (function setupRegressionstatisticsSearch() {
            var regressionstatisticsSearchQueryArray = ["| where prediction!=\"\" AND '$predictFieldsToken$' != \"\"", '| `regressionstatistics($predictFieldsToken|s$, prediction)`'];

            var vizQueryArray = [];
            var vizQuerySearch = null;

            regressionStatisticsPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch), '_blank');
            });

            regressionStatisticsPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('regressionstatisticsSearchStringDisplayModal', 'Compute R² and root mean squared error (RMSE)', vizQueryArray, [null, modvizpredictExplain, null, 'use the `regressionstatistics` macro to compute R² and RMSE'], baseTimerange);
            });

            Searches.setSearch("regressionstatisticsSearch", {
                autostart: false,
                searchString: ['| loadjob $predictJobIdToken$'].concat(regressionstatisticsSearchQueryArray),
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay(r2StatisticPanel.viz.$el, smallLoaderScale);
                    Spinners.showLoadingOverlay(rootMeanSquaredErrorStatisticPanel.viz.$el, smallLoaderScale);

                    vizQueryArray = getFullSearchQueryArray().concat(regressionstatisticsSearchQueryArray);
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(r2StatisticPanel.title, vizQuerySearch);
                    DrilldownLinker.setSearchDrilldown(rootMeanSquaredErrorStatisticPanel.title, vizQuerySearch);
                },
                onDataCallback: function onDataCallback(data) {
                    var searchManager = Searches.getSearchManager(searchManagerId);
                    var jobId = Searches.getSid(searchManager);

                    var r2Index = data.fields.indexOf('rSquared');
                    var rmseIndex = data.fields.indexOf('RMSE');
                    var collection = {
                        rmse: data.rows[0][rmseIndex],
                        r_squared: data.rows[0][r2Index]
                    };

                    historySerializer.persist(jobId, collection);
                },
                onFinallyCallback: function onFinallyCallback() {
                    Spinners.hideLoadingOverlay(r2StatisticPanel.viz.$el);
                    Spinners.hideLoadingOverlay(rootMeanSquaredErrorStatisticPanel.viz.$el);
                }
            });
        })();
    }

    (function setupQueryHistorySearch() {
        Searches.setSearch("queryHistorySearch", {
            searchString: compact(_templateObject5, showcaseName)
        });
    })();

    var tabsControl = function () {
        return new Tabs($('#dashboard-form-tabs'), $('#dashboard-form-controls'));
    }();

    var queryHistoryPanel = new QueryHistoryTable($('#queryHistoryPanel'), 'queryHistorySearch', historyCollectionId, ['Actions', '_time', 'Search query', 'Field to predict', 'Method', 'Withhold', 'Forecast next k values', 'Confidence Interval', 'Period', 'R² Statistic', 'RMSE', '# of outliers'], submitButtonText, function (params, autostart) {
        var savedSearch = {};
        savedSearch.value = params.data["row.search_query"];
        savedSearch.earliestTime = params.data["row.earliest_time"];
        savedSearch.latestTime = params.data["row.latest_time"];
        savedSearch.algorithm = params.data["row.method"];
        savedSearch.fieldToPredict = params.data["row.field_to_predict"];
        savedSearch.holdback = params.data["row.withhold"];
        savedSearch.futureTimespan = params.data["row.future_values"];
        savedSearch.confidenceInterval = params.data["row.confidence_interval"];
        savedSearch.period = params.data["row.period"];
        savedSearch.autostart = autostart;

        loadSavedSearch(savedSearch);
    });

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
            Forms.clearChoiceView(predictFieldsControl, true);
            Forms.unsetToken("predictFieldsToken");

            var searchBarSearch = Searches.getSearchManager("searchBarSearch");

            baseSearchString = this.searchBarView.val();
            baseTimerange = this.searchBarView.timerange.val();

            searchBarSearch.settings.unset("search");
            searchBarSearch.settings.set("search", baseSearchString);
            searchBarSearch.search.set(baseTimerange);

            updateForm();
        });
    }();

    var predictFieldsControl = function () {
        var predictFieldsControl = new DropdownView({
            "id": "predictFieldsControl",
            "el": $("#predictFieldsControl"),
            "managerid": "predictionFieldsSearch",
            "labelField": "column",
            "valueField": "column",
            showClearButton: false
        });

        predictFieldsControl.on("datachange", function () {
            if (currentSampleSearch != null) {
                var choices = Forms.getChoiceViewChoices(predictFieldsControl);

                if (choices.indexOf(currentSampleSearch.fieldToPredict) >= 0) {
                    predictFieldsControl.val(currentSampleSearch.fieldToPredict);
                } else {
                    // if the outlier variable can't be selected, we can remove the sample search since it's no longer relevant
                    currentSampleSearch = null;
                }
            }
        });

        predictFieldsControl.on("change", function (value) {
            Forms.setToken("predictFieldsToken", value);

            updateForm();

            if (value != null) {
                if (currentSampleSearch.autostart !== false) {
                    assistantControlsFooter.controls.submitButton.trigger('submit');
                } else {
                    // if the sample search isn't auto-running, we want to remove it since it's no longer relevant
                    currentSampleSearch = null;
                }
            }
        });
        predictFieldsControl.render();

        return predictFieldsControl;
    }();

    var predictAlgorithmControl = function () {
        var predictAlgorithmControl = new DropdownView({
            "id": "predictAlgorithmControl",
            "el": $("#predictAlgorithmControl"),
            "labelField": "label",
            "valueField": "value",
            "selectFirstChoice": true,
            "showClearButton": false,
            "choices": [{ "label": "LLP5 (combines LLT and LLP)", "value": "LLP5" }, { "label": "LL (local level)", "value": "LL" }, { "label": "LLP (seasonal local level)", "value": "LLP" }, { "label": "LLT (local level trend)", "value": "LLT" }]
        });

        predictAlgorithmControl.on("change", function (value) {
            Forms.setToken("predictAlgorithmToken", value);
        });
        predictAlgorithmControl.render();

        return predictAlgorithmControl;
    }();

    var holdbackControl = function () {
        var holdbackControl = new TextInputView({
            id: 'holdbackControl',
            el: $('#holdbackControl')
        });

        holdbackControl.on("change", function (value) {
            var holdback = parseInt(value, 10);

            if (isNaN(holdback) || holdback < 0) {
                controlValidity.set(holdbackControl.id, false);
                Messages.setTextInputMessage(this, 'Withhold value must be a positive integer.');
            } else {
                controlValidity.set(holdbackControl.id, true);
                Messages.removeTextInputMessage(this);

                //convert to integer if the value is float
                holdbackControl.val(holdback);
                Forms.setToken('holdbackToken', holdback);

                if (futureTimespanControl != null) {
                    var futureTimespan = parseInt(futureTimespanControl.val(), 10);
                    if (!isNaN(futureTimespan) && futureTimespan >= 0) {
                        Forms.setToken('futureTimespanToken', holdback + futureTimespan);
                    }
                }
            }

            updateForm();
        });

        holdbackControl.render();

        return holdbackControl;
    }();

    var futureTimespanControl = function () {
        var futureTimespanControl = new TextInputView({
            id: 'futureTimespanControl',
            el: $('#futureTimespanControl')
        });

        futureTimespanControl.on("change", function (value) {
            //convert to integer if the value is float
            var futureTimespan = parseInt(value, 10);

            if (isNaN(futureTimespan) || futureTimespan < 0) {
                controlValidity.set(futureTimespanControl.id, false);
                Messages.setTextInputMessage(this, 'Forecast value must be a positive integer.');
            } else {
                controlValidity.set(futureTimespanControl.id, true);
                Messages.removeTextInputMessage(this);

                futureTimespanControl.val(futureTimespan);

                if (holdbackControl != null) {
                    var holdback = parseInt(holdbackControl.val(), 10);
                    if (!isNaN(holdback) && holdback >= 0) {
                        var actualFutureTimespan = futureTimespan + holdback;
                        Forms.setToken('futureTimespanToken', actualFutureTimespan);
                        Forms.setToken('futurePointsToken', futureTimespan);
                    }
                }
            }

            updateForm();
        });

        futureTimespanControl.render();

        return futureTimespanControl;
    }();

    var confidenceIntervalControl = function () {
        var confidenceIntervalControl = new TextInputView({
            id: 'confidenceIntervalControl',
            el: $('#confidenceIntervalControl')
        });

        confidenceIntervalControl.on("change", function (value) {
            var confidenceInterval = parseInt(value, 10);

            if (isNaN(confidenceInterval) || confidenceInterval < 0 || confidenceInterval >= 100) {
                controlValidity.set(confidenceIntervalControl.id, false);
                Messages.setTextInputMessage(this, 'Confidence interval percentile value must be a integer between 0 and 99.');
            } else {
                controlValidity.set(confidenceIntervalControl.id, true);
                Messages.removeTextInputMessage(this);

                //convert to integer if the value is float
                confidenceIntervalControl.val(confidenceInterval);
                Forms.setToken('confidenceIntervalToken', confidenceInterval);
            }

            updateForm();
        });

        confidenceIntervalControl.render();

        return confidenceIntervalControl;
    }();

    var periodCheckboxControl = function () {
        var periodCheckboxControl = new CheckboxView({
            id: 'periodCheckboxControl',
            el: $('#periodCheckboxControl'),
            default: false
        });

        periodCheckboxControl.on("change", function (hasPeriod) {
            updatePeriodValueControlValidity();

            if (!hasPeriod) {
                Forms.setToken('periodValueToken', '');
            } else {
                if (periodValueControl.val() != null) {
                    periodValueControl.trigger("change", periodValueControl.val()); //force trigger the event if the value was disabled before.
                }
            }
        });

        Forms.setToken('periodValueToken', '');
        periodCheckboxControl.render();

        return periodCheckboxControl;
    }();

    var periodValueControl = function () {
        var periodValueControl = new TextInputView({
            id: 'periodValueControl',
            disabled: true,
            el: $('#periodValueControl')
        });

        periodValueControl.on("change", function (value) {
            if (value == null) {
                Forms.setToken('periodValueToken', '');
            } else {
                var periodValue = parseInt(value, 10);
                Forms.setToken('periodValueToken', "period=" + periodValue);
            }
            updatePeriodValueControlValidity();
        });

        periodValueControl.render();

        return periodValueControl;
    }();

    function updatePeriodValueControlValidity() {
        if (periodCheckboxControl != null && periodValueControl != null) {
            var periodValue = periodValueControl.val();
            var hasPeriod = periodCheckboxControl.val();

            if (hasPeriod && (isNaN(periodValue) || periodValue <= 0)) {
                controlValidity.set(periodValueControl.id, false);
                Messages.setTextInputMessage(periodValueControl, 'Period value must be a positive integer.');
            } else {
                controlValidity.set(periodValueControl.id, true);
                Messages.removeTextInputMessage(periodValueControl);
            }

            periodValueControl.settings.set("disabled", !hasPeriod);

            updateForm();
        }
    }

    var assistantControlsFooter = function () {
        var assistantControlsFooter = new AssistantControlsFooter($('#assistantControlsFooter'), submitButtonText);

        assistantControlsFooter.controls.submitButton.on('submit', function () {
            activatePredictionSearch();
        });

        return assistantControlsFooter;
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

    var predictionOutliersStatisticPanel = function () {
        var assistantPanel = new AssistantPanel($('#predictionOutliersStatisticPanel'), 'Forecast Outliers', SingleView, {
            id: 'predictionOutliersStatisticViz',
            managerid: 'predictionOutliersSearch',
            field: 'count',
            numberPrecision: '0',
            height: 30
        });

        assistantPanel.plotOutliersOverTimeButton = $('<button>').addClass('btn btn-default mlts-plot-outliers-over-time').text('Plot Outliers Over Time');
        assistantPanel.footer.append(assistantPanel.plotOutliersOverTimeButton);

        return assistantPanel;
    }();

    var forecastPanel = function () {
        var ForecastViz = VisualizationRegistry.getVisualizer(appName, 'ForecastViz');

        return new AssistantPanel($('#forecastPanel'), 'Forecast', ForecastViz, {
            id: 'forecastViz',
            managerid: searchManagerId
        }, {
            footerButtons: {
                scheduleAlertButton: true
            }
        });
    }();

    var datasetPreviewTable = function () {
        return new TableView({
            id: 'datasetPreviewTable',
            el: $('#datasetPreviewPanel'),
            managerid: 'searchBarSearch',
            count: 5
        });
    }();

    // gets the current full search query as an array, where array[0] is the search bar search
    function getFullSearchQueryArray() {
        var fullSearchQueryArray = [];

        if (baseSearchString != null) {
            fullSearchQueryArray[0] = baseSearchString;
            fullSearchQueryArray[1] = predictSearchStrings;
        }

        return fullSearchQueryArray;
    }

    function loadSavedSearch(sampleSearch) {
        tabsControl.activate('newForecast');

        currentSampleSearch = _.extend({}, {
            algorithm: 'LLP',
            holdback: 0,
            futureTimespan: 0,
            confidenceInterval: 95
        }, sampleSearch);

        searchBarControl.setProperties(sampleSearch.value, sampleSearch.earliestTime, sampleSearch.latestTime);

        var holdback = currentSampleSearch.holdback;
        var futureTimespan = currentSampleSearch.futureTimespan;
        var algorithm = currentSampleSearch.algorithm;
        var confidenceInterval = currentSampleSearch.confidenceInterval;

        //Assign pre-canned parameters to each input
        if (currentSampleSearch.period != null && currentSampleSearch.period != 0) {
            var period = currentSampleSearch.period;
            periodCheckboxControl.val(true);
            periodValueControl.val(period);
        } else {
            periodValueControl.settings.unset("value");
            periodValueControl.settings.set("disabled", true);
            periodCheckboxControl.val(false);
        }
        holdbackControl.val(holdback);
        futureTimespanControl.val(futureTimespan);
        predictAlgorithmControl.val(algorithm);
        confidenceIntervalControl.val(confidenceInterval);
    }

    function activatePredictionSearch() {
        // the controlValidity.getAll() check is intentionally made here so that the user can try to submit the form even with empty fields
        // the submission will fail and they'll see the appropriate errors
        if (!assistantControlsFooter.getDisabled() && controlValidity.getAll()) {
            currentSampleSearch = null;

            Searches.startSearch(searchManagerId);
        }
    }

    function updateForm(newIsRunningValue) {
        // optionally set a new value for isRunning
        if (newIsRunningValue != null) isRunning = newIsRunningValue;

        predictFieldsControl.settings.set('disabled', isRunning);
        predictAlgorithmControl.settings.set('disabled', isRunning);
        periodCheckboxControl.settings.set('disabled', isRunning);
        // don't re-enable windowSizeControl if it's disabled by windowedAnalysisCheckboxControl
        periodValueControl.settings.set('disabled', isRunning || !periodCheckboxControl.val());
        holdbackControl.settings.set('disabled', isRunning);
        futureTimespanControl.settings.set('disabled', isRunning);
        confidenceIntervalControl.settings.set('disabled', isRunning);

        if (isRunning) {
            assistantControlsFooter.setDisabled(true);
            assistantControlsFooter.controls.submitButton.text('Forecasting...');
        } else {
            var predictFieldsToken = Forms.getToken('predictFieldsToken');
            var fieldsValid = predictFieldsToken != null && predictFieldsToken.length > 0;

            assistantControlsFooter.setDisabled(!fieldsValid);
            assistantControlsFooter.controls.submitButton.text(submitButtonText);
        }
    }

    function showErrorMessage(errorMessage) {
        var errorDisplay$El = $("#errorDisplay");
        Messages.setAlert(errorDisplay$El, errorMessage, undefined, undefined, true);
    }

    function hideErrorMessage() {
        var errorDisplay$El = $("#errorDisplay");
        Messages.removeAlert(errorDisplay$El, true);
    }

    function hidePanels() {
        Forms.unsetToken('showResultPanelsToken');
    }

    function showPanels() {
        Forms.setToken('showResultPanelsToken', true);
    }

    // update validity for the initial state of the period controls
    updatePeriodValueControlValidity();

    setupSearches();

    // load canned searches from URL bar parameters
    (function setInputs() {
        var searchParams = ParseSearchParameters(showcaseName);

        if (searchParams.mlToolkitDataset != null) {
            SampleSearchLoader.getSampleSearchByLabel(searchParams.mlToolkitDataset).then(loadSavedSearch);
        } else {
            loadSavedSearch(searchParams);
        }
    })();

    // disable the form on initial load
    setTimeout(updateForm, 0);
});