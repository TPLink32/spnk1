/*global define */
define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    
    var mvc = require('splunkjs/mvc');
    var Backbone = require('backbone');
    var SearchManager = require('splunkjs/mvc/searchmanager');
    var SavedSearchManager = require('splunkjs/mvc/savedsearchmanager');
    var PostProcessSearchManager = require('splunkjs/mvc/postprocessmanager');
    var TimePickerView = require('splunkjs/mvc/timepickerview');
    var BaseTokenModel = require('splunkjs/mvc/basetokenmodel');
    var TokenUtils = require('splunkjs/mvc/tokenutils');
    var PageRepresentation = require('./palette_page_builder');
    var _displayMessage = require('./palette-dropdown-patches');
    // var console = require('util/console');

    /** DOT: Given a list of expected panels on the page, ensures that
     *  each panel is up and running, and all panel dependencies are
     *  fulfilled.  When the list changes, adds & deletes (or stops,
     *  in the case of searches) dependencies as needed.
     */

    var _Dropdown = require('splunkjs/mvc/dropdownview');
    var _MultiDropdown = require('splunkjs/mvc/multidropdownview');
    
    var viewComponents = {
        'table': require('splunkjs/mvc/tableview'),
        'chart': require('splunkjs/mvc/chartview'),
        'single': require('splunkjs/mvc/singleview'),
        'textbox': require('splunkjs/mvc/textinputview'),
        'dropdown': _Dropdown.extend({_displayMessage: _displayMessage}),
        'multidropdown': _MultiDropdown.extend({_displayMessage: _displayMessage})
    };

    var tokenBindingTypes = {
        /* Example input:
         *   - key = "ForestName"
         *   - values = ["forest1", "forest 2"]
         *
         * Example output (string):
         *      (ForestName="forest1" OR ForestName="forest 2")
        */
        'or': function(key, values) {
            return "(" + _.map(values, function(value) { return key + "=\"" + value + "\""; }).join(" OR ") + ")";
        },
        'wrap': function(key, value) {
            if (!$.trim(value)) {
                return "";
            }
            return key + '="' + value + '"';
        }
    };

    var localInputParameters = _.memoize(function() {
        if (!window.location.search) {
            return {};
        }
        return _.reduce(window.location.search.substring(1).split('&'), function(m, v) {
            var pair = v.split('=');
            m[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1].replace(/\+/g, ' '));
            return m;
        }, {});
    });

    var localInputParameter = function(parameter) {
        return (localInputParameters().hasOwnProperty(parameter) ?
                localInputParameters()[parameter] : null);
    };

    
    /**
     * Inputs local to a panel.
     *  
     * Contains the MVC object, which draws directly into the element
     * provided (in this case, an LI).  Render does not attach the
     * element to the DOM; that is left up to the parent container. 
     */
    
    var pageInputTmpl = require('text!./palette_templates/page-input.html');
    var PagePanelInputView = Backbone.View.extend({
        tagName: 'li',
        className: "panel-selector-parent preview-hide open relative palette-local-input",
        template: _.template(pageInputTmpl),
        
        initialize: function(options) {
            this.inputRef = options.input;
            this.input = this.inputRef.conf;
        },
        
        render: function() {
            var search = this.inputRef.getForType('search').pop();
            var options = this.input.viewconf;
            this.$el.html(this.template(this.input));
            this.$el.attr({'typeof': 'input', 'about': this.input.name});

            // This is really the only place where the domName() is
            // needed.

            this.inputComponent = new viewComponents.dropdown({
                el: this.$('.palette-input-contain'),
                managerid: search.conf.get('name'),
                labelField: options.labelField,
                valueField: options.valueField,
                value: mvc.tokenSafe('$' + this.inputRef.domName() + '$'),
                showClearButton: false,
                choices: options.choices,
                'default': options['default']
            });
            
            this.inputComponent.render();
            return this;
        }
    });


    //  ___          _    _                      _   ___                _      
    // |   \ __ _ __| |_ | |__  ___  __ _ _ _ __| | |_ _|_ _  _ __ _  _| |_ ___
    // | |) / _` (_-< ' \| '_ \/ _ \/ _` | '_/ _` |  | || ' \| '_ \ || |  _(_-<
    // |___/\__,_/__/_||_|_.__/\___/\__,_|_| \__,_| |___|_||_| .__/\_,_|\__/__/
    //                                                       |_|               
    
    function build_default(defvalue) {
        return _.isEmpty(defvalue) ? [] : ['default', defvalue];
    }

    var PageInputView = Backbone.View.extend({
        tagName: 'li',
        className: "panel-selector-parent nav-item preview-hide palette-input",
        template: _.template(pageInputTmpl),
        
        initialize: function(options) {
            this.inputRef = options.input;
            this.model = this.inputRef.conf;
            this.defaultSetting = localInputParameter(this.model.id);
        },

        searchName: function() {
            var search = this.inputRef.getForType('search');
            if (search.length) {
                return search[0].conf.get('name');
            }
            return null;
        },

        baseOptions: function(opts, custpairs) {
            custpairs = custpairs || [];
            var options = _.extend(JSON.parse(this.model.properties.get('viewconf')),
                                   { el: this.$('.palette-input-contain') },
                                   opts);
            _.each(custpairs, function(c) {
                options[c[0]] = c[1] || options[c[0]];
            });
            return options;
        },

        render_dropdown: function() {
            return new viewComponents.dropdown(this.baseOptions({
                value: mvc.tokenSafe('$' + this.inputRef.domName() + '$'),
                showClearButton: false,
                managerid: this.searchName()
            }, [build_default(this.defaultSetting)]));
        },

        render_textbox:function() {
            return new viewComponents.textbox(this.baseOptions({
                value: mvc.tokenSafe('$' + this.inputRef.name + '$')
            }, [['default', this.defaultSetting || '']]));
        },

        render_multidropdown: function() {
            // Need vector of values for multiselect
            if (_.isString(this.defaultSetting)) {
                this.defaultSetting = this.defaultSetting.split(',');
            }
            return new viewComponents.multidropdown(this.baseOptions({
                value: mvc.tokenSafe('$' + this.inputRef.domName() + '$'),
                managerid: this.searchName()
            }, [build_default(this.defaultSetting)]));
        },

        renderCustom: function() {
            this.$el.html(this.template(this.model.properties.toJSON()));
            this.$el.attr({'typeof': 'input', 'about': this.model.get('name')});
            this.inputComponent = new viewComponents[this.model.properties.get('viewpath')](this.baseOptions({
                value: mvc.tokenSafe('$' + this.inputRef.domName() + '$'),
                managerid: this.searchName()
            }, [build_default(this.defaultSetting)])).render();
            return this;
        },
        
        render: function() {
            var that = this;
            if (this.model.properties.has('viewpath')) {
                return this.renderCustom();
            }
            var type = this.model.properties.get('view');
            this.$el.html(this.template(this.model.properties.toJSON()));
            this.$el.attr({'typeof': 'input', 'about': this.model.get('name')});
            this.inputComponent = this['render_' + type]();
            this.inputComponent.render();
            return this;
        }
    });

    var PageTimepickerView = Backbone.View.extend({

        initialize: function(options) {
            var earliest_time = (localInputParameter('earliest_time') || 
                                 options.parent.$el.data('timepickerDefault') || 
                                 '-15m');
            var latest_time = (localInputParameter('latest_time') || 'now');
            this.timepicker = new TimePickerView({
                earliest_time: earliest_time,
                latest_time: latest_time
            });
            this.rendered = false;
            this.listeners = {};
        },

        attachSearches: function(searches) {
            var that = this;

            _.each(searches, function(s) {
                if (that.listeners[s.name]) {
                    return;
                }

                var searchManager = mvc.Components.getInstance(s.name);
                searchManager.search.set(that.timepicker.val());
                var searchHandler = function() {
                    searchManager.search.set(that.timepicker.val());
                };
                that.timepicker.on('change', searchHandler);
                that.listeners[s.name] = searchHandler;
            });
        },

        detachSearches: function(searchNames) {
            var that = this;
            _.each(searchNames, function(s) { 
                if (that.listeners[s]) {
                    that.timepicker.off('change', that.listeners[s]);
                    that.listeners[s] = null;
                }
            });
        },

        render: function() {
            if (! this.rendered) {
                this.$el.append(this.timepicker.render().$el);
                this.rendered = true;
            }
            return this;
        },

        maybeShow: function() {
            var that = this;
            this.$el.hide();
            if (_.any(this.listeners, function(v, k) { return v !== null; })) {
                that.$el.show();
            }
            return this;
        }
    });
    
    
    //  ___               _ 
    // | _ \__ _ _ _  ___| |
    // |  _/ _` | ' \/ -_) |
    // |_| \__,_|_||_\___|_|
    //                      

    var pagePanelTemplate = _.template([
        '<div class="dashboard-panel">',
        '  <div class="drag-handle">',
        '      <div class="handle-inner"></div>',
        '      <a href="#" class="palette-panel-delete-btn pull-right"><i class="icon-x-circle"></i></a>',
        '  </div>',
        '  <!-- Panel menu -->',
        '  <div class="panel-head">',
        '    <div class="panel-btn-title pull-left">',
        '      <h3><%= title %></h3>',
        '    </div>',
        '    <div class="pull-right">',
	    '      <ul class="nav-pills side-borders panel-extras">',
	    '      </ul>',
        '    </div>',
        '    <div style="clear:both;"></div>',
        '  </div>',
        '  <div class="panel-info"></div>',
        '  <div class="panel-footer"></div>',
        '</div>'].join('\n'));

    var PagePanelView = Backbone.View.extend({
        template: pagePanelTemplate,
        
        initialize: function(options) {
            this.parent = options.parent;
            this.panelRef = options.panelRef;
            this.panel = this.panelRef.conf;
        },

        enableDrilldown: function() {
            if (! this.panel.properties.has('drilldown')) {
                return;
            }

            var drilldown = JSON.parse(this.panel.properties.get('drilldown'));

            if (_.isEmpty(drilldown) || _.isUndefined(drilldown.view)) {
                return;
            }

            var that = this;
            var tokenModel = new BaseTokenModel();
            var defaultTokenModel = mvc.Components.getInstance('default');
            defaultTokenModel.set(tokenModel.toJSON());

            var makeStraights = function(memo, value, key) { 
                memo[value] = key; 
                return memo; 
            };

            var target = '';

            if (drilldown.view.indexOf('/') !== 0) {
                target = mvc.reverse("splunk_app_windows_infrastructure:tmpl_render", { tmpl: drilldown.view});
            } else {
                target = drilldown.view;
            }


            this.component.on('clicked:row', function(event) {
                var results = event.component.results.get('rows');
                var index   = event.index;
                event.preventDefault();

                var makeRows = function(memo, value, key) { 
                    memo[value] = results[index][parseInt(key, 10)]; 
                    return memo; 
                };

                // dereference tokenparams
                var dereferencedTokens = {};
                _.each(_.keys(drilldown.tokenparams || {}), function(tokenQuery) {
                    var originalTokenQuery = tokenQuery;
                    var clickRegexp = null;

                    // First deal with clicks
                    // FRAGILE only allows 0-9 click values
                    for (var i = 0; i < 10; i++) {
                        clickRegexp = new RegExp("\\$click\\.cell" + i + "\\.value\\$", "g");
                        tokenQuery = tokenQuery.replace(clickRegexp, results[index][i]);
                    }

                    // Now deal with general tokens
                    // replaceTokens not working
                    var tokenNames = TokenUtils.getTokenNames(tokenQuery);
                    _.each(tokenNames, function(tokenName) {
                        var regexp = new RegExp("\\$" + tokenName + "\\$", "g");
                        tokenQuery = tokenQuery.replace(regexp, mvc.Components.getInstance('default').get(tokenName));
                    });

                    dereferencedTokens[drilldown.tokenparams[originalTokenQuery]] = tokenQuery;

                });

                var options = _.extend({},
                                       dereferencedTokens,
                                       _.reduce((drilldown.rowparams || {}), makeRows, {}),
                                       _.reduce((drilldown.nontokenparams || {}), makeStraights, {}));
                mvc.drilldown(target, options);
            });

            this.component.on('clicked:chart', function(e, component) {
                e.preventDefault();

                // TODO FRAGILE. Requires search to be carefully constructed at the end
                // E.g. | chart count(host), list(host) by sourcetype
                var underlyingData = component.resultsModel.data();
                var valueIndex = _.indexOf(component.resultsModel.data().columns[0], e.value);
                
                // Replace (some) special Simple XML drilldown tokens specified at:
                // http://docs.splunk.com/Documentation/Splunk/6.0/Viz/PanelreferenceforSimplifiedXML#link
                var clickValue = e.value;       // X-axis value
                var clickValue2 = e.value2;     // Y-axis value
                var clickName = e.name;
                var clickName2 = e.name2;
                if (component.settings.get('type') === 'pie') {
                    // Special case for legacy pie charts.
                    // Might be a no-op. Someone should retest it...
                    clickValue = underlyingData.columns[2][valueIndex];
                }
                
                var params = _.reduce(
                    drilldown.chartparams || {}, 
                    function(params, value, key) {
                        value = value.replace(/\$click\.value\$/g, clickValue);
                        value = value.replace(/\$click\.value2\$/g, clickValue2);
                        value = value.replace(/\$click\.name\$/g, clickName);
                        value = value.replace(/\$click\.name2\$/g, clickName2);
                        value = TokenUtils.replaceTokens(value, mvc.Components);
                        params[key] = value;
                        return params;
                    },
                    {}
                );

                mvc.drilldown(target, params);
            });
        },

        addInput: function(ref) {
            this.$(".panel-extras").append((new PagePanelInputView({input: ref})).render().$el);
        },
        
        render: function() {
            var that = this;
            this.$el.html(this.template(this.panel.properties.toJSON()));
            this.$el.attr({'typeof': 'panel', 'about': this.panel.id});

            _.each(this.panelRef.getForType('localinput'), function(i) {
                that.addInput(i);
            });

            var uitype = this.panel.properties.get('view') || this.panel.properties.get('viewpath');
            var innerEl = this.$('.panel-info');
            var savedSearch = this.panelRef.getForType('savedsearch').pop();
            var inlineSearch = this.panelRef.getForType('search').pop();
            var search = inlineSearch || savedSearch;
            var uiConf = _.extend({}, {el: innerEl, managerid: search.domName()},
                                  JSON.parse(this.panel.properties.get('viewconf')));
            this.component = new (viewComponents[uitype])(uiConf);
            this.component.render();



            // Search Icon code for search inspection per panel
            var $searchIcon = $('<a href="#" title="Search"><i class="icon-search"></i></a>')
                .appendTo(this.$('.panel-footer'))
                .off('click')
                .click(function() {
                    var search = mvc.Components.getInstance(uiConf.managerid);
                    var parentSearchId = search.get('managerid');
                    var sid = search.job.sid;
                    var earliest = search.get('earliest_time');
                    var latest = search.get('latest_time');
                    var query = (search.settings || search.query).get('search');

                    // If it's a post process, we need the prefix query
                    if (parentSearchId) {
                        
                        var concatQueryParts = function(leftPart, rightPart) {
                            var regExEndsWithPipe = /\|(\s*)$/;
                            var regExBeginssWithPipe = /^(\s*)\|/;
                        
                            if (!regExEndsWithPipe.test(leftPart) &&
                                !regExBeginssWithPipe.test(rightPart))
                            {
                                return (leftPart + "|" + rightPart);
                            } else {
                                // Doesn't take care of removing if both left
                                // and right have pipe character since aim is
                                // only to not introduce duplicates. It is not a
                                // goal here to fix potentially incorrect searches
                                return (leftPart + rightPart);
                            }
                        }

                        var parentSearch = mvc.Components.getInstance(parentSearchId);
                                                
                        query = concatQueryParts(
                            (parentSearch.settings || parentSearch.query).get('search'),
                            query
                        );
                    }

                    window.open(
                        "/app/splunk_app_windows_infrastructure/search?" +
                        "sid=" + encodeURIComponent(sid) + "&" +
                        "q=" + encodeURIComponent(query) + "&" +
                        "earliest=" + encodeURIComponent(earliest) + "&" +
                        "latest=" + encodeURIComponent(latest)
                    );
                })
                .hide();

            var searchManager = mvc.Components.getInstance(uiConf.managerid);
            // It's already resolved if settings.search (splunk 6.1) or query.search (splunk 6.0)
            var alreadyResolved = (searchManager.settings || searchManager.query).get('search');

            // Inline searches that are already resolved by now AND saved searches should just show the icon
            if (alreadyResolved || savedSearch) {
                $searchIcon.show();
            }

            // If it's an inline search, listen for tokens to change to show/hide the search icon
            // Otherwise the search icon will show when it's not actually tied to a valid search
            if (inlineSearch) {
                (searchManager.settings || searchManager.query).on('change:search', function(settings, newSearch) {
                    $searchIcon[newSearch ? 'show' : 'hide']();
                });
            }

            this.enableDrilldown();
            return this;
        }
    });

    //  ___          _    _                      _ 
    // |   \ __ _ __| |_ | |__  ___  __ _ _ _ __| |
    // | |) / _` (_-< ' \| '_ \/ _ \/ _` | '_/ _` |
    // |___/\__,_/__/_||_|_.__/\___/\__,_|_| \__,_|
    //                                             
    
    /* This is a parent object that routinizes all of the interaction
     * between the different parts of the page.  It's not a
     * Route, notice, it's a View: we are not using this in any way to
     * route URLs, which is what a Route is for. 
     */
    
    var PalettePanelController = Backbone.View.extend({
        id: 'palette-panel-controller',

        events: {
            'update': 'render'
        },

        initialize: function(options) {
            Backbone.View.prototype.initialize.apply(this, arguments);
            this.inputs =  {};
            this.searches = {};
            this.savedsearches = {};
            this.timepicker = null;
            this.pageRep = new PageRepresentation(this.model);
            $(window).bind('resize', _.bind(_.debounce(this.rebalanceRows), this));
        },

        _activateSearches: function(searches) {
            _.each(_.filter(searches, function(s) { return s.state === 'pending'; }),
                   function(search) {
                       search.search.startSearch();
                       search.search.set({autostart: true});
                       search.state = 'running';
                   });
        },

        _removeEmptyRows: function() {
            // Side effect.
            this.$('#dashboard-panels-container .dashboard-row').each(function(index, rowEl) {
                var row = $(rowEl);
                if (row.is(':empty') && (! row.hasClass('empty'))) {
                    row.remove();
                }
            });
        },

        _addNewInputs: function(newInputs) {
            var that = this;
            _.each(newInputs, function(input) {
                that.$('#dashboard-global-selectors').append(new PageInputView({input: input}).render().$el);
            });
        },
 
        _sortInputs: function() {
            var order = this.$el.data('inputOrdering');
            if (_.isEmpty(order)) {
                return;
            }

            order = _.reduce(order, function(m, v, i) { m[v] = i; return m; }, {});
            var container = this.$('#dashboard-global-selectors');
            var sorter = function(el) {
                var n = $(el).attr('about');
                if (! order.hasOwnProperty(n)) { return -1; }
                return order[n];
            };

            _.each(_.sortBy(container.children('li'), sorter), function(el) {
                container.append(el);
            });
        },

        // TODO: This method has no reference to its parent object or
        // class. It's nicely segmented, but in a perfect world it
        // would be within this namespace but inacessible by this
        // object.

        _createSearch: function(ref) {
            // Side effect.

            var setupBindings = function(object) {
                // TODO verify: this code assumes correct inputs have already been loaded.
                // That data is being blown away right here.
                var defaultTokenNamespace = mvc.Components.getInstance('default');
                var searchString = object.conf.properties.get('search');
                var bindingconf = object.conf.properties.get('bindingconf');
                if (!_.isUndefined(bindingconf)) {
                    bindingconf = JSON.parse(bindingconf);
                    _.each(_.keys(bindingconf), function(tokenName) {
                        var type = bindingconf[tokenName].type;
                        var key = bindingconf[tokenName].key;
                        var replaceRegex = new RegExp("\\$" + tokenName + "\\$", "g");
                        var tokenFacade = "__palette_facade_" + tokenName;
                        
                        searchString = searchString.replace(replaceRegex, '$' + tokenFacade + '$');
                        var applyFacade = function() {
                            defaultTokenNamespace.set(
                                tokenFacade,
                                tokenBindingTypes[type](key, defaultTokenNamespace.get(tokenName))
                            );
                        };
                        defaultTokenNamespace.on('change:' + tokenName, applyFacade);
                        applyFacade();
                    });
                }
                
                return searchString;
            };

            function createSearchByType(searchtype, object, extra) {
                if (mvc.Components.hasInstance(object.conf.get('name'))) {
                    return null;
                }

                var searchString = setupBindings(object);
                var obj = _.extend({
                    id: object.conf.get('name'),
                    search: mvc.tokenSafe(searchString),
                    autostart: false
                }, extra ? extra : {});

                var thesearch = new searchtype(obj);
                return thesearch;
            }
                    
            var search = (ref.conf.properties.has('parent') ? 
                      createSearchByType(PostProcessSearchManager, ref, {managerid: ref.extra.parentId}) :
                      createSearchByType(SearchManager, ref, {}));
            return search;
        },

        _addNewPanels: function(newPanels) {
            var that = this;
            this.$('.panel-proto').map(function(i, e) {
                var el = $(e), 
                    about = el.attr('about'),
                    panelRef = _.find(newPanels, function(p) { return (p.conf.get('name') === about); });
                new PagePanelView({
                    el: el,
                    parent: that,
                    panelRef: panelRef
                }).render();
                el.removeClass('panel-proto').addClass('dashboard-cell');
            });
        },

        _setTimepickerSearches: function(newSearches, delSearches) {
            var toAttach = [];
            if (this.$el.data('use_timepicker')) {
                toAttach = _.filter(newSearches, function(i) { return (! i.conf.properties.has('parent')); });
            } else { 
                toAttach = _.filter(newSearches, function(i) { return i.conf.properties.get('use_timepicker'); });
            }
            this.timepicker.attachSearches(toAttach);
            this.timepicker.detachSearches(delSearches);
        },

        _setNewDropdownsToInitialValues: function() {
            var isddre = new RegExp('dropdown', 'i');
            var dropdowns = _(mvc.Components.getInstances()).filter(function(s) {
                return isddre.test(s.moduleId);
            });

            _(dropdowns).each(function(dropdown) {
                if (! _.isEmpty(dropdown.val())) {
                    return;
                }

                if (dropdown.options.choices && dropdown.options.choices.length) {
                    dropdown.val(dropdown.options.choices[0].value);
                    return;
                }

                // Move this to a new execution block at the end of
                // the execution list.  By then, the managerChange
                // event will have registered and the resultsModel
                // will exist.
                
                _.defer(function() {
                    var resultsModel = dropdown.resultsModel;
                    var fieldName = dropdown.settings.get('valueField');

                    var callback = function(results) {
                        var resultValues = _.filter(_.map(
                            results.collection().toArray(), 
                            function(r) { return r.get(fieldName); }), // Map to value
                            function(v) { return ! _.isEmpty(v); });   // Filter empty values

                        if (resultValues.length) {
                            dropdown.val(resultValues[0]);
                            resultsModel.off('data', callback);
                        }
                    };
                    resultsModel.on('data', callback);
                });
            });
        },

        render: function() {
            var that = this;
            this.pageRep.build(this.$('.dashboard-cell,.panel-proto').map(function(i, e) {
                return $(e).attr('about');
            }));

            var customVis = this.pageRep.getCustomVisualizations();
            if (customVis.length === 0) {
                return this.renderPage();
            }

            require(customVis, function() {
                _.extend(viewComponents, _.reduce(_.zip(customVis, _.toArray(arguments)), 
                                                  function(m, va) { m[va[0]] = va[1]; return m; }, {}));
                that.renderPage();
            });

            return this;
        },

        rebalanceRows: function() {
            this.$('.dashboard-row').each(function() {
                var els = $(this).children();
                els.css({ width: String(Math.floor(10000/(els.length))/100)+'%'});
                var items = $(this).find('.dashboard-panel');
                items.css({ 'min-height': 100 }).css({ 'min-height': _.max(_.map(items, function(i){ return $(i).height(); })) });
            });
            return this;
        },

        renderPage: function() {
            var that = this;

            // The logical representation needs both the existing and
            // prototype panels.

            function delta(typename, current) {
                var objects = _.uniq(that.pageRep.getAllForType(typename),
                                     function(u) { return u.conf.get('name'); });
                var request = _.map(objects, function(e) { return e.conf.get('name'); });
                var newNames = _.difference(request, current);
                var delNames = _.difference(current, request);
                return {
                    type: typename, 
                    objects: objects,
                    newObjects: _.filter(objects, function(e) { return _.contains(newNames, e.conf.get('name')); }),
                    delNames: delNames,
                    unchanged: _.difference(request, delNames)
                };
            }

            function fromDom(source) { 
                return that.$(source).map(function(i, e) { return $(e).attr('about'); }).get(); 
            }

            function fromThis(source) {
                return _.keys(that[source]);
            }
                                       
            var panels =   delta('panel',       fromDom('.dashboard-cell'));
            var inputs =   delta('input',       fromDom('li.palette-input'));
            var searches = delta('search',      fromThis('searches'));
            var saved =    delta('savedsearch', fromThis('savedsearches'));

            // Remove any deleted panels or inputs from the display.

            function cleanUp(source, names) {
                that.$(source).each(function(i, e) { 
                    if (_.contains(names, $(e).attr('about'))) {
                        $(e).remove();
                    }
                });
            }
            cleanUp('.dashboard-cell', panels.delNames);
            cleanUp('li.palette-input', inputs.delNames);

            // Cancel any running searches 
            _.each(searches.delNames, function(name) {
                // Preprocessed searches don't have the cancel feature.
                if (that.searches[name].search.cancel) {
                    that.searches[name].search.set({autostart: false});
                    that.searches[name].search.cancel();
                }
                that.searches[name].state = 'cancelled';
            });

            _.each(saved.delNames, function(name) {
                if (that.savedsearches[name].search.cancel) {
                    that.savedsearches[name].search.set({autostart: false});
                    that.savedsearches[name].search.cancel();
                }
                that.savedsearches[name].state = 'cancelled';
            });

            // Instantiate the new
            this.searches = _.reduce(searches.newObjects, function(m, s) { 
                var name = s.conf.get('name');
                if (! m[name]) {
                    m[name] = {
                        search: that._createSearch(s)
                    };
                }
                m[name].state = s.conf.properties.has('parent') ? 'postprocess' : 'pending';
                return m;
            }, this.searches);

            this.savedsearches = _.reduce(saved.newObjects, function(m, src) {
                var name = src.conf.get('name');
                if (! m[name]) {
                    m[name] = {
                        search: new SavedSearchManager({
                            id: src.domName(),
                            searchname: name,
                            autostart: true
                        })
                    };
                }
                m[name].state = 'pending';
                return m;
            }, this.savedsearches);

            // Re-activate any searches that weren't added but were
            // cancelled earlier.

            _.each(searches.unchanged, function(name) {
                if (that.searches[name].state == 'cancelled') {
                    that.searches[name].state = 'pending';
                }
            });

            _.each(saved.unchanged, function(name) {
                if (that.savedsearches[name].state == 'cancelled') {
                    that.savedsearches[name].state = 'pending';
                }
            });

            // Ugly, but this can't be instantiated until we've
            // rendered the template.
            if (!this.timepicker) {
                this.timepicker = new PageTimepickerView({
                    model: this.model, 
                    parent: this,
                    el: $('#dashboard-timepicker-slot')
                });
            }

            var nonPostSearches = _.filter(
                searches.objects,
                function(i) { return (! i.conf.properties.has('parent')); });

            this._addNewInputs(inputs.newObjects);
            this._addNewPanels(panels.newObjects);
            this.timepicker.render();
            this._setTimepickerSearches(nonPostSearches, searches.delNames);
            this.timepicker.maybeShow();
            this._sortInputs();
            this._setNewDropdownsToInitialValues();
            this._activateSearches(this.searches);
            this._activateSearches(this.savedsearches);
            this._removeEmptyRows();
            this.rebalanceRows();
            this.$el.trigger('rendered');
        }
    });
    
    return PalettePanelController;

});

