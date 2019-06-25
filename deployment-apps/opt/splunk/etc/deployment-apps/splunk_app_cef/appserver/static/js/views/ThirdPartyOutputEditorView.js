require.config({
    paths: {
        text: "../app/splunk_app_cef/js/lib/text",
        console: '../app/splunk_app_cef/js/util/Console',
        field_mapping_view: '../app/splunk_app_cef/js/views/FieldMappingView',
        output_entry_view: '../app/splunk_app_cef/js/views/OutputEntryView'
    },
    shim: {
    	
    }
});

define([
    "underscore",
    "backbone",
    "splunkjs/mvc",
    "jquery",
    "splunkjs/mvc/simplesplunkview",
    "splunkjs/mvc/simpleform/input/dropdown",
    "splunkjs/mvc/simpleform/input/text",
    "field_mapping_view",
    "output_entry_view",
    "text!../app/splunk_app_cef/js/templates/ThirdPartyOutputEditorView.html",
    "css!../app/splunk_app_cef/css/ThirdPartyOutputEditorView.css",
    "console"
], function( _, Backbone, mvc, $, SimpleSplunkView, DropdownInput, TextInput, FieldMappingView, OutputEntryView, ThirdPartyOutputEditorViewTemplate ){
	
    // Define the custom view class
    var ThirdPartyOutputEditorView = SimpleSplunkView.extend({
        className: "ThirdPartyOutputEditorView",

        /**
         * Setup the defaults
         */
        defaults: {
        	list_link: null,
        	list_link_title: "Back to list",
        	redirect_to_list_on_save: true,
        	default_app: "splunk_app_cef"
        },
        
        /**
         * Initialize the class.
         */
        initialize: function() {
            
            // Apply the defaults
            this.options = _.extend({}, this.defaults, this.options);
            
            options = this.options || {};
            
            this.list_link = options.list_link;
            this.list_link_title = options.list_link_title;
            this.redirect_to_list_on_save = options.redirect_to_list_on_save;
            this.default_app = options.default_app;
            
            this.field_mapping_views = [];
            this.static_field_mapping_views = [];
            this.output_entry_view = null;
            this.capabilities = null;
            this.fetched_search = null;
            
            this.last_unique_identifier = 0;
            
            this.listenTo(Backbone, "field_mapping:selected", this.fieldMappingSelected.bind(this));
            
            // This data structure outlines the page states
            this.page_states = {
            		'data_source' : {
            			'state_id': 0,
            			'element_id': '#data_source_step',
            			'initial_state' : true
            		},
            		'field_mapping' : {
            			'state_id': 1,
            			'element_id': '#field_mapping_step'
            		},
            		'field_creation' : {
            			'state_id': 2,
            			'element_id': '#field_creation_step'
            		},
            		'outputs' : {
            			'state_id': 3,
            			'element_id': '#outputs_step'
            		},
            		'search_info' : {
            			'state_id': 4,
            			'element_id': '#finalize_step',
            			'final_state': true
            		}
            };
            
            this.page_state = 0;
            
            // This will cache the list of CEF fields
            this.cef_fields = null;
            
            // Get the fields so they are cached
            this.getAvailableCEFFields(false);
        },
        
        /**
         * Setup the event handlers.
         */
        events: {
        	"click #save": "save",
        	"click #prev": "gotoPrevPage",
        	"click #next": "gotoNextPage",
        	"click .new_static_field" : "addStaticMappingField",
        	"click #show-search" : "showSearch"
        },

        /**
         * Perform actions necessary when a field is selected
         */
        fieldMappingSelected: function(unique_identifier){
        	this.uniqueifyAvailableFields(unique_identifier);
        	this.validateFieldsAreNotMissing();
        },
        
        /**
         * Determine if the user has the given capability
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
        
        /**
         * Show the search preview
         */
        showSearch: function(){
        	$(".search-preview").show();
        	$("#show-search").hide();
        },
        
        /**
         * Get the given URL parameter.
         */
        getURLParameter: function(param){
        	var pageURL = window.location.search.substring(1);
            var sURLVariables = pageURL.split('&');
            for (var i = 0; i < sURLVariables.length; i++)
            {
                var parameterName = sURLVariables[i].split('=');
                if (parameterName[0] == param) 
                {
                    return decodeURIComponent(parameterName[1]);
                }
            }
            
            return null;
        },
        
        /**
         * Get the search string from the spec.
         */
        getSearchStringFromSpec: function(data_model, data_model_object, spec){
        	
        	var search_string;
        	var parses = true;
        	
        	// Prepare the arguments
            var params = new Object();
            params.output_mode = 'json';
            params.datamodel = data_model;
            params.objectName = data_model_object;
            params.fieldmap = JSON.stringify(spec.fieldmap);
        	
            jQuery.ajax({
            	url:     Splunk.util.make_url('/custom/splunk_app_cef/cef_utils/make_search_string'),
                type:    'GET',
                async:   false,
                data:    	params,
                success: function(result) {
                	
                	if(result !== undefined){
                		search_string = result.search;
                		parses = result.parses;
                		
                		this.renderSearchDescription(spec, search_string, parses);
                	}
                	
                }.bind(this)
            });
        	
            return search_string;
        },
        
        /**
         * Strip off quotes or double-quotes around a string.
         */
        stripQuotes: function(str){
        	
        	var strip_quotes_re = /["']?([^"']*)["']?/i;
        	
        	var match = strip_quotes_re.exec(str);
        	
        	if( match === null ){
        		return str;
        	}
        	else{
	        	return match[1];
        	}
        },
        
        /**
         * Parse out the data-model and object from the search.
         */
        getDataModelInfoFromSearch: function(search_string){
        	
        	var parse_search_re = /\s*[|]\s*datamodel\s+([^ ]+)\s+([^ ]+)/i;
        	
        	var match = parse_search_re.exec(search_string);
        	
        	if( match === null ){
        		return [null, null];
        	}
        	else{
        		
	        	var data_model = this.stripQuotes(match[1]);
	        	var data_model_object = this.stripQuotes(match[2]);
	        	
	        	return [data_model, data_model_object];
        	}
        },
        
        /**
         * Remove the field represented by the given CEF key from the list of fields.
         */
        removeCEFField: function(fields, cef_key){
        	
        	var new_fields = [];
        	
        	for( var c = 0; c < fields.length; c++ ){
        		if( fields[c]['value'] !== cef_key ){
        			new_fields.push(fields[c]);
        		}
        	}
        	
        	return new_fields;
        },
        
        /**
         * Determine if the given CEF field is included in the list of CEF fields and return the index.
         */
        getCEFField: function(fields, cef_key){
        	
        	for( var c = 0; c < fields.length; c++ ){
        		if( (fields[c].hasOwnProperty('value') && fields[c]['value'] === cef_key) || (fields[c].hasOwnProperty('cef_key') && fields[c]['cef_key'] === cef_key) ){
        			return fields[c];
        		}
        	}
        	
        	return null;
        },
        
        /**
         * Determine if the given CEF field is included in the list of CEF fields.
         */
        includesCEFField: function(fields, cef_key){
        	
        	if( this.getCEFField(fields, cef_key) !== null){
        		return true;
        	}
        	else{
        		return false;
        	}
        },
        
        /**
         * Filter the available fields.
         */
        filterAvailableFields: function(mapping_views_source, mapping_views_to_update, unique_identifier){
        	
        	// Get the list of available fields
        	var fields = this.getAvailableCEFFields().slice(0);
        	
        	var selected_field = null;
        	
        	// Determine all of the selected fields and prune them
        	for( var i = 0; i < mapping_views_source.length; i++){
        		
        		selected_field = mapping_views_source[i].getMappedField();
        		
        		// Remove this field so that it cannot be selected again
        		if( selected_field ){
        			fields = this.removeCEFField(fields, selected_field);
        		}
        	}
        	
        	// Update the list of fields for each widget
        	var fields_for_widget = fields;
        	
        	for( i = 0; i < mapping_views_to_update.length; i++){
        		
        		selected_field = mapping_views_to_update[i].getMappedField();
        		
        		// Allow the existing value if the widget already has one
        		if( selected_field && !this.includesCEFField(fields, selected_field) ){
        			
        			fields_for_widget = fields.slice(0);
        			
        			// Add the field
        			cef_field = this.getCEFField(this.cef_fields, selected_field);
        			
        			if( cef_field ){
        				fields_for_widget.push(this.convertCEFFieldToChoice(cef_field));
        			}
        			else{
        				console.warn("Unable to find a CEF field for the selected field " + String(selected_field));
        			}
        		}
        		
        		// Update it (unless it is the item that fired the event)
        		if( unique_identifier != mapping_views_to_update[i].unique_identifier ){
        			mapping_views_to_update[i].setAvailableFields(fields_for_widget);
        		}
        		
        	}     	
        },
        
        /**
         * Reduce the set of selectable fields 
         */
        uniqueifyAvailableFields: function(unique_identifier){
        	
        	// Determine if this is for a static field or a dynamic one
        	for( var i = 0; i < this.field_mapping_views.length; i++ ){
        		
        		if( this.field_mapping_views[i].unique_identifier === unique_identifier ){
        			return this.filterAvailableFields(this.field_mapping_views, this.field_mapping_views, unique_identifier);
        		}
        	}
        	
        	
        	return this.filterAvailableFields(this.field_mapping_views.concat(this.static_field_mapping_views), this.static_field_mapping_views, unique_identifier, true);
        },
        
        /**
         * Remove entries from the array that are empty
         */
        pruneEmptyEntries: function(array){
        	return _.without(array, null);
        },
        
        /**
         * This function clears the CEF selection or removes static field entries entirely that are no longer required because they are defined on the dynamic fields page.
         */
        removeOverlapsFromStaticFields: function(){
        	
        	for(var i = 0; i < this.static_field_mapping_views.length; i++){
        		
        		for(var j = 0; j < this.field_mapping_views.length; j++){
        			
        			// Found a match, this static field entry is already mapped
            		if( this.static_field_mapping_views[i] !== null && this.field_mapping_views[j].getMappedField() === this.static_field_mapping_views[i].getMappedField() ){
            			
            			// If the value is defined, then clear it but leave it around in case the user wants the value
            			if( this.static_field_mapping_views[i].getField() ){
            				this.static_field_mapping_views[i].setMappedField(undefined);
            			}
            			
            			// If the value is empty, then just remove it
            			else{
            				 this.static_field_mapping_views[i].remove();
            				 this.static_field_mapping_views[i] = null;
            			}
            		}
            	}
        	}
        	
        	// Remove entries we cleared
        	this.static_field_mapping_views = this.pruneEmptyEntries(this.static_field_mapping_views);
        },
        
        /**
         * Save the search.
         */
        saveSearchToServer: function(name, app, owner, spec, output_name, data_model, data_model_object, is_new){
        	
        	// Prepare the arguments
            var params = new Object();
            params.output_mode = 'json';
            
            // Specify the name
            if( is_new ){
            	params.name = "CEF - " + name;
            }
            
            // Specify the content
            params['alert.suppress'] = 0;
            params['action.cefout'] = 1;
            params['action.cefout._ROUTING'] = this.stripTcpout(output_name);
            params['cron_schedule'] = "* * * * *";
            params['disabled'] = 0;
            params['is_scheduled'] = 1;
            params['dispatch.earliest_time'] = 'rt';
            params['dispatch.latest_time'] = 'rt';
            params['actions'] = 'cefout';
            params['action.cefout'] = 1;
            params['action.cefout.fieldmap'] = JSON.stringify(spec);
            params['description'] = $('#search-description', this.$el).val();
            params['search'] = this.getSearchStringFromSpec(data_model, data_model_object, spec);
        	
        	// Assign the app ...
        	if( app === "" || app === null || app === undefined ){
        		app = this.default_app;
        	}
        	
            //   ... and the owner ...
        	if( is_new || owner === "admin" ){
        		owner = 'nobody';
        	}
        	
        	// Get the entity
        	var entity = name;
        	
        	if( is_new ){
        		entity = "";
        	}
        	
        	// Make the URL
            var uri = Splunk.util.make_url('/splunkd/__raw/servicesNS', owner, app, 'saved/searches', entity);
            
            var success = false;
            
            // Fire off the request
            jQuery.ajax({
                url:     uri,
                type:    'POST',
                data: params,
                async: false,
                success: function(result) {
                	
                    if(result !== undefined && result.isOk === false){
                    	this.showWarning("Search could not be saved: " + result.message);
                    }
                    else{
                    	success = true;
                    }
                }.bind(this),
                error: function(result) {
                	
                	if(result.responseJSON.messages.length > 0){
                		this.showWarning("Search could not be saved: " + result.responseJSON.messages[0].text);
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
         * Redirect the user to the list view.
         */
        redirectToList: function(){
        	if( this.list_link ){
        		document.location = this.list_link;
        	}
        },
        
        /**
         * Clone the provided object.
         */
        clone: function(obj) {
            if (null === obj || "object" != typeof obj){
            	return obj;
            }
            var copy = obj.constructor();
            for (var attr in obj) {
                if (obj.hasOwnProperty(attr)){
                	copy[attr] = this.clone(obj[attr]);
                }
            }
            return copy;
        },
        
        /**
         * Remove tcpout from the output group name; produces "cefroute" from "tcpout:cefroute".
         */
        stripTcpout: function(name){
        	strip_tcpout_re = /tcpout:(.*)/i;
        	
        	var match = strip_tcpout_re.exec(name);
        	
        	if( match === null ){
        		return name;
        	}
        	else{
	        	return match[1];
        	}
        	
        },
        
        /**
         * Save the output
         */
        save: function(){
        	
        	// Make sure that the search name was provided
        	if( this.fetched_search === null && !this.validateSearchInformation() ){
        		return false;
        	}
        	
        	// Get the information to make the search
        	var data_model_object = mvc.Components.get("objects_dropdown").val();
        	var data_model = mvc.Components.get("models_dropdown").val();
        	var output = this.output_entry_view.getSelectedOutput();
        	var name = "New Search";
        	var app = null;
        	var owner = null;
        	var field_map = {};
        	
        	var search_name = null;
        	var is_new = null;
        	
        	// If we are editing an existing search, then use the existing name
        	if( this.fetched_search !== null ){
        		search_name = this.fetched_search.name;
        		owner = this.fetched_search['acl']['owner'];
        		app = this.fetched_search['acl']['app'];
        		is_new = false;
        	}
        	else{
        		search_name = mvc.Components.get("search_name_input").val();
        		is_new = true;
        	}
        	
        	// Stop if no output was selected
        	this.hideWarning();
        	
        	if( !output ){
        		this.showWarning("You need to select an output");
        		return false;
        	}
        	
        	var spec = this.makeSpec();
        	
        	// Save the search
        	if( this.saveSearchToServer(search_name, app, owner, spec, output["name"], data_model, data_model_object, is_new) ){
        		this.redirectToList();
        	}
        	
        	
        },
        
        /**
         * Get the mapped fields that have been defined.
         */
        getFieldMapping: function(){
        	
        	var field_mapping = {};
        	
        	// Get the mapped fields from the dynamic field mappings
        	for( var c = 0; c < this.field_mapping_views; c++ ){
        		
        		// Don't get the value is the field is no longer mapped
        		if( this.field_mapping_views.getMappedField() ){
        			field_mapping[this.field_mapping_views.field] = this.field_mapping_views.getMappedField();
        		}
        	}
        	
        	// Get the mapped fields from the static field mappings
        	for( c = 0; c < this.static_field_mapping_views; c++ ){
        		
        		// Don't get the value is the field is no longer mapped
        		if( this.static_field_mapping_views.getMappedField() ){
        			field_mapping[this.static_field_mapping_views.getField()] = this.field_mapping_views.getMappedField();
        		}
        	}
        	
        	return field_mapping;
        },
        
        /**
         * Get the list of fields 
         */
        getAttributesList: function(){
        	
        	// Don't try to get the fields if the model or object is not selected
        	if( !mvc.Components.getInstance("objects_dropdown").val() || !mvc.Components.getInstance("models_dropdown").val() ){
        		return [];
        	}
        	
        	var attributes = [];
        	
        	var params = { 
        			'obj' : mvc.Components.getInstance("objects_dropdown").val(),
        			'data_model' : mvc.Components.getInstance("models_dropdown").val()
        		};
        	
        	// Get 'em
            $.ajax( 
                    {
                        url:  Splunk.util.make_url('/custom/splunk_app_cef/cef_utils/get_available_fields'),
                        type: 'GET',
                        async: false,
                        data: params,
                        success: function(data, textStatus, jqXHR){
                        	attributes = data;
                        }.bind(this),
                        
                        error: function(jqXHR,textStatus,errorThrown) {
                        	alert("Unable to get the list of data-models");
                        } 
                    }
            );
            
            return attributes;
            
        },
        
        /**
         * Render the page that describes this search.
         */
        renderSearchDescription: function(spec, search_string, search_parses){
        	
        	// Make the meta-data to describe the search
        	var search_meta = this.clone(spec);
        	search_meta.search_string = search_string;
        	search_meta.parses = search_parses;
        	
            // Get the template
            var search_description_template = $("#search-description-template", this.$el).text();
            
            // Render the table
            $("#search-preview", this.$el).html(_.template(search_description_template, search_meta));
        	
        },
        /**
         * Add static mapping.
         */
        addStaticMappingField: function(){
        	
       		// Make the new place to put the field mapping view
        	var append_to = $('#static_field_mappings tbody', this.$el);
        	var id = 'static-field-mapping-' + String(this.last_unique_identifier);
        	append_to.append('<tr id="' + id + '"></tr>');
        	var new_el = $('#' + id, this.$el);
    		
        	// Make an instance of the mapping view
        	var field_mapping_view = new FieldMappingView({
    			el: new_el,
    			field_is_static: false,
    			show_dropdown_first: true,
    			available_fields: this.getAvailableCEFFields(),
    			unique_identifier: this.last_unique_identifier
    		})
        	
        	this.last_unique_identifier = this.last_unique_identifier + 1;
        	
    		this.static_field_mapping_views.push( field_mapping_view );
    		
        	// Render the row
        	field_mapping_view.render();
        	
        	// Show the table
        	$("#static_field_mappings", this.$el).show();
        	
        	this.filterAvailableFields(this.field_mapping_views.concat(this.static_field_mapping_views), this.static_field_mapping_views, null);
        	
        	$('.no_static_fields', this.$el).hide();
        	
        	return field_mapping_view;
        },
        
        /**
         * Render the list of static field mappings.
         */
        render_static_mappings: function(remove_existing){
        	
        	if( typeof remove_existing === "undefined" ){
        		remove_existing = false;
        	}
        	
        	// Remove the existing attributes
        	if( remove_existing ){
        		
	        	for( var i = 0; i < this.static_field_mapping_views.length; i++){
	        		this.static_field_mapping_views[i].remove();
	        	}
	        	
	        	this.static_field_mapping_views = [];
        	}
        	
        	// Remove an static entries that are now overlapping with dynamic ones
        	this.removeOverlapsFromStaticFields();
        	
    		// Add the static field mappings
        	if( this.fetched_search !== null && this.fetched_search.content.hasOwnProperty('action.cefout.fieldmap') ){
        		var spec = JSON && JSON.parse(this.fetched_search.content['action.cefout.fieldmap']) || $.parseJSON(this.fetched_search.content['action.cefout.fieldmap']);
        		
	    		for (var cef_key in spec.fieldmap) {
	    			
	    			if (spec.fieldmap.hasOwnProperty(cef_key) && spec.fieldmap[cef_key].cef_value_type !== "fieldmap" ) {
	    				
	    				var does_item_exist_already = false;
	    				
	    				// Determine if the item already exists
	    				for(var i = 0; i < this.static_field_mapping_views.length; i++){
	    					
	    					if( this.static_field_mapping_views[i].getMappedField() === cef_key ){
	    						does_item_exist_already = true;
	    						break;
	    					}
	    						
	    				}
	    				
	    				if( !does_item_exist_already ){
							var new_static_map = this.addStaticMappingField();
							new_static_map.setField(spec.fieldmap[cef_key].cef_value);
							new_static_map.setMappedField(cef_key);
	    				}
					}
	    		}
        	}
        	
        	var suggested_fields = this.getSuggestedStaticFields();
        	var added_fields_views = [];
        	
        	// Make a view for each suggested field
        	for( var i = 0; i < suggested_fields.length; i++ ){
        		added_fields_views.push(this.addStaticMappingField());
        	}
        	
        	// Set the values for the added fields. We do this after adding them so that they can update themselves to remove already selected options.
        	for( var i = 0; i < suggested_fields.length; i++ ){
        		added_fields_views[i].setMappedField(suggested_fields[i]);
        	}
        	
        	// Show/hide the dialog indicating that no static fields exist
        	if( this.static_field_mapping_views.length == 0 ){
        		$('.no_static_fields', this.$el).show();
        		$("#static_field_mappings", this.$el).hide();
        	}
        	else{
        		$('.no_static_fields', this.$el).hide();
        		$("#static_field_mappings", this.$el).show();
        	}
        	
        },
        
        /**
         * Ensure that all of the fields required are present
         */
        validateFieldsAreNotMissing: function(){
        	var missing_fields = this.getMissingFields();
        	
        	if( missing_fields.length == 0){
        		$('.fields-missing-warning-message').hide();
        		return true;
        	}
        	else{
        		
        		var missing_fields_html = "<div>Some fields are required but are missing:</div><ul>";
        		
        		for(var c = 0; c < missing_fields.length; c++){
        			missing_fields_html = missing_fields_html + "<li>" + missing_fields[c] + "</li>";
        		}
        		
        		missing_fields_html = missing_fields_html + "</ul>"
        		
        		$('.missing-fields-message-text').html(missing_fields_html);
        		
        		$('.fields-missing-warning-message').show();
        		return false;
        	}
        },
        
        /**
         * Make sure an output was selected.
         */
        validateOutputSelection: function(){
        	
        	this.hideWarning();
        	
        	if( this.output_entry_view.getSelectedOutput() ){
        		return true;
        	}
        	else{
        		this.showWarning("Please select an output group");
        		return false;
        	}
        },
        
        /**
         * Get the list of fields that are required but missing
         */
        getMissingFields: function(){
        	
        	// Get the required fields
        	var required_fields = [];
        	
        	for(var c = 0; c < this.cef_fields.length; c++){
        		
        		if(this.cef_fields[c].required_field){
        			required_fields.push(this.cef_fields[c].cef_key);
        		}
        	}
        	
        	// Determine which fields are missing
        	var mappings = this.static_field_mapping_views.concat(this.field_mapping_views);
        	
        	for(c = 0; c < mappings.length; c++){
        		
        		if( mappings[c].getField() ){
        			required_fields = _.without(required_fields, mappings[c].getMappedField());
        		}
        	}
        	
        	// If vendor_product are assigned, then remove vendor and product because we will handle it for them on the backend
        	for(c = 0; c < this.field_mapping_views.length; c++){
        		if( this.getUnqualifiedAttributeName(this.field_mapping_views[c].getField()) === "vendor_product" && (this.field_mapping_views[c].getMappedField() == "dvc_vendor" || this.field_mapping_views[c].getMappedField() == "dvc_product") ){
        			required_fields = _.without(required_fields, "dvc_vendor");
        			required_fields = _.without(required_fields, "dvc_product");
        			break;
        		}
        	}
        	
        	return required_fields;
        },
        
        /**
         * Get the static fields that the user needs to define
         */
        getSuggestedStaticFields: function(){
        	
        	var necessaryCEFFields = [];
        	
        	// Get the required fields
        	for( var i = 0; i < this.field_mapping_views.length; i++ ){
        		
        		var mapped_field = this.field_mapping_views[i].getMappedField();
        		
        		if( mapped_field ){
        			var cef_field = this.getCEFField(this.cef_fields, mapped_field);
        			
        			if( cef_field.required_related_field ){
        				necessaryCEFFields.push(cef_field.required_related_field);
        			}
        		}
        	}
        	
           	// Add in the required-but-missing fields
        	var missing_fields = this.getMissingFields();
        	
        	necessaryCEFFields = necessaryCEFFields.concat(missing_fields);
        	
        	// Prune ones that exist already
        	for( i = 0; i < this.static_field_mapping_views.length; i++ ){
        		
        		var mapped_field = this.static_field_mapping_views[i].getMappedField();
        		
        		if( mapped_field && _.contains(necessaryCEFFields, mapped_field)){
        			necessaryCEFFields = _.without(necessaryCEFFields, mapped_field)
        		}
        	}
        	
        	return necessaryCEFFields;
        	
        },
        
        /**
         * Render the list of field mappings.
         */
        render_mappings: function(){
        	
        	// Remove the existing attributes
        	for( var i = 0; i < this.field_mapping_views.length; i++){
        		this.field_mapping_views[i].remove();
        	}
        	
        	this.field_mapping_views = [];
        	
        	// Create new field mappings for the attributes
        	var attributes = this.getAttributesList();
        	
        	for( i = 0; i < attributes.length; i++){
        		
        		var attribute = attributes[i];
        		
        		// Make the new place to put the field mapping view
            	var append_to = $('#field_mappings tbody', this.$el);
            	var id = 'field-mapping-' + String(this.last_unique_identifier);
            	append_to.append('<tr id="' + id + '"></tr>');
            	var new_el = $('#' + id, this.$el);
        		
            	// Make an instance of the mapping view
            	var field_mapping_view = new FieldMappingView({
        			el: new_el,
        			field: attribute,
        			show_dropdown_first: true,
        			available_fields: this.getAvailableCEFFields(),
        			unique_identifier: this.last_unique_identifier
        		})
            	
            	this.last_unique_identifier = this.last_unique_identifier + 1;
            	
        		this.field_mapping_views.push( field_mapping_view );
            	
            	// Render the row
            	field_mapping_view.render();
            	
            	// Show the table
            	$("#field_mappings", this.$el).show();
            	$("#field_mappings_select_data_model_first", this.$el).hide();
        		
        	}
        	
        	// Try to load existing map from the fetched search
        	if( this.fetched_search !== null && this.fetched_search.content.hasOwnProperty('action.cefout.fieldmap') ){
        		var spec = JSON && JSON.parse(this.fetched_search.content['action.cefout.fieldmap']) || $.parseJSON(this.fetched_search.content['action.cefout.fieldmap']);
        		
        		// Update the UI to include the values in the fieldmap (the dynamic ones)
        		for( i = 0; i < this.field_mapping_views.length; i++ ){
        			
        			// See if the given field mapping view has a value in the field map
        			var existing_mapping = null;
        			
        			for (var cef_key in spec.fieldmap) {
        				
        				// See if we can find a mapping (for the dynamic fields)
        				if (spec.fieldmap.hasOwnProperty(cef_key) && spec.fieldmap[cef_key].splunk_key === this.field_mapping_views[i].field && spec.fieldmap[cef_key].cef_value_type === "fieldmap" ) {
        					existing_mapping = cef_key;
        					break;
        				}
        			}
        			
        			// If we found a mapping, then update the value accordingly
        			if( existing_mapping !== null ){
        				this.field_mapping_views[i].setMappedField(existing_mapping);
        			}
        		}
        	}
        	
        	// Otherwise, set the mapping according to the defaults
        	else{
        		this.setDefaultFieldValues();
        	}
        	
        },
        
        /**
         * Get the unqualified attribute name (without the lineage, "All_Traffic.vendor_product" would be "vendor_product").
         */
        getUnqualifiedAttributeName: function(name){
        	
			// Get only the last part of the data-model attribute (un-qualified)
			var attr_name_re = /.*[.]([a-zA-Z0-9_ ]+)/i;
			
			var match = attr_name_re.exec(name);
			
			var attr_name = name;
			
			// Get the attribute name if we got a match
			if(match){
				attr_name = match[1];
			}
			
			return attr_name;
        },
        
        /**
         * Set the field mappings according to known corresponding fields.
         */
        setDefaultFieldValues: function(){
        	
        	// Iterate all of the field mapping views and set the value to the default if one is known
        	for(i = 0; i < this.field_mapping_views.length; i++){
        		
        		// See if the given field has a default value
        		for(var c = 0; c < this.cef_fields.length; c++){
        			
        			// Get only the last part of the data-model attribute (un-qualified)
        			var attr_name = this.getUnqualifiedAttributeName(this.field_mapping_views[i].field);
        			
        			// If the field has a known mapping, then set it
        			if(attr_name === this.cef_fields[c]["splunk_key"]){
        				this.field_mapping_views[i].setMappedField(this.cef_fields[c]["cef_key"]);
        			}
        		}
        	}
        },
        
        /**
         * Validate the selection of field mappings.
         */
        validateFieldMappingSelection: function(){
        	
        	this.hideWarning();
        	
        	// Iterate all of the field mapping views and make sure at least one is selected
        	for(i = 0; i < this.field_mapping_views.length; i++){
        		if( this.field_mapping_views[i].getMappedField() ){
        			return true;
        		}
        	}
        	
        	this.showWarning("You need to select at least one field to map");
        	return false;
        		
        },
        
        /**
         * Validate the final page of search information.
         */
        validateSearchInformation: function(){
        	
        	this.hideWarning();
        	
        	// Verify that the search name is provided
        	if( mvc.Components.get("search_name_input").val() === undefined || mvc.Components.get("search_name_input").val().length === 0 ){
        		this.showWarning("Define the search name");
        		return false;
        	}
        	
        	return true;
        		
        },
        
        /**
         * Get the given correlation search.
         */
        fetchSearch: function(savedsearch_name){
        	
        	var search = null;
        	
        	// Prepare the arguments
            var params = new Object();
            params.output_mode = 'json';
            
            var uri = Splunk.util.make_url("/splunkd/__raw/services/saved/searches/", encodeURIComponent(savedsearch_name));
            uri += '?' + Splunk.util.propToQueryString(params);
            
            // Fire off the request
            jQuery.ajax({
                url:     uri,
                type:    'GET',
                success: function(result) {
                	
                    if(result !== undefined && result.isOk === false){
                    	console.error("Search could not be obtained: " + result.message);
                    }
                    else{
                    	search = result.entry[0];
                    }
                }.bind(this),
                async: false
            });
            
            // Store the last fetched search
            this.fetched_search = search;
            
            // Return the search
            return search;
        },
        
        /**
         * Render the dialog.
         */
        render: function(){
        	
            // Render the content
            this.$el.html(ThirdPartyOutputEditorViewTemplate);
            
            var models_dropdown = new DropdownInput({
                "id": "models_dropdown",
                "choices": [],
                "selectFirstChoice": false,
                "valueField": "model_id",
                "labelField": "model",
                "value": "$form.dm$",
                "showClearButton": false,
                "el": $('#models-dropdown')
            }, {tokens: true}).render();
            
            models_dropdown.on("change", function(newValue) {
                //FormUtils.handleValueChange(models_dropdown);
                this.updateObjectsList();
            }.bind(this));
            
            // Make the input for the list of objects
            var objects_dropdown = new DropdownInput({
                "id": "objects_dropdown",
                "choices": [],
                "selectFirstChoice": false,
                "valueField": "object",
                "labelField": "object",
                "value": "$form.object$",
                "managerid": "objects_search",
                "showClearButton": false,
                "el": $('#objects-dropdown')
            }, {tokens: true}).render();

            objects_dropdown.on("change", function(newValue) {
            	setTimeout(this.render_mappings.bind(this), 100);
                //FormUtils.handleValueChange(objects_dropdown);
            }.bind(this));
            
            this.getDataModelsList(false);
            
        	// The name of the search
        	var search_name_input = new TextInput({
                "id": "search_name_input",
                "searchWhenChanged": false,
                "el": $('#search-name-input', this.$el)
            }, {tokens: true}).render();
            
        	// Get the search (if we are loading one)
        	var search_name = this.getURLParameter("search");
        	
        	if( search_name ){
        		var search = this.fetchSearch(search_name);
        		
        		var data_model_info = this.getDataModelInfoFromSearch(search.content['search']);
        		
        		// Load the values into the UI
        		if( data_model_info[1] !== null ){
        			objects_dropdown.val(data_model_info[1]);
        		}
        		
        		if( data_model_info[0] !== null ){
        			models_dropdown.val(data_model_info[0]);
        		}
        		
        		// Hide the search name input since the name is not editable
        		$('#search-name-input', this.$el).hide();
        		
        		// Fetch the search description (if provided)
        		if( search.content.hasOwnProperty('description') ){
        			$('#search-description', this.$el).val(search.content.description);
        		}
        	}
        	
            // Determine if we have a selected output from the existing search
        	var selected_output = null;
        	
            if( this.fetched_search !== null && this.fetched_search.content.hasOwnProperty('action.cefout._ROUTING') ){
            	selected_output = this.fetched_search.content['action.cefout._ROUTING'];
            }
            
            // Render the outputs list
            this.output_entry_view = new OutputEntryView({
            	el : $("#outputs_list", this.$el),
            	selected_output: "tcpout:" + selected_output
            });
            
            this.output_entry_view.render();
        	
            return this;
        },
        
        /**
         * Save the list of data-models.
         */
        setDataModelsList: function(data_models){
        	this.data_models = data_models;
        	
        	// Populate the list of models
        	var choices = [];
        	
        	for(var i=0; i < data_models.length; i++){
        		choices.push( { 'label': data_models[i].name, 'value': data_models[i].name } );
        	}
        	
        	mvc.Components.getInstance("models_dropdown").settings.set("choices", choices);
        	
        	// Update the list of objects for the given model
        	this.updateObjectsList();
        },
        
        /**
         * Slide in a panel and slide out the old one.
         */
        slideInPanel: function (cur_el, next_el, forward){
        	
        	// This is the speed of the animation. This should be a sane default.
        	var speed = 200;
        	
        	//Define the CSS for the difference between the height and position
        	var cur = {
        		height: cur_el.height()+'px'
        	};
        	
        	// Clear any left-over height value so that the real height can be determined
        	next_el.css('height', 'initial');
        	
        	var next = {
        		height: next_el.height() +'px',
        		left: '0px',
        		position: 'relative'
        	};
        	
        	// Go ahead and hide the current item and show the next one that we will be pulling into the screen
        	cur_el.hide();
        	next_el.show();
        	
        	// Setup the position of the next div before we start the animation
        	if(forward){
	        	next_el.css({
	        		left: cur_el.width()+'px',
	        		position: 'relative'
	        	});
        	}
        	else{
	        	next_el.css({
	        		left: (-1 * cur_el.width()) +'px',
	        		position: 'relative'
	        	});
        	}
        	
        	// Animate it
        	next_el.css(cur).animate(next, speed, function(){ next_el.css('height', 'initial'); });
        	
        },
        
        /**
         * Get the list of valid CEF fields.
         */
        getAvailableCEFFields: function(async){
        	
        	// If the async parameter wasn't provided, then get it
        	if( typeof async == 'undefined' ){
        		async = true;
        	}
        	
        	// Get the fields if we don't have them already.
        	if( this.cef_fields === null ){
        		
	        	// Get 'em
	            $.ajax( 
	                    {
	                        url:  Splunk.util.make_url('/custom/splunk_app_cef/cef_utils/get_cef_fields'),
	                        type: 'GET',
	                        async: async,
	                        success: function(data, textStatus, jqXHR){
	                        	this.cef_fields = data;
	                        }.bind(this),
	                        
	                        error: function(jqXHR,textStatus,errorThrown) {
	                        	alert("Unable to get the list of available CEF fields");
	                        } 
	                    }
	            );
        	}
        	
        	if( this.cef_fields !== null){
	        	// Convert the fields to a flat table of choices
	        	var choices = [];
	        	
	        	for(var c = 0; c < this.cef_fields.length; c++){
	        		choices.push( this.convertCEFFieldToChoice(this.cef_fields[c]) );
	        	}
	        	
	        	return choices;
        	}
        },
        
        /**
         * Convert the CEF field to a choice.
         */
        convertCEFFieldToChoice: function(cef_field){
        	return { 
    			'label' : cef_field["cef_key"] + " (" + cef_field["friendly_name"] + ")",
    			'value' : cef_field["cef_key"]
    		}
        },
        
        /**
         * Get the list of available data-models.
         */
        getDataModelsList: function(async){

        	// If the async parameter wasn't provided, then get it
        	if( typeof async == 'undefined' ){
        		async = true;
        	}
        	
        	// Get 'em
            $.ajax( 
                    {
                        url:  Splunk.util.make_url('/custom/splunk_app_cef/cef_utils/get_data_models'),
                        type: 'GET',
                        async: async,
                        success: function(data, textStatus, jqXHR){
                        	this.setDataModelsList(data);
                        }.bind(this),
                        
                        error: function(jqXHR,textStatus,errorThrown) {
                        	alert("Unable to get the list of data-models");
                        } 
                    }
            );
            
        },
        
        /**
         * Update the list of objects for the selected data-model.
         */
        updateObjectsList: function(){
        	
        	// If we don't have the data-models yet, then just wait
        	if( this.data_models === null ){
        		return;
        	}
        	
        	// Determine which model is selected
        	var model_selected = mvc.Components.get("models_dropdown").val();
        	var data_model = null;
        	
        	if(!model_selected){
        		mvc.Components.getInstance("objects_dropdown").settings.set("choices", []);
        		return;
        	}
        	
        	// Find the model
        	for(var i = 0; i < this.data_models.length; i++){
        		if( this.data_models[i].name == model_selected ){
        			data_model = this.data_models[i];
        			break;
        		}
        	}
        	
        	// Set the list of objects
        	var choices = [];
        	
        	for(i=0; i < data_model.objects.length; i++){
        		choices.push( { 'label': data_model.objects[i], 'value': data_model.objects[i] } );
        	}
        	
        	mvc.Components.getInstance("objects_dropdown").settings.set("choices", choices);
        },
        
        /**
         * Go to the previous page.
         */
        gotoPrevPage: function(){
        	
        	var current_page_state = this.getPageState();
        	
        	// If the page indicates the next page, then load it
        	if( current_page_state === null ){
        		return;
        	}
        	else if(current_page_state.hasOwnProperty('previous_state_id')){
        		this.changePage(current_page_state.previous_state_id, false);
        	}
        	else if( current_page_state.hasOwnProperty('initial_state') === true || current_page_state.initial_state === true ){
            	return; // This is the first state, no where to go
        	}
        	else{
        		this.changePage(current_page_state.state_id - 1, false);
        	}
        	
        },
        
        /**
         * Go the next page.
         */
        gotoNextPage: function(){

        	var current_page_state = this.getPageState();
        	
        	// If the page indicates the next page, then load it
        	if( current_page_state === null ){
        		return;
        	}
        	else if(current_page_state.hasOwnProperty('next_state_id')){
        		this.changePage(current_page_state.next_state_id, true);
        	}
        	else if(current_page_state.hasOwnProperty('final_state') && current_page_state.final_state){
        		return; // This is a final state stop
        	}
        	else{
        		this.changePage(current_page_state.state_id + 1, true);
        	}
        	
        },
        
        /**
         * Get the page state object for the current state.
         */
        getPageState: function(page_state){
        	
        	if(typeof page_state == "undefined"){
        		page_state = this.page_state;
        	}
        	
        	var current_page_state = null;
        	
        	// Find the current page
        	for (var page in this.page_states) {
        		
        		if( this.page_states[page].state_id === page_state ){
        			current_page_state = this.page_states[page];
        			break;
        		}
        	}
        	
        	return current_page_state;
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
         * Check the data model selection
         */
        validateDataModelSelection: function(){
        	
        	this.hideWarning();
        	
        	if( !mvc.Components.getInstance("objects_dropdown").val() ){
        		this.showWarning("Please select a data model");
        		return false;
        	}
        	else if( !mvc.Components.getInstance("models_dropdown").val() ){
        		this.showWarning("Please select an object");
        		return false;
        	}
        	else{
        		return true;
        	}
        },
        
        /**
         * Render the current page.
         */
        changePage: function(new_page_state_id, forward){
        	
        	// Hide the warnings by default
        	this.hideWarning();
        	
        	// Do validation here and return if the page should not be changed:
        	
        	// 	* If on the first page already, then stop
        	if(this.page_state === this.page_states.data_source.state_id && !forward){
        		return;
        	}
        	
        	// 	* If on the data model selection page, validate the selection
        	if(this.page_state === this.page_states.data_source.state_id && forward){
        		if( !this.validateDataModelSelection() ){
        			return;
        		}
        	}
        	
        	// 	* If on the field mapping selection page, validate the selection
        	if(this.page_state === this.page_states.field_mapping.state_id && forward){
        		if( !this.validateFieldMappingSelection() ){
        			return;
        		}
        	}
        	
        	// 	* If on the static field mapping selection page, validate the selection
        	if(this.page_state === this.page_states.field_creation.state_id && forward){
        		if( !this.validateFieldsAreNotMissing() ){
        			return;
        		}
        	}
        	
        	// 	* If on the outputs selection page, validate the selection
        	if(this.page_state === this.page_states.outputs.state_id && forward){
        		if( !this.validateOutputSelection() ){
        			return;
        		}
        	}
        	
        	
        	// Do page specific rendering things here
        	
        	//  * If going to the field assignment page, render the mappings
        	if(new_page_state_id === this.page_states.field_mapping.state_id && forward){
        		//this.render_mappings(); // This is updated when the data-model object is selected
        	}
        	
        	//  * If going to the field creation page, render the static mappings
        	if(new_page_state_id === this.page_states.field_creation.state_id && forward){
        		this.render_static_mappings();
        	}
        	
        	//  * If going to the final page, render the search description
        	if(new_page_state_id === this.page_states.search_info.state_id && forward){
        		var data_model_object = mvc.Components.get("objects_dropdown").val();
            	var data_model = mvc.Components.get("models_dropdown").val();
            	var spec = this.makeSpec();
        		this.getSearchStringFromSpec(data_model, data_model_object, spec);
        	}
        	
        	// Update the breadcrumbs
        	$(".step", this.$el).addClass("inactive");
        	$(".step-" + new_page_state_id, this.$el).removeClass("inactive");
        	
        	// Hide all pages by default
        	for (var page in this.page_states) {
        		$(this.page_states[page].element_id, this.$el).hide();
        	}
        	
        	// Get the current page
        	var current_page_state = this.getPageState();
        	
        	// Get the next page
        	var next_page_state = this.getPageState(new_page_state_id);
        	
        	// If this is the final state, then swap the "next" button for the "save" button
        	if(next_page_state.hasOwnProperty('final_state') && next_page_state.final_state){
        		$("#save", this.$el).show();
        		$("#next", this.$el).hide();
        	}
        	else{
        		$("#save", this.$el).hide();
        		$("#next", this.$el).show();
        	}
        	
        	// Toggle the previous button if a state exists to go to
        	if(next_page_state.hasOwnProperty('initial_state') && next_page_state.initial_state){
        		$("#prev", this.$el).addClass('disabled');
        	}
        	else{
        		$("#prev", this.$el).removeClass('disabled');
        	}
        	
        	// If we are already on the page, do nothing
        	if( current_page_state.state_id === new_page_state_id ){
        		$(next_page_state.element_id, this.$el).show();
        		return;
        	}
        	
        	// Slide in the new panel
        	this.slideInPanel( $(current_page_state.element_id, this.$el), $(next_page_state.element_id, this.$el), forward );
        	
        	// Store the current page state
        	this.page_state = new_page_state_id;
        	
        },
        
        /**
         * Make the spec describing the search.
         */
        makeSpec: function(){
        	
        	var spec = { 'version' : '1.0' };
        	
        	var fieldmap = {};
        	
        	// Populate the field map
        	for( var i = 0; i < this.field_mapping_views.length; i++ ){
        		
        		var output_field = this.field_mapping_views[i].getMappedField();
        		var original_field = this.field_mapping_views[i].field;
        		
        		// If the user wants to map the field, then add it to the field map
        		if( output_field ){
        			fieldmap[output_field] = { 
        					"cef_value_type" : "fieldmap",
        					"splunk_key"     : original_field
        			};
        		}
        	}
        	
        	// ... from the static fields
        	for( var i = 0; i < this.static_field_mapping_views.length; i++ ){
        		
        		var output_field = this.static_field_mapping_views[i].getMappedField();
        		var field_value = this.static_field_mapping_views[i].getField();
        		
        		// If the user wants to map the field, then add it to the field map
        		if( output_field ){
        			fieldmap[output_field] = { 
        					"cef_value_type" : "userdefined",
        					"cef_value"      : field_value
        			};
        		}
        	}
        	
        	// Add in the field map
        	spec["fieldmap"] = fieldmap;
        	
        	// Done, return the spec
        	return spec;
        }
        
        
    });
    
    return ThirdPartyOutputEditorView;
});
