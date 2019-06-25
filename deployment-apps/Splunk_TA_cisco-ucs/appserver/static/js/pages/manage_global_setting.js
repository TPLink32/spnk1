require([
    'jquery',
    'underscore',
    'backbone',
    "bootstrap",
    "splunkjs/mvc/headerview",
    "splunk.util",
    'app/collections/GlobalSettings'
    ],
function(
    $,
    _,
    Backbone,
    Bootstrap,
    HeaderView,
    splunkdUtils,
    GlobalSettings
) {
    var headerView = new HeaderView({
        id: 'header',
        section: 'dashboards',
        el: $('.header'),
        acceleratedAppNav: true
    }).render();

    var globalSettings = new GlobalSettings();
    globalSettings.fetch();

    globalSettings.once("sync", function() {
        $("[name=btn_update_global_setting]").removeAttr("disabled");

        // set
        var logging_modal = globalSettings.get("Splunk_TA_cisco-ucs:logging");
        var log_level = logging_modal == undefined ? "INFO" : String(logging_modal.get("log_level"));
        $("[name=edit_global_setting_debug_level_option]").val(log_level);
    });

    $("[name=btn_update_global_setting]").click(function() {
        var new_logging_val = {
            "name": "logging",
            "appName": "Splunk_TA_cisco-ucs",
            "log_level": $("[name=edit_global_setting_debug_level_option]").val()};

        var logging_modal = globalSettings.get("Splunk_TA_cisco-ucs:logging");

        var param = {wait: true, error: function(model,response){
            var rsp=response.responseText;
            var rspx=rsp.substring(rsp.indexOf('<body>'),rsp.length)
                .replace(new RegExp('<(/?)(h1|p|html|body)([^>]*)>','g'),'<$1div$3>')
                .replace(new RegExp('<[^>]*/>','g'),'');
            var splunk_error_page=$(rspx);
            var status=splunk_error_page.find('.status').text();
            var msg=splunk_error_page.find('.msg').text();
            alert(status+':\n'+msg);
        },success: function(){
            alert("Setting is successfully updated.")
        } };

        if (logging_modal == undefined) {
            globalSettings.create(new_logging_val, param);
        } else {
            logging_modal.save(new_logging_val, param);
        }

    });


});
