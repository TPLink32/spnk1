define(function() {
    var TestConstants = {
        TestStatusRunning: function() { return 'Running'; },
        
        TestStatusPassed: function() { return 'Passed'; },
        
        TestStatusFailed: function() { return 'Failed'; },
        
        DontValidateResultCount: function() { return null; }
    };
        
    return TestConstants;
});