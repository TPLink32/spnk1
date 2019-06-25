
require.config({
    paths: {
        cef_output_editor_view: "../app/splunk_app_cef/js/views/ThirdPartyOutputEditorView"
    }
});

require([
         "jquery",
         "underscore",
         "backbone",
         "cef_output_editor_view",
         "splunkjs/mvc/simplexml/ready!"
     ], function($, _, Backbone, ThirdPartyOutputEditorView)
     {
         var outputEditorView = new ThirdPartyOutputEditorView({
        	 'el': $("#cef_output_editor"),
        	 'default_app': 'splunk_app_cef',
        	 'list_link' : 'cef_output_list',
        	 'list_link_title' : 'Back to List'});
         
         outputEditorView.render();
     }
);