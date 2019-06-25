require.config({
    paths: {
        text: './contrib/text'
    }
});

define(function(require, exports, module) {
	var _ = require('underscore');
	var $ = require('jquery');
	var mvc = require('splunkjs/mvc');

 	var PaletteConfiguration = require('./palette_configuration');
    var PalettePanelController = require('./palette_page_view');

	var service = mvc.createService({
        app: 'splunk_app_windows_infrastructure',
        owner: '-'
	});
    
	// TODO need to make this much more modular so I can stop hacking
	$('head').append('<link rel="stylesheet" type="text/css" href="/dj/static/splunk_app_windows_infrastructure/palette.css" />');
	$('head').append('<link rel="stylesheet" type="text/css" href="/dj/static/splunk_app_windows_infrastructure/palettepage.css" />');
    
    var paletteConfiguration = new PaletteConfiguration(service);

	// TODO make this API have an initialize step, followed by a render step
	// All the render step does is call Backbone.render() on each Framework
	// component created.

	return {
        
		// Input
		//   - $el: the element to render into
		//   - panels: the panels to render, given by a list or a dashboard ID
		//   - layout: optional. layout information. not used with dasbhoard IDs
		render: function($el, dashboardId, layout) {
			paletteConfiguration.start(function(user) {
				var userService = service.specialize(user, 'splunk_app_windows_infrastructure');
                
                var palettePanelController = new PalettePanelController({
                    model: paletteConfiguration,
                    el: $('#dashboard-main')
                });
                
                palettePanelController.render();
	    	});
            
		}
	}
});
