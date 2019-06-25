"use strict";

function toHex(str) {
    //http://forums.devshed.com/javascript-development-115/convert-string-hex-674138.html
    var hex = '';
    for(var i=0;i<str.length;i++) {
        hex += ''+str.charCodeAt(i).toString(16);
    }
    return hex;
}
 
window.NumSearchesSelected = 0

function trigger_clicked(str){
    if(document.getElementById("checkbox_" + str).checked){
        window.NumSearchesSelected += 1;
    }else{
        window.NumSearchesSelected -= 1;
    }
    $("#NumSearches").text(window.NumSearchesSelected)
}

require([
    "jquery",
    "splunkjs/mvc",
    "splunkjs/mvc/utils",
    "splunkjs/mvc/tokenutils",
    "splunkjs/mvc/simplexml",
    "splunkjs/ready!",
    "bootstrap.tooltip",
    "bootstrap.popover"//,
    //'json!components/data/ShowcaseInfo.json'
    ],
    function(
        $,
        mvc,
        utils,
        TokenUtils,
        DashboardController,
        Ready//,
        //ShowcaseInfo
        ) {

            var HTMLBlockHeader = "<div id=\"search_selector_header\"><span id=\"NumSearches\">0</span> Searches Selected. <a href=\"#\" onclick=\"$('#searchlistpanel').toggle()\">Toggle Search List</a><div id=\"searchlistpanel\">"
            var HTMLBlock = ""
            var unsubmittedTokens = mvc.Components.getInstance('default');
            var submittedTokens = mvc.Components.getInstance('submitted');
            var myDataset = "No dataset provided"
            console.log("Running Dataset..", myDataset.replace(/\W/g,""))
            ShowcaseInfo = ""
            $.getJSON('/static/app/Splunk_Security_Essentials/components/data/ShowcaseInfo.json', function(data) {
                console.log("Got a dataset!", data)
                ShowcaseInfo = data
                console.log("ShowcaseInfo: - Checking ShowcaseInfo", ShowcaseInfo)
                for (var summary in ShowcaseInfo.summaries){
                    summary = ShowcaseInfo.summaries[summary]
                    console.log("Showcase Instance", summary.dashboard, summary)
                    dashboardname= summary.dashboard
                    if(dashboardname.indexOf("?")>0){
                        dashboardname = dashboardname.substr(0, dashboardname.indexOf("?"))
                    }
                    example = undefined
                    if(summary.dashboard.indexOf("=")>0){
                        example = summary.dashboard.substr(summary.dashboard.indexOf("=")+1)
                    }
                    
                    if(typeof example !="undefined"){
                        exampleText = ""
                        exampleList = $('<span></span>')
                        //console.log("ShowcaseInfo: New Title", document.title)
                        /*if(typeof summary.examples != "undefined"){
                            exampleText = summary.examples.length > 1 ? '<b>Examples:</b>' : '<b>Example:</b>';
                            exampleList = $('<ul class="example-list"></ul>');

                            summary.examples.forEach(function (example) {
                                var showcaseURLDefault = summary.dashboard;
                                if(summary.dashboard.indexOf("?")>0){
                                    showcaseURLDefault = summary.dashboard.substr(0, summary.dashboard.indexOf("?"))
                                }
                                
                                var url = showcaseURLDefault + '?ml_toolkit.dataset=' + example.name;
                                if(example.name == sampleSearch.label){
                                    exampleList.append($('<li></li>').append(example.label+ " (You are here)"));
                                }else{
                                    
                                    exampleList.append($('<li></li>').append($('<a></a>').attr('href', url).append(example.label )));
                                }
                            });
                        }*/
                        if(summary.description.match(/<b>\s*Alert Volume:*\s*<\/b>:*\s*Very Low/)){
                            summary.description = summary.description.replace(/<b>\s*Alert Volume:*\s*<\/b>:*\s*Very Low/, '<b>Alert Volume:</b> Very Low <a class="dvPopover" id="alertVolumetooltip" href="#" title="Alert Volume: Very Low" data-placement="right" data-toggle="popover" data-trigger="hover" data-content="An alert volume of Very Low indicates that a typical environment will rarely see alerts from this search, maybe after a brief period of tuning. This search should trigger infrequently enough that you could send it directly to the SOC as an alert, although you should also send it into a data-analysis based threat detection solution, such as Splunk UBA (or as a starting point, Splunk ES\'s Risk Framework)">(?)</a>')
                        }else if(summary.description.match(/<b>\s*Alert Volume:*\s*<\/b>:*\s*Low/)){
                            summary.description = summary.description.replace(/<b>\s*Alert Volume:*\s*<\/b>:*\s*Low/, '<b>Alert Volume:</b> Low <a class="dvPopover" id="alertVolumetooltip" href="#" title="Alert Volume: Low" data-placement="right" data-toggle="popover" data-trigger="hover" data-content="An alert volume of Low indicates that a typical environment will occasionally see alerts from this search -- probably 0-1 alerts per week, maybe after a brief period of tuning. This search should trigger infrequently enough that you could send it directly to the SOC as an alert if you decide it is relevant to your risk profile, although you should also send it into a data-analysis based threat detection solution, such as Splunk UBA (or as a starting point, Splunk ES\'s Risk Framework)">(?)</a>')
                        }else if(summary.description.match(/<b>\s*Alert Volume:*\s*<\/b>:*\s*Medium/)){
                            summary.description = summary.description.replace(/<b>\s*Alert Volume:*\s*<\/b>:*\s*Medium/, '<b>Alert Volume:</b> Medium <a class="dvPopover" id="alertVolumetooltip" href="#" title="Alert Volume: Medium" data-placement="right" data-toggle="popover" data-trigger="hover" data-content="An alert volume of Medium indicates that you\'re likely to see one to two alerts per day in a typical organization, though this can vary substantially from one organization to another. It is recommended that you feed these to an anomaly aggregation technology, such as Splunk UBA (or as a starting point, Splunk ES\'s Risk Framework)">(?)</a>')
                        }else if(summary.description.match(/<b>\s*Alert Volume:*\s*<\/b>:*\s*High/)){
                            summary.description = summary.description.replace(/<b>\s*Alert Volume:*\s*<\/b>:*\s*High/, '<b>Alert Volume:</b> High <a class="dvPopover" id="alertVolumetooltip" href="#" title="Alert Volume: High" data-placement="right" data-toggle="popover" data-trigger="hover" data-content="An alert volume of High indicates that you\'re likely to see several alerts per day in a typical organization, though this can vary substantially from one organization to another. It is highly recommended that you feed these to an anomaly aggregation technology, such as Splunk UBA (or as a starting point, Splunk ES\'s Risk Framework)">(?)</a>')
                        }else if(summary.description.match(/<b>\s*Alert Volume:*\s*<\/b>:*\s*Very High/)){
                            summary.description = summary.description.replace(/<b>\s*Alert Volume:*\s*<\/b>:*\s*Very High/, '<b>Alert Volume:</b> Very High <a class="dvPopover" id="alertVolumetooltip" href="#" title="Alert Volume: Very High" data-placement="right" data-toggle="popover" data-trigger="hover" data-content="An alert volume of Very High indicates that you\'re likely to see many alerts per day in a typical organization. You need a well thought out high volume indicator search to get value from this alert volume. Splunk ES\'s Risk Framework is a starting point, but is probably insufficient given how common these events are. IT is highly recommended that you either build correlation searches based on the output of this search, or leverage Splunk UBA with it\'s threat models to surface the high risk indicators.">(?)</a>')
                        }else{
                            summary.description = summary.description.replace(/(<b>\s*Alert Volume:.*?)(?:<\/p>)/, '$1 <a class="dvPopover" id="alertVolumetooltip" href="#" title="Alert Volume" data-placement="right" data-toggle="popover" data-trigger="hover" data-content="The alert volume indicates how often a typical organization can expect this search to fire. On the Very Low / Low side, alerts should be rare enough to even send these events directly to the SIEM for review. Oh the High / Very High side, your SOC would be buried under the volume, and you must send the events only to an anomaly aggregation and threat detection solution, such as Splunk UBA (or for a partial solution, Splunk ES\'s risk framework). To that end, *all* alerts, regardless of alert volume, should be sent to that anomaly aggregation and threat detection solution. More data, more indicators, should make these capabilites stronger, and make your organization more secure.">(?)</a>')
                        }
                        relevance = summary.relevance ? "<p><b>Security Impact:</b> <br />" + summary.relevance + "</p>" : ""
                        panelStart = "<div id=\"rowDescription\" class=\"dashboard-row dashboard-rowDescription splunk-view\">        <div id=\"panelDescription\" class=\"dashboard-cell last-visible splunk-view\" style=\"width: 100%;\">            <div class=\"dashboard-panel clearfix\" style=\"min-height: 0px;\"><h2 class=\"panel-title empty\"></h2><div id=\"view_description\" class=\"fieldset splunk-view editable hide-label hidden empty\"></div>                                <div class=\"panel-element-row\">                    <div id=\"elementdescription\" class=\"dashboard-element html splunk-view\" style=\"width: 100%;\">                        <div class=\"panel-body html\"> <div id=\"contentDescription\"> "
                        panelEnd =  "</div></div>                    </div>                </div>            </div>        </div>    </div>"
                        description = panelStart + "<b>Description:</b> " + summary.description + relevance + /*exampleText + "<ul>" + exampleList.html() + "</ul>" + */ panelEnd
                        HTMLBlock += "<li><input type=\"checkbox\" id=\"checkbox_" + toHex(example) + "\" onclick=\"trigger_clicked('" + toHex(example) + "')\"> " + summary.name + " (<a href=\"#\" onclick=\"$('#description_" + toHex(example) + "').toggle(); return false;\">toggle description</a>)<div id=\"description_" + toHex(example) + "\" style=\"display: none; margin-left:40px;\">" + description + "</div></li>\n"
                    }
                }
                HTMLBlock = HTMLBlockHeader + "<form><ul>" + HTMLBlock + "</ul></form></div>"
                window.HTMLBlock = HTMLBlock //backup...
                //console.log("Here's my HTML", HTMLBlock)
                $("#main_content").html(HTMLBlock)
            });
            
    if($(".dvTooltip").length>0){$(".dvTooltip").tooltip()}
    if($(".dvPopover").length>0){$(".dvPopover").popover()}
    

            unsubmittedTokens.set(myDataset.replace(/\W/g,""),"Test");

            submittedTokens.set(unsubmittedTokens.toJSON());
        }
    );

