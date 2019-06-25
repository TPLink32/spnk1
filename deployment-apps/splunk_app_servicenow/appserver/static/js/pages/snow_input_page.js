/**
 * Created by strong on 8/5/15.
 */
require([
        'app/routers/SnowDataInputRouter',
        'util/router_utils',
        'app/lib/ui-metrics-collector/ui-metrics-collector',
        'app/utils/ContextResolver',
    ],
    function (
         Router,
         Router_utils,
         UIMetricsCollector
    ) {
        var router = new Router();
        Router_utils.start_backbone_history();

        router.pageReady.then(function () {

            UIMetricsCollector.start();
        })
    });