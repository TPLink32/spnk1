'use strict';
//console.log("Starting it")
require(['jquery', 'splunkjs/mvc/simplexml/controller', 'splunkjs/mvc/dropdownview', 'splunk.util', 'components/data/parameters/RoleStorage', 'Options', 'json!components/data/ShowcaseInfo.json'], function ($, DashboardController, DropdownView, SplunkUtil, RoleStorage, Options, ShowcaseInfo) {
    var showcasesByRole = ShowcaseInfo.roles;
    var showcaseSummaries = ShowcaseInfo.summaries;

 
    window.dvtest_showcasesByRole = showcasesByRole
    window.dvtest_showcaseinfo = ShowcaseInfo
    var showcaseList = $('<ul class="showcase-list"></ul>');
    var showcaseFullList = $('<ul class="showcase-list"></ul>');
    var showcaseHighlightList = $('<ul class="showcase-list"></ul>');

    var setRole = function setRole(roleName) {
        showcaseList.empty();
        showcaseFullList.empty();
        showcaseHighlightList.empty()
        var app = DashboardController.model.app.get('app');

        if (showcasesByRole[roleName] == null) roleName = Options.getOptionByName('defaultRoleName');

        RoleStorage.setRole(roleName);
        var myElements = document.getElementsByClassName("activeshowcase");
        for (var i = 0; i < myElements.length; i++) {
            myElements[i].className = myElements[i].className.replace("activeshowcase", "");
        }
        if(typeof document.getElementById("showcase-" + roleName.replace(" ", "_")) != "undefined" && document.getElementById("showcase-" + roleName.replace(" ", "_")) != null){
            var element=document.getElementById("showcase-" + roleName.replace(" ", "_"))
            document.getElementById("showcase-" + roleName.replace(" ", "_")).className = document.getElementById("showcase-" + roleName.replace(" ", "_")).className + " activeshowcase"
        }
        
        showcasesByRole[roleName].summaries.sort(function(a, b){
            
            if(showcaseSummaries[a].name < showcaseSummaries[b].name) return -1;
            if(showcaseSummaries[a].name > showcaseSummaries[b].name) return 1;
            return 0;
        })
      
        showcasesByRole[roleName].summaries.forEach(function (showcaseId) {

            var showcaseSettings = showcaseSummaries[showcaseId];
            if(typeof showcaseSettings.datasource == "undefined"){
                showcaseSettings.datasource="Other"
                ShowcaseInfo.summaries[showcaseId].datasource = "Other"

            }
            var exampleText = void 0,
                exampleList = void 0;
            var InScope = true;
            if(typeof localStorage["dv-alert_volume"] != "undefined" && localStorage["dv-alert_volume"] != null && InScope == true && localStorage["dv-alert_volume"] != "ALL"){
                InScope = false;
               // console.log("We got an alert volume from localStorage", localStorage["dv-alert_volume"])
                var regex = /Alert Volume:\s*<.*?>\s*([\w ]*?)\s*</
                var match = regex.exec(showcaseSettings.description)
                if(match!= null && typeof match !="undefined" && typeof match.length!="undefined" && match.length > 1){
              //      console.log("For ", showcaseSettings, "comparing ", match[1].replace(/ /g, "_"), "and", localStorage["dv-alert_volume"])
                    if(match[1].replace(/ /g, "_") == localStorage["dv-alert_volume"]){
                        InScope = true;
                    }
                }
            }
            if(typeof localStorage["dv-data_sources"] != "undefined" && localStorage["dv-data_sources"] != null && InScope == true && localStorage["dv-data_sources"] != "ALL"){
                InScope = false;
                if(typeof showcaseSettings.datasource != "undefined" && showcaseSettings.datasource != null){
            //        console.log("We got an data source from localStorage", showcaseSettings.datasource, localStorage["dv-data_sources"])
                    if( typeof showcaseSettings.datasource != "undefined" && showcaseSettings.datasource != null && showcaseSettings.datasource.replace(/ /g, "_").indexOf(localStorage["dv-data_sources"]) >=0){
                        InScope = true;
                    }    
                }
                
            }
            if(typeof localStorage["dv-recent"] != "undefined" && localStorage["dv-recent"] != null && InScope == true && localStorage["dv-recent"] != "ALL"){
                InScope = false;
            //    console.log("We got an recent from localStorage", localStorage["dv-recent"])
                
                if( typeof showcaseSettings.released != "undefined" && showcaseSettings.released != null && showcaseSettings.released.replace(/ /g, "_").replace(/\./g, "_") == localStorage["dv-recent"]){
                    InScope = true;
                }
            }
            if(InScope == false){
                return; // skip this one
            }
            if (showcaseSettings != null) {
                if (showcaseSettings.examples != null) {
                    exampleText = showcaseSettings.examples.length > 1 ? '<b>Examples:</b>' : '<b>Example:</b>';
                    exampleList = $('<ul class="example-list"></ul>');

                    showcaseSettings.examples.forEach(function (example) {
                        var showcaseURLDefault = showcaseSettings.dashboard;
                        
                        if(showcaseSettings.dashboard.indexOf("?")>0){

                            showcaseURLDefault = showcaseSettings.dashboard.substr(0, showcaseSettings.dashboard.indexOf("?"))
                            
                        }
                        var url = showcaseURLDefault + '?ml_toolkit.dataset=' + example.name;
                        exampleList.append($('<li></li>').append($('<a></a>').attr('href', url).append(example.label)));
                    });
                    //exampleText +='<ul class="example-list">' + exampleList.html() + '</ul>'
                } else {
                    exampleList = '';
                    exampleText = '';
                }
                //exampleText += exampleList.html()

                //console.log("Working on ", showcaseId, "got examples", exampleText, exampleList[0])
                var wrapperLink = $('<a></a>').attr('href', showcaseSettings.dashboard);
                var showcaseImageDefault = showcaseSettings.dashboard
                if(showcaseSettings.dashboard.indexOf("?")>0){
                    showcaseImageDefault = showcaseSettings.dashboard.substr(0, showcaseSettings.dashboard.indexOf("?"))
                }
                
                var showcaseImage = showcaseSettings.image != null ? showcaseSettings.image : showcaseImageDefault + '.png';
                
                if(typeof showcaseSettings.highlight!= "undefined" && showcaseSettings.highlight=="true"){
                    showcaseHighlightList.append($('<li></li>').append(wrapperLink.clone().append($('<img class="showcase-list-item-image" />').attr('src', SplunkUtil.make_url('/static/app/' + app + '/images/content_thumbnails/' + showcaseImage))), $('<div class="showcase-list-item-content"></div>').append(wrapperLink.clone().append($('<h3>' + showcaseSettings.name + '</h3>')), showcaseSettings.description, exampleText, exampleList)));    
                }else{
                    showcaseFullList.append($('<li></li>').append(wrapperLink.clone().append($('<img class="showcase-list-item-image" />').attr('src', SplunkUtil.make_url('/static/app/' + app + '/images/content_thumbnails/' + showcaseImage))), $('<div class="showcase-list-item-content"></div>').append(wrapperLink.clone().append($('<h3>' + showcaseSettings.name + '</h3>')), showcaseSettings.description, exampleText, exampleList)));
                }
                //showcaseList.append($('<li></li>').append(wrapperLink.clone().append($('<img class="showcase-list-item-image" />').attr('src', SplunkUtil.make_url('/static/app/' + app + '/images/content_thumbnails/' + showcaseImage))), $('<div class="showcase-list-item-content"></div>').append(wrapperLink.clone().append($('<h3>' + showcaseSettings.name + '</h3>')), showcaseSettings.description, exampleText, exampleList)));
            }
        });
    };
    
    DashboardController.onReady(function () {
        DashboardController.onViewModelLoad(function () {
            //console.log("Here are my showcases...", showcaseHighlightList , showcaseFullList)
            $('.dashboard-body').append($("<h3>Highlights</h3>"), showcaseHighlightList, $("<hr />"), $("<h3>Other Use Cases</h3>"), showcaseFullList);
            //$('.dashboard-body').append( showcaseList);
            var rolePickerRow = void 0;

            if (Object.keys(ShowcaseInfo.roles).length > 1) rolePickerRow = $('#rolePickerRow');
            if (rolePickerRow != null) rolePickerRow.show();
            var myHtml="<ul class=\"RoleList\">"
            Object.keys(showcasesByRole).map(function(roleName){
                
                myHtml += "<li><a href=\"#\" id=\"showcase-" + roleName.replace(" ", "_") + "\" onclick=\"setRole('" + roleName + "'); return false;\">" + showcasesByRole[roleName].label + " (" + showcasesByRole[roleName].summaries.length + " examples)</a></li>"
            })
            myHtml += "</ul>"
            //$('.dashboard-body').append(myHtml);
            $('#rolePickerControl').html(myHtml);
            initNav();
            setUpNav();

            
        });
    });


    function initNav(){
        if(typeof localStorage["dv-alert_volume"] == "undefined" || localStorage["dv-alert_volume"] == null){
            localStorage["dv-alert_volume"] = "ALL"
        }
        if(typeof localStorage["dv-domains"] == "undefined" || localStorage["dv-domains"] == null){
            localStorage["dv-domains"] = "ALL"
        }
        if(typeof localStorage["dv-data_sources"] == "undefined" || localStorage["dv-data_sources"] == null){
            localStorage["dv-data_sources"] = "ALL"
        }
        if(typeof localStorage["dv-recent"] == "undefined" || localStorage["dv-recent"] == null){
            localStorage["dv-recent"] = "ALL"
        }
    }

    function setUpNav(){


            // Alternative Approach
            var myHTML = "<h4>Use Case Filters <a href=\"#\" onclick=\"toggleFilters(); return false;\" style=\"font-weight: normal;\" id=\"toggleFilters\"> (Hide)</span></h4><table id=\"FiltersBox\" style=\"width: 1050px\"><tr><td style=\"width:150px;\">Security Domains</td><td style=\"width:500px;\">Data Sources</td><td style=\"width:150px;\">Alert Volume</td><td style=\"width:150px;\">Last Updated</td></tr>"
            var myDomains = new Object();
            var myDataSources = new Object();
            var myAlertVolume = new Object();
            var myRecent = new Object();
            var showcase = "default";


            // Calculate the max number of use cases
            for(var i = 0; i < showcasesByRole[showcase].summaries.length; i++){
                var myShowcase = ShowcaseInfo.summaries[showcasesByRole[showcase].summaries[i]]
                var showcaseLabel=showcasesByRole[showcase].summaries[i]
                
                if(typeof myShowcase.datasource !="undefined"){
                    if(myShowcase.datasource.indexOf("|")>=0){
                        var datasources = myShowcase.datasource.split("|")
                        //console.log("DataSources", datasources.length, datasources, myShowcase.datasource)
                        for(var g = 0; g < datasources.length; g++){
                            if(typeof myDataSources[datasources[g]] == "undefined")
                                myDataSources[datasources[g]] = 0;
                            myDataSources[datasources[g]]++;
                        }
                    }else{
                        if(typeof myDataSources[myShowcase.datasource] == "undefined")
                            myDataSources[myShowcase.datasource] = 0;
                        myDataSources[myShowcase.datasource]++;
                    }

                    
                }
                var regex = /Alert Volume:\s*<.*?>\s*([\w ]*?)\s*</
                var match = regex.exec(myShowcase.description)
                if(match!= null && typeof match !="undefined" && typeof match.length!="undefined" && match.length > 1){
                    if(typeof myAlertVolume[match[1]] == "undefined")
                        myAlertVolume[match[1]] = 0;
                    myAlertVolume[  match[1]  ]++;
                    //console.log("Alert", match)
                    
                }
                if(typeof myShowcase.released !="undefined"){
                    if(typeof myRecent[myShowcase.released] == "undefined")
                        myRecent[myShowcase.released] = 0;
                    myRecent[myShowcase.released]++;
                }
                
                
                Object.keys(showcasesByRole).map(function(showcase){
                    if(showcase!="default"){
                        for(var i = 0; i < showcasesByRole[showcase].summaries.length; i++){
                            if(showcaseLabel == showcasesByRole[showcase].summaries[i]){
                                //console.log("dvtest2", showcaseLabel, showcasesByRole[showcase].summaries[i])
                                if(typeof myDomains[showcase] == "undefined")
                                    myDomains[showcase] = 0;
                                myDomains[showcase]++
                            }
                        }   
                    }
                })

            }
            // End max use cases -- I should fold this into the main functions, but priorities priorities priorities

            // Calculate the in scope number of use cases
            var myInScopeDomains = new Object();
            var myInScopeDataSources = new Object();
            var myInScopeAlertVolume = new Object();
            var myInScopeRecent = new Object();

            var InScopeIDs = DetermineInScope()
            
            //console.log("Final In Scope IDs", InScopeIDs)
            //showcasesByRole["default"].summaries.forEach(function (showcaseId) {
            InScopeIDs.forEach(function (showcaseId) {
                var showcaseSettings = showcaseSummaries[showcaseId];
                var exampleText = void 0,
                    exampleList = void 0;
                var InScope = true;
                //console.log("We're in scope for ", showcaseId, " with ", showcaseSettings.datasource, " and", showcaseSettings)
                //var myShowcase = ShowcaseInfo.summaries[showcasesByRole[showcase].summaries[i]]
                //var showcaseLabel=showcasesByRole[showcase].summaries[i]
                if(typeof showcaseSettings.datasource !="undefined"){
                    if(showcaseSettings.datasource.indexOf("|")>=0){
                        var datasources = showcaseSettings.datasource.split("|")
                        //console.log("DataSources..verification...", datasources.length, datasources, showcaseSettings.datasource)
                        for(var g = 0; g < datasources.length; g++){
                            //console.log("Handling", datasources[g], myInScopeDataSources[datasources[g]])
                            if(typeof myInScopeDataSources[datasources[g]] == "undefined" || isNaN(myInScopeDataSources[datasources[g]]))
                                myInScopeDataSources[datasources[g]] = 1;
                            else
                                myInScopeDataSources[datasources[g]]++;
                            //console.log("Output...", myInScopeDataSources[datasources[g]])
                        }
                    }else{
                        //console.log("Handling2",showcaseSettings.datasource)
                        if(showcaseSettings.datasource)
                            if(typeof myInScopeDataSources[showcaseSettings.datasource] == "undefined" )
                                myInScopeDataSources[showcaseSettings.datasource] = 1;
                            else
                                myInScopeDataSources[showcaseSettings.datasource]++;
                    }

                    
                }
                var regex = /Alert Volume:\s*<.*?>\s*([\w ]*?)\s*</
                var match = regex.exec(showcaseSettings.description)
                if(match!= null && typeof match !="undefined" && typeof match.length!="undefined" && match.length > 1){
                    if(typeof myInScopeAlertVolume[match[1]] == "undefined")
                        myInScopeAlertVolume[match[1]] = 0;
                    myInScopeAlertVolume[  match[1]  ]++;
                    //console.log("Alert", match)
                    
                }
                if(typeof showcaseSettings.released !="undefined"){
                    if(typeof myInScopeRecent[showcaseSettings.released] == "undefined")
                        myInScopeRecent[showcaseSettings.released] = 0;
                    myInScopeRecent[showcaseSettings.released]++;
                }
                
                
                Object.keys(showcasesByRole).map(function(showcase){
                    if(showcase!="default"){
                        for(var i = 0; i < showcasesByRole[showcase].summaries.length; i++){
                            
                            if(showcaseId == showcasesByRole[showcase].summaries[i]){
                                //console.log("dvtest2", showcaseLabel, showcasesByRole[showcase].summaries[i])    
                                if(typeof myInScopeDomains[showcase] == "undefined")
                                    myInScopeDomains[showcase] = 0;
                                myInScopeDomains[showcase]++

                            }
                        }   
                    }
                })


                //console.log("This use case is inScope", showcaseSettings)
            });
            //console.log("Here's the in scope", myInScopeRecent, myInScopeDomains, myInScopeDataSources, myInScopeAlertVolume)











            
            //console.log("DVTest -- got my items", myDomains, myDataSources, myAlertVolume, myRecent)
            

            myHTML += "<tr><td style=\"vertical-align:text-top;\">" + '<div style=\"height: 1.75em; \"><input onclick="window.doChange(this)" type="radio" name="domains" value="ALL">&nbsp;&nbsp;All</div>'
            for(var i =0 ;i < Object.keys(myDomains).length; i++){
                var item= Object.keys(myDomains).sort()[i]
                //console.log("Running...", item)
                // Working with Span... just the click that's the issuemyHTML += '<div style=\"height: 1.75em; \"><input onclick="window.doChange(this)" type="radio" id="domains_' + item.replace(/ /g, "_").replace(/\./g, "_") + '" name="domains" value="' + item.replace(/ /g, "_") + '">&nbsp;&nbsp;<span onclick=\'$("#domains_' + item.replace(/ /g, "_").replace(/\./g, "_") + '").attr(\"checked\",true);\'>' + item.replace(" Domain","") + ' (' + (GetNumberInScope("Domains", item, InScopeIDs) /*myInScopeDomains[item]*/ || "0") + "/" + myDomains[item] + ')</span></div>'
                myHTML += '<div style=\"height: 1.75em; \"><input onclick="window.doChange(this)" type="radio" id="domains_' + item.replace(/ /g, "_").replace(/\./g, "_") + '" name="domains" value="' + item.replace(/ /g, "_") + '">&nbsp;&nbsp;' + item.replace(" Domain","") + ' (' + (GetNumberInScope("Domains", item, InScopeIDs) /*myInScopeDomains[item]*/ || "0") + "/" + myDomains[item] + ')</div>'
            }
            myHTML += "</td>"



            myHTML += "<td style=\"vertical-align:text-top;\">" + '<div style=\"height: 1.75em; \"><input onclick="window.doChange(this)" type="radio" name="data_sources" value="ALL">&nbsp;&nbsp;All</div>'
            
            for(var i =0 ;i < Object.keys(myDataSources).length; i++){
                var item= Object.keys(myDataSources).sort()[i]
                myHTML += '<div style=\"width:250px; height: 1.75em; display: inline-block;\"><input onclick="window.doChange(this)" type="radio" id="data_sources_' + item.replace(/ /g, "_").replace(/\./g, "_") + '" name="data_sources" value="' + item.replace(/ /g, "_") + '">&nbsp;&nbsp;' + item + ' (' + (GetNumberInScope("DataSources", item, InScopeIDs) || "0") + "/"  + myDataSources[item] + ')</div>'
            }
            myHTML += "</td>"




            myHTML += "<td style=\"vertical-align:text-top;\">" + '<div style=\"height: 1.75em; \"><input onclick="window.doChange(this)" type="radio" name="alert_volume" value="ALL">&nbsp;&nbsp;All</div>'
            
            //for(var i =0 ;i < Object.keys(myAlertVolume).length; i++){
            //    var item= Object.keys(myAlertVolume).sort()[i]
            var alerts = new Object();
            alerts['Very Low'] = 1;
            alerts['Low'] = 1;
            alerts['Medium'] = 1;
            alerts['High'] = 1;
            alerts['Very High'] = 1;
            for(var item in alerts){
                myHTML += '<div style=\"height: 1.75em; \"><input onclick="window.doChange(this)" type="radio" id="alert_volume_' + item.replace(/ /g, "_").replace(/\./g, "_") + '" name="alert_volume" value="' + item.replace(/ /g, "_") + '">&nbsp;&nbsp;' + item + ' (' + (GetNumberInScope("AlertVolume", item, InScopeIDs) || "0") + "/"  + myAlertVolume[item] + ')</div>'
            }
            myHTML += "</td>"




            myHTML += "<td style=\"vertical-align:text-top;\">" + '<div style=\"height: 1.75em; \"><input onclick="window.doChange(this)" type="radio" name="recent" value="ALL">&nbsp;&nbsp;All</div>'
            
            for(var i =0 ;i < Object.keys(myRecent).length; i++){
                var item= Object.keys(myRecent).sort()[i]
                myHTML += '<div style=\"height: 1.75em; \"><input onclick="window.doChange(this)" type="radio" id="recent_' + item.replace(/ /g, "_").replace(/\./g, "_") + '" name="recent" value="' + item.replace(/ /g, "_").replace(/\./g, "_") + '">&nbsp;&nbsp;' + item + ' (' + (GetNumberInScope("Recent", item.replace(/ /g, "_").replace(/\./g, "_"), InScopeIDs) || "0") + "/"  + myRecent[item] + ')</div>'
            }
          myHTML += "</td></tr>"

  
            myHTML += "</table>"
            //console.log(myHTML)
            $('#rolePickerControl').html(myHTML);
            $("#FiltersBox").find("tr").first().find("td").css("border-bottom","1px  solid lightgray ")
            $("#FiltersBox").find("tr").last().find("td").css("border-right","1px  solid lightgray ")
            $("#FiltersBox").find("tr").last().find("td").css("padding-top","4px")
            $("#FiltersBox").find("tr").first().find("td").css("padding-bottom","4px")
            $("h4:contains(Use Case Filters)").css("margin-top", "15px")
            $("#FiltersBox").css("margin-top", "10px")
            $("#FiltersBox").find("tr").last().find("td").last().css("border-right","")
            $("#FiltersBox").find("td").css("padding-left", "10px")
            var role = localStorage["dv-domains"].replace(/_/g, " "); //RoleStorage.getRole();
            $('input[name=domains][value=' + localStorage["dv-domains"] +']').prop("checked", true)
            $('input[name=data_sources][value=' + localStorage["dv-data_sources"] +']').prop("checked", true)
            $('input[name=alert_volume][value=' + localStorage["dv-alert_volume"] +']').prop("checked", true)
            $('input[name=recent][value=' + localStorage["dv-recent"] +']').prop("checked", true)
            setRole(role)

            function doChange(object){
                //console.log("I got called!", $(object).attr("name"), $(object).attr("value"))

                if($(object).attr("name") == "domains"){
                    localStorage["dv-" + $(object).attr("name")] = $(object).attr("value")
                    //console.log("Got an attempt to change the domain...", $(object).attr("value"), $(object).attr("value").replace(/_/g, " "))
                    setRole($(object).attr("value").replace(/_/g, " "))

                }else{
                    localStorage["dv-" + $(object).attr("name")] = $(object).attr("value")
                    setRole()
                }
                setUpNav()
                
            }
            window.doChange = doChange
            window.setRole = setRole
    }
    window.setUpNav = setUpNav;
    function DetermineInScope(Category){
        var inScopeIds = []
        showcasesByRole["default"].summaries.forEach(function (showcaseId) {
            var showcaseSettings = showcaseSummaries[showcaseId];
            var exampleText = void 0,
                exampleList = void 0;
            var InScope = true;
            
            if(typeof localStorage["dv-alert_volume"] != "undefined" && localStorage["dv-alert_volume"] != null && InScope == true && localStorage["dv-alert_volume"] != "ALL" && Category!="AlertVolume"){
                InScope = false;
                var regex = /Alert Volume:\s*<.*?>\s*([\w ]*?)\s*</
                var match = regex.exec(showcaseSettings.description)
                if(match!= null && typeof match !="undefined" && typeof match.length!="undefined" && match.length > 1){
                    if(match[1].replace(/ /g, "_") == localStorage["dv-alert_volume"]){
                        InScope = true;
                    }
                }
            }else if(localStorage["dv-alert_volume"] == "ALL"){

            }
            if(typeof localStorage["dv-data_sources"] != "undefined" && localStorage["dv-data_sources"] != null && InScope == true && localStorage["dv-data_sources"] != "ALL" && Category!="DataSources"){
                InScope = false;
                if(typeof showcaseSettings.datasource != "undefined" && showcaseSettings.datasource != null){
                    if( typeof showcaseSettings.datasource != "undefined" && showcaseSettings.datasource != null && showcaseSettings.datasource.replace(/ /g, "_").indexOf(localStorage["dv-data_sources"]) >=0){
                        InScope = true;
                    }    
                }
                
            }
            if(typeof localStorage["dv-recent"] != "undefined" && localStorage["dv-recent"] != null && InScope == true && localStorage["dv-recent"] != "ALL"  && Category!="Recent"){
                InScope = false;
                
                if( typeof showcaseSettings.released != "undefined" && showcaseSettings.released != null && showcaseSettings.released.replace(/ /g, "_").replace(/\./g, "_") == localStorage["dv-recent"]){
                    
                    InScope = true;
                }
            }

            if(typeof localStorage["dv-domains"] != "undefined" && localStorage["dv-domains"] != null && InScope == true && localStorage["dv-domains"] != "ALL" && Category!="Domains"){
                InScope = false;
                for(var q=0; q < showcasesByRole[localStorage["dv-domains"].replace(/_/g, " ")].summaries.length; q++){
                    if(showcasesByRole[localStorage["dv-domains"].replace(/_/g, " ")].summaries[q] == showcaseId){
                        InScope = true;
                    }   
                }

            }

            if(InScope == true){
                inScopeIds.push(showcaseId)
            }

        })
        return inScopeIds
    }


    function GetNumberInScope(Category, Item, InScopeIDs){
               // Calculate the in scope number of use cases
            var myInScopeDomains = new Object();
            var myInScopeDataSources = new Object();
            var myInScopeAlertVolume = new Object();
            var myInScopeRecent = new Object();

            var InScopeIDs = DetermineInScope(Category)
            
         //   console.log("Final In Scope IDs", InScopeIDs)
            //showcasesByRole["default"].summaries.forEach(function (showcaseId) {
            InScopeIDs.forEach(function (showcaseId) {
                var showcaseSettings = showcaseSummaries[showcaseId];

                var exampleText = void 0,
                    exampleList = void 0;
                var InScope = true;
                //console.log("We're in scope for ", showcaseId, " with ", showcaseSettings.released, " and", showcaseSettings)
                //var myShowcase = ShowcaseInfo.summaries[showcasesByRole[showcase].summaries[i]]
                //var showcaseLabel=showcasesByRole[showcase].summaries[i]


                //Data Sources Check
                if(Category=="DataSources"){
                    if(typeof showcaseSettings.datasource !="undefined"){
                        if(showcaseSettings.datasource.indexOf("|")>=0){
                            var datasources = showcaseSettings.datasource.split("|")
                            for(var g = 0; g < datasources.length; g++){
                                if(typeof myInScopeDataSources[datasources[g]] == "undefined")
                                    myInScopeDataSources[datasources[g]] = 0;
                                myInScopeDataSources[datasources[g]]++;
                                //console.log("Checking", showcaseSettings.datasource, showcaseId)

                            }
                        }else{
                            if(showcaseSettings.datasource)
                                if(typeof myInScopeDataSources[showcaseSettings.datasource] == "undefined" )
                                    myInScopeDataSources[showcaseSettings.datasource] = 0;
                                myInScopeDataSources[showcaseSettings.datasource]++;
                                //  console.log("Checking", showcaseSettings.datasource, showcaseId)
                        }
                    }
                }

                // Alert Volume Check
                if(Category=="AlertVolume"){
                    var regex = /Alert Volume:\s*<.*?>\s*([\w ]*?)\s*</
                    var match = regex.exec(showcaseSettings.description)
                    if(match!= null && typeof match !="undefined" && typeof match.length!="undefined" && match.length > 1){
                        if(typeof myInScopeAlertVolume[match[1]] == "undefined")
                            myInScopeAlertVolume[match[1]] = 0;
                        myInScopeAlertVolume[  match[1]  ]++;
                    //    console.log("Alert", match)
                    }
                }


                // Recent Check
                if(Category=="Recent"){
                    
                    if(typeof showcaseSettings.released !="undefined"){
                        var newReleased = showcaseSettings.released.replace(/ /g, "_").replace(/\./g, "_")
                        
                        if(typeof myInScopeRecent[newReleased] == "undefined")
                            myInScopeRecent[newReleased] = 0;
                        myInScopeRecent[newReleased]++;
                        
                    }
                }
                
                
                // Domain Check
                if(Category=="Domains"){    
                    Object.keys(showcasesByRole).map(function(showcase){
                        if(showcase!="default"){
                            for(var i = 0; i < showcasesByRole[showcase].summaries.length; i++){
                                
                                if(showcaseId == showcasesByRole[showcase].summaries[i]){
                                    //console.log("dvtest2", showcaseLabel, showcasesByRole[showcase].summaries[i])    
                                    if(typeof myInScopeDomains[showcase] == "undefined")
                                        myInScopeDomains[showcase] = 0;
                                    myInScopeDomains[showcase]++

                                }
                            }   
                        }
                    })
                }




            //    console.log("This use case is inScope", showcaseSettings)
            });
            //console.log("Here's the in scope", myInScopeRecent, myInScopeDomains, myInScopeDataSources, myInScopeAlertVolume)
            if(Category=="Domains"){
                return myInScopeDomains[Item] || "0"
            }else if(Category=="DataSources"){
                return myInScopeDataSources[Item] || "0"
            }else if(Category=="Recent"){
                return myInScopeRecent[Item] || "0"
            }else if(Category=="AlertVolume"){
                return myInScopeAlertVolume[Item] || "0"
            }

    }



});

function toggleFilters(){
    if($("#FiltersBox").css("display") !="none"){
        $("#FiltersBox").css("display", "none")
        $("#toggleFilters").text(" (show)")
    }else{
        $("#FiltersBox").css("display", "block")
        $("#toggleFilters").text(" (hide)")
    }
}