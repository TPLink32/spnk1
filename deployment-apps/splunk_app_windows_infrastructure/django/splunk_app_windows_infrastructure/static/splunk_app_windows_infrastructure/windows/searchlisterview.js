
// TODO this SearchListerView is not generic
// it only shows pairs, which I guess is not bad

define(function(require, exports, module) {
	var mvc = require('splunkjs/mvc');
	var BaseSplunkView = require('splunkjs/mvc/basesplunkview');
	var _ = require('underscore');

	

	// guaranteed by backbone to be called with proper "this" binding
	var onManagerChange = function(managers, manager) {
		// too much boilerplate here
		if (this.manager) {
			this.manager.off(null, null, this);
			this.manager = null
		}
		if (this.resultsModel) {
			this.resultsModel.off(null, null, this);
		}

		if (_.isUndefined(manager)) {
			return;
		}

		this.manager = manager;
		this.resultsModel = this.manager.data(this.settings.get('data'), {
			count: 0
		});
		// end boilerplate

		// TODO bind to changes in seach manager as well for certain errors...

		// for now just proxy to render

		this.resultsModel.on('data', this.render, this);
		manager.on('search:done', function(properties, job) {
			properties = properties || {};
			var content = properties.content || {};
			var resultCount = content.resultCount || 0;

            this.paginator.settings.set({
                itemCount: resultCount
            });
		}, this );


	};

	// It's cumbersome to have to update your paginator in this way
	var onPaginatorChange = function(components, paginator) {
		if (this.paginator) {
            this.paginator.off(null, null, this);
        }

        this.paginator = paginator;

        var updateResultsModel = function(resultsModel, paginator) {
        	var page = paginator.settings.get("page");
        	var count = paginator.settings.get("pageSize");
        	var offset = page * count;
        	resultsModel.set({count: count, offset: offset});
        };

        this.paginator.settings.on(
            "change:page change:pageSize", 
            _.debounce(function() {
	            updateResultsModel(this.resultsModel, this.paginator);
	        }), this);

        this.paginator.settings.set({
            page: 0,
            pageSize: 10,
            itemCount: -1
        });

        updateResultsModel(this.resultsModel, this.paginator);
	};

	var SearchListerView = BaseSplunkView.extend({
		className: 'windows-searchlisterview', // TODO would be nice to have app_name here

		// TODO not exactly sure what values to put here.... Is this the initialization interface?
		options: {
			managerid: null,
			data: 'results'
		},

		// Called once, when this gets created
		initialize: function() {
			this.configure(); // TODO no idea.

			// TODO might need to trigger a render when options are changed, if there are more options.

			this.bindToComponent(this.settings.get('managerid'), onManagerChange, this);
			this.bindToComponent(this.settings.get('paginator'), onPaginatorChange, this);
			
		},

		render: function() {
			this.$el.empty();

			var $ul = $('<ul />');

			if (this.resultsModel && this.resultsModel.hasData()) {
				var data = this.resultsModel.collection();
				data.each( function(model, idx) {
					var result = model.toJSON();
					$ul.append('<li>' + result.key + ': ' + result.value + '</li>')
				});
			}

			this.$el.append($ul);

			return this;
		}

	});

	return SearchListerView;
});