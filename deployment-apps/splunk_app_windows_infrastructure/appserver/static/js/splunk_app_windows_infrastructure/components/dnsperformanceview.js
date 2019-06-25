define(function(require, exports, module) {

    var _ = require('underscore');
    var SimpleSplunkView = require("splunkjs/mvc/simplesplunkview");
    var mvc = require('splunkjs/mvc');
    var Highcharts = require('highcharts');

    var LINE_NAME = "% Processor Time";

    var DNSPerformanceView = SimpleSplunkView.extend({

        className: "splunk-app-microsoft-dnsperformanceview",

        output_mode: "json",

        _highchart: null,

        createView: function() {
            return true;
        },

        formatData: function(data){
        	return data;
        },

        updateView: function(viz, data) {
            if (data.length == 0) {
                return;
            }

            var areaName = '';

            _.each(data, function(datum) {
                _.each(_.keys(datum), function(key) {
                    if (key !== LINE_NAME && key.indexOf('_') !== 0) {
                        areaName = key;
                    }
                });
            });

            var lineData = [];
            var areaData = [];

            _.each(data, function(datum) {
                if (!_.isUndefined(datum[LINE_NAME])) {
                    lineData.push([
                        Date.parse(datum._time),
                        parseFloat(datum[LINE_NAME])
                    ]);
                }
                if (!_.isUndefined(datum[areaName])) {
                    areaData.push([
                        Date.parse(datum._time),
                        parseFloat(datum[areaName])
                    ]);
                }
            });

            if (this._highchart) {
                this._highchart.destroy();
            }
            this.$el.empty();
            this.$el.append('<div></div>');
            this._highchart = new Highcharts.Chart({
                chart: {
                    renderTo: this.$('div')[0]
                },
                credits: {
                    enabled: false
                },
                title: { text: "" },
                xAxis: [{
                    type: 'datetime',
                    title: { text: "Time" }
                }],
                yAxis: [
                    {
                        title: { text: LINE_NAME },
                        opposite: true,
                        min: 0,
                        max: 100
                    },
                    {
                        title: { text: areaName }
                    }
                ],
                
                series: [
                    {
                        type: 'area',
                        data: areaData,
                        name: areaName,
                        yAxis: 1
                    },
                    {
                        type: 'line',
                        data: lineData,
                        name: LINE_NAME
                    } 
                ]
            });
        },
        
        getData: function(){
            return this.resultsModel.data().results;
        }

    });
    return DNSPerformanceView;
});