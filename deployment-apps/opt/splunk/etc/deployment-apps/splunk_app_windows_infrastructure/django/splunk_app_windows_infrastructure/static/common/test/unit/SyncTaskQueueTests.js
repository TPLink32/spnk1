define([
        'jquery',
        'underscore',
        'common/Class',
        'common/SyncTaskQueue',
        'common/test/unit/TestHelpers',
        'common/test/unit/UnitTestBase'
        ],
        function(
            $,
            _,
            Class,
            SyncTaskQueue,
            TestHelpers,
            UnitTestBase
            )
{
    var SyncTaskQueueTests = function() {}
    
    var SyncTaskQueueTestsClass = Class.makeInheritedClass(UnitTestBase, SyncTaskQueueTests);
    
    SyncTaskQueueTestsClass.setup = function() {
        this.defineTest(
            'SyncTaskQueueTests',
            'Sync Task Queue Tests',
            'sync-task-queue-tests'
            );
    }
    
    SyncTaskQueueTestsClass.run = function() {
        var that = this;
        
        var delayPerTask = 100;
        var countOfTasksCompleted = 0;
        var expectedCountofTasks = 10;
        
        var printTaskCompletion = function(taskRunner, taskIndex, label) {
            setTimeout(
                function() {
                    
                    that.emitTestProgress((new Date()).toString() + ': ' + label + ' has completed');
                    taskRunner.markCompleted();
                    
                    if (countOfTasksCompleted !== taskIndex) {
                        that.emitTestError('Task ' + taskLabel + ' ran out of order. This is unexpected');
                        that.emitTestFailed();
                    } else {
                        countOfTasksCompleted++;
                        
                        if (countOfTasksCompleted === expectedCountofTasks) {
                            clearTimeout(that._testTimeoutHandle);
                            that.emitTestPassed();
                        }
                    }
                },
                delayPerTask
                );
        };
        
        var taskQueue = new SyncTaskQueue();
        for (var index = 0; index < expectedCountofTasks; index++) {
            var taskLabel = 'task' + index;
            
            taskQueue.enqueue(
                taskLabel,
                /* task function */ printTaskCompletion,
                /* task Arguments */ [index, taskLabel],
                null, // default timeout
                /* timeout handler */ function(taskLabel) {
                    that.emitTestProgress('Task ' + taskLabel + ' timed out unexpectedly');
                    that.emitTestFailed();
                }
                );
        }
        
        this._testTimeoutHandle = setTimeout(
            function() {
                that.emitTestProgress('Expected count of tasks is ' + expectedCountofTasks +
                    ' but only ' + countOfTasksCompleted + ' completed.');
                that.emitTestFailed();
            },
            expectedCountofTasks * delayPerTask * 5
            );
    }
    
    SyncTaskQueueTestsClass.cleanup = function() {
    }

    return SyncTaskQueueTests;
});