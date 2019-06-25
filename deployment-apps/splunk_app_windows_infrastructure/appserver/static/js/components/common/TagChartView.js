define(function(require, exports, module) {

    var _ = require('underscore');
    var SimpleSplunkView = require("splunkjs/mvc/simplesplunkview");
    var SearchManager = require('splunkjs/mvc/searchmanager');
    var WaitSpinner = require('views/shared/WaitSpinner');
    var mvc = require('splunkjs/mvc');
    var Highcharts = require('highcharts');

    var TagChartView = SimpleSplunkView.extend({

        className: "splunk-tag-chart-view",

        output_mode: "json",

        _highchart: null,

        initialize: function() {
            SimpleSplunkView.prototype.initialize.apply(this, arguments);
            Highcharts.setOptions({
                global:{
                    useUTC: false
                }
            });
        },

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

            var series = this.settings.get('series');
            var drilldown = this.settings.get('drilldown');
            var benchmarks = this.settings.get('benchmarks') || [];

            var plotLines =[];
            var yValues = [];

            _.each(series, function(singleSeries, index) {
                singleSeries._data = [];
            });

            _.each(data, function(datum) {
                _.each(series, function(singleSeries) {
                    if (!_.isUndefined(singleSeries.columnName)) {
                        if (!_.isUndefined(datum[singleSeries.columnName])) {
                            singleSeries._data.push([
                                Date.parse(datum._time),
                                parseFloat(datum[singleSeries.columnName])
                            ]);
                            if(singleSeries.visible) {
                                yValues.push(datum[singleSeries.columnName]);
                            }
                        }
                    }
                });

                _.each(benchmarks, function(benchmark){
                    if (!_.isUndefined(benchmark.columnName)) {
                        if (!_.isUndefined(datum[benchmark.columnName])) {
                            if(benchmark.visible) {
                                plotLines.push({
                                    value: datum[benchmark.columnName],
                                    width: 2,
                                    color: benchmark.lineColor,
                                    dashStyle: 'shortDot'
                                });
                                yValues.push(datum[benchmark.columnName]);
                            }
                        }
                    }
                });
            });
            
            // Need this because the base chart library does not adjust for 
            // plotlines. We always want the plotlines in the picture, so
            // we set the range of y manually
            var yMin = _.min(yValues, function(val) { return parseFloat(val) });
            var yMax = _.max(yValues, function(val) { return parseFloat(val) });

            if (this._highchart) {
                this._highchart.destroy();
            }

            this.$el.empty();
            this.$el.append('<div></div>');

            var highchartsOptions = {
                chart: {
                    renderTo: this.$('div')[0],
                    alignTicks: false,
                    zoomType: 'x',
                    height: 200
                },
                credits: {
                    enabled: false
                },
                colors: _.map(series, function(singleSeries) { return singleSeries.lineColor; }),
                title: { text: "" },
                plotOptions: {
                    series: {
                        marker: {
                            enabled: false
                        },
                        fillOpacity: 1.0,
                        cursor: 'pointer',
                    },
                    area: {
                        stacking: 'normal',
                        lineWidth: 0
                    }
                },
                legend: {
                    enabled: false,
                    borderWidth: 0,
                    margin: 20
                },
                xAxis: [{
                    type: 'datetime',
                    title: { text: null }
                }],
                yAxis: {
                    type: 'linear', 
                    min: yMin,
                    max: yMax,
                    plotLines: plotLines
                },
                series: _.map(series, function(singleSeries, index) {
                    return {
                        type: singleSeries.type,
                        data: singleSeries._data,
                        name: singleSeries.title,
                        lineColor: singleSeries.lineColor,
                        fillColor: singleSeries.fillColor,
                        visible: singleSeries.visible,
                        dashStyle: singleSeries.dashStyle,
                        animation: false
                    };
                })
            };

            this._highchart = new Highcharts.Chart(highchartsOptions);
        },
        
        getData: function(){
            return this.resultsModel.data().results;
        }

    });
    return TagChartView;
});