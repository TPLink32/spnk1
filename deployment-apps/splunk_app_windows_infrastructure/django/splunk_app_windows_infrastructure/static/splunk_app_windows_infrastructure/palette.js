/*global define, require */

require.config({
    paths: {
        text: './contrib/text'
    }
});

define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var mvc = require('splunkjs/mvc');
    var splunk_util = require('splunk.util');

    var PaletteLocationConfiguration = require('./palette_location_configuration');
    var PaletteConfiguration = require('./palette_configuration');
    var PalettePageConfiguration = require('./palette_page_editable');
    var PalettePanelController = require('./palette_page_view');
    var PaletteLayoutView = require('./palette_page_layout_view');
    var PaletteLayoutEditor = require('./palette_edit_router');

    var appRoot = splunk_util.getConfigValue('DJANGO_ROOT_PATH', 'dj/');
    var paletteUrl = appRoot + '/splunk_app_windows_infrastructure/palette/';

    
    return $(function() {
        var service = mvc.createService({
            app: 'splunk_app_windows_infrastructure',
            owner: null
        });

        var paletteConfiguration = new PaletteConfiguration(service);
        var closingMessage = 'You have not saved your changes.';

        $.when(paletteConfiguration.start()).then(function() {
            var paletteLocation = new PaletteLocationConfiguration(service.app);
            var userService = service.specialize(
                paletteConfiguration.userName, 
                'splunk_app_windows_infrastructure'
            );

            var palettePageConfiguration = PalettePageConfiguration(
                userService, (paletteLocation.pageName() === '_new'));

            var paletteLayoutView = new PaletteLayoutEditor({
                model: palettePageConfiguration,
                panels: paletteConfiguration.panels,
                el: $('#dashboard-main').get(0)
            });

            // Scans the layout viewport for inactive panels and fills
            // them in.  Also, disables any searches associated with
            // panels that have been deactivated.
            var palettePanelController = new PalettePanelController({
                model: paletteConfiguration,
                el: paletteLayoutView.layout.$el
            });

            palettePageConfiguration.on('pageNotFound', function() {
                splunk_util.redirect_to(paletteUrl);
            });

            var initializePageProperties = function() {
                if (! palettePageConfiguration.isNew()) {
                    return palettePageConfiguration.fetch({about: paletteLocation.pageName()});
                }

                closingMessage = 'You have not saved your page.';
                var source = paletteLocation.getCloneSource();

                if (!source) {
                    window.location.hash = '#edit';
                    return palettePageConfiguration.properties.trigger('change:panels');
                }
                
                var temporaryPalette = PalettePageConfiguration(userService);

                temporaryPalette.on('pageNotFound', function() {
                    splunk_util.redirect_to(paletteUrl);
                });

                $.when(temporaryPalette.fetch({about: source})).then(function() {
                    // Set the properties *as if* they came from a Stanza.
                    palettePageConfiguration.properties.set(
                        _.omit(temporaryPalette.properties.toStanzaJson(), ['isDefault']));
                });

                return null;
            };

            $(window).bind('beforeunload', function() {
                if (palettePageConfiguration.dirty) {
                    return closingMessage;
                }
                return undefined;
            });

            initializePageProperties();
        });
    });
});

