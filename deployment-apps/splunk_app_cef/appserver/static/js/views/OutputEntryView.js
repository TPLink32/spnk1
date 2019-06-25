require.config({
    paths: {
        text: "../app/splunk_app_cef/js/lib/text",
        console: '../app/splunk_app_cef/js/util/Console',
        tagmanager: '../app/splunk_app_cef/js/lib/tagmanager/tagmanager'
    },
    shim: {
        'tagmanager': {
            deps: ['jquery']
        }
    }
});

define([
    "underscore",
    "backbone",
    "splunkjs/mvc",
    "jquery",
    "splunkjs/mvc/simplesplunkview",
    "text!../app/splunk_app_cef/js/templates/OutputEntryView.html",
    "tagmanager",
    "css!../app/splunk_app_cef/js/lib/tagmanager/tagmanager.css",
    "css!../app/splunk_app_cef/css/OutputEntryView.css",
    "console"
], function( _, Backbone, mvc, $, SimpleSplunkView, OutputEntryViewTemplate ){
	
    // Define the custom view class
    var OutputEntryView = SimpleSplunkView.extend({
        className: "OutputEntryView",

        /**
         * Setup the defaults
         */
        defaults: {
        	default_app: "splunk_app_cef",
        	selected_output: null
        },
        
        initialize: function() {
            
            // Apply the defaults
            this.options = _.extend({}, this.defaults, this.options);
            
            options = this.options || {};
            
            this.default_app = options.default_app;
            this.selected_output = options.selected_output;
            
            this.outputs = [];
        },
        
        events: {
        	"click .new_output_group" : "openDialogNewEntry",
        	"click #save_new" : "saveEntry",
        	"click .output_entry_edit_href" : "openEditDialogExistingEntry"
        },
        
        /**
         * Open a dialog to edit the existing entry
         */
        openEditDialogExistingEntry: function(ev){
        	
        	// Get the dialog to edit
        	var i = parseInt( $(ev.target).data('output-index'), 10);
        	var output = this.outputs[i];
        	
        	// Open the dialog to edit this entry
        	this.openEditingDialog(output.name, output.hosts, output.app, output.owner, false);
        	
        },
        
        /**
         * Load the outputs from the server.
         */
        loadOutputs: function(){
        	
        	// Prepare the arguments
            var params = new Object();
            params.output_mode = 'json';
            
            var uri = Splunk.util.make_url('/splunkd/__raw/services', 'configs/conf-outputs?output_mode=json');
            
            // Fire off the request
            jQuery.ajax({
                url:     uri,
                type:    'GET',
                success: function(result) {
                	
                    if(result !== undefined && result.isOk === false){
                    	console.error("Outputs could not be obtained: " + result.message);
                    }
                    else{
                    	this.outputs = [];
                    	
                    	for( var c = 0; c < result.entry.length; c++){
                    		
                    		if( result.entry[c].name.indexOf("tcpout:") === 0 && result.entry[c].name !== "tcpout:indexCluster" ){
                    			
                    			var hosts = "";
                    			
                    			if( result.entry[c].content.hasOwnProperty('server') ){
                    				hosts = result.entry[c].content.server;
                    			}
                    			
	                    		this.outputs.push({
	                    			'name': result.entry[c].name,
	                    			'hosts': hosts,
	                    			'app': result.entry[c].acl.app,
	                    			'owner' : result.entry[c].acl.owner
	                    		});
                    		}
                    	}
                    	
                    	this._render();
                    }
                }.bind(this),
                async: true
            });
            
        },
        
        /**
         * Call reload on the given input.
         */
        reloadEndpoint: function(endpoint, description){
        	
           	// Prepare the arguments
            var params = new Object();
            params.output_mode = 'json';
        	
        	// Make the URL
            var uri = Splunk.util.make_url(endpoint);
            
            var success = false;
            
            // Fire off the request
            jQuery.ajax({
                url:     uri,
                type:    'POST',
                async:   false,
                data:    params,
                success: function(result) {
                	
                    if(result !== undefined && result.isOk === false){
                    	this.showWarning(description + " could not be reloaded: " + result.message);
                    }
                    else{
                    	console.info("Successfully reloaded the " + description);
                    	success = true;
                    }
                    
                }.bind(this),
                error: function(result) {
                	
                	if(result.responseJSON.messages.length > 0){
                		this.showWarning(result.responseJSON.messages[0].text);
                	}
                	else{
                		this.showWarning(description + " could not be reloaded");
                	}
                }.bind(this)
            });
            
            return success;
        },
        
        /**
         * Tell Splunk to reload inputs and outputs so that the output works
         */
        reloadInputsAndOutputs: function(){
        	this.reloadEndpoint('/splunkd/__raw/services/data/inputs/monitor/_reload', 'Outputs');
        	this.reloadEndpoint('/splunkd/__raw/services/data/outputs/tcp/server/_reload', 'Inputs');
        },
        
        /**
         * Save the output to the server
         */
        saveOutputToServer: function(name, hosts, app, owner, is_new){
        	
        	// Prepare the arguments
            var params = new Object();
            params.output_mode = 'json';
            
            // Specify the name
            if( is_new ){
            	params.name = "tcpout:" + name;
            }
            
            // Make this the selected output
            this.selected_output = params.name;
            
            // Specify the hosts and sendCookedData
            params['server'] = hosts;
            params['sendCookedData'] = 0;
        	
        	//   ... and the app ...
        	if( app === "" || app === null ){
        		app = this.default_app;
        	}
        	
            //   ... and the owner ...
        	if( is_new ){
        		owner = 'nobody';
        	}
        	else if( owner === 'admin' ){
        		owner = 'nobody';
        	}
        	
        	// Get the entity
        	var entity = name;
        	
        	if( is_new ){
        		entity = "";
        	}
        	
        	// Make the URL
            var uri = Splunk.util.make_url('/splunkd/__raw/servicesNS', owner, app, 'configs/conf-outputs', entity);
            
            var success = false;
            
            // Fire off the request
            jQuery.ajax({
                url:     uri,
                type:    'POST',
                data: params,
                async: false,
                success: function(result) {
                	
                    if(result !== undefined && result.isOk === false){
                    	this.showWarning("Output could not be updated: " + result.message);
                    }
                    else{
                    	success = true;
                    }
                }.bind(this),
                error: function(result) {
                	
                	if(result.responseJSON.messages.length > 0){
                		this.showWarning(result.responseJSON.messages[0].text);
                	}
                	else{
                		this.showWarning("Output could not be updated");
                	}
                }.bind(this),
                complete: function(jqXHR, textStatus){
                	//this.showSaving(false);
                }.bind(this)
            });
            
            return success;
        	
        },
        
        /**
         * Show the warning message.
         */
        hideWarning: function(){
        	$('#warning-message', this.$el).hide();
        },
        
        /**
         * Show the warning message.
         */
        showWarning: function(message){
        	$('#warning-message-text', this.$el).text(message);
        	$('#warning-message', this.$el).show();
        },
        
        /**
         * Save the input to the server
         */
        saveInputToServer: function(name, app, owner, is_new){
        	
        	// Prepare the arguments
            var params = new Object();
            params.output_mode = 'json';
            
            // Specify the name
            if( is_new ){
            	params.name = "batch://$SPLUNK_HOME/var/spool/splunk/...stash_cef_" + name;
            }
            
            // Specify the hosts and sendCookedData
            params['_TCP_ROUTING'] = name;
            params['queue'] = 'stashparsing';
            params['sourcetype']   = 'stash_cef';
            params['move_policy']  = 'sinkhole';
            params['crcSalt']      = '<SOURCE>';
        	
        	//   ... and the app ...
        	if( app === "" || app === null ){
        		app = this.default_app;
        	}
        	
            //   ... and the owner ...
        	if( is_new ){
        		owner = 'nobody';
        	}
        	else if( owner === 'admin' ){
        		owner = 'nobody';
        	}
        	
        	// Get the entity
        	var entity = name;
        	
        	if( is_new ){
        		entity = "";
        	}
        	
        	// Make the URL
            var uri = Splunk.util.make_url('/splunkd/__raw/servicesNS', owner, app, 'configs/conf-inputs', entity);
            
            var success = false;
            
            // Fire off the request
            jQuery.ajax({
                url:     uri,
                type:    'POST',
                data: params,
                async: false,
                success: function(result) {
                	
                    if(result !== undefined && result.isOk === false){
                    	this.showWarning("Output could not be updated: " + result.message);
                    }
                    else{
                    	success = true;
                    }
                }.bind(this),
                error: function(result) {
                	if(result.status === 409 ){
                		success = true; //Input already existed.
                	}
                	else if(result.responseJSON.messages.length > 0){
                		this.showWarning(result.responseJSON.messages[0].text);
                	}
                	else{
                		this.showWarning("Output could not be updated");
                	}
                	
                }.bind(this),
                complete: function(jqXHR, textStatus){
                	//this.showSaving(false);
                }.bind(this)
            });
            
            return success;
        	
        },
        
        /**
         * Save the entry from the dialog
         */
        saveEntry: function(){
        	
        	// Stop of the form doesn't validate
        	if( !this.validateEntry() ){
        		return false;
        	}
        	
        	// Get the name
        	var is_new = !$('#name_input', this.$el).prop('disabled');
        	
        	var name = $('#name_input_hidden', this.$el).val();
        	
        	if( is_new ){
        		name = $('#name_input', this.$el).val();
        	}
        	
        	// Get the list of hosts
        	var hosts = $('input[name=hidden-hosts_input]', this.$el).val();
    		
        	// Determine the owner and app
        	var owner = $('#owner_input').val();
        	var app = $('#app_input').val();
        	
        	// Assign default values
        	if( is_new || !owner ){
        		owner = "nobody";
        	}
        	
        	if( is_new || !app ){
        		app = this.default_app;
        	}
        	
        	// Save the output
        	var success = this.saveOutputToServer(name, hosts, app, owner, is_new);
        	
        	// Skip saving the input to the server if the item already exists
        	if( is_new ){
        		success = this.saveInputToServer(name, app, owner, is_new);
        	}
        	
        	// Reload the inputs and outputs so that the output componentry works
        	this.reloadInputsAndOutputs();
        	
        	// Update the UI based on whether the operation was successful
        	if( success ){
        		$('#editOutputModal', this.$el).modal('hide');
            	this.render();
            	$('#success_message', this.$el).show();
        	}
        	
        },
        
        /**
         * Open a dialog to create a new output.
         */
        openDialogNewEntry: function(){
        	this.openEditingDialog("", "", "", "", true);
        },
        
        /**
         * Get the selected output.
         */
        getSelectedOutput: function(){
        	
        	// Get the dialog to edit
        	var selected_output_el = $(".output_group_assignment:checked", this.$el);
        	
        	if( selected_output_el.length > 0 ){
            	var i = parseInt( $(".output_group_assignment:checked", this.$el).data('output-index'), 10);
            	var output = this.outputs[i];
            	
            	return output;        		
        	}
        	else{
        		return null;
        	}
        	
        }, 
        
        /**
         * Validate the outputs entry.
         */
        validateEntry: function(){
        	
        	// Clear the existing errors
        	$(".name-input-group", this.$el).removeClass("error");
        	$(".host-input-group", this.$el).removeClass("error");
        	
        	var errors = 0;
        	
        	// Validate the name
        	if($('#name_input', this.$el).prop('disabled') === false){
	        	var name = $('#name_input', this.$el).val();
	        	var name_re = /^[a-zA-Z0-9_]+$/i;
	        	
	        	if( !name_re.test(name) ){
	        		$(".name-input-group", this.$el).addClass("error");
	        		errors = errors + 1;
	        	}
        	}
        	
        	// Get the list of hosts
        	if( $('input[name=hidden-hosts_input]', this.$el).val().length === 0){
    			$(".host-input-group", this.$el).addClass("error");
        		errors = errors + 1;
        	}
        	
        	return errors === 0;
        	
        },
        
        /**
         * Determine if the host is valid.
         */
        isValidHost: function( host ) {
        	
        	var host_re = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])([:][0-9]+)?$/;
        	var ip_re = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])([:][0-9]+)?$/;
        	
        	if( host_re.test(host) || ip_re.test(host) ){
        		return true;
        	}
        	
        	return false;
        },
        
        /**
         * Open the dialog for editing the output.
         */
        openEditingDialog: function(name, hosts, app, owner, is_new){
        	
        	// Update the hosts
        	$("#hosts_input", this.$el).tagsManager('empty');
        	var hosts_array = hosts.split(',');
        	
        	for( var i = 0; i < hosts_array.length; i++ ){
        		$("#hosts_input", this.$el).tagsManager('pushTag',hosts_array[i]);
        	}
        	
        	// Update the state depending on whether this is a new entry or not
        	if( is_new ){
        		$("#name_input", this.$el).prop("disabled", false);
        		$(".modal_new_state", this.$el).show();
        		$(".modal_edit_state", this.$el).hide();
        	}
        	else{
        		$("#name_input", this.$el).prop("disabled", true);
        		$("#name_input_hidden", this.$el).val(name);
        		$(".modal_new_state", this.$el).hide();
        		$(".modal_edit_state", this.$el).show();
        	}
        	
        	// Set the vales
        	$("#name_input", this.$el).val(name);
        	$("#app_input", this.$el).val(app);
        	$("#owner_input", this.$el).val(owner);
        	
        	// Open the dialog
        	$('#editOutputModal', this.$el).modal();
        	
        },
        
        /**
         * Render the page 
         */
        _render: function(){
            
            // Render the content
            this.$el.html(_.template(OutputEntryViewTemplate, {
            	'outputs' : this.outputs,
            	'selected_output' : this.selected_output
            }));
            
        	// Make the list of hosts into tags
        	$("#hosts_input", this.$el).tagsManager({
        		delimiters: [44, 9, 13], // tab, enter, comma
        		prefilled: [],
        		validator: function(tag){ 
        			if( this.isValidHost(tag) ){
        				$(".host-input-group", this.$el).removeClass("error");
        				return true;
        			}
        			else{
        				$(".host-input-group", this.$el).addClass("error");
        				return false;
        			}
        			
        			}.bind(this)
        	});
            
            return this;
        },
        
        /**
         * Render the dialog.
         */
        render: function(){
            this.loadOutputs();
        }
        
    });
    
    return OutputEntryView;
});
