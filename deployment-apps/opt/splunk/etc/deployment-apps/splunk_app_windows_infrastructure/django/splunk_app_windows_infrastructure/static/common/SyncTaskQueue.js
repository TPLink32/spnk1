/* 
 * The SyncTaskQueue is a task serializer queue to enable queueing tasks to be run
 * synchronously.
 */

define([
        'jquery',
        'underscore',
        'common/Class',
        'common/SyncTaskRunner'
        ],
        function(
            $,
            _,
            Class,
            SyncTaskRunner
            ) {
    var SyncTaskQueue = function() {
        var that = this;
        
        this._taskQueue = [];
        this._currentTask = null;
        
        this._waitHandle = setInterval(
            function() {
                if (
                    (_.isNull(that._currentTask) || that._currentTask.hasCompleted()) &&
                    that._taskQueue.length > 0
                    ) {
                    that._currentTask = that._taskQueue.shift();
                    that._currentTask.start();
                }
            },
            200
            );
    }
    
    var SyncTaskQueueClass = Class.makeClass(SyncTaskQueue);
        
    /*
     * taskLabel - a label for the task to enqueue
     * taskFn - the function to execute for the task
     *          the signature for the function is:
     *          function(taskRunner, <any array of arguments passed in as taskFnArgs>)
     * taskFnArgs - array of arguments to the task. Note that this array will
     *              not contain the taskRunner but the rest of the arguments
     *              specific to the function
     * timeout - optional timeout for the task in ms
     * timeoutFn - a timeout handler with the signature
     *             function(<any array of arguments passed in as timeoutFnArgs>)
     * timeoutFnArgs - array of arguments to the timeout handler 
     */
    SyncTaskQueueClass.enqueue = function(
        taskLabel,
        taskFn,
        taskFnArgs,
        timeout,
        timeoutFn,
        timeoutFnArgs
        ) {
        this._taskQueue.push(
            new SyncTaskRunner(taskLabel, taskFn, taskFnArgs, timeout, timeoutFn, timeoutFnArgs)
            );
    }
    
    return SyncTaskQueue;
});
        