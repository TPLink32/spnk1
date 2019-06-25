define(["underscore", "jquery"], function(_, $) {
    _.mixin({
        isMeaningless: function(v) { return (_.isUndefined(v) || _.isEmpty(v) || (v === "")); }
    });

    var utils = {
        //
        // Number Methods
        //
        /**
         * given a number and a number of decimal places round the number to 
         * said number of places, default is 2
         * @param {number} num the raw number to round
         * @param {number} dec number of decimal places to round to, defaults to 2
         * @returns {number} the rounded number
         */
        roundNumber: function(num, dec) {
            //Provide a dec to get it to a different rounding than 2
            if (dec === null || dec === undefined || !this.isNum(dec)) {
                dec = 2;
            }
            var result = Math.round(num*Math.pow(10,dec))/Math.pow(10,dec);
            return result;
        },
        /**
         * Check that n can be parsed as a finite number
         * @param {?} n
         * @returns {Boolean} true if can be parsed as a finite number, false otherwise
         */
        isNum: function(n) {
            return !isNaN(parseFloat(n)) && isFinite(n);
        },
        
        //
        // Splunk Results Methods
        //
        /**
         * given arrays of rows and field names compute the span of the time buckets
         * to the best of our ability
         * @param {Array} fields
         * @param {Array} rows
         * @return {Number} span
         */
        getSpan: function(fields, rows) {
            var spanIndex = _.indexOf(fields, "_span");
            var timeIndex = _.indexOf(fields, "_time");
            var span;
            if (spanIndex === -1) {
                // Deduce the span from the last two elements in the time series data
                if (rows.length > 1) {
                    var sample = _.last(rows, 2);
                    span = Math.abs(Number(sample[0][timeIndex]) - Number(sample[1][timeIndex]));
                }
                else {
                    // Only one row, just set span to 1
                    span = 1;
                }
            }
            else {
                // If span is the data we trust it to give us our buckets
                span = Number(rows[0][spanIndex]) || -1;
            }
            return span;
        },
        
        //
        // Array Methods
        //
        /**
         * Check that two arrays are identical
         * @param {Array} arr1
         * @param {Array} arr2
         * @returns {Boolean} true if identical, false otherwise
         */
        areArraysIdentical: function(arr1, arr2) {
            if (arr1.length !== arr2.length) {
                return false;
            }
            for (var ii = 0; ii < arr1.length; ii++) {
                if (arr1[ii] !== arr2[ii]) {
                    return false;
                }
            }
            return true;
        },
        
        /**
         * Return the first index that matches the given predicate
         * @param {Array} list, the list to check
         * @param {function} predicate, the test function, returns true or false
         * @returns {Number} index of element that passes first, -1 if nothing passes
         */
        indexWhere: function(list, predicate) {
            var returnIndex = -1;
            _.find(list, function(element, index) {
                var test = predicate(element);
                if (test) {
                    returnIndex = index;
                    return true;
                }
                return false;
            });
            return returnIndex;
        },
        //
        // Date Methods
        //
        /**
         * Take in a date and return ["MM/DD/YYYY", "Locale Time"]
         * @param {Date} date a js date object
         * @returns {Array} ["MM/DD/YYYY", "Locale Time"]
         */
        dateToShortDateArray: function(date) {
            return [String(date.getMonth() + 1) + "/" + String(date.getDate()) + "/" + date.getFullYear(), date.toLocaleTimeString()];
        },
        /**
         * Convert the epoch seconds int into a js Date obj
         * @param {number} epoch time in epoch seconds
         * @returns {Date} js date representation of the epoch in seconds
         */
        convertEpochToDate: function(epoch) {
            var date = new Date(0);
            date.setUTCSeconds(epoch);
            return date;
        },

        /**
         * takes in a time duration in seconds and formats as a string of 
         * weeks days hours minutes seconds
         * @param {number} duration total time duration in seconds
         * @returns {string} w d h m s string representation of the duration
         * @private
         */
        formatTimeDuration: function(duration) {
            // Number of seconds constants
            var timeConstants = [
                {val: 604800, label: "w"},
                {val: 86400, label: "d"},
                {val: 3600, label: "h"},
                {val: 60, label: "m"},
                {val: 1, label: "s"}
            ];
            
            return (_.reduce(timeConstants, function(m, c) {
                var quotient = Math.floor(duration / c.val);
                if (quotient > 0) { 
                    duration = duration % c.val;
                    m.push(String(quotient) + c.label);
                }
                return m;
            }, [])).join(" ");
        },
        
        updateUrlState: function(parameters) {
		    var queryArgs = window.location.search.substr(1) || '';
            var deleteEmpties = function(m, v, k) { 
                if (! (_.isMeaningless(v))) {
                    m[k] = v;
                }
                return m;
            };
		    var params = _.reduce(_.extend($.deparam(queryArgs) || {}, parameters), deleteEmpties, {});
            window.history.replaceState(params, "LaneCollectionView", window.location.href.replace(/\?.*$/, '') + '?' + $.param(params));
        }
    };
    
    return utils;
});
