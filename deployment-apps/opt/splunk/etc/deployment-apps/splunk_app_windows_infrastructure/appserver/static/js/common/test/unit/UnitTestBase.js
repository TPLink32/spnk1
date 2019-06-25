define([
        'common/Class',
        'common/test/unit/TestConstants',
        'common/test/unit/TestHelpers'
        ],
        function(
            Class,
            TestConstants,
            TestHelpers
            )
{
    var UnitTestBase = function() {
        this._status = null;
        this._testId = null;
        this._testTitle = null;
        this._elIdForTest = null;
        this._testOutputSel = null;
    }
    
    unitTestBaseClass = Class.makeClass(UnitTestBase);
    
    unitTestBaseClass.defineTest = function(testId, testTitle, elIdForTest) {
        this._status = TestConstants.TestStatusRunning;
        this._testId = testId;
        this._testTitle = testTitle;
        this._elIdForTest = elIdForTest;
    }
      
    unitTestBaseClass.runTest = function() {
        this._prepareToRun();
        this.run(); // Will be defined per test
    }
    
    unitTestBaseClass._prepareToRun = function() {
        this._testOutputSel = TestHelpers.startNewTest(
            this._testTitle,
            this._elIdForTest
            );
    }
     
    unitTestBaseClass.getId = function() {
        return this._testId;
    };
        
    unitTestBaseClass.getName = function() {
        return this._testTitle;
    };
        
    unitTestBaseClass.emitTestPassed = function() {
        this._status = TestConstants.TestStatusPassed;
        TestHelpers.emitTestPassed(this._testOutputSel);
        
        this.cleanup(); // Will be defined per test
    }
    
    unitTestBaseClass.emitTestFailed = function() {
        this._status = TestConstants.TestStatusFailed;
        TestHelpers.emitTestFailed(this._testOutputSel);
        
        this.cleanup(); // Will be defined per test
    }
    
    unitTestBaseClass.emitTestProgress = function(message) {
        TestHelpers.emitTestProgress(this._testOutputSel, message);
    }
    
    unitTestBaseClass.emitTestError = function(message) {
        TestHelpers.emitTestError(this._testOutputSel, message);
    }
    
    unitTestBaseClass.getTestStatus = function() {
        return this._status;
    } 
    
    unitTestBaseClass.markAsDone = function() {
        TestHelpers.markAsDone(this._testOutputSel);
    }        
    
    return UnitTestBase;
});
