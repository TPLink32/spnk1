/* 
 * The SearchRunner is a wrapper to run searches via the core search manager that
 * encapsulates the event handlers to ensure search manager events are handled uniformly
 */

define([
        'jquery',
        'underscore',
        'common/Class',
        'splunkjs/mvc/searchmanager'
        ],
        function(
            $,
            _,
            Class,
            SearchManager
            ) {
    var SearchRunner = function(
        searchManager,
        resultsModel,
        failureCallback,
        successCallback,
        startCallback,
        progressCallback
        ) {
        this.checkValidProperty(searchManager);
        this.checkValidProperty(failureCallback);
        this.checkValidProperty(successCallback);
        this.checkValidProperty(startCallback);
        this.checkValidProperty(progressCallback);
        
        if (_.isUndefined(resultsModel) || _.isNull(resultsModel)) {
            resultsModel = searchManager.data('preview', {
                count: 0,
                offset: 0
            });
        }
        
        this.checkValidProperty(resultsModel);
        
        this._searchManager = searchManager;
        this._resultsModel = resultsModel;
        this._failureCallback = failureCallback;
        this._successCallback = successCallback;
        this._startCallback = startCallback;
        this._progressCallback = progressCallback;
    }
    
    var SearchRunnerClass = Class.makeClass(SearchRunner);
        
    SearchRunnerClass.runSearch = function(deferRun) {
        var that = this;
        
        this._searchManager.on(
            "search:cancelled",
            function() {
                that._failureCallback(
                    'The search got cancelled.' + 
                    ' Search string is: "' +  that._searchManager.settings.get('search') + '"'
                    );
            },
            this
            );
        
        this._searchManager.on(
            "search:error",
            function(message, error) {
                var errorMessage = 'The search returned error "' + message + '".';
                    
                if (!_.isUndefined(error) && !_.isNull(error)) {
                    errorMessage += 'Detailed error: "' + error.error +
                        '(' + error.status + ') - ' + error.data.messages[0].text + '"';
                }
                
                that._failureCallback(
                    errorMessage + ' Search string is: "' +  that._searchManager.settings.get('search') + '"'
                    );
            },
            this
            );
        
        this._searchManager.on(
            "search:fail",
            function(state, job) {
                that._failureCallback(
                    'The search failed with error "' +  state.content.messages[0].text + '".' +
                    ' Search string is: "' +  that._searchManager.settings.get('search') + '"'
                    );
            },
            this
            );
        
        this._searchManager.on(
            "search:start",
            function() {
                that._startCallback();
            },
            this
            );
        
        this._searchManager.on(
            "search:progress",
            function(properties) {
                that._progressCallback(properties.content.isDone, properties);
            },
            this
            );
        
        this._searchManager.on(
            "search:done",
            function(properties) {
                that._progressCallback(properties.content.isDone, properties);
            },
            this
            );
        
        this._resultsModel.on(
            "error",
            function(message, error) {
                var errorMessage = 'The search returned error "' + message + '".';
                
                if (!_.isUndefined(error) && !_.isNull(error)) {
                    errorMessage += 'Detailed error: "' + error.error +
                        '(' + error.status + ') - ' + error.data.messages[0].text + '"';
                }
                
                that._failureCallback(
                    errorMessage + ' Search string is: "' +  that._searchManager.settings.get('search') + '"'
                    );
            },
            this
            );
        
        this._resultsModel.on(
            "data",
            function() {
                that._successCallback(this._resultsModel.data());
            },
            this
            );
        
        if (_.isUndefined(deferRun) || _.isNull(deferRun) || deferRun === true) {
            this._searchManager.startSearch();
        }
    }
    
    SearchRunnerClass.checkValidProperty = function(property) {
        if (_.isUndefined(property) || _.isNull(property)) {
            throw property + ' is invalid';
        }
    }
    
    return SearchRunner;
});