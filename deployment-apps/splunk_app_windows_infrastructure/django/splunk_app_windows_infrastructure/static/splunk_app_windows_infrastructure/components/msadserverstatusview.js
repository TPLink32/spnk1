define(function(require, exports, module) {

    var _ = require('underscore');
    var mvc = require('splunkjs/mvc');
    var SimpleSplunkView = require("splunkjs/mvc/simplesplunkview");
    require("css!./msadserverstatusview.css");

   var servicesLookup =  {
        'dfsr':         'Distributed File Replication',
        'ismserv':      'Intersite Messaging',
        'ntfrs':        'NT File Replication',
        'kdc':          'Kerberos Distribution',
        'netlogon':     'Network Logon',
        'w32time':      'Windows Time'
    };

    var MSADServerStatusView = SimpleSplunkView.extend({

        className: "splunk-app-microsoft-msadserverstatusview",

        output_mode: "json",

        createView: function() {
            return true;
        },

        formatData: function(data){
        	return data;
        },

        updateView: function(viz, data) {
            // Internal to rendering functions
            var reverseUrl = function(url) {
                var urlSplit = url.split('?');
                return mvc.reverse("splunk_app_windows_infrastructure:tmpl_render", { tmpl: urlSplit[0] }) + (urlSplit[1] ? '?'+urlSplit[1] : '');
            };
            var makeRow = function(col1,col2) { return '<tr><td class="col1">' + col1 + '</td><td class="col2">' + col2 + '</td></tr>'; };
            var makeUrl = function(url,val) {
                url = reverseUrl(url);
                return '<a href="' + url + val + '">' + val + '</a>'; 
            };
            var makeLnk = function(url,val) { 
                url = reverseUrl(url);
                return '<a href="' + url + '">' + val + '</a>'; 
            };
            var divider = function()          { return '<tr class="divider"><td colspan="2">&nbsp;</td></tr>'; };
            var makeImg = function(img)       { return '<span class="image' + img + '"/>'; };
            
            var row  = data[0];
            
            // Compute some specific fields
            var dsaOptions = makeImg('Enabled');
            if (row['RODC'] === 'True')             dsaOptions += ' ' + makeImg('RODC');
            if (row['GlobalCatalog'] === 'True')    dsaOptions += ' ' + makeImg('GlobalCatalog');
            
            var aFSMORoles = row['FSMORoles'].split(" ");
            var blk_roles = [];
            for (var i = 0 ; i < aFSMORoles.length ; i++) {
                blk_roles.push(makeImg(aFSMORoles[i]));
            }
            
            var ServiceList = {};
            var ServicesRunning = row['ServicesRunning'].split(",");
            for (var i = 0 ; i < ServicesRunning.length ; i++) {
                if (ServicesRunning[i] && ServicesRunning[i].length > 0) {
                    ServiceList[ServicesRunning[i]] = "ServiceUp";
                }
            }
            var ServicesNotRunning = row['ServicesNotRunning'].split(",");
            for (var i = 0 ; i < ServicesNotRunning.length ; i++) {
                if (ServicesNotRunning[i] && ServicesNotRunning[i].length > 0) {
                    ServiceList[ServicesNotRunning[i]] = "ServiceDown";
                }
            }
            // We now have a list of Services that are named with a true/false based on if they are running or not
            serviceRow = '<table class="svc_table"><tbody>';
            var keys = Object.keys(ServiceList).sort();
            for (var i = 0 ; i < keys.length ; i++) {
                serviceRow += '<tr><td class="svc_name">' + servicesLookup[keys[i]] + '</td><td class="svc_status">' + makeImg(ServiceList[keys[i]]) + '</td></tr>';
            }
            serviceRow += '</tbody></table>';

            // Start the rendering in a collecting variable
            var html = '<table class="MSADServerStatus_Table"><tbody>';

            // Block 1 - Basic Information
            html += makeRow('Server', makeUrl('ad/ops_domain_status?select159=', row['DomainNetBIOSName']) + ' \\ ' + row['Server']);
            html += makeRow('Domain', makeUrl('ad/ops_domain_status?select159=', row['DomainNetBIOSName']) + ' \\ ' + makeLnk('ops_domain_status?DomainNetBIOSName='+row['DomainNetBIOSName'], row['DomainDNSName']));
            html += makeRow('Site',   makeUrl('ad/ops_site_status?select199=', row['Site']));
            html += makeRow('Forest', row['ForestName']);
            html += divider();

            // Block 2 - OS Information
            html += makeRow('Operating System', row['OperatingSystem']);
            html += makeRow('Service Pack', row['ServicePack']);
            html += makeRow('OS Version', row['OSVersion']);

            // Block 3 - Domain Controller Information
            html += makeRow('DSA Options', dsaOptions);
            html += makeRow('Master Roles', blk_roles.join('&nbsp;'));
            html += makeRow('Highest USN', row['HighestUSN']);
            html += makeRow('Schema Version', row['SchemaVersion'] + ' (' + row['SchemaName'] + ')');
            html += divider();

            html += '<tr><td class="services">Services</td><td class="col2">' + serviceRow + '</td></tr>';
            html += makeRow('SYSVOL is Shared', makeImg(row['SYSVOLShare']));
            html += makeRow('Registered in DNS', makeImg(row['DNSRegister']));

            html += '</tbody></table>';
            this.$el.html(html);
            
        },

        getData: function(){
            return this.resultsModel.data().results;
        }

    });
    return MSADServerStatusView;
});