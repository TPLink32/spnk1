define([
        'jquery',
        'underscore',
        'common/Class',
        'common/statestore/statestorewrapper',
        'common/test/unit/TestHelpers',
        'common/test/unit/UnitTestBase'
        ],
        function(
            $,
            _,
            Class,
            StateStoreWrapper,
            TestHelpers,
            UnitTestBase
            )
{
    var StateStoreWrapperTests = function() {
        this._testCollectionName = 'testCollection';
        this._keyFieldName = '_key';
        this._indexFieldName = 'testIndex';
    }
    
    var StateStoreWrapperTestsClass = Class.makeInheritedClass(UnitTestBase, StateStoreWrapperTests);
    
    StateStoreWrapperTestsClass.setup = function() {
        this.defineTest(
            'StateStoreWrapperTests',
            'State Store Wrapper Tests',
            'state-store-wrapper-tests'
            );
    }
    
    StateStoreWrapperTestsClass.run = function() {
        this.runCreateStep();
    }
    
    StateStoreWrapperTestsClass.runCreateStep = function() {
        var that = this;
        
        this.emitTestProgress('Test creation of collection ...');
        
        StateStoreWrapper.createCollection(
            this._testCollectionName,
            [this._indexFieldName],
            function(error, result) {
                if (_.isUndefined(error) || _.isNull(error)) {
                    that.emitTestProgress(
                        'Collection named ' + that._testCollectionName + '\
                        created successfully'
                        );
                    
                    that.runReCreateStep();
                } else {
                    that.emitTestError(
                        'Creation of collection named ' + that._testCollectionName + 
                        ' failed with error ' + TestHelpers.restErrorToMessage(error)
                        );
                    
                    that.emitTestFailed();
                }
            });
    }

    StateStoreWrapperTestsClass.runReCreateStep = function() {
        var that = this;
        
        this.emitTestProgress('Test re-creation of collection ...');
        
        StateStoreWrapper.createCollection(
            this._testCollectionName,
            [this._indexFieldName],
            function(error, result) {
                if (_.isUndefined(error) || _.isNull(error)) {
                    that.emitTestProgress(
                        'Collection named ' + that._testCollectionName + '\
                        already existed, so no errors were thrown'
                        );
                    
                    that.runAddDataStep();
                } else {
                    that.emitTestError(
                        'Re-creation of collection named ' + that._testCollectionName + 
                        ' failed with error ' + TestHelpers.restErrorToMessage(error)
                        );
                    
                    that.emitTestFailed();
                }
            });
    }
    
    StateStoreWrapperTestsClass.runAddDataStep = function() {
        var that = this;
        
        this.emitTestProgress('Test adding data to collection ...');
        
        var jsonData = {};
        jsonData[that._keyFieldName] = 'data1/key';
        jsonData[that._indexFieldName] = 'index1';
        jsonData['other'] = 'something1';
        
        var data = [jsonData];
        StateStoreWrapper.setData(
            this._testCollectionName,
            data,
            function(error, result) {
                if (_.isUndefined(error) || _.isNull(error)) {
                    that.emitTestProgress(
                        'Data successfully added to collection named ' + that._testCollectionName
                        );
                    
                    that.runUpdateDataStep(data);
                } else {
                    that.emitTestError(
                        'Failed to add data to collection named ' + that._testCollectionName + 
                        ' with error "' + TestHelpers.restErrorToMessage(error)
                        );
                    
                    that.emitTestFailed();
                }
            });
    }
    
    StateStoreWrapperTestsClass.runUpdateDataStep = function(data) {
        var that = this;
        
        that.emitTestProgress('Test updating data to collection ...');
        
        data[0]['other'] = 'some other thing 1';
        StateStoreWrapper.setData(
            this._testCollectionName,
            data,
            function(error, result) {
                if (_.isUndefined(error) || _.isNull(error)) {
                    that.emitTestProgress(
                        'Data successfully updated in collection named ' + that._testCollectionName
                        );
                    
                    that.runVerifyDataStep(data, true, false);
                } else {
                    that.emitTestError(
                        'Failed to update data in collection named ' + that._testCollectionName + 
                        ' with error ' + TestHelpers.restErrorToMessage(error)
                        );
                    
                    that.emitTestFailed();
                }
            });
    }
    
    StateStoreWrapperTestsClass.runVerifyDataStep = function(data, checkIfPresent, isFinalStep) {
        var that = this;
        
        if (checkIfPresent) {
            that.emitTestProgress(
                'Verify data added to collection (test get data) ...'
                );
        } else {
            that.emitTestProgress(
                'Verify data not present in collection (test get data) ...'
                );
        }
        
        StateStoreWrapper.getData(
            this._testCollectionName,
            data[0][this._keyFieldName],
            function(error, result) {
                if (_.isUndefined(error) || _.isNull(error)) {
                    if (checkIfPresent) {
                        that.emitTestProgress(
                            'Data successfully retrieved from collection named ' + that._testCollectionName
                            );
                        
                        if (result.data[that._keyFieldName] !== data[0][that._keyFieldName] ||
                            result.data[that._indexFieldName] !== data[0][that._indexFieldName] ||
                            result.data['other'] !== data[0]['other'] ||
                            result.data['_user'] !== 'nobody') {
                            that.emitTestError(
                                'Data retrieved from collection named ' + that._testCollectionName +
                                ' does not match expected values. Expected values: "' + JSON.stringify(data[0]) +
                                '", retrieved values:"' + JSON.stringify(result.data) + '"'
                                );
                            
                            that.emitTestFailed();
                        } else {
                            that.runDeleteDataStep(data);
                        }
                    } else {
                        that.emitTestProgress(
                            'Data with key field ' + data[0][that._keyFieldName] +
                            ' retrieved from collection named ' + that._testCollectionName +
                            ' but was not expected to be found in the collection'
                            );
                    }
                } else {
                    if (checkIfPresent) {
                        that.emitTestError(
                            'Failed to get data for key field ' + data[0][that._keyFieldName] +
                            ' in collection named ' + that._testCollectionName + 
                            ' with error ' + TestHelpers.restErrorToMessage(error)
                            );
                        
                        that.emitTestFailed();
                    } else {
                        if (error.status === 404) {
                            that.emitTestProgress(
                                'Data with key field ' + data[0][that._keyFieldName] +
                                ' not found in collection named ' + that._testCollectionName +
                                ' as expected'
                                );
                            
                            that.emitTestPassed();
                        } else {
                            that.emitTestError(
                                'Failed to get data with key field ' + data[0][that._keyFieldName] +
                                ' with error ' + TestHelpers.restErrorToMessage(error)
                                );
                            
                            that.emitTestFailed();
                        }
                    }
                }
            });
    }
    
    StateStoreWrapperTestsClass.runDeleteDataStep = function(data) {
        var that = this;
        
        this.emitTestProgress(
            'Test deleting data from collection ...'
            );
        
        StateStoreWrapper.deleteItem(
            this._testCollectionName,
            data[0][this._keyFieldName],
            function(error, result) {
                if (_.isUndefined(error) || _.isNull(error)) {
                    that.emitTestProgress(
                        'Data successfully deleted from collection named ' + that._testCollectionName
                        );
                    
                    that.runVerifyDataStep(data, false, true);
                } else {
                    that.emitTestError(
                        'Failed to delete data from collection named ' + that._testCollectionName + 
                        ' with error ' + TestHelpers.restErrorToMessage(error)
                        );
                    
                    that.emitTestFailed();
                }
            });
    }
    
    StateStoreWrapperTestsClass.cleanup = function() {
        StateStoreWrapper.deleteCollection(
            this._testCollectionName,
            null,
            null // best effort
            );
    }

    return StateStoreWrapperTests;
});