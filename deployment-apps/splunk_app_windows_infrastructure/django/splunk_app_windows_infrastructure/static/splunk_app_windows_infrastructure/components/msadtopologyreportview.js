define(function(require, exports, module) {

    var _ = require('underscore');
    var $ = require('jquery');
    var SimpleSplunkView = require("splunkjs/mvc/simplesplunkview");
    var mvc = require('splunkjs/mvc');
    require("css!./msadtopologyreportview.css");
    require("css!../contrib/jquery.dataTables.css");
    require("/dj/static/splunk_app_windows_infrastructure/contrib/jquery.dataTables.min.js");


    var TITLE_FIELD = "DomainTitle";

   
    var MSADTopologyReportView = SimpleSplunkView.extend({

        className: "splunk-app-microsoft-msadtopologyreportview",

        output_mode: "json",

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

            var tables = {};
            var tableTitles = [];
            var that = this;
            
            // Build the results table
            for (var i = 0 ; i < data.length ; i++) {
                var title = data[i][TITLE_FIELD];
                if (!tables[title]) {
                    tables[title] = [];
                    tableTitles.push(title);
                }
                tables[title].push(data[i]);
            }
            
            // Reset the UI First
            this.$el.empty();

            // For each table that we are going to render:
            //      1. Render a title
            //      2. Render the table for that title
            for (var i = 0 ; i < tableTitles.length ; i++) {
                var title = '<h2 class="title">' + tableTitles[i] + '</h2>';
                var table = this.renderTable(tables[tableTitles[i]]);
                this.$el.append(title, table);
            }
            
            // Create the data table
            this.$el.find('.MSADTopology_DataTable').dataTable({
                'oLanguage': {
                    'oPaginate': {
                        'sPrevious': "",
                        'sNext': ""
                    }
                }
            });
            
            // Link the click to the drill-down with $click.host$ being set
            this.$el.find('tr').on('click', function() {
                var hostField = $('span.host', this).text();
                
                // Now, find the host within data
                for (var i = 0 ; i < data.length ; i++) {
                    if (data[i]['host'] === hostField) {
                        // WARNING: fragile. Depends on Palette exposing its only timepicker this way
                        var globalTimepicker = _(mvc.Components.getInstances()).find(
                            function(i) {
                                return i.moduleId === 'splunkjs/mvc/timerangeview';
                            }
                        );
                        var earliestTime = globalTimepicker.settings.get('earliest_time');
                        var latestTime = globalTimepicker.settings.get('latest_time');
                        mvc.drilldown(
                            mvc.reverse("splunk_app_windows_infrastructure:tmpl_render", { tmpl: "ad/ops_dc_status" }),
                            {
                                "select118": hostField,
                                "earliest_time": earliestTime,
                                "latest_time": latestTime,
                                "autoRun": "True" 
                            }
                        );
                    }
                }
            });
        },

        /**
         * Renders a single table based on the data in the array of objects
         */
        renderTable: function(data) {
            var html = '<table class="MSADTopology_DataTable">';

            // Append the Headers
            html += '<thead><tr>';
            html += '<th>Host</th>';
            html += '<th>Site</th>';
            html += '<th>Operating System</th>';
            html += '<th>Version</th>';
            html += '<th>Master Roles</th>';
            html += '<th>DSA Options</th>';
            html += '<th>Services</th>';
            html += '<th>DNS Registration</th>';
            html += '<th>SYSVOL Shared</th>';
            html += '</tr></thead>';
            
            // Handle the body of the table
            html += '<tbody>';
            for (var i = 0 ; i < data.length ; i++) {
                var row = data[i];
                
                html += '<tr>';
                html += '<td><span class="host' + row['Enabled'] + '">&nbsp;</span><span class="host">' + row['host'] + '</span></td>';
                html += '<td class="center">' + row['Site'] + '</td>';
                html += '<td class="center">' + row['OperatingSystem'] + '</td>';
                html += '<td class="center">' + row['OSVersion'] + '</td>';
                
                // FSMO Roles
                var aFSMO = _.filter((row['FSMORoles'] || '').split(' '), function(entry) { return $.trim(entry) !== ''; });
                if (aFSMO.length == 0) {
                    html += '<td>&nbsp;</td>';
                } else {
                    for (var j = 0 ; j < aFSMO.length ; j++) {
                        var role = aFSMO[j];
                        aFSMO[j] = '<span class="image' + role + '">&nbsp;</span>';
                    }
                    html += '<td class="center fsmoroles"><div class="fsmoroles">' +aFSMO.join('<span class="imageSep">&nbsp;</span>') + '</div></td>';
                }
                
                // DSA Options (Enabled, GlobalCatalog, RODC)
                var aDSA = [];
                if (row['GlobalCatalog'] == 'True') aDSA.push('<span class="imageGlobalCatalog">&nbsp;</span>');
                if (row['RODC'] == 'True')          aDSA.push('<span class="imageRODC">&nbsp;</span>');
                if (aDSA.length == 0) {
                    html += '<td>&nbsp;</td>';
                } else {
                    html += '<td class="center dsaoptions"><div class="dsaoptions">' + aDSA.join('<span class="imageSep">&nbsp;</span>') + '</div></td>';
                }
                
                // ProcsOK
                html += '<td class="center truefalse"><div class="image' + row['ProcsOK'] + '">&nbsp;</div></td>';
                
                // DNSRegister
                html += '<td class="center truefalse"><div class="image' + row['DNSRegister'] + '">&nbsp;</div></td>';
                
                // SYSVOLShared
                html += '<td class="center truefalse"><div class="image' + row['SYSVOLShare'] + '">&nbsp;</div></td>';
                
                // End of Row
                html += '</tr>';
            }
            html += '</tbody>';
            
            // Finish off the table and return
            html += '</table>';
            return html;
        },
        
    

        getData: function(){
            return this.resultsModel.data().results;
        }

    });
    return MSADTopologyReportView;
});