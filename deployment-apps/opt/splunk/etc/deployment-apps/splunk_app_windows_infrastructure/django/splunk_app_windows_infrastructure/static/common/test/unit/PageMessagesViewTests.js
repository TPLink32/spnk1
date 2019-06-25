define([
        'jquery',
        'underscore',
        'common/Class',
        'common/PageMessagesView',
        'common/test/unit/TestHelpers',
        'common/test/unit/UnitTestBase'
        ],
        function(
            $,
            _,
            Class,
            PageMessagesView,
            TestHelpers,
            UnitTestBase
            )
{
    var PageMessagesViewTests = function() {}
    
    var PageMessagesViewTestsClass = Class.makeInheritedClass(UnitTestBase, PageMessagesViewTests);
    
    PageMessagesViewTestsClass.setup = function() {
        this.defineTest(
            'PageMessagesViewTests',
            'Page Messages View Tests',
            'page-messages-view-tests'
            );
    }
    
    PageMessagesViewTestsClass.run = function() {
        var isTestsPassed = true;
        
        var unused = new PageMessagesView('#page-messages-view-tests');
        
        var pageMessagesViewSel = '#page-messages-view-tests #page-messages-view';
        
        if (!_.isUndefined(unused) && !_.isNull(unused) &&
            $(pageMessagesViewSel).length === 0) {
            this.emitTestProgress('Page Messages View created successfully');
        } else {
            this.emitTestError('Page Messages View could not be created.');
            isTestsPassed = false;
            return;
        }
        
        var pageMessagesView = new PageMessagesView('#page-messages-view-tests');
        
        if (!_.isUndefined(pageMessagesView) && !_.isNull(pageMessagesView) &&
            $(pageMessagesViewSel).length === 0) {
            this.emitTestProgress('Page Messages View created successfully');
        } else {
            this.emitTestError('Page Messages View could not be created.');
            isTestsPassed = false;
            return;
        }
        
        var infoIconSel = '.alert-info';
        var warningIconSel = '.alert-warning';
        var errorIconSel = '.alert-error';
        
        pageMessagesView.addMessage('Info Message');
        
        // Once first message is added, the page messages view should be created
        if ($(pageMessagesViewSel).length !== 1) {
            this.emitTestError('Page Messages View created but does not contain \
                or contains duplicates of the page messages element.'
                );
            isTestsPassed = false;
            return;
        }
        
        if ($(pageMessagesViewSel + ' ' + infoIconSel).length === 1 &&
            $(pageMessagesViewSel + ' ' + infoIconSel + ' p').text() === 'Info Message') {
            this.emitTestProgress('Info message added as expected.');
        } else {
            this.emitTestError('Info message not found.');
            isTestsPassed = false;
        }
        
        pageMessagesView.addMessage('Error Message', pageMessagesView.ErrorMessageType);
        if ($(pageMessagesViewSel + ' ' + errorIconSel).length === 1 &&
            $(pageMessagesViewSel + ' ' + errorIconSel + ' p').text() === 'Error Message') {
            this.emitTestProgress('Error message added as expected.');
        } else {
            this.emitTestError('Error message not found.');
            isTestsPassed = false;
        }
        
        pageMessagesView.addMessage('Warning Message', pageMessagesView.WarningMessageType);
        if ($(pageMessagesViewSel + ' ' + warningIconSel).length === 1 &&
            $(pageMessagesViewSel + ' ' + warningIconSel + ' p').text() === 'Warning Message') {
            this.emitTestProgress('Warning message added as expected.');
        } else {
            this.emitTestError('Warning message not found.');
            isTestsPassed = false;
        }
        
        pageMessagesView.clearAllMessages();
        if ($(pageMessagesViewSel).children().length === 0) {
            this.emitTestProgress('All messages cleared as expected.');
        } else {
            this.emitTestError('Messages did not get cleared as expected.');
            isTestsPassed = false;
        }
        
        pageMessagesView.addMessage('Info Message 2', pageMessagesView.InfoMessageType);
        if ($(pageMessagesViewSel + ' ' + infoIconSel).length === 1 &&
            $(pageMessagesViewSel + ' ' + infoIconSel + ' p').text() === 'Info Message 2') {
            this.emitTestProgress('Info message added as expected.');
        } else {
            this.emitTestError('Info message not found.');
            isTestsPassed = false;
        }
        
        pageMessagesView.clearAllMessages();
        if ($(pageMessagesViewSel).children().length === 0) {
            this.emitTestProgress('All messages cleared as expected.');
        } else {
            this.emitTestError('Messages did not get cleared as expected.');
            isTestsPassed = false;
        }
        
        pageMessagesView.addMessage('Info Message 3', pageMessagesView.InfoMessageType, 'info-3');
        if ($(pageMessagesViewSel + ' #info-3' + infoIconSel).length === 1 &&
            $(pageMessagesViewSel + ' #info-3' + infoIconSel + ' p').text() === 'Info Message 3') {
            this.emitTestProgress('Specific info message added as expected.');
        } else {
            this.emitTestError('Specific info message not found.');
            isTestsPassed = false;
        }
        pageMessagesView.clearMessage('info-3');
        if ($(pageMessagesViewSel + ' #info-3' + infoIconSel).length === 0) {
            this.emitTestProgress('Specific info message cleared as expected.');
        } else {
            this.emitTestError('Specific info message did not get cleared as expected.');
            isTestsPassed = false;
        }

        pageMessagesView.addMessage('Warning Message 2', pageMessagesView.WarningMessageType, 'warning-2');
        if ($(pageMessagesViewSel + ' #warning-2' + warningIconSel).length === 1 &&
            $(pageMessagesViewSel + ' #warning-2' + warningIconSel + ' p').text() === 'Warning Message 2') {
            this.emitTestProgress('Specific warning message added as expected.');
        } else {
            this.emitTestError('Specific warning message not found.');
            isTestsPassed = false;
        }
        
        pageMessagesView.addMessage('Error Message 2', pageMessagesView.ErrorMessageType, 'error-2');
        if ($(pageMessagesViewSel + ' #error-2' + errorIconSel).length === 1 &&
            $(pageMessagesViewSel + ' #error-2' + errorIconSel + ' p').text() === 'Error Message 2') {
            this.emitTestProgress('Specific error message added as expected.');
        } else {
            this.emitTestError('Specific error message not found.');
            isTestsPassed = false;
        }
        
        pageMessagesView.clearMessage('warning-2');
        if ($(pageMessagesViewSel + ' #warning-2' + warningIconSel).length === 0) {
            this.emitTestProgress('Specific warning message cleared as expected.');
        } else {
            this.emitTestError('Specific warning message did not get cleared as expected.');
            isTestsPassed = false;
        }
        
        pageMessagesView.clearMessage('error-2');
        if ($(pageMessagesViewSel + ' #error-2' + errorIconSel).length === 0) {
            this.emitTestProgress('Specific error message cleared as expected.');
        } else {
            this.emitTestError('Specific error message did not get cleared as expected.');
            isTestsPassed = false;
        }
        
        if ($(pageMessagesViewSel).children().length === 0) {
            this.emitTestProgress('All messages cleared as expected.');
        } else {
            this.emitTestError('Not all Messages got cleared as expected.');
            isTestsPassed = false;
        }
        
        pageMessagesView.addMessage('Sample Test Error Message', pageMessagesView.ErrorMessageType);
        if ($(pageMessagesViewSel + ' ' + errorIconSel).length === 1 &&
            $(pageMessagesViewSel + ' ' + errorIconSel + ' p').text() === 'Sample Test Error Message') {
            this.emitTestProgress('Test error message added as expected.');
        } else {
            this.emitTestError('Tests error message not found.');
            isTestsPassed = false;
        }
        
        pageMessagesView.addMessage('Sample Test Warning Message', pageMessagesView.WarningMessageType);
        if ($(pageMessagesViewSel + ' ' + warningIconSel).length === 1 &&
            $(pageMessagesViewSel + ' ' + warningIconSel + ' p').text() === 'Sample Test Warning Message') {
            this.emitTestProgress('Test warning message added as expected.');
        } else {
            this.emitTestError('Test warning message not found.');
            isTestsPassed = false;
        }
        
        pageMessagesView.addMessage('Sample Test Info Message', pageMessagesView.InfoMessageType);
        if ($(pageMessagesViewSel + ' ' + infoIconSel).length === 1 &&
            $(pageMessagesViewSel + ' ' + infoIconSel + ' p').text() === 'Sample Test Info Message') {
            this.emitTestProgress('Test info message added as expected.');
        } else {
            this.emitTestError('Test info message not found.');
            isTestsPassed = false;
        }
        
        if ($(pageMessagesViewSel).children().length === 3) {
            this.emitTestProgress('All test messages found as expected.');
        } else {
            this.emitTestError('Not all test messages expected were found.');
            isTestsPassed = false;
        }
        
        if (isTestsPassed) {
            this.emitTestPassed();
        } else {
            this.emitTestFailed();
        }
    }
    
    PageMessagesViewTestsClass.cleanup = function() {
    }

    return PageMessagesViewTests;
});