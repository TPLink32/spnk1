requirejs.config({
    enforceDefine: false,
    paths: {
        'text': './contrib/text',
        'css': 'splunkjs/contrib/require-css/css'
    }
});
        
define([
        'jquery',
        'underscore',
        'common/test/unit/TestConstants',
        'text!common/test/unit/UnitTestRunner.html',
        'css!common/test/unit/UnitTestRunner.css'
        ],
        function(
            $,
            _,
            TestConstants,
            TestRunnerMarkup,
            CSS
            ) {
    var UnitTestRunner = {
        _tests: null,
            
        render: function(tests, testPanelSel) {
            $(testPanelSel).html(TestRunnerMarkup);
            
            var that = this;
            
            this._tests = tests;
            
            _.each(this._tests, function(test, index) {
                test.setup();
                
                $('#tests-list').append('\
                    <li id="' + test.getId() + '">' +
                    test.getName() + '</li>'
                    );
            });
            
            $("#run-tests").click(function() {
                _.each(that._tests, function(test, index) {
                    that.runTest(test);
                });
            });
            
            $("#clear-test-progress-board").click(function() {
                $('#test-progress-board').empty();
            });
        },
        
        runTest: function(test) {
            test.runTest();
            
            var waitOnTest = setInterval(
                function() {
                    if (test.getTestStatus() !== TestConstants.TestStatusRunning) {
                        clearInterval(waitOnTest);
                        test.markAsDone();
                    }
                }, 
                1000
                );
        }
    };
    
    return UnitTestRunner;
});
    