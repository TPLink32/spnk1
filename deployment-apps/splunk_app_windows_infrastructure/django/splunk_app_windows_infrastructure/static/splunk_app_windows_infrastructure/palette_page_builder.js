define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var Backbone = require('backbone');
    var PageConf = require('./palette_page_configuration');
    var TokenUtils = require('splunkjs/mvc/tokenutils');
    // var console = require('util/console');

    /** Pagebuilder.
     *
     * Takes a PageConfiguration object and a PaletteConfiguration
     * object and builds a logical representation of all the
     * relationships between all of the objects specified:
     * 
     * a panel has searches and inputs, 
     * searches may themselves have tokens that refer to inputs,
     * choice inputs may have searches to populate their contents, 
     * panels may have searches dependent upon other panels (drilldowns),
     * some inputs will be set-wide, others will be local to a panel.
     * 
     * This is represented here as a tree of relationships. This is an
     * intermediary format between a Pallete PageConfiguration and the
     * ultimate representation in the DOM.  As each object is identified
     * in the tree, it is replaced with its representation from the
     * PaletteConfiguration, until all objects have been resolved.
     *
     * Along the way, local input names are munged to be localized to
     * their panels, and the search strings that depend upon those names
     * are likewise munged so they all resolve correctly using Tokens.
     *
     * TODO:
     * All names are then munged a second time to reflect their set
     * identification.  Only panels are members of sets explicitly, so
     * all child objects must be munged on the fly to represent the set 
     * to which they belong.
     */

    function idFix(id) {
        return id.replace(/[^A-Za-z0-9\_\.]+/g, '-');
    }

    /* A node in the (logical) tree.  'conf' is the configuration
     * representation of the object as encoded in a specific
     * configuration file.  This solves several problems: the name of
     * the object is the stanza name, not the content of the object;
     * the type is the name of the stanza's file, not the content of
     * the object; the children are consequential parts of the object,
     * since the child objects are just names in the stanza.
     */

    var PanelNode = function(type, name, object, children, extra) {
        extra = extra ? extra : {};
        this.type = type;
        this.name = name;
        this.conf = object;
        this.children = children;

        // Reserved space on a per-type basis
        this.extra = extra;
        return this;
    };

    /* The names of objects have periods.  This changes those to dashes. */

    PanelNode.prototype.domName = function() {
        return idFix(this.name);  
    };

    /* Gets all immediate children objects of a given type */

    PanelNode.prototype.getForType = function(type) {
        return _.filter(this.children, function(a) { return (a.type === type); });
    };

    /* Gets all children objects, descending down the tree as
     * necessary, to retrieve elements of a given type.  Returns the
     * nodes as a list. Note that the list will be populated in a
     * width-first, bottom-to-top scan. */

    PanelNode.prototype.visit = function(visitor) {
        function scan(obj) {
            _.each(obj.children, function(o) { scan(o); });
            visitor.visit(obj);
        }
        scan(this);
        return visitor;
    };

    PanelNode.prototype.getAllForType = function(type, uniq) {
        var visitor = new NodeFilter(function(obj) { return (obj.type === type); });
        this.visit(visitor);
        if (uniq) { 
            return _.uniq(visitor.found());
        }
        return visitor.found();
    };

    PanelNode.prototype.getByName = function(name) {
        var visitor = new (function() {
            var that = this, found = null;
            this.visit = function(obj) {
                if (obj.name == name) {
                    found = obj;
                }
            };
        })();
        this.visit(visitor);
        return visitor.found;
    };

    var NodeFilter = function(f) {
        this._found = [];
        this._comp = f;
    };

    NodeFilter.prototype.visit = function(obj) {
        if (this._comp(obj)) { this._found.push(obj); }
    };

    NodeFilter.prototype.found = function() { return this._found; };

    var CatalogChildren = function() {
        this.children = {};
    };

    CatalogChildren.prototype.visit = function(obj) {
        (this.children[obj.type] || (this.children[obj.type] = [])).push(obj.name);
    };

    CatalogChildren.prototype.found = function() {
        return _.reduce(this.children, function(memo, value, key, parent) {
            memo[key] = _.uniq(value); return memo; }, {});
    };

    // This is one of the two major pieces of Palette.  It takes the
    // list of palette panel names, and turns that into a tree
    // representing all of the objects needed to support those panels.

    function panelBuild(panelNames, library) {

        var buildGlobalInputs = function(inputnames) {
            // console.log("INPUT: ", inputnames.join(", "));
            return _.map(inputnames, function(inputname) {
                var inputobj = library.inputs.get(inputname);
                var inputsearchname = inputobj.properties.get('search');
                var search = null;
                if (inputsearchname) {
                    search = buildSearch(inputsearchname);
                }
                return new PanelNode('input', inputname, inputobj, (search ? [search] : []));
            });
        };
        
        var buildSearch = function(searchname, localNameChanges) {
            // console.log("SEARCH: ", searchname);
            localNameChanges = localNameChanges ? localNameChanges : [];
            var parent = [];
            var searchobj = library.searches.get(searchname).clone();
            var searchstring = searchobj.properties.get('search');

            var skip = _.pluck(localNameChanges, 0);
            var inputNames = _.filter(TokenUtils.getTokenNames(searchstring),
                                      function(t) { return (! _.contains(skip, t)); });

            if (searchobj.properties.has('parent')) {
                parent = [buildSearch(searchobj.properties.get('parent'), [])];
            }
            
            // Modify the search string so that panel-level input
            // names are unique.
            
            _.each(localNameChanges, function(transform) {
                var xform  = RegExp('\\$' + transform[0] + '\\$', 'g');
                searchstring = searchstring.replace(xform, '$' + transform[1] + '$');
            });
            
            // TODO: Modify the search string so that the set-level
            // names are also unique.

            // If this search has a parent search, add its domName to the extra field.

            var po = {};
            if (parent.length) {
                po = {parentId: parent[0].conf.get('name')};
            }

            searchobj.properties.set('search', searchstring);
            return new PanelNode('search', searchname, searchobj, parent.concat(buildGlobalInputs(inputNames)), po);
        };

        var buildPanelSearch = function(panelObj) {
            // Because these are local to the panel, this method is
            // contained here.  Note that although localinputs arrive
            // as a dictionary, they're returned as an array, which
            // befits the node.children structure.

            if (! panelObj.properties.has('search')) {
                return [null, []];
            }

            if (_.isEmpty(panelObj.properties.get('search'))) {
                return [null, []];
            }

            function buildLocalInputs(localinputs, localname) {
                return _.map(localinputs, function(inputdef, inputname) {
                    return new PanelNode(
                        'localinput', inputname, inputdef,
                        (inputdef.search? [buildSearch(inputdef.search)] : []),
                        {'panel': localname});
                });
            }

            function inputTransformMap(localInputNode) {
                return [localInputNode.name, 
                        [idFix(localInputNode.extra.panel), 
                         idFix(localInputNode.name), 
                         idFix(localInputNode.name)].join('-')];
            }
            
            function rewriteInputNames(transformMap) {
                return function(localInputNode) {
                    _.each(transformMap, function(a) {
                        if (localInputNode.name == a[0]) {
                            localInputNode.name = a[1];
                        }
                    });
                    return localInputNode;
                };
            }

            var localInputs = panelObj.properties.has('inputs') ? JSON.parse(panelObj.properties.get('inputs')) : {};
            var localInputNodes = buildLocalInputs(localInputs, panelObj.properties.get('search'));

            // Because local inputs have names that might collide
            // within the token system, here we remap those names to
            // include the panel name, so that they can be localized
            // to the panel.  Only inputs need to be referred to in
            // this fashion.
            var inputNameRemap = _.map(localInputNodes, inputTransformMap);

            // Build the panel search, including the remapped names.
            var panelSearch = buildSearch(panelObj.properties.get('search'), inputNameRemap);
            
            // Modify the localInputsNode collection to with the rewritten name.
            localInputNodes = _.map(localInputNodes, rewriteInputNames(inputNameRemap));

            return [panelSearch, localInputNodes];
        };

        var buildPanel = function(panelName) {
            // console.log("PANEL: ", panelName);
            // Start by getting the panel representation from .conf
            var panelObj = library.panels.get(panelName);
            var savedsearchconf;

            var panelSearch = buildPanelSearch(panelObj);
            var localInputNodes = panelSearch[1];
            panelSearch = panelSearch[0];

            if ((! panelSearch) && (panelObj.properties.get('savedsearch'))) {
                savedsearchconf = new Backbone.Model({'name': panelObj.properties.get('savedsearch') });
                panelSearch = new PanelNode('savedsearch', panelObj.properties.get('savedsearch'), savedsearchconf, []);
            }

            if (! panelSearch) {
                return null;
            }

            return new PanelNode('panel', panelName, panelObj, localInputNodes.concat([panelSearch]));
        };

        return new PanelNode('page', '', null, _.filter(_.map(panelNames, buildPanel), function(n) { return n !== null; }));
    }

    // DOT: Provides an API for the logical representation of a page: the
    // panels, associated searches and inputs.

    var PageRepresentation = function(library) {
        this.library = library;
        this.panels = new PanelNode('page', '', null, []);
    };

    _.extend(PageRepresentation.prototype, {
        build: function(panelNames) {
            this.panels = panelBuild(panelNames, this.library);
        },

        visit: function() { 
            return this.panels.visit.apply(this.panels, arguments); 
        },

        getAllForType: function() { 
            return this.panels.getAllForType.apply(this.panels, arguments); 
        },

        getForType: function() { 
            return this.panels.getForType.apply(this.panels, arguments); 
        },

        getAllByType: function() {
            var cataloger = new CatalogChildren();
            this.visit(cataloger);
            return cataloger.found();
        },

        getPanelNamed: function(panelName) {
            var panelFinder = new NodeFilter(function(obj) {
                return ((obj.type === 'panel') && (obj.name == panelName));
            });
            this.visit(panelFinder);
            panel = panelFinder.found();
            if (panel.length === 0) {
                return null;
            }
            return panel[0];
        },

        getSearchesForTimepicker: function() {
            var findTimepickers = new NodeFilter(function(obj) {
                return ((obj.type === 'search') && (obj.conf.properties.get('use_timepicker') === "1"));
            });
            this.visit(findTimepickers);
            return findTimepickers.found();
        },

        getCustomVisualizations: function() {
            var findCustomVisualizations = new NodeFilter(function (obj) {
                return (obj.conf && 
                        obj.conf.hasOwnProperty('properties') && 
                        obj.conf.properties.has('viewpath') && 
                        obj.conf.properties.get('viewpath'));
            });
            this.visit(findCustomVisualizations);
            return _.uniq(_.map(findCustomVisualizations.found(), 
                         function(cv) { return cv.conf.properties.get('viewpath'); }));
        }
    });

    return PageRepresentation;
});
