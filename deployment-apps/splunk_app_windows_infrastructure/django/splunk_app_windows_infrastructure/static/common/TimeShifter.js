define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var mvc = require('splunkjs/mvc')
    var Class = require('common/Class');

    var MINUTE = 60;
    var HOUR = MINUTE * 60;
    var DAY = HOUR * 24;
    var WEEK = DAY * 7;

    var basicTemplate ='earliest=<%= earliest %> latest=<%= latest %> <%= search %>';

    var comparisonTemplate = basicTemplate + '\
        | eval shiftBy=0 \
        | append [\
            search earliest=<%= previousEarliest %> latest=<%= previousLatest %> <%= search %> \
            | eval shifted="true" \
            | eval shiftBy=<%= shiftBy%> \
        ] \
        | eval _time=_time+shiftBy ';

    var TimeShifter = function(){
        this.service = mvc.createService();
        this.shifts = {
            "Yesterday" : 86400,
            "Last week": 604800,
            "Last Month": 2592000,
            "60 minutes ago": 3600,
            "2 hours ago": 7200,
            "6 hours ago": 21600,
            "12 hours ago": 43200
        }
    }

    var TimeShifterClass = Class.makeClass(TimeShifter);

    TimeShifterClass.fetchTimestamps = function(earliestTime, latestTime){
        return this.service.get(
            'search/timeparser',
            {
                'time': [earliestTime, latestTime], 
                'output_time_format': '%s.%Q'
            }
        );
    }

    TimeShifterClass.getSearchWithTime = function(search, earliestTime, latestTime, shiftBy){
        var that = this;
        var dfd = $.Deferred();
        if(shiftBy) {
            this.fetchTimestamps(earliestTime, latestTime)
                .done(function(serverResponse){
                    var times = JSON.parse(serverResponse);

                    // Shift be a preset, or the difference between the latest time
                    // and the passed-in timestamp
                    var shiftAmount = that.shifts[shiftBy] || times[latestTime] - shiftBy;
                    var previousEarliest = times[earliestTime] - shiftAmount;
                    var previousLatest = times[latestTime] - shiftAmount;

                    var response = _.template(comparisonTemplate, {
                        search: search,
                        earliest: times[earliestTime],
                        latest: times[latestTime],
                        previousEarliest: previousEarliest,
                        previousLatest: previousLatest,
                        shiftBy: shiftAmount
                    });
                    dfd.resolve(response);
                });
        }
        else {
            var response = _.template(basicTemplate, {
                search: search,
                earliest: earliestTime,
                latest: latestTime
            });
            dfd.resolve(response);
        }
        return dfd.promise();
    }

    return TimeShifter;
});