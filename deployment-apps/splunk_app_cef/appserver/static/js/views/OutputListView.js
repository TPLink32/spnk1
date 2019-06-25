require.config({
    paths: {
        datatables: "../app/splunk_app_cef/js/lib/DataTables/js/jquery.dataTables",
        bootstrapDataTables: "../app/splunk_app_cef/js/lib/DataTables/js/dataTables.bootstrap",
        text: "../app/splunk_app_cef/js/lib/text",
        console: '../app/splunk_app_cef/js/util/Console'
    },
    shim: {
        'bootstrapDataTables': {
            deps: ['datatables']
        }
    }
});

define([
    "underscore",
    "backbone",
    "splunkjs/mvc",
    "jquery",
    "splunkjs/mvc/simplesplunkview",
    "datatables",
    "text!../app/splunk_app_cef/js/templates/OutputListView.html",
    "bootstrapDataTables",
    "css!../app/splunk_app_cef/css/OutputListView.css",
    "css!../app/splunk_app_cef/js/lib/DataTables/css/jquery.dataTables.css",
    "css!../app/splunk_app_cef/js/lib/DataTables/css/dataTables.bootstrap.css",
    "css!../app/splunk_app_cef/css/SplunkDataTables.css",
    "console"
], function( _, Backbone, mvc, $, SimpleSplunkView, dataTable, OutputListTemplate ){
    // Define the custom view class
    var OutputListView = SimpleSplunkView.extend({
        className: "OutputListView",

        /**
         * Setup the defaults
         */
        defaults: {
        	default_app: "splunk_app_cef",
        	output_new_view: "cef_output_new",
        	output_edit_view: "cef_output_edit"
        },
        
        initialize: function() {
            this.output_searches = null;
            
            // Apply the defaults
            this.options = _.extend({}, this.defaults, this.options);        
            
            // Get the settings
            this.default_app = this.options.default_app;
            this.output_new_view = this.options.output_new_view;
            this.output_edit_view = this.options.output_edit_view;
            
            // This will contain a list of searches that need to be processed in some way
            this.search_processing_queue = [];
            this.initial_processing_queue_size = 0;
            this.cancel_operation = false;
            
            this.capabilities = null;
            this.output_searches = null;
            this.show_message_on_complete = true;
        },
        
        events: {
        	"click #checkall": "checkOrUncheckAll",
        	"click .change_to_enabled": "enableSearch",
        	"click .change_to_disabled": "disableSearch",
        	"click #enable-selected-searches" : "enableSearches",
        	"click #disable-selected-searches" : "disableSearches",
        	"click #cancel-operation" : "cancelOperation",
        	"click #close-operation" : "closeOperationDialog",
        	"click #new-output" : "newOutput"
        },
        
        /**
         * Determine if the user has the given capability.
         */
        hasCapability: function(capability){
        	
        	var uri = Splunk.util.make_url("/splunkd/__raw/services/authentication/current-context?output_mode=json");
        	
        	if( this.capabilities === null ){
        		
	            // Fire off the request
	            jQuery.ajax({
	            	url:     uri,
	                type:    'GET',
	                async:   false,
	                success: function(result) {
	                	
	                	if(result !== undefined){
	                		this.capabilities = result.entry[0].content.capabilities;
	                	}
	                	
	                }.bind(this)
	            });
        	}
            
            return $.inArray(capability, this.capabilities) >= 0;
        	
        },
        
        newOutput: function(){
        	document.location = this.output_new_view;
        },
        
        /**
         * Cancel the given operation.
         */
        cancelOperation: function(){
        	this.cancel_operation = true;
        },
        
        /**
         * Close the dialog that displays progress on queued up searches.
         */
        closeOperationDialog: function(){
        	$("#search-operation-modal", this.$el).modal('hide');
        },
        
        /**
         * Perform an operation on the queued up searches
         */
        doOperationOnQueuedSearches: function(operation, next_function_to_call, success_message){
        	
        	// Go ahead hide the dialog if the operation was cancelled
        	if( this.cancel_operation ){
        		this.closeOperationDialog();
        	}
        	
        	// Re-render if we are done and stop scheduling the calls to 'next_function_to_call'
        	if( this.search_processing_queue.length === 0 || this.cancel_operation ){
        		
        		// Clear the cache of searches so that they are forced to reload
        		this.clearSearchCache();
        		
        		// Set the dialog to show that we are done
        		this.setOperationModalProgress(100, true);
        		
        		// Show a message indicating success unless we are showing the dialog
        		if( this.show_message_on_complete && success_message && this.cancel_operation === false ){
        			this.showMessage(success_message, true);
        		}
        		
        		// Render the searches list to show the updated content
    			setTimeout(function(){
    				this.render_searches_list(true);
    			}.bind(this), 100);
    			
    			return;
        	}
        	
        	// Get the next search to process
        	var search_name = this.search_processing_queue.pop();
        	
        	// Find the search
        	var output_search = null;
        	
        	for(var c = 0; c < this.output_searches.length; c++ ){
        		if( this.output_searches[c]["name"] === search_name ){
        			output_search = this.output_searches[c];
        		}
        	}
        	
        	// Stop if we couldn't find the search
        	if(!output_search){
        		alert("Search '" + search_name + "' could not be found to perform the operation on");
        		return;
        	}
        	
        	// Perform the operation
        	this.doOperation(operation, search_name, output_search["acl"]["owner"], output_search["acl"]["app"], 
	        	function(result){
        			
        			if( this.show_message_on_complete && result && result.messages.length > 0 ){
        				
        				if( result.messages[0]['severity'] == 'info' ){
        					this.showMessage(result.messages[0].message, true);
        				}
        				else{
        					this.showMessage(result.messages[0].message, false);
        					this.cancel_operation = true;
        				}
        			}
        		
        			this.setOperationModalProgress(100 * (1 - (1.0 * this.search_processing_queue.length / this.initial_processing_queue_size)), false);
	        	}.bind(this),
	        		
	        	function(){
	        		if(this.search_processing_queue.length === 0 || this.cancel_operation){
	        			setTimeout(next_function_to_call.bind(this), 400);
	        		}
	        		else{
	        			setTimeout(next_function_to_call.bind(this), 400);
	        		}
	        	}.bind(this));
        },
        
        /**
         * Disable the next search to be enabled.
         */
        disableNextSearch: function(){
        	this.doOperationOnQueuedSearches('disable', this.disableNextSearch.bind(this), "Searches successfully disabled");
        },
        
        /**
         * Reload the searches on the server.
         */
        reloadSearches: function(){
        	
        	var uri = Splunk.util.make_url("/splunkd/__raw/services/saved/searches/_reload");
        	 
            // Fire off the request
            jQuery.ajax({
                url:     uri,
                type:    'POST',
                async:   false
            });
        },
        
        /**
         * Perform a batch operation and schedule the next one.
         */
        doOperation: function(operation, name, owner, app, success_callback, complete_callback){
        	
            var uri = Splunk.util.make_url('/splunkd/__raw/servicesNS', owner, app, 'saved/searches/', name, operation);
            var uri = Splunk.util.make_url('/custom/splunk_app_cef/cef_utils/change_search');
        	
            if( owner === "admin"){
            	owner = "nobody";
            }
            
            var params = {
            	'operation' : operation,
            	'name' : name,
            	'owner' : owner,
            	'app' : app
            };
            
            // Fire off the request
            jQuery.ajax({
                url:     uri,
                type:    'POST',
                data:    params,
                success: success_callback,
                complete: complete_callback,
                async: false
            });
        },
        
        /**
         * Enable the next search to be enabled.
         */
        enableNextSearch: function(){
        	this.doOperationOnQueuedSearches('enable', this.enableNextSearch.bind(this), "Searches successfully enabled");
        },
        
        /**
         * Set the progress of the modal
         */
        setOperationModalProgress: function(percentage, done){
        	
        	// If we are done, then close out the dialog
        	if(done){
        		$("#close-operation", this.$el).show();
            	$("#cancel-operation", this.$el).hide();
            	$("#progress-bar", this.$el).hide();
            	$("#operation-completion-message", this.$el).show();
            	$("#operation-description", this.$el).hide();
            	return;
        	}
        	
        	// Make sure the progress does not exceed 100% or go below 0%
        	if( percentage > 100 ){
        		percentage = 100;
        	}
        	else if(percentage < 0){
        		percentage = 0;
        	}
        	
        	// Set the progress on the bar
        	$("#progress-bar", this.$el).show();
        	$("#operation-completion-message", this.$el).hide();
        	$("#operation-description", this.$el).show();
        	$(".bar", this.$el).css("width", String(percentage) + "%");
        	
        },
        
        /**
         * Open the modal used for showing the progress of a batch operation.
         */
        openOperationModal: function(title, description, completion_message){
        	$("#search-operation-modal", this.$el).modal({
        		backdrop: 'static',
        		keyboard: false
        	});
        	
        	$("#search-operation-modal h3.text-dialog-title", this.$el).text(title);
        	$("#search-operation-modal #operation-description", this.$el).text(description);
        	$("#close-operation", this.$el).hide();
        	$("#cancel-operation", this.$el).show();
        	$("#operation-completion-message", this.$el).text(completion_message);
        },
        
        /**
         * Enable the selected searches.
         */
        enableSearches: function(){
        	var searches = [];
        	
        	$("input.search_checkbox[type='checkbox']:checked", this.$el).each(function() {
        		searches.push($($(this).parent().parent()).data("search"));
            });
        	
        	// Stop if the user didn't select any searches
        	if(searches.length === 0){
        		$("#no-searches-selected-modal", this.$el).modal();
        		return;
        	}
        	
        	this.search_processing_queue = searches;
        	this.initial_processing_queue_size = searches.length;
        	this.cancel_operation = false;
        	this.show_message_on_complete = false;
        	
        	this.openOperationModal("Enabling output searches", "Enabling " + String(searches.length) + " searches", "Searches successfully enabled");
        	this.enableNextSearch();
        },
        
        /**
         * Disable the selected searches.
         */
        disableSearches: function(){
        	var searches = [];
        	
        	$("input.search_checkbox[type='checkbox']:checked", this.$el).each(function() {
        		searches.push($($(this).parent().parent()).data("search"));
            });
        	
        	// Stop if the user didn't select any searches
        	if(searches.length === 0){
        		$("#no-searches-selected-modal", this.$el).modal();
        		return;
        	}
        	
        	this.search_processing_queue = searches;
        	this.initial_processing_queue_size = searches.length;
        	this.cancel_operation = false;
        	this.show_message_on_complete = false;
        	
        	this.openOperationModal("Disable output searches", "Disabling " + String(searches.length) + " searches", "Searches successfully disabled");
        	this.disableNextSearch();
        },
        
        /**
         * Enable the clicked search.
         */
        enableSearch: function(ev){
        	var search = $(ev.target).data('search');
        	
        	this.search_processing_queue = [search];
        	this.initial_processing_queue_size = 1;
        	this.cancel_operation = false;
        	this.show_message_on_complete = true;
        	
        	//this.openOperationModal("Enable output search", "Enabling " + search, "Search successfully Enabled");
        	this.enableNextSearch();
        },
        
        /**
         * Disable the clicked search.
         */
        disableSearch: function(ev){
        	
        	var search = $(ev.target).data('search');
        	
        	this.search_processing_queue = [search];
        	this.initial_processing_queue_size = 1;
        	this.cancel_operation = false;
        	this.show_message_on_complete = true;
        	
        	//this.openOperationModal("Disable output search", "Disabling " + search, "Search successfully disabled");
        	this.disableNextSearch();
        	
        },
        
        /**
         * Check or uncheck all of the items as necessary.
         */
        checkOrUncheckAll: function(){
        	if( $("#checkall", this.$el).prop("checked") ){
        		$("input[type='checkbox']:enabled", this.$el).attr('checked', 'true').prop('checked', true);
        	}
        	else{
        		$("input[type='checkbox']", this.$el).removeAttr('checked').prop('checked', false);
        	}
        },
        
        /**
         * Show a message indicating that some operation succeeded or failed.
         */
        showMessage: function(message, success){
        	
        	// Get rid of any existing messages first
        	$('#failure_message', this.$el).hide();
        	$('#success_message', this.$el).hide();
        	
        	if( success ){
        		$('#success_text', this.$el).text(message);
                $('#success_message', this.$el).show();
        	}
        	else{
                $('#error_text', this.$el).text(message);
                $('#failure_message', this.$el).show();	
        	}
        },
        
        /**
         * Render the list of searches
         */
        render_searches_list: function(retain_datatables_state){
        	
        	// Reload the searches on the server
        	this.reloadSearches();
        	
        	// Populate retain_datatables_state if it was not provided
        	retain_datatables_state = (typeof retain_datatables_state === "undefined") ? false : retain_datatables_state;
        	
        	// Get the searches
            var searches = this.fetchSearches(
            		function(){
            			this.render_searches_list(retain_datatables_state);
            		}.bind(this) );
            
            if( !searches ){
            	return;
            }
            
            // Determine if the user can edit searches
            var can_edit_searches = this.hasCapability('schedule_search'); // TODO make sure the capability is the correct one
            
            // Get the template
            var search_list_template = $('#search-list-template', this.$el).text();
            
            // Render the table
            $("#content", this.$el).html( _.template(search_list_template,{
            	searches: searches,
            	can_edit_searches: can_edit_searches,
            	output_edit_view : this.output_edit_view
            }) );
            
            // Make the table filterable, sortable and paginated with data-tables
            $('#table', this.$el).dataTable( {
                "iDisplayLength": 25,
                "bLengthChange": false,
                "bStateSave": true,
                "fnStateLoadParams": function (oSettings, oData) {
                	return retain_datatables_state;
                },
                "aaSorting": [[ 1, "asc" ]],
                "aoColumns": [
                              { "bSortable": false }, // Select all checkbox
                              null,                   // Name
                              null,                   // Output Group
                              null,                   // Next schedule time
                              { "bSortable": false }  // Actions
                            ]
              } );
            
        },
        
        /**
         * Render the list or a dialog if the user doesn't have permission.
         */
        render: function(retain_datatables_state){
            
        	// Populate retain_datatables_state if it was not provided
        	retain_datatables_state = (typeof retain_datatables_state === "undefined") ? false : true;
            
            // Render the content
            this.$el.html(OutputListTemplate);
            
            this.render_searches_list(retain_datatables_state);
            
            return this;
        },
        
        /**
         * Clear the cache of output searches so that they will be reloaded when they are fetched.
         */
        clearSearchCache: function(){
        	this.output_searches = null;
        },
        
        /**
         * Get the list of search from the server.
         */
        fetchSearches: function(success_callback){
        	
        	// Stop if we already got the searches
        	if( this.output_searches !== null ){
        		return this.output_searches;
        	}
        	
        	if(typeof success_callback === "undefined"){
        		success_callback = null;
        	}
        	
            // Load all of the saved searches and look for those that are those that we are interested in
            var params = new Object();
            params.output_mode = 'json';
            params.count = '-1';
            params.search = 'action.cefout=1';
            
            var uri = Splunk.util.make_url('/splunkd/__raw/services/saved/searches/');
            uri += '?' + Splunk.util.propToQueryString(params);

            var searches = null;
            
            // Determine if the call should be asynchronous
            var async = true;
            
            if(success_callback === null){
            	async = false;
            }
            
            jQuery.ajax({
                url:     uri,
                type:    'GET',
                success: function(result) {
                     if(result !== undefined && result.isOk === false){
                         console.error("Could not obtain the list of searches: " + result.message);
                     }
                     else if(result !== undefined){
                    	 
                    	 this.output_searches = result.entry;
                    	 
                    	 if(success_callback !== null){
                    		 success_callback();
                    	 }
                    	 
                     }
                }.bind(this),
                async:   async
            });
            
        },
        
        /**
         * Refresh the list of searches and re-render the display.
         */
        refreshResults: function(retain_datatables_state){
            
        	// Populate retain_datatables_state if it was not provided
        	retain_datatables_state = (typeof retain_datatables_state === "undefined") ? false : true;
        	
            this.render_searches_list(retain_datatables_state);
        }
    });
    
    return OutputListView;
});
