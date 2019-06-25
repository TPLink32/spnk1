/*
 * This file contains a collection of constants for use in the Winfra app's js files
 */

define(function() {
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

       getPerfmonPath: function() { return '/dj/splunk_app_windows_infrastructure/windows/perfmon?'; }
   };
   
   return WinfraConstants;
});