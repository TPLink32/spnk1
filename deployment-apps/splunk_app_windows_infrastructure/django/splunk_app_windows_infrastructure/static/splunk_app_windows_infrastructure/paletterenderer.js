require.config({
    paths: {
        text: './contrib/text'
    }
});


define(function(require, exports, module) {
	var _ = require('underscore');
	var $ = require('jquery');
	var mvc = require('splunkjs/mvc');

	var PagePreChecks = require('./page_prechecks');
    
    var PalettePageConfiguration = require('./palette_page_configuration');
 	var PaletteConfiguration = require('./palette_configuration');
    var PaletteLayoutView = require('./palette_page_layout_view');
    var PalettePanelController = require('./palette_page_view');

	var service = mvc.createService({
        app: 'splunk_app_windows_infrastructure',
        owner: null
	});

    // TODO need to make this much more modular so I can stop hacking
	$('head').append('<link rel="stylesheet" type="text/css" href="/dj/static/splunk_app_windows_infrastructure/palette.css" />');
	$('head').append('<link rel="stylesheet" type="text/css" href="/dj/static/splunk_app_windows_infrastructure/palettepage.css" />');
	$('head').append('<link rel="stylesheet" type="text/css" href="/dj/static/contrib/jquery.colorPicker.css" />');
    
    
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

		    /*
		     * Before palette is rendered, run pre-checks.
		     * Pre-checks are defined in file page_prechecks.js
		     */
		    PagePreChecks.runChecks();
            
			// TODO refactor!
			var dashboard = $('<div id="dashboard-main" class="content-padding">');
            $el.append(dashboard);

            // Stock Palette configurations should always use the
            // current user.
			paletteConfiguration.start(function(user) {
                var palettePageConfiguration = new PalettePageConfiguration({
                    service: service,
                    about: dashboardId,
                    user: null
                });
                
                var paletteLayoutView = new PaletteLayoutView({
                    model: palettePageConfiguration.properties
                });
                
                dashboard.append(paletteLayoutView.$el);
                
                var palettePanelController = new PalettePanelController({
                    model: paletteConfiguration,
                    el: paletteLayoutView.$el
                });
                
                palettePageConfiguration.fetch();
	    	});
            
		}
	};
});
