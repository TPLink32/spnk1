
require.config({
    paths: {
        output_list_view: "../app/splunk_app_cef/js/views/OutputListView"
    }
});

require([
         "jquery",
         "underscore",
         "backbone",
         "output_list_view",
         "splunkjs/mvc/simplexml/ready!"
     ], function($, _, Backbone, OutputListView)
     {
         var outputList = new OutputListView({
        	 'el': $(".output_list #list_table")
        	 });
         
         outputList.render();
     }
);