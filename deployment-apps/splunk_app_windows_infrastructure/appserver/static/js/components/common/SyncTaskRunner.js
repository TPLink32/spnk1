/* 
 * The SyncTaskRunner is a task serializer to enable running tasks synchronously.
 * It takes as input a function to run a task, executes it and waits for completion.
 * The SyncTaskRunner defines a markCompleted function to call back into to indicate
 * task completion.
 */

define([
        'jquery',
        'underscore',
        'common/Class'
        ],
        function(
            $,
            _,
            Class
            ) {
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
    var SyncTaskRunner = function(
        taskLabel,
        taskFn,
        taskFnArgs,
        timeout /* in ms */,
        timeoutFn,
        timeoutFnArgs
        ) {
        this._taskCompleted = false;
        
        if (_.isUndefined(taskFn) || _.isNull(taskFn) || !_.isFunction(taskFn)) {
            throw('Invalid task passed to SyncTaskRunner');
        } else {
            this._taskFn = taskFn;
            
            this._taskFnArgs = taskFnArgs;
            // First argument to the function is the runner so it could invoke markCompleted
            this._taskFnArgs.unshift(this);
            
            this._taskLabel = taskLabel;
        }
        
        if (_.isUndefined(timeout) || _.isNull(timeout)) {
            this._timeout = 600000; // 10 minutes in ms
        } else {
            if (_.isNumber(timeout)) {
                this._timeout = timeout;
            } else {
                throw('Invalid timeout passed to SyncTaskRunner. Please specify a number in ms');
            }
        }
        
        if (_.isUndefined(timeoutFn) || _.isNull(timeoutFn) || !_.isFunction(timeoutFn)) {
            throw('Invalid timeout handler passed to SyncTaskRunner');
        } else {
            this._timeoutFn = timeoutFn;
            this._timeoutFnArgs = timeoutFnArgs;
        }
        
        this._waitHandle = null;
    }
    
    var SyncTaskRunnerClass = Class.makeClass(SyncTaskRunner);
        
    SyncTaskRunnerClass.start = function() {
        var that = this;
        
        if (this._taskCompleted) {
            throw('The task ' + this._taskLabel + ' has already completed');
        }
        
        this._taskFn.apply(this, this._taskFnArgs);
        
        this._waitHandle = setInterval(
            function() {
                if (that._taskCompleted) {
                    clearInterval(that._waitHandle);
                }
            },
            200
            );
        
        this._timeoutHandle = setTimeout(
            function() {
                that.markCompleted();
                that._timeoutFn.apply(that, that._timeoutFnArgs);
            },
            this._timeout
            );
    }
    
    /*
     * This function MUST be called by the task when done otherwise the task will timeout.
     */
    SyncTaskRunnerClass.markCompleted = function() {
        this._taskCompleted = true;
        clearTimeout(this._timeoutHandle);
    }
    
    SyncTaskRunnerClass.hasCompleted = function() {
        return this._taskCompleted;
    }
    
    return SyncTaskRunner;
});
        