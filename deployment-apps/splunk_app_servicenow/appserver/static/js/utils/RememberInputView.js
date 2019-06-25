/**
 * Created by hshen on 16/7/11.
 */
define([
    'splunkjs/mvc',
    'splunkjs/mvc/simplexml/ready!'
], function(mvc) {

    var addRemEl = function (inputId) {
        $el = mvc.Components.getInstance(inputId);
        if ( !$el ) {
            console.error('Not component instance found by id ' + inputId);
            return;
        }
        var value = localStorage.getItem(inputId);
        if (value) {
            $el.val(_formatRetrievedData(value));
        }
        $el.on('change',function (value) {
            // Filter the new value here,because some components will
            // trigger change events with a null or undefined value when the page loaded
            if (_filterValue(value)) {
                localStorage.setItem(inputId, _formatSavedData(value));
            }
        });
    };

    var _filterValue = function (value) {
        // Filter null,undefined
        if (!value) {
            return false;
        }
        if (typeof value === 'object') {
            // Filter {earliest_time:'',latest_time:''}
            if (value.hasOwnProperty('earliest_time') && value.earliest_time === ''
                && value.latest_time === '') {
                return false;
            }
            // Filter []
            if (value.hasOwnProperty('length') && value.length ===0 ) {
                return false;
            }
        }
        return true;
    };

    var _formatSavedData = function (value) {
        return JSON.stringify(value);
    };

    var _formatRetrievedData = function (value) {
        return JSON.parse(value);
    }

    return {addRemEl: addRemEl};
});