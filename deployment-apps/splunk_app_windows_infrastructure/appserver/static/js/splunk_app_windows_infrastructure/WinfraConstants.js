/*
 * This file contains a collection of constants for use in the Winfra app's js files
 */

define([
        'splunk.util'
        ],
        function(splunk_util) {
   var WinfraConstants = {
       getAppName: function() { return 'Splunk App for Windows Infrastructure'; },
       
       getAppRestId: function() { return 'splunk_app_windows_infrastructure'; },
       
       getDefaultSparklineSettings: function() {
           return {
               type: "line", 
               lineColor: "#070", 
               lineWidth: 1,
               height: 30,
               highlightSpotColor: null, 
               minSpotColor: null, 
               maxSpotColor: null, 
               spotColor: '#070',
               spotRadius: 2,
               fillColor: null
               };
       },

       getSplunkWebUrl: function(){
           return (splunk_util.getConfigValue('MRSPARKLE_ROOT_PATH', '/') + '/')
               .replace(/^(\/)+/, "$1")
               .replace(/(\/)+$/, "$1");
       },

       getPerfmonPath: function() {
           return WinfraConstants.getSplunkWebUrl() + 'app/splunk_app_windows_infrastructure/windows_perfmon?';
       }
   };
   
   return WinfraConstants;
});