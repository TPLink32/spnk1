/**
 * Created by strong on 6/24/15.
 */
require([
        'jquery',
        'app/views/UsageCollectorView',
        'app/lib/ui-metrics-collector/ui-metrics-collector',
        'app/routers/SnowOverviewRouter',
        'util/router_utils',
        'app/utils/ContextResolver'
    ],
    function (
         $,
         UsageCollectorView,
         UIMetricsCollector,
         Router,
         Router_utils
    ) {
        var router = new Router();
        Router_utils.start_backbone_history();

        router.pageReady.then(function () {
            new UsageCollectorView({el: $('#usage_collection')});

            UIMetricsCollector.start();
            UIMetricsCollector.checkAgreement();
        })

    });