"use strict";

var _templateObject = _taggedTemplateLiteral(["| loadjob $searchBarSearchJobIdToken$\n                                   | head 1\n                                   | transpose\n                                   | fields column\n                                   | search column != \"column\" AND column != \"_*\""], ["| loadjob $searchBarSearchJobIdToken$\n                                   | head 1\n                                   | transpose\n                                   | fields column\n                                   | search column != \"column\" AND column != \"_*\""]),
    _templateObject2 = _taggedTemplateLiteral(["| inputlookup ", "_lookup\n                                   | eval Actions=actions\n                                   | eval \"Search query\" = search_query,\n                                          \"Field to analyze\" = outlier_variable,\n                                          \"Threshold method\" = threshold_method,\n                                          \"Threshold multiplier\" = threshold_multiplier,\n                                          \"Sliding window\" = window_size,\n                                          \"Include current point\" = if(use_current_point == \"0\", \"false\", \"true\"),\n                                          \"# of outliers\" = outliers_count"], ["| inputlookup ", "_lookup\n                                   | eval Actions=actions\n                                   | eval \"Search query\" = search_query,\n                                          \"Field to analyze\" = outlier_variable,\n                                          \"Threshold method\" = threshold_method,\n                                          \"Threshold multiplier\" = threshold_multiplier,\n                                          \"Sliding window\" = window_size,\n                                          \"Include current point\" = if(use_current_point == \"0\", \"false\", \"true\"),\n                                          \"# of outliers\" = outliers_count"]);

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

require(["jquery", "underscore", "splunkjs/mvc", "splunkjs/mvc/chartview", "splunkjs/mvc/dropdownview", "splunkjs/mvc/textinputview", "splunkjs/mvc/singleview", "splunkjs/mvc/checkboxview", "splunkjs/mvc/tableview", "splunkjs/mvc/utils", 'splunkjs/mvc/visualizationregistry', 'Options', "components/splunk/AlertModal", "components/splunk/Forms", "components/splunk/KVStore", 'components/splunk/SearchBarWrapper', "components/splunk/Searches", "components/data/parameters/ParseSearchParameters", "components/data/formatters/compactTemplateString", "components/data/serializers/ShowcaseHistorySerializer", "components/controls/AssistantControlsFooter", "components/controls/AssistantPanel/Master", "components/controls/QueryHistoryTable", "components/controls/SearchStringDisplay", "components/controls/DrilldownLinker", "components/controls/Messages", "components/controls/Modal", "components/controls/Spinners", "components/controls/Tabs", "components/data/sampleSearches/SampleSearchLoader", "components/data/validators/NumberValidator"], function ($, _, mvc, ChartView, DropdownView, TextInputView, SingleView, CheckboxView, TableView, utils, VisualizationRegistry, Options, AlertModal, Forms, KVStore, SearchBarWrapper, Searches, ParseSearchParameters, compact, ShowcaseHistorySerializer, AssistantControlsFooter, AssistantPanel, QueryHistoryTable, SearchStringDisplay, DrilldownLinker, Messages, Modal, Spinners, Tabs, SampleSearchLoader, NumberValidator) {
    var showcaseName = 'showcase_outlier_detection';

    var appName = Options.getOptionByName('appName');

    var submitButtonText = 'Detect Outliers';

    var baseSearchString = null;
    var baseTimerange = null;

    // stores the current sample search, if applicable
    var currentSampleSearch = null;

    var isRunning = false;

    // stores whether or not the last value entered into a given control is valid
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

    var historyCollectionId = showcaseName + "_history";

    var historySerializer = new ShowcaseHistorySerializer(historyCollectionId, {
        _time: null,
        search_query: null,
        earliest_time: null,
        latest_time: null,
        outlier_variable: null,
        threshold_method: null,
        threshold_multiplier: null,
        window_size: null,
        use_current_point: null,
        outliers_count: null
    }, function () {
        Searches.startSearch('queryHistorySearch');
    });

    // the possible searches and their descriptions, one per analysis function
    var outlierResultsSearchSettings = {
        'outlierSearchTypeAvgStreamStats': {
            search: ['| streamstats window=$windowSizeToken$ current=$useCurrentPointToken$ avg($outlierVariableToken|s$) as avg stdev($outlierVariableToken|s$) as stdev', '| eval lowerBound=(avg-stdev*$scaleFactorToken$), upperBound=(avg+stdev*$scaleFactorToken$)'],
            description: ['calculate the mean and standard deviation using a sliding window', 'calculate the bounds as a multiple of the standard deviation']
        },
        'outlierSearchTypeMADStreamStats': {
            search: ['| streamstats window=$windowSizeToken$ current=$useCurrentPointToken$ median($outlierVariableToken|s$) as median', "| eval absDev=(abs('$outlierVariableToken$'-median))", '| streamstats window=$windowSizeToken$ current=$useCurrentPointToken$ median(absDev) as medianAbsDev', '| eval lowerBound=(median-medianAbsDev*$scaleFactorToken$), upperBound=(median+medianAbsDev*$scaleFactorToken$)'],
            description: ['calculate the median value using a sliding window', 'calculate the absolute deviation of each value from the median', 'use the same sliding window to compute the median absolute deviation', 'calculate the bounds as a multiple of the median absolute deviation']
        },
        'outlierSearchTypeIQRStreamStats': {
            search: ['| streamstats window=$windowSizeToken$ current=$useCurrentPointToken$ median($outlierVariableToken|s$) as median p25($outlierVariableToken|s$) as p25 p75($outlierVariableToken|s$) as p75', '| eval IQR=(p75-p25)', '| eval lowerBound=(median-IQR*$scaleFactorToken$), upperBound=(median+IQR*$scaleFactorToken$)'],
            description: ['calculate the first, second, and third quartiles using a sliding window', 'calculate the interquartile range', 'calculate the bounds as a multiple of the interquartile range']
        },
        'outlierSearchTypeAvgEventStats': {
            search: ['| eventstats avg($outlierVariableToken|s$) as avg stdev($outlierVariableToken|s$) as stdev', '| eval lowerBound=(avg-stdev*$scaleFactorToken$), upperBound=(avg+stdev*$scaleFactorToken$)'],
            description: ['calculate the mean and standard deviation', 'calculate the bounds as a multiple of the standard deviation']
        },
        'outlierSearchTypeMADEventStats': {
            search: ['| eventstats median($outlierVariableToken|s$) as median', "| eval absDev=(abs('$outlierVariableToken$'-median))", '| eventstats median(absDev) as medianAbsDev', '| eval lowerBound=(median-medianAbsDev*$scaleFactorToken$), upperBound=(median+medianAbsDev*$scaleFactorToken$)'],
            description: ['calculate the median', 'calculate the absolute deviation of each value from the median', 'use the same sliding window to compute the median absolute deviation', 'calculate the bounds as a multiple of the median absolute deviation']
        },
        'outlierSearchTypeIQREventStats': {
            search: ['| eventstats median($outlierVariableToken|s$) as median p25($outlierVariableToken|s$) as p25 p75($outlierVariableToken|s$) as p75', '| eval IQR=(p75-p25)', '| eval lowerBound=(median-IQR*$scaleFactorToken$), upperBound=(median+IQR*$scaleFactorToken$)'],
            description: ['calculate the first, second, and third quartiles', 'calculate the interquartile range', 'calculate the bounds as a multiple of the interquartile range']
        }
    };

    var outlierFieldSearchStrings = {
        both: "| eval isOutlier=if('$outlierVariableToken$' < lowerBound OR '$outlierVariableToken$' > upperBound, 1, 0)",
        above: "| eval isOutlier=if('$outlierVariableToken$' > upperBound, 1, 0)",
        below: "| eval isOutlier=if('$outlierVariableToken$' < lowerBound, 1, 0)",
        split: "| eval isOutlierUpper=if('$outlierVariableToken$' < lowerBound, 1, 0), isOutlierLower=if('$outlierVariableToken$' > upperBound, 1, 0)"
    };

    function setupSearches() {
        (function setupSearchBarSearch() {
            Searches.setSearch('searchBarSearch', {
                targetJobIdTokenName: 'searchBarSearchJobIdToken',
                onStartCallback: function onStartCallback() {
                    hideErrorMessage();
                    hidePanels();
                },
                onDoneCallback: function onDoneCallback(searchManager) {
                    DrilldownLinker.setSearchDrilldown(datasetPreviewTable.$el.prev('h3'), searchManager.search);
                    Searches.startSearch('outlierVariableSearch');
                },
                onErrorCallback: function onErrorCallback(errorMessage) {
                    Forms.clearChoiceViewOptions(outlierVariableControl);
                    showErrorMessage(errorMessage);
                    hidePanels();
                }
            });
        })();

        (function setupOutlierVariableSearch() {
            Searches.setSearch("outlierVariableSearch", {
                searchString: compact(_templateObject),
                onStartCallback: function onStartCallback() {
                    hideErrorMessage();
                },
                onErrorCallback: function onErrorCallback(errorMessage) {
                    showErrorMessage(errorMessage);
                    hidePanels();
                }
            });
        })();

        (function setupOutlierResultsSearches() {
            Object.keys(outlierResultsSearchSettings).forEach(function (searchName) {
                Searches.setSearch(searchName, {
                    autostart: false,
                    searchString: ['| loadjob $searchBarSearchJobIdToken$'].concat(outlierResultsSearchSettings[searchName].search, [outlierFieldSearchStrings.both]),
                    targetJobIdTokenName: 'outlierResultsSearchToken',
                    onStartCallback: function onStartCallback() {
                        hideErrorMessage();
                        updateForm(true);
                    },
                    onDoneCallback: function onDoneCallback() {
                        showPanels();
                    },
                    onDataCallback: function onDataCallback(data) {
                        var collection = {
                            _time: parseInt(new Date().valueOf() / 1000, 10),
                            search_query: baseSearchString,
                            earliest_time: baseTimerange.earliest_time,
                            latest_time: baseTimerange.latest_time,
                            outlier_variable: Forms.getToken('outlierVariableToken'),
                            threshold_method: Forms.getToken('outlierSearchTypeToken'),
                            threshold_multiplier: Forms.getToken('scaleFactorToken'),
                            window_size: Forms.getToken('windowedAnalysisToken') === 'StreamStats' ? Forms.getToken('windowSizeToken') : 0,
                            use_current_point: Forms.getToken('useCurrentPointToken')
                        };

                        historySerializer.persist(Searches.getSid(searchName), collection);

                        Searches.startSearch('outliersVizSearch');

                        var showOutliersOverTimeViz = false;

                        if (data != null && data.fields != null && data.rows != null && data.rows.length > 0) {
                            var timeIndex = data.fields.indexOf('_time');

                            // plotting the outliers count over time only makes sense on time-series data
                            if (timeIndex > -1 && data.rows[0][timeIndex] != null) {
                                showOutliersOverTimeViz = true;
                            }
                        }

                        if (showOutliersOverTimeViz) {
                            Forms.setToken('showOutliersOverTimeToken', true);
                            Searches.startSearch('outliersOverTimeVizSearch');
                        } else {
                            Forms.unsetToken('showOutliersOverTimeToken');
                        }
                    },
                    onErrorCallback: function onErrorCallback(errorMessage) {
                        showErrorMessage(errorMessage);
                        hidePanels();
                    },
                    onFinallyCallback: function onFinallyCallback() {
                        updateForm(false);
                    }
                });
            });
        })();

        (function setupResultsCountSearch() {
            var sharedSearchArray = ['| stats count'];

            var vizQueryArray = [];
            var vizQuerySearch = null;

            var vizOptions = DrilldownLinker.parseVizOptions({ category: 'singlevalue' });

            singleResultsPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch, vizOptions), '_blank');
            });

            singleResultsPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('resultsCountSearchModal', 'Display the number of results', vizQueryArray, getFullSearchQueryComments().concat(['count the results']), baseTimerange, vizOptions);
            });

            Searches.setSearch("resultsCountSearch", {
                autostart: true,
                targetJobIdTokenName: "resultsCountSearchToken",
                searchString: ['| loadjob $outlierResultsSearchToken$'].concat(sharedSearchArray),
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay(singleResultsPanel.viz.$el);

                    vizQueryArray = getFullSearchQueryArray().concat(sharedSearchArray);
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(singleResultsPanel.title, vizQuerySearch, vizOptions);
                },
                onFinallyCallback: function onFinallyCallback() {
                    Spinners.hideLoadingOverlay(singleResultsPanel.viz.$el);
                }
            });
        })();

        (function setupOutliersCountSearch() {
            var sharedSearchArray = ['| where isOutlier=1', '| stats count'];

            var vizQueryArray = [];
            var vizQuerySearch = null;

            var vizOptions = DrilldownLinker.parseVizOptions({ category: 'singlevalue' });

            singleOutliersPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch, vizOptions), '_blank');
            });

            singleOutliersPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('outliersCountSearchModal', 'Display the number of outliers', vizQueryArray, getFullSearchQueryComments().concat(['show only outliers', 'count the outliers']), baseTimerange, vizOptions);
            });

            Searches.setSearch("outliersCountSearch", {
                autostart: true,
                targetJobIdTokenName: "outliersCountSearchToken",
                searchString: ['| loadjob $outlierResultsSearchToken$'].concat(sharedSearchArray),
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay(singleOutliersPanel.viz.$el);

                    vizQueryArray = getFullSearchQueryArray().concat(sharedSearchArray);
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(singleOutliersPanel.title, vizQuerySearch, vizOptions);
                },
                onDataCallback: function onDataCallback(data) {
                    var countIndex = data.fields.indexOf('count');

                    if (data.rows.length > 0 && countIndex >= 0) {
                        var jobId = Searches.getSid(getCurrentSearchName());

                        var collection = {
                            outliers_count: data.rows[0][countIndex]
                        };

                        historySerializer.persist(jobId, collection);
                    }
                },
                onFinallyCallback: function onFinallyCallback() {
                    Spinners.hideLoadingOverlay(singleOutliersPanel.viz.$el);
                }
            });
        })();

        (function setupOutliersVizSearch() {
            var sharedSearchArray = ['| table _time, $outlierVariableToken|s$, lowerBound, upperBound, isOutlier'];

            var vizQuerySearch = null;
            var vizQueryArray = [];

            var outliersVizAlertModal = null;

            var vizOptions = DrilldownLinker.parseVizOptions({
                category: 'custom',
                type: appName + ".OutliersViz"
            });

            function openInSearch() {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch, vizOptions), '_blank');
            }

            function showSPL(e) {
                // adjust the modal title depending on whether or not the modal is from the plot or not
                var modalTitle = outliersVizPanel.showSPLButton.first().is($(e.target)) ? 'Plot the outliers' : 'Calculate the outliers';

                SearchStringDisplay.showSearchStringModal('outliersVizSearchModal', modalTitle, vizQueryArray, getFullSearchQueryComments(), baseTimerange, vizOptions);
            }

            function scheduleAlert() {
                if (outliersVizAlertModal == null) {
                    (function () {
                        outliersVizAlertModal = new Modal('outliersVizAlertModal', {
                            title: 'Schedule an alert',
                            destroyOnHide: false,
                            type: 'wide'
                        });

                        var outlierSearchTypeControl = new DropdownView({
                            id: 'outliersVizAlertModalTypeControl',
                            el: $('<span>'),
                            labelField: 'label',
                            valueField: 'value',
                            showClearButton: false,
                            choices: [{ value: 'both', label: 'outside both thresholds' }, { value: 'above', label: 'above the upper threshold' }, { value: 'below', label: 'below the lower threshold' }]
                        }).render();

                        var outliersVizAlertModalValueControl = new TextInputView({
                            id: 'outliersVizAlertModalValueControl',
                            el: $('<span>')
                        }).render();

                        outliersVizAlertModal.body.addClass('mlts-modal-form-inline').append($('<p>').text('Alert me when the number of outliers '), outlierSearchTypeControl.$el, $('<p>').text('is greater than '), outliersVizAlertModalValueControl.$el);

                        outliersVizAlertModal.footer.append($('<button>').addClass('mlts-modal-cancel').attr({
                            type: 'button',
                            'data-dismiss': 'modal'
                        }).addClass('btn btn-default mlts-modal-cancel').text('Cancel'), $('<button>').attr({
                            type: 'button'
                        }).on('click', function () {
                            outliersVizAlertModal.removeAlert();

                            var minOutliersCount = outliersVizAlertModalValueControl.val();

                            var isValid = NumberValidator.validate(minOutliersCount, { min: 0 });

                            Messages.setFormInputStatus(outliersVizAlertModalValueControl, isValid);

                            if (isValid) {
                                var searchString = Forms.parseTemplate(getFullSearchQueryArray(outlierSearchTypeControl.val()).join(''));

                                outliersVizAlertModal.hide();

                                var alertModal = new AlertModal({
                                    searchString: searchString
                                });

                                alertModal.model.alert.entry.content.set('ui.scheduled.resultsinput', minOutliersCount);

                                alertModal.render().appendTo($('body')).show();
                            } else {
                                outliersVizAlertModal.setAlert('Alert count must be a positive number.');
                            }
                        }).addClass('btn btn-primary mlts-modal-submit').text('Next'));

                        outliersVizAlertModal.$el.on('show.bs.modal', function () {
                            outliersVizAlertModal.removeAlert();
                            Messages.setFormInputStatus(outliersVizAlertModalValueControl, true);

                            outlierSearchTypeControl.val('both');
                            outliersVizAlertModalValueControl.val(0);
                        });
                    })();
                }

                outliersVizAlertModal.show();
            }

            assistantControlsFooter.controls.openInSearchButton.on('click', openInSearch);
            assistantControlsFooter.controls.showSPLButton.on('click', showSPL);

            outliersVizPanel.openInSearchButton.on('click', openInSearch);
            outliersVizPanel.showSPLButton.on('click', showSPL);

            outliersTablePanel.openInSearchButton.on('click', openInSearch);
            outliersTablePanel.showSPLButton.on('click', showSPL);

            outliersVizPanel.scheduleAlertButton.on('click', scheduleAlert);

            singleOutliersPanel.scheduleAlertButton.on('click', scheduleAlert);

            Searches.setSearch('outliersVizSearch', {
                autostart: false, // this doesn't autostart on purpose, to prevent the chart from flickering when the user changes the "Field to predict" but doesn't actually run the search
                searchString: ['| loadjob $outlierResultsSearchToken$'].concat(sharedSearchArray),
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay(outliersVizPanel.viz.$el);
                    Messages.removeAlert(outliersVizPanel.message, true);
                },
                onDoneCallback: function onDoneCallback() {
                    vizQueryArray = getFullSearchQueryArray().concat(sharedSearchArray);
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(outliersTablePanel.title, vizQuerySearch);
                    DrilldownLinker.setSearchDrilldown(outliersVizPanel.title, vizQuerySearch, vizOptions);
                },
                onDataCallback: function onDataCallback(data) {
                    if (data != null && data.fields != null && data.rows != null && data.rows.length > 0) {
                        (function () {
                            var tableFields = data.fields;
                            var timeIndex = tableFields.indexOf('_time');

                            var outlierVariableToken = Forms.getToken('outlierVariableToken');
                            var outlierVariableIndex = tableFields.indexOf(outlierVariableToken);

                            var nonNumeric = data.rows.every(function (row) {
                                return isNaN(parseFloat(row[outlierVariableIndex]));
                            });

                            if (nonNumeric) {
                                Messages.setAlert(outliersVizPanel.message, "All values in \"" + outlierVariableToken + "\" are non-numeric. You may be able to analyze this data in the \"Detect Categorical Outliers\" assistant.", 'error', 'alert-inline', true);
                            }

                            // if the data isn't time-series, remove the _time column from the table
                            if (timeIndex === -1 || data.rows[0][timeIndex] == null) tableFields.splice(timeIndex, 1);

                            outliersTablePanel.viz.settings.set('fields', tableFields);
                        })();
                    }
                },
                onErrorCallback: function onErrorCallback() {
                    Messages.removeAlert(outliersVizPanel.message, true);
                },
                onFinallyCallback: function onFinallyCallback() {
                    Spinners.hideLoadingOverlay(outliersVizPanel.viz.$el);
                }
            });
        })();

        (function setupOutliersOverTimeVizSearch() {
            var sharedSearchArray = ['| timechart sum(isOutlierUpper), sum(isOutlierLower)'];

            var vizQueryArray = [];
            var vizQuerySearch = null;

            var vizOptions = DrilldownLinker.parseVizOptions({
                category: 'charting',
                type: 'column'
            });

            vizOptions['display.visualizations.charting.chart.stackMode'] = 'stacked';

            outliersOverTimeVizPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQueryArray, vizOptions), '_blank');
            });

            outliersOverTimeVizPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('outliersOverTimeVizSearchModal', 'Plot the outlier count over time', vizQueryArray, getFullSearchQueryComments().concat(['plot the outlier count over time']), baseTimerange, vizOptions);
            });

            Searches.setSearch('outliersOverTimeVizSearch', {
                autostart: false,
                searchString: ['| loadjob $outlierResultsSearchToken$'].concat([outlierFieldSearchStrings.split], sharedSearchArray),
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay(outliersOverTimeVizPanel.viz.$el);

                    vizQueryArray = getFullSearchQueryArray('split').concat(sharedSearchArray);
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(outliersOverTimeVizPanel.title, vizQuerySearch, vizOptions);
                },
                onFinallyCallback: function onFinallyCallback() {
                    Spinners.hideLoadingOverlay(outliersOverTimeVizPanel.viz.$el);
                }
            });
        })();
    }

    (function setupQueryHistorySearch() {
        Searches.setSearch('queryHistorySearch', {
            searchString: compact(_templateObject2, showcaseName)
        });
    })();

    function getCurrentSearchName() {
        return 'outlierSearchType' + Forms.getToken('outlierSearchTypeToken') + Forms.getToken('windowedAnalysisToken');
    }

    function submitForm() {
        // the controlValidity.getAll() check is intentionally made here so that the user can try to submit the form even with empty fields
        // the submission will fail and they'll see the appropriate errors
        if (!assistantControlsFooter.getDisabled() && controlValidity.getAll()) {
            currentSampleSearch = null;

            Object.keys(outlierResultsSearchSettings).forEach(function () {
                return Searches.cancelSearch;
            });

            Searches.startSearch(getCurrentSearchName());
        }
    }

    /**
     * gets the current full search query as an array, where array[0] is the search bar search
     * @param {string} [outliersFilterType='both'] Whether to report points "above", "below", or "both" as outliers
     * @returns {Array}
     */
    function getFullSearchQueryArray() {
        var outliersFilterType = arguments.length <= 0 || arguments[0] === undefined ? 'both' : arguments[0];

        var fullSearchQueryArray = [];
        var outlierResultsSearchQuery = outlierResultsSearchSettings[getCurrentSearchName()];

        if (baseSearchString != null && outlierResultsSearchQuery != null) {
            fullSearchQueryArray[0] = baseSearchString;

            for (var i = 0; i < outlierResultsSearchQuery.search.length; i++) {
                fullSearchQueryArray[i + 1] = outlierResultsSearchQuery.search[i];
            }

            fullSearchQueryArray.push(outlierFieldSearchStrings[outliersFilterType]);
        }

        return fullSearchQueryArray;
    }

    function getFullSearchQueryComments() {
        return [null].concat(outlierResultsSearchSettings[getCurrentSearchName()].description, ['values outside the bounds are outliers']);
    }

    var updateForm = function updateForm(newIsRunningValue) {
        // optionally set a new value for isRunning
        if (newIsRunningValue != null) isRunning = newIsRunningValue;

        outlierVariableControl.settings.set('disabled', isRunning);
        outlierSearchTypeControl.settings.set('disabled', isRunning);
        scaleFactorControl.settings.set('disabled', isRunning);
        windowedAnalysisCheckboxControl.settings.set('disabled', isRunning);
        // don't re-enable windowSizeControl and currentPointCheckboxControl if they're disabled by windowedAnalysisCheckboxControl
        var windowingControlsEnabled = isRunning || !windowedAnalysisCheckboxControl.val();
        windowSizeControl.settings.set('disabled', windowingControlsEnabled);
        currentPointCheckboxControl.settings.set('disabled', windowingControlsEnabled);

        if (isRunning) {
            assistantControlsFooter.setDisabled(true);
            assistantControlsFooter.controls.submitButton.text('Detecting Outliers...');
        } else {
            var outlierVariableToken = Forms.getToken('outlierVariableToken');
            var fieldsValid = outlierVariableToken != null && outlierVariableToken.length > 0;

            assistantControlsFooter.setDisabled(!fieldsValid);
            assistantControlsFooter.controls.submitButton.text(submitButtonText);
        }
    };

    function showErrorMessage(errorMessage) {
        var errorDisplay$El = $("#errorDisplay");
        Messages.setAlert(errorDisplay$El, errorMessage, undefined, undefined, true);
    }

    function hideErrorMessage() {
        var errorDisplay$El = $("#errorDisplay");
        Messages.removeAlert(errorDisplay$El, true);
    }

    function showPanels() {
        Forms.setToken('showResultPanelsToken', true);
    }

    function hidePanels() {
        Forms.unsetToken('showResultPanelsToken');
    }

    function setCurrentSampleSearch(sampleSearch) {
        currentSampleSearch = _.extend({}, {
            outlierSearchType: 'Avg',
            scaleFactor: 2,
            useCurrentPoint: true
        }, sampleSearch);

        var isWindowed = currentSampleSearch.windowSize != null && currentSampleSearch.windowSize > 0;

        outlierSearchTypeControl.val(currentSampleSearch.outlierSearchType);
        scaleFactorControl.val(currentSampleSearch.scaleFactor);

        windowedAnalysisCheckboxControl.val(isWindowed);

        windowSizeControl.val(isWindowed ? currentSampleSearch.windowSize : 0);

        currentPointCheckboxControl.val(currentSampleSearch.useCurrentPoint);

        searchBarControl.setProperties(currentSampleSearch.value, currentSampleSearch.earliestTime, currentSampleSearch.latestTime);

        // outlierVariable is the only part of the sample search that has to be set asynchronously
        // if it's null, we can remove the sample search now
        if (currentSampleSearch.outlierVariable == null) currentSampleSearch = null;
    }

    var tabsControl = function () {
        return new Tabs($('#dashboard-form-tabs'), $('#dashboard-form-controls'));
    }();

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
            Forms.clearChoiceView(outlierVariableControl, true);
            Forms.unsetToken('outlierVariableToken');

            var searchBarSearch = Searches.getSearchManager("searchBarSearch");

            baseSearchString = this.searchBarView.val();
            baseTimerange = this.searchBarView.timerange.val();

            searchBarSearch.settings.unset("search");
            searchBarSearch.settings.set("search", baseSearchString);
            searchBarSearch.search.set(baseTimerange);

            updateForm();
        });
    }();

    // target variable control

    var outlierVariableControl = function () {
        var outlierVariableControl = new DropdownView({
            "id": "outlierVariableControl",
            "managerid": "outlierVariableSearch",
            "el": $("#outlierVariableControl"),
            "labelField": "column",
            "valueField": "column",
            showClearButton: false
        });

        outlierVariableControl.on('datachange', function () {
            if (currentSampleSearch != null) {
                var choices = Forms.getChoiceViewChoices(outlierVariableControl);

                if (choices.indexOf(currentSampleSearch.outlierVariable) >= 0) {
                    outlierVariableControl.val(currentSampleSearch.outlierVariable);
                } else {
                    // if the outlier variable can't be selected, we can remove the sample search since it's no longer relevant
                    currentSampleSearch = null;
                }
            }
        });

        outlierVariableControl.on('change', function (value) {
            Forms.setToken("outlierVariableToken", value);

            updateForm();

            if (currentSampleSearch.autostart !== false) {
                assistantControlsFooter.controls.submitButton.trigger('submit');
            } else {
                // if the sample search isn't auto-running, we want to remove it since it's no longer relevant
                currentSampleSearch = null;
            }
        });

        outlierVariableControl.render();

        return outlierVariableControl;
    }();

    // analysis function control

    var outlierSearchTypeControl = function () {
        var outlierSearchTypeControl = new DropdownView({
            id: 'outlierSearchTypeControl',
            el: $('#outlierSearchTypeControl'),
            labelField: 'label',
            valueField: 'value',
            showClearButton: false,
            choices: [{ value: 'Avg', label: 'Standard Deviation' }, { value: 'MAD', label: 'Median Absolute Deviation' }, { value: 'IQR', label: 'Interquartile Range' }]
        });

        outlierSearchTypeControl.on("change", function (value) {
            Forms.setToken("outlierSearchTypeToken", value);
        });

        outlierSearchTypeControl.render();

        return outlierSearchTypeControl;
    }();

    // outlier scale factor control

    var scaleFactorControl = function () {
        var scaleFactorControl = new TextInputView({
            id: 'scaleFactorControl',
            el: $('#scaleFactorControl')
        });

        controlValidity.set(scaleFactorControl.id, false);

        scaleFactorControl.on('change', function (value) {
            var numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < 0) {
                controlValidity.set(scaleFactorControl.id, false);
                Messages.setTextInputMessage(this, 'Multiplier must be a number greater than zero.');
            } else {
                controlValidity.set(scaleFactorControl.id, true);
                Messages.removeTextInputMessage(this);
                Forms.setToken('scaleFactorToken', value);
            }

            updateForm();
        });

        scaleFactorControl.render();

        return scaleFactorControl;
    }();

    // window size control

    var windowSizeControl = function () {
        var windowSizeControl = new TextInputView({
            id: 'windowSizeControl',
            el: $('#windowSizeControl')
        });

        windowSizeControl.on('change', function (value) {
            Forms.setToken('windowSizeToken', parseInt(value, 10));
            updateWindowSizeControlValidity();
        });

        windowSizeControl.render();

        return windowSizeControl;
    }();

    // whether to use windowed analysis or not (streamstats vs eventstats)
    // this is defined after windowSizeControl on purpose

    var windowedAnalysisCheckboxControl = function () {
        var windowedAnalysisCheckboxControl = new CheckboxView({
            id: 'windowedAnalysisCheckboxControl',
            el: $('#windowedAnalysisCheckboxControl'),
            value: true
        });

        windowedAnalysisCheckboxControl.on('change', function (isWindowed) {
            updateWindowSizeControlValidity();

            Forms.setToken('windowedAnalysisToken', isWindowed ? 'StreamStats' : 'EventStats');
        });

        windowedAnalysisCheckboxControl.render();

        return windowedAnalysisCheckboxControl;
    }();

    var currentPointCheckboxControl = function () {
        var currentPointCheckboxControl = new CheckboxView({
            id: 'currentPointCheckboxControl',
            el: $('#currentPointCheckboxControl'),
            value: true
        });

        currentPointCheckboxControl.on('change', function (useCurrent) {
            updateWindowSizeControlValidity();

            Forms.setToken('useCurrentPointToken', useCurrent);
        });

        currentPointCheckboxControl.render();

        return currentPointCheckboxControl;
    }();

    // after rendering, re-parent currentPointCheckboxControl to windowSizeControl so that it's on the same line (and above the potential error message)
    windowSizeControl.$el.append(currentPointCheckboxControl.$el.parent());

    /**
     * Update the validity of the windowSizeControl, which depends on the values of both itself and the windowedAnalysisCheckboxControl
     */
    function updateWindowSizeControlValidity() {
        if (windowSizeControl != null && windowedAnalysisCheckboxControl != null && currentPointCheckboxControl != null) {
            var windowSize = windowSizeControl.val();
            var isWindowed = windowedAnalysisCheckboxControl.val();

            if (isWindowed && (isNaN(windowSize) || windowSize <= 0)) {
                controlValidity.set(windowSizeControl.id, false);
                Messages.setTextInputMessage(windowSizeControl, 'Number of samples must be a positive integer.');
            } else {
                controlValidity.set(windowSizeControl.id, true);
                Messages.removeTextInputMessage(windowSizeControl);
            }

            windowSizeControl.settings.set("disabled", !isWindowed);
            currentPointCheckboxControl.settings.set("disabled", !isWindowed);

            updateForm();
        }
    }

    var assistantControlsFooter = function () {
        var assistantControlsFooter = new AssistantControlsFooter($('#assistantControlsFooter'), submitButtonText);

        assistantControlsFooter.controls.submitButton.on('submit', function () {
            submitForm();
        });

        return assistantControlsFooter;
    }();

    var queryHistoryPanel = new QueryHistoryTable($('#queryHistoryPanel'), 'queryHistorySearch', historyCollectionId, ['Actions', '_time', 'Search query', 'Field to analyze', 'Threshold method', 'Threshold multiplier', 'Sliding window', 'Include current point', '# of outliers'], submitButtonText, function (params, autostart) {
        var sampleSearch = {
            value: params.data['row.search_query'],
            earliestTime: params.data['row.earliest_time'],
            latestTime: params.data['row.latest_time'],
            outlierVariable: params.data['row.outlier_variable'],
            outlierSearchType: params.data['row.threshold_method'],
            scaleFactor: params.data['row.threshold_multiplier'],
            windowSize: params.data['row.window_size'],
            // Splunk searches map boolean true to "1" and boolean false to "0"
            // defaulting to true instead of false here because this value didn't exist in early history entries
            useCurrentPoint: params.data['row.use_current_point'] !== "0",
            autostart: autostart
        };

        setCurrentSampleSearch(sampleSearch);
        tabsControl.activate('newOutliers');
    });

    var singleOutliersPanel = function () {
        return new AssistantPanel($('#singleOutliersPanel'), 'Outlier(s)', SingleView, {
            id: 'singleOutliersViz',
            managerid: 'outliersCountSearch',
            underLabel: 'Outlier(s)'
        }, { footerButtons: { scheduleAlertButton: true } });
    }();

    var singleResultsPanel = function () {
        return new AssistantPanel($('#singleResultsPanel'), 'Total Event(s)', SingleView, {
            id: 'singleResultsViz',
            managerid: 'resultsCountSearch',
            underLabel: 'Total Event(s)'
        });
    }();

    var outliersVizPanel = function () {
        var vizName = 'OutliersViz';
        var OutliersViz = VisualizationRegistry.getVisualizer(appName, vizName);

        var assistantPanel = new AssistantPanel($('#outliersPanel'), 'Outlier(s)', OutliersViz, _defineProperty({
            id: 'outliersViz',
            managerid: 'outliersVizSearch'
        }, appName + "." + vizName + ".onClick", function undefined(point) {
            if (!isNaN(point.y)) {
                var yValue = point.originalY != null ? Forms.escape(point.originalY) : Forms.escape(point.y);
                var searchQuery = getFullSearchQueryArray().concat([" | search $outlierVariableToken|s$=" + yValue]);

                var search = DrilldownLinker.createSearch(searchQuery, baseTimerange);

                window.open(DrilldownLinker.getUrl('search', search), "_blank");
            }
        }), {
            footerButtons: {
                scheduleAlertButton: true
            }
        });

        assistantPanel.message = $('<div.mlts-panel-message>');
        assistantPanel.message.insertAfter(assistantPanel.title);

        return assistantPanel;
    }();

    var outliersOverTimeVizPanel = function () {
        return new AssistantPanel($('#outliersOverTimePanel'), 'Outlier Count Over Time', ChartView, {
            id: 'outliersOverTimeViz',
            managerid: 'outliersOverTimeVizSearch',
            type: 'column',
            'charting.legend.placement': 'bottom',
            'charting.chart.stackMode': 'stacked'
        });
    }();

    var datasetPreviewTable = function () {
        return new TableView({
            id: 'datasetPreviewTable',
            el: $('#datasetPreviewPanel'),
            managerid: 'searchBarSearch'
        });
    }();

    var outliersTablePanel = function () {
        return new AssistantPanel($('#outliersTablePanel'), 'Data and Outliers', TableView, {
            id: 'outliersTable',
            managerid: 'outliersVizSearch',
            sortKey: 'isOutlier',
            sortDirection: 'desc'
        });
    }();

    // update validity for the initial state of the window size controls
    updateWindowSizeControlValidity();

    // set up the searches
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