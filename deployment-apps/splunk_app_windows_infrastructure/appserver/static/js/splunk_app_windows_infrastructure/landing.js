define(function(require, exports, module) {
    var $ = require('jquery');
    var _ = require('underscore');
    var mvc = require('splunkjs/mvc');
    var splunkSdk = require('splunkjs/splunk');
    var Sankey = require('splunk_app_windows_infrastructure/components/sankey/sankey');
    var SearchManager = require('splunkjs/mvc/searchmanager');
    var TableView = require('splunkjs/mvc/tableview');
    var ChartView = require('splunkjs/mvc/chartview');
    var PagePreChecks = require('splunk_app_windows_infrastructure/page_prechecks');

    PagePreChecks.runChecks();

    // TODO refactor this with setup.html
    var service = mvc.createService();
    var navEntity = new splunkSdk.Service.Entity(
        service,
        "data/ui/nav/default", {
            owner: 'admin',
            app: 'splunk_app_windows_infrastructure',
            sharing: 'app'
        }
    );

    navEntity.fetch({}, function(err, resource) {
        var navXmlDoc = $.parseXML(resource.properties()['eai:data']);
        var navXml = $(navXmlDoc);

        // TODO this does not account for turning off
        // whatever views are within the specific things
        // e.g. Windows may be enabled, but that doesn't
        // necessarily mean the health link within it is enabled
        var hasWindows = navXml.find('collection[label="Windows"]').length;
        var hasAd = navXml.find('collection[label="Active Directory"]').length;
        var width = parseInt(100.0 / (hasWindows + hasAd)) + '%';

        if (hasWindows) {
            $('#windows-container').show();
            $('#windows-container').css('width', width);
        }
        if (hasAd) {
            $('#ad-container').show();
            $('#ad-container').css('width', width);
        }
    });

});