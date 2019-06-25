"use strict";

var _templateObject = _taggedTemplateLiteral(["| inputlookup ", "\n                                              | fit ", " ", " x y\n                                              | table cluster, x, y"], ["| inputlookup ", "\n                                              | fit ", " ", " x y\n                                              | table cluster, x, y"]);

function _taggedTemplateLiteral(strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Clustering page script
require(["jquery", "components/splunk/Searches", "splunkjs/mvc/visualizationregistry", "components/data/formatters/compactTemplateString", "components/controls/DrilldownLinker", "components/controls/Spinners", "Options"], function ($, Searches, VisualizationRegistry, compact, DrilldownLinker, Spinners, Options) {

    var appName = Options.getOptionByName('appName');
    var smallLoaderScale = Options.getOptionByName('smallLoaderScale');
    var ScatterLineViz = VisualizationRegistry.getVisualizer(appName, 'ScatterLineViz');

    //todo: move the datasets literals to samplesearches after clustering design is nailed down.
    var datasets = [{
        name: 'noisyCircles',
        src: 'sklearn_cluster_noisy_circles.csv',
        el: 'clusteringPlotNoisyCirclesDatasetPanel'
    }, {
        name: 'noisyMoons',
        src: 'sklearn_cluster_noisy_moons.csv',
        el: 'clusteringPlotNoisyMoonsDatasetPanel'
    }, {
        name: 'blobs',
        src: 'sklearn_cluster_blobs.csv',
        el: 'clusteringPlotBlobsDatasetPanel'
    }, {
        name: 'noStructure',
        src: 'sklearn_cluster_no_structure.csv',
        el: 'clusteringPlotNoStructureDatasetPanel'
    }];

    // configuration

    var Algorithm = function Algorithm(name, parameters) {
        _classCallCheck(this, Algorithm);

        this.name = name;
        this.parameters = parameters;
    };

    var algorithms = [new Algorithm("KMeans", "k=2"), new Algorithm("DBSCAN", "eps=0.2"), new Algorithm("SpectralClustering", "k=2 affinity=\"nearest_neighbors\""), new Algorithm("Birch", "k=2")];

    // setup plots
    (function () {
        algorithms.forEach(function (algorithm, index) {
            var name = algorithm.name;
            var parameters = algorithm.parameters;

            datasets.forEach(function (dataset, index) {
                var vizId = dataset.name + algorithm.name;
                var searchId = vizId + "Search";
                var vizOptions = {
                    category: 'custom',
                    type: appName + ".ScatterLineViz"
                };
                var clusteringPlot = $("<div>").attr('id', vizId);
                var title$El = $("<h3>").text(name);
                var clusteringWrapper = $("<div>").addClass('clustering-plot').append(title$El).append(clusteringPlot);
                $('#' + dataset.el).addClass('clustering-row').append(clusteringWrapper);

                var searchString = compact(_templateObject, dataset.src, name, parameters);
                Searches.setSearch(searchId, {
                    searchString: searchString,
                    onStartCallback: function onStartCallback() {
                        Spinners.showLoadingOverlay(vizId, smallLoaderScale);
                    },
                    onDoneCallback: function onDoneCallback() {
                        Spinners.hideLoadingOverlay(vizId);
                        DrilldownLinker.setSearchDrilldown(clusteringPlot.prev('h3'), searchString, DrilldownLinker.parseVizOptions(vizOptions));
                    },
                    onErrorCallback: function onErrorCallback() {
                        Spinners.hideLoadingOverlay(vizId);
                    }
                });

                var ScatterLineVizControl = function () {
                    var scatterLineVizControl = new ScatterLineViz({
                        id: vizId,
                        managerid: searchId,
                        el: clusteringPlot
                    });

                    scatterLineVizControl.render();
                    return scatterLineVizControl;
                }();
            });
        });
    })();
});