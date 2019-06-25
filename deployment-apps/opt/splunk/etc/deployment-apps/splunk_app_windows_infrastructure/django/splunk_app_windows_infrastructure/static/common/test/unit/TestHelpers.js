define(['jquery', 'underscore'], function($, _) {
    var TestHelpers = {
        emitTestPassed: function(testOutputSel) {
            $(testOutputSel).append(
                '<div class="test-pass">Test Passed</div>'
                );
        },
        
        emitTestFailed: function(testOutputSel) {
            $(testOutputSel).append(
                '<div class="test-error">Test Failed</div>'
                );
        },
        
        emitTestProgress: function(testOutputSel, message) {
            $(testOutputSel).append(
                '<div class="test-progress">' + message + '</div>'
                );
        },
        
        emitTestError: function(testOutputSel, message) {
            $(testOutputSel).append(
                '<div class="test-error">' + message + '</div>'
                );
        },
        
        markAsDone: function(testOutputSel) {
            $(testOutputSel ).find('#test-status').text('Done');
        },
        
        startNewTest: function(title, elId) {
            var testEl = '#' + elId;
            $(testEl).remove();
            $('#test-progress-board').append(
                '<div class="dashboard-row">\
                    <div class="test-title" id="' + elId + '" style="padding-top: 20px">' +
                    title + '</div>\
                </div>'
                );
            
            $(testEl).append('<div id="test-status" class="test-status">Running ...</div>');
            
            return testEl;
        },
        
        restErrorToMessage: function(restError) {
            return ('"' + restError.status + 
                '(' + restError.error + '): ' + 
                restError.data.messages[0].text + '"');
        },
        
        runSearch: function(
            searchManager,
            expectedResultsCount,
            callBackOnSuccess,
            callBackOnFailure,
            callBackOnCompletion
            ) {
            var that = this;
            
            var resultsModel = searchManager.data('preview', {
                count: 0,
                offset: 0
            });
            
            var searchDisplayName =
                !_.isUndefined(searchManager.attributes.search) ?
                    searchManager.attributes.search :
                    searchManager.attributes.searchname;
            
            searchManager.on(
                "search:cancelled",
                function() {
                    callBackOnFailure(
                        'The search"' + 
                        searchDisplayName +
                        '" got cancelled'
                        );
                },
                this
                );
            
            searchManager.on(
                "search:error",
                function(message, error) {
                    callBackOnFailure(
                        'The search"' + searchDisplayName + '" returned error "' +
                        message + ' - ' + error.data.messages[0].text + '"'
                        );
                },
                this
                );
            
            searchManager.on(
                "search:fail",
                function(state, job) {
                    callBackOnFailure(
                        'The search"' + searchDisplayName + '" failed with error "' + 
                        state.content.messages[0].text + '"'
                        );
                },
                this
                );
            
            searchManager.on(
                "search:done",
                function(properties) {
                    callBackOnCompletion(properties);
                },
                this
                );
            
            resultsModel.on(
                "error",
                function(message, error) {
                    callBackOnFailure(
                        'The search"' + searchDisplayName + '" returned error "' +
                        message + ' - ' + error.data.messages[0].text + '"'
                        );
                },
                this
                );
            
            var processResultsModelData = function() {
                var rowCount = resultsModel.data().rows.length;
                
                if (rowCount > 0) {
                    if (!_.isUndefined(expectedResultsCount) && !_.isNull(expectedResultsCount)) {
                        if (expectedResultsCount === rowCount) {
                            callBackOnSuccess(resultsModel.data());
                        } else {
                            callBackOnFailure(
                                'The search "' + searchDisplayName + '" returned ' +
                                rowCount + ' entries, but expected count was ' +
                                expectedResultsCount
                                );
                        }
                    } else {
                        callBackOnSuccess(resultsModel.data());
                    }
                } else {
                    callBackOnFailure(
                        'The search "' + searchDisplayName + 
                        '" returned no events'
                        );
                }
            }

            // Fire only once if we don't care about the result count
            if (!_.isUndefined(expectedResultsCount) && !_.isNull(expectedResultsCount)) {
                resultsModel.on(
                    "data",
                    processResultsModelData,
                    this
                );
            } else {
                resultsModel.once(
                    "data",
                    processResultsModelData,
                    this
                );
            }
            
            searchManager.startSearch();
        }
    };
        
    return TestHelpers;
});