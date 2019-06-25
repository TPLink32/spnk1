require.config({
    paths: {
        text: "../app/splunk_app_cef/js/lib/text",
        console: '../app/splunk_app_cef/js/util/Console'
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
    "css!../app/splunk_app_cef/css/ThirdPartyOutputEditorView.css",
    "console"
], function( _, Backbone, mvc, $, SimpleSplunkView, DropdownInput, TextInput ){
	
    // Define the custom view class
    var FieldMappingView = SimpleSplunkView.extend({
        className: "FieldMappingView",

        /**
         * Setup the defaults
         */
        defaults: {
        	field: null,
        	mapped_field: null,
        	available_fields: [],
        	show_dropdown_first: false,
        	field_is_static: true
        },
        
        initialize: function() {
            
            // Apply the defaults
            this.options = _.extend({}, this.defaults, this.options);
            
            options = this.options || {};
            
            this.field = options.field;
            this.mapped_field = options.mapped_field;
            this.available_fields = options.available_fields;
            this.unique_identifier = options.unique_identifier;
            this.show_dropdown_first = options.show_dropdown_first;
            this.field_is_static = options.field_is_static;
        },
        
        events: {
        	
        },
        
        /**
         * Set the list of available fields.
         */
        setAvailableFields: function(available_fields){
        	this.available_fields = available_fields;
        	mvc.Components.getInstance("field_mapping_dropdown_" + this.unique_identifier).settings.set("choices",this.available_fields);
        },
        
        /**
         * Get the field that the given field is mapped to.
         */
        getMappedField: function(){
        	return mvc.Components.get("field_mapping_dropdown_" + this.unique_identifier).val();
        },
        
        /**
         * Get the field
         */
        getField: function(){
        	if( this.field_is_static ){
        		return this.field;
        	}
        	else{
            	return mvc.Components.get("field_input_" + this.unique_identifier).val();
                
            } 
        },
        
        /**
         * Set the field
         */
        setField: function(field){
        	
        	this.field = field;
        	
        	if( !this.field_is_static ){
        		mvc.Components.get("field_input_" + this.unique_identifier).val(field);
        	}
        },
        
        /**
         * Set the field to the given field.
         */
        setMappedField: function(field){
        	return mvc.Components.get("field_mapping_dropdown_" + this.unique_identifier).val(field);
        },
        
        /**
         * Convert a flat list to one that can be displayed in a choices list
         */
        convertListToChoices: function(list){
        	
        	var choices = [];
        	
        	for(var c = 0; c < list.length; c++){
        		choices.push( { 
        			'label' : list[c],
        			'value' : list[c]
        		} );
        	}
        	
        	return choices;
        },
        
        /**
         * Make a template
         */
        makeTemplate: function(){
        	
        	var template = "";
        	
        	// Add the field
        	if( this.field_is_static === true ){
        		// If the field is static, then list it. 
        		template = template + "<td><%- field %></td>";
        	}
        	else{
        		// Otherwise, make place to allow them to edit it
        		template = template + '<td><div class="field_input"></div></td>';
        	}
        	
        	// Add the field mapping
        	if( this.show_dropdown_first ){
        		template = '<td><div class="field_mapping_dropdown"></div></td>' + template;
        	}
        	else{
        		template = template + '<td><div class="field_mapping_dropdown"></div></td>';
        	}
        	
        	return template;
        	
        },
        
        /**
         * Render the dialog.
         */
        render: function(){
        	
            // Render the content
            this.$el.html(_.template(this.makeTemplate(), {
            	'field' : this.field,
            	'available_fields' : this.available_fields
            }));
            
            // Render the drop-down of the fields
            var field_mapping_dropdown = new DropdownInput({
                "id": "field_mapping_dropdown_" + this.unique_identifier,
                "choices": this.available_fields,
                "selectFirstChoice": false,
                "showClearButton": true,
                "el": $('.field_mapping_dropdown', this.$el)
            }, {tokens: true}).render();
            
            field_mapping_dropdown.on("change", function(newValue) {
            	Backbone.trigger("field_mapping:selected", this.unique_identifier);
            }.bind(this));
            
            // Render an input for editing the field if it is not static
            if( !this.field_is_static ){
            	
                var field_input = new TextInput({
                    "id": "field_input_" + this.unique_identifier,
                    "showClearButton": true,
                    "el": $('.field_input', this.$el)
                }, {tokens: true}).render();
                
                field_input.on("change", function(newValue) {
                	Backbone.trigger("field_mapping:selected", this.unique_identifier);
                }.bind(this));
                
            }
            
            return this;
        }
        
    });
    
    return FieldMappingView;
});
