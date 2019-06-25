'use strict';

var _templateObject = _taggedTemplateLiteral(["| loadjob $searchBarSearchJobIdToken$\n                                       | head 1\n                                       | transpose\n                                       | table column\n                                       | search column != \"column\" AND column != \"_*\""], ["| loadjob $searchBarSearchJobIdToken$\n                                       | head 1\n                                       | transpose\n                                       | table column\n                                       | search column != \"column\" AND column != \"_*\""]),
    _templateObject2 = _taggedTemplateLiteral(["| loadjob $anomalyDetectionResultsToken$ | stats count"], ["| loadjob $anomalyDetectionResultsToken$ | stats count"]),
    _templateObject3 = _taggedTemplateLiteral(["| inputlookup ", "_lookup\n                                   | eval \"Search query\"=search_query, \"Field(s) to analyze\"=anomaly_fields,\n                                   \"# of outliers\"=outliers_count"], ["| inputlookup ", "_lookup\n                                   | eval \"Search query\"=search_query, \"Field(s) to analyze\"=anomaly_fields,\n                                   \"# of outliers\"=outliers_count"]);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

require(["jquery", "underscore", "splunkjs/mvc", "splunkjs/mvc/checkboxview", "splunkjs/mvc/singleview", "splunkjs/mvc/tableview", "splunkjs/mvc/textinputview", "splunkjs/mvc/dropdownview", "components/splunk/AlertModal", "components/splunk/EnhancedMultiDropdownView", "components/splunk/Searches", "components/splunk/Forms", "components/splunk/KVStore", "components/splunk/SearchBarWrapper", "components/splunk/TableUtils", "components/data/parameters/ParseSearchParameters", "components/data/formatters/compactTemplateString", "components/data/serializers/ShowcaseHistorySerializer", "components/controls/QueryHistoryTable", "components/controls/AssistantControlsFooter", "components/controls/AssistantPanel/Master", "components/controls/Modal", "components/controls/Tabs", "components/data/parameters/ColorPalette", "components/controls/DrilldownLinker", "components/controls/Messages", "Options", "components/controls/SearchStringDisplay", "components/controls/Spinners", "components/data/sampleSearches/SampleSearchLoader", "components/data/validators/NumberValidator"], function ($, _, mvc, CheckboxView, SingleView, TableView, TextInputView, DropdownView, AlertModal, EnhancedMultiDropdownView, Searches, Forms, KVStore, SearchBarWrapper, TableUtils, ParseSearchParameters, compact, ShowcaseHistorySerializer, QueryHistoryTable, AssistantControlsFooter, AssistantPanel, Modal, Tabs, ColorPalette, DrilldownLinker, Messages, Options, SearchStringDisplay, Spinners, SampleSearchLoader, NumberValidator) {
    var showcaseName = 'showcase_categorical_outlier_detection';
    var smallLoaderScale = Options.getOptionByName('smallLoaderScale');
    var multiDropdownSelectAllLimit = Options.getOptionByName('multiDropdownSelectAllLimit');

    var submitButtonText = 'Detect Outliers';
    var historyCollectionId = showcaseName + "_history";

    var baseSearchString = null;
    var baseTimerange = null;
    var currentSampleSearch = null;
    var isRunning = false;

    var historySerializer = new ShowcaseHistorySerializer(historyCollectionId, {
        _time: null,
        search_query: null,
        earliest_time: null,
        latest_time: null,
        anomaly_fields: null,
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

        (function setupAnomalyFieldsSearch() {
            Searches.setSearch("anomalyFieldsSearch", {
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

        (function setupAnomalyDetectionResultsSearch() {
            var sharedSearchArray = ['| anomalydetection $anomalyFieldsToken$ action=annotate', '| eval isOutlier = if(probable_cause != "", "1", "0")', '| table $anomalyFieldsToken$, probable_cause, isOutlier', '| sort probable_cause'];

            var vizQueryArray = [];
            var vizQuerySearch = null;

            var outliersTableAlertModal = null;

            function openInSearch() {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch), '_blank');
            }

            function showSPL() {
                SearchStringDisplay.showSearchStringModal('anomalyDetectionResultsSearchModal', 'Display the outliers in search', vizQueryArray, [null, 'compute the categorical outliers', 'add a field to identify the outliers', 'reorder the fields', 'sort the results to make outliers appear at the top'], baseTimerange);
            }

            function scheduleAlert() {
                if (outliersTableAlertModal == null) {
                    (function () {
                        outliersTableAlertModal = new Modal('outliersTableAlertModal', {
                            title: 'Schedule an alert',
                            destroyOnHide: false
                        });

                        var outliersTableAlertModalValueControl = new TextInputView({
                            id: 'outliersTableAlertModalValueControl',
                            el: $('<span>')
                        }).render();

                        var outliersTableAlertModalProbableCausesControl = new EnhancedMultiDropdownView({
                            id: 'outliersTableAlertModalProbableCausesControl',
                            el: $('<span>'),
                            width: 300,
                            allowCustomValues: true,
                            choices: []
                        }).render();

                        var outliersTableAlertModalProbableCausesCheckboxControl = new CheckboxView({
                            id: 'outliersTableAlertModalProbableCausesCheckboxControl',
                            el: $('<span>'),
                            default: false
                        }).on('change', function (checked) {
                            outliersTableAlertModalProbableCausesControl.settings.set('disabled', !checked);
                        }).render();

                        outliersTableAlertModal.body.addClass('mlts-modal-form-inline').append($('<p>').text('Alert me when the number of outliers is greater than'), outliersTableAlertModalValueControl.$el, $('<br>'), $('<label>').addClass('checkbox').append(outliersTableAlertModalProbableCausesCheckboxControl.$el, $('<span>').text('Alert only for outliers with the following probable_cause:')), outliersTableAlertModalProbableCausesControl.$el);

                        outliersTableAlertModal.footer.append($('<button>').addClass('mlts-modal-cancel').attr({
                            type: 'button',
                            'data-dismiss': 'modal'
                        }).addClass('btn btn-default mlts-modal-cancel').text('Cancel'), $('<button>').attr({
                            type: 'button'
                        }).on('click', function () {
                            outliersTableAlertModal.removeAlert();

                            var minOutliersCount = outliersTableAlertModalValueControl.val();

                            var isValid = NumberValidator.validate(minOutliersCount, { min: 0 });

                            Messages.setFormInputStatus(outliersTableAlertModalValueControl, isValid);

                            if (isValid) {
                                var probableCauses = outliersTableAlertModalProbableCausesCheckboxControl.val() ? outliersTableAlertModalProbableCausesControl.val() : [];
                                var probableCauseSearch = probableCauses.length > 0 ? ' | where ' + probableCauses.map(function (probableCause) {
                                    return "probable_cause = \"" + probableCause + "\"";
                                }).join(' OR ') : '';

                                var searchString = Forms.parseTemplate(baseSearchString + ' | anomalydetection $anomalyFieldsToken$' + probableCauseSearch);

                                outliersTableAlertModal.hide();

                                var alertModal = new AlertModal({
                                    searchString: searchString
                                });

                                alertModal.model.alert.entry.content.set('ui.scheduled.resultsinput', minOutliersCount);

                                alertModal.render().appendTo($('body')).show();
                            } else {
                                outliersTableAlertModal.setAlert('Alert count must be a positive number.');
                            }
                        }).addClass('btn btn-primary mlts-modal-submit').text('Next'));

                        outliersTableAlertModal.$el.on('show.bs.modal', function () {
                            outliersTableAlertModal.removeAlert();
                            Messages.setFormInputStatus(outliersTableAlertModalValueControl, true);

                            outliersTableAlertModalProbableCausesCheckboxControl.val(false);
                            outliersTableAlertModalProbableCausesControl.val([]);
                            outliersTableAlertModalProbableCausesControl.settings.set('disabled', true);

                            outliersTableAlertModalValueControl.val(0);

                            outliersTableAlertModalProbableCausesControl.settings.set('choices', []);

                            Searches.getSearchResults('anomalyDetectionResultsSearch').on('data', function (searchResults, data) {
                                var probableCauseFieldIndex = data.fields.indexOf('probable_cause');

                                if (probableCauseFieldIndex > -1) {
                                    // _.compact removes rows that don't have a probable_cause
                                    var choices = _.compact(_.uniq(data.rows.map(function (row) {
                                        return row[probableCauseFieldIndex];
                                    })).map(function (choice) {
                                        return choice != null ? { value: choice } : choice;
                                    }));

                                    outliersTableAlertModalProbableCausesControl.settings.set('choices', choices);
                                }
                            });
                        });
                    })();
                }

                outliersTableAlertModal.show();
            }

            assistantControlsFooter.controls.openInSearchButton.on('click', openInSearch);
            assistantControlsFooter.controls.showSPLButton.on('click', showSPL);

            outliersTablePanel.openInSearchButton.on('click', openInSearch);
            outliersTablePanel.showSPLButton.on('click', showSPL);

            outliersTablePanel.scheduleAlertButton.on('click', scheduleAlert);
            singleOutliersPanel.scheduleAlertButton.on('click', scheduleAlert);

            Searches.setSearch("anomalyDetectionResultsSearch", {
                targetJobIdTokenName: "anomalyDetectionResultsToken",
                autostart: false,
                searchString: ['| loadjob $searchBarSearchJobIdToken$'].concat(sharedSearchArray),
                onStartCallback: function onStartCallback() {
                    hidePanels();
                    updateForm(true);

                    var jobId = Searches.getSid('anomalyDetectionResultsSearch');

                    var anomalyFieldsToken = Forms.getToken('anomalyFieldsToken');
                    var anomalyFieldsArray = anomalyFieldsToken.slice(1, anomalyFieldsToken.length - 1).split('" "');

                    var collection = {
                        _time: parseInt(new Date().valueOf() / 1000, 10),
                        search_query: baseSearchString,
                        earliest_time: baseTimerange.earliest_time,
                        latest_time: baseTimerange.latest_time,
                        anomaly_fields: anomalyFieldsArray
                    };

                    historySerializer.persist(jobId, collection);

                    vizQueryArray = [baseSearchString].concat(sharedSearchArray);
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(outliersTablePanel.title, vizQuerySearch);
                },
                onDoneCallback: function onDoneCallback() {
                    showPanels();
                },
                onFinallyCallback: function onFinallyCallback() {
                    updateForm(false);
                }
            });
        })();

        (function setupAnomalousEventsCountSearch() {
            var vizQueryArray = [];
            var vizQuerySearch = null;

            var vizOptions = DrilldownLinker.parseVizOptions({ category: 'singlevalue' });

            singleOutliersPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch, vizOptions), '_blank');
            });

            singleOutliersPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('anomalousEventsCountSearchModal', 'Display the number of outliers', vizQueryArray, [null, 'compute the categorical outliers', 'count the outliers'], baseTimerange, vizOptions);
            });

            Searches.setSearch("anomalousEventsCountSearch", {
                targetJobIdTokenName: "anomalousEventsCountToken",
                searchString: "| loadjob $anomalyDetectionResultsToken$ | where isOutlier=1 | stats count",
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay(singleOutliersPanel.viz.$el);

                    vizQueryArray = [baseSearchString, '| anomalydetection $anomalyFieldsToken$', '| stats count'];
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(singleOutliersPanel.title, vizQuerySearch, vizOptions);
                },
                onDataCallback: function onDataCallback(data) {
                    var countIndex = data.fields.indexOf('count');
                    if (data.rows.length > 0 && countIndex >= 0) {
                        var searchManager = Searches.getSearchManager("anomalyDetectionResultsSearch");
                        var jobId = Searches.getSid(searchManager);

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

        (function setupAnomalyDetectionResultsCountSearch() {
            var vizQueryArray = [];
            var vizQuerySearch = null;

            var vizOptions = DrilldownLinker.parseVizOptions({ category: 'singlevalue' });

            singleResultsPanel.openInSearchButton.on('click', function () {
                window.open(DrilldownLinker.getUrl('search', vizQuerySearch, vizOptions), '_blank');
            });

            singleResultsPanel.showSPLButton.on('click', function () {
                SearchStringDisplay.showSearchStringModal('anomalyDetectionResultsCountSearchModal', 'Display the number of results', vizQueryArray, [null, 'annotate the results with categorical outliers', 'count the results'], baseTimerange, vizOptions);
            });

            Searches.setSearch("anomalyDetectionResultsCountSearch", {
                targetJobIdTokenName: "anomalyDetectionResultsCountToken",
                searchString: compact(_templateObject2),
                onStartCallback: function onStartCallback() {
                    Spinners.showLoadingOverlay(singleResultsPanel.viz.$el);

                    vizQueryArray = [baseSearchString, '| anomalydetection $anomalyFieldsToken$ action=annotate', '| stats count'];
                    vizQuerySearch = DrilldownLinker.createSearch(vizQueryArray, baseTimerange);

                    DrilldownLinker.setSearchDrilldown(singleResultsPanel.title, vizQueryArray, vizOptions);
                },
                onFinallyCallback: function onFinallyCallback(data) {
                    Spinners.hideLoadingOverlay(singleResultsPanel.viz.$el);
                }
            });
        })();
    }

    function loadSavedSearch(sampleSearch) {
        tabsControl.activate('newOutliers');
        currentSampleSearch = sampleSearch;

        searchBarControl.setProperties(sampleSearch.value, sampleSearch.earliestTime, sampleSearch.latestTime);
    }

    var tabsControl = function () {
        return new Tabs($('#dashboard-form-tabs'), $('#dashboard-form-controls'));
    }();

    (function setupQueryHistorySearch() {
        Searches.setSearch('queryHistorySearch', {
            searchString: compact(_templateObject3, showcaseName)
        });
    })();

    var queryHistoryPanel = new QueryHistoryTable($('#queryHistoryPanel'), 'queryHistorySearch', historyCollectionId, ['Actions', '_time', 'Search query', 'Field(s) to analyze', '# of outliers'], submitButtonText, function (params, autostart) {
        var sampleSearch = {
            value: params.data['row.search_query'],
            earliestTime: params.data['row.earliest_time'],
            latestTime: params.data['row.latest_time'],
            anomalyFields: typeof params.data['row.anomaly_fields'] === 'string' ? [params.data['row.anomaly_fields']] : params.data['row.anomaly_fields'],
            autostart: autostart
        };

        loadSavedSearch(sampleSearch);
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
            Forms.clearChoiceView(anomalyFieldsControl, true);

            Forms.unsetToken('anomalyFieldsToken', 'anomalyDetectionResultsToken');

            var searchBarSearch = Searches.getSearchManager("searchBarSearch");

            baseSearchString = this.searchBarView.val();
            baseTimerange = this.searchBarView.timerange.val();

            searchBarSearch.settings.unset("search");
            searchBarSearch.settings.set("search", baseSearchString);
            searchBarSearch.search.set(baseTimerange);

            updateForm();
        });
    }();

    var anomalyFieldsControl = function () {
        var anomalyFieldsControl = new EnhancedMultiDropdownView({
            "id": "anomalyFieldsControl",
            "managerid": "anomalyFieldsSearch",
            "el": $("#anomalyFieldsControl"),
            "labelField": "column",
            "valueField": "column",
            "width": 400
        });

        anomalyFieldsControl.on("datachange", function () {
            if (currentSampleSearch != null) {
                var choices = Forms.getChoiceViewChoices(anomalyFieldsControl);
                var validChoices = Forms.intersect(choices, currentSampleSearch.anomalyFields);

                anomalyFieldsControl.val(validChoices);

                if (currentSampleSearch != null && currentSampleSearch.autostart !== false) {
                    assistantControlsFooter.controls.submitButton.trigger('submit');
                } else {
                    // if the sample search isn't auto-running, we want to remove it since it's no longer relevant
                    currentSampleSearch = null;
                }
            }
        });

        anomalyFieldsControl.on("change", function (values) {
            if (values != null && values.length > 0) {
                Forms.setToken("anomalyFieldsToken", "\"" + values.join('" "') + "\"");
            } else {
                Forms.unsetToken("anomalyFieldsToken");
            }

            updateForm();
        });

        anomalyFieldsControl.render();

        return anomalyFieldsControl;
    }();

    var assistantControlsFooter = function () {
        var assistantControlsFooter = new AssistantControlsFooter($('#assistantControlsFooter'), submitButtonText);

        assistantControlsFooter.controls.submitButton.on('submit', function () {
            currentSampleSearch = null;
            Searches.startSearch('anomalyDetectionResultsSearch');
        });

        return assistantControlsFooter;
    }();

    function updateForm(newIsRunningValue) {
        // optionally set a new value for isRunning
        if (newIsRunningValue != null) isRunning = newIsRunningValue;

        anomalyFieldsControl.settings.set('disabled', isRunning);

        if (isRunning) {
            assistantControlsFooter.setDisabled(true);
            assistantControlsFooter.controls.submitButton.text('Detecting Outliers...');
        } else {
            var anomalyFieldsToken = Forms.getToken('anomalyFieldsToken');

            var fieldsValid = anomalyFieldsToken != null && anomalyFieldsToken.length > 0;

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

    function showPanels() {
        Forms.setToken('showResultPanelsToken', true);
    }

    function hidePanels() {
        Forms.unsetToken('showResultPanelsToken');
    }

    var singleOutliersPanel = function () {
        return new AssistantPanel($('#singleOutliersPanel'), 'Outlier(s)', SingleView, {
            id: 'singleOutliersViz',
            managerid: 'anomalousEventsCountSearch',
            underLabel: 'Outlier(s)'
        }, { footerButtons: { scheduleAlertButton: true } });
    }();

    var singleResultsPanel = function () {
        return new AssistantPanel($('#singleResultsPanel'), 'Total Event(s)', SingleView, {
            id: 'singleResultsViz',
            managerid: 'anomalyDetectionResultsCountSearch',
            underLabel: 'Total Event(s)'
        });
    }();

    var datasetPreviewTable = function () {
        return new TableView({
            id: 'datasetPreviewTable',
            el: $('#datasetPreviewPanel'),
            managerid: 'searchBarSearch'
        }).render();
    }();

    var outliersTablePanel = function () {
        var assistantPanel = new AssistantPanel($('#outliersTablePanel'), 'Data and Outliers', TableView, {
            id: 'outliersTable',
            managerid: 'anomalyDetectionResultsSearch',
            drilldown: 'none'
        }, {
            footerButtons: {
                scheduleAlertButton: true
            }
        });

        var outlierFieldIndexArray = [];
        var fieldsCache = [];

        var HighlightedTableRender = TableView.BaseCellRenderer.extend({
            canRender: function canRender() {
                return true;
            },
            render: function render($td, cell) {
                fieldsCache.push(cell.field);
                $td.text(cell.value);

                if (cell.field === "probable_cause" && cell.value != null) {
                    //find the index of outlier field in this row and save it.
                    outlierFieldIndexArray.push(fieldsCache.indexOf(cell.value));
                    $td.addClass('outlier-event'); // bold the probable_cause field name
                } else if (cell.field === "isOutlier") {
                    fieldsCache = [];

                    var icon = 'check';
                    var colorIndex = 7;

                    if (cell.value === '1') {
                        icon = 'alert';
                        colorIndex = 1;
                    }

                    $td.addClass('icon-inline').html(_.template('<i class="icon-<%-icon%>" style="color: <%-color%>"></i> &#160 <%- text %> ', {
                        icon: icon,
                        text: cell.value,
                        color: ColorPalette.getColorByIndex(colorIndex)
                    }));
                }

                $td.addClass(TableUtils.columnTypeToClassName(cell.columnType));
            }
        });

        assistantPanel.viz.addCellRenderer(new HighlightedTableRender());

        assistantPanel.viz.on('rendered', function () {
            assistantPanel.viz.$el.find('td.outlier-event.string').each(function (index) {
                //highlight the outlier field from index array
                if (outlierFieldIndexArray[index] != null) {
                    var fieldIndex = outlierFieldIndexArray[index];
                    $(this).parents('tr').find('td:eq(' + fieldIndex + ')').css("background-color", ColorPalette.getColorByIndex(1));
                }
            });
            outlierFieldIndexArray = [];
        });

        return assistantPanel;
    }();

    setupSearches();

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