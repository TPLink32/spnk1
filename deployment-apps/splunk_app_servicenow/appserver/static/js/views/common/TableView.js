/**
 * Created by michael on 6/19/15.
 */


define([
    'underscore',
    'backbone',
    'views/Base'
], function (_, Backbone, BaseView) {

    var TableView = BaseView.extend({
        /**
         * @param {Object} options {
             *     headers: [<string>],  header names, string array
             *     keyName: <string>, key column name
             *     dataModel:<Backbone.Model>
             *     {
             *       data: [{
             *          data: []  array of row data,
             *          details: <string> details string,
             *       }],
             *       error: <string>
             *     }
             *     allowExpand: <boolean> whether allow table to expand, defaults to false
             *     allowRemove: <boolean> whether to render a remove column, defaults to false
             *     cellRenderer: {
             *       'header name' : <TableView.Cell> custom cell renderer.
             *     }
             * }
         */
        initialize: function () {
            BaseView.prototype.initialize.apply(this, arguments);
            this.headers = this.options.headers || [];
            this.keyName = this.options.keyName;
            this.dataModel = this.options.dataModel || new Backbone.Model();
            this.allowExpand = this.options.allowExpand || false;
            this.allowRemove = this.options.allowRemove || false;
            this.cellRenderer = this.options.cellRenderer || {};
            this.unit = this.options.unit || [_('Entry').t(), _('Entries').t()];
            this.rowIndex = 0;
            var index = _.indexOf(this.headers, this.keyName);
            // by default the first column is key
            this.keyIndex = index == -1 ? 0 : index;
            this.listenTo(this.dataModel, 'change:data change:error', this.render);
        },
        render: function () {
            this.data = this.dataModel.get('data');
            var template = this.compiledTemplate();
            this.$el.html(template);
            // render caption
            this._renderCaption();
            // render header
            this.children.headerView = new Header({
                headers: this.headers,
                allowExpand: this.allowExpand,
                allowRemove: this.allowRemove
            });
            this.$('thead').append(this.children.headerView.render().$el);
            // render rows
            _.each(this.data, this._renderRow.bind(this));
        },
        spin: function (text) {
            this.$('.spinner-small-gray').show();
            this.$('.app-table-caption').text(text);
        },
        _renderCaption: function () {
            this.$('.spinner-small-gray').hide();
            var len = _.size(this.data);
            var text = len > 1 ? len + " " + this.unit[1] : len + " " + this.unit[0];
            this.$('.app-table-caption').text(text);
        },
        _renderRow: function (rowData) {
            var row = this.children['row' + this.rowIndex++] = new Row({
                el: this.$('tbody'), // render in tbody
                headers: this.headers,
                keyIndex: this.keyIndex,
                rowData: rowData,
                cellRenderer: this.cellRenderer,
                allowExpand: this.options.allowExpand,
                allowRemove: this.options.allowRemove
            })
            this.listenTo(row, 'all', this.trigger);
            row.render();
        },
        template: '\
                <div class="caption">\
                    <div class="spinner-small-gray"></div>\
                    <div class="app-table-caption"></div>\
                </div>\
                <table class="table table-chrome table-striped aws-accounts-table">\
                    <thead></thead>\
                    <tbody></tbody>\
                </table>\
        '
    });

    var Header = BaseView.extend({
        tagName: "tr",
        render: function () {
            var template = this.compiledTemplate({
                headers: this.options.headers,
                allowExpand: this.options.allowExpand,
                allowRemove: this.options.allowRemove
            });
            this.$el.html(template);
            return this;
        },
        template: '\
               <% if (headers && (headers instanceof Array)) { %>\
                    <% if (allowExpand) { %>\
                        <th><i class="icon-info col-info"></i></th>\
                    <% } %>\
                    <% _.each(headers, function(header, i){ %>\
                        <th class="col-<%= header.toLowerCase().replace(/ /g, "-") %>"><%= header %></th>\
                    <% }) %>\
                    <% if (allowRemove) { %>\
                        <th>&nbsp</th>\
                    <% } %>\
                <% } %>\
                '
    });

    var Row = BaseView.extend({
        render: function () {
            var colspan = this.options.allowRemove ? this.options.rowData.data.length + 1 : this.options.rowData.data.length;
            var template = this.compiledTemplate({
                data: this.options.rowData.data,
                details: this.options.rowData.details,
                allowExpand: this.options.allowExpand,
                allowRemove: this.options.allowRemove,
                colspan: colspan
            });
            this.$el.append(template);

            // render cells
            var $row = this.$('.dashboards-table-tablerow');
            _.each(this.options.rowData.data, function (cell, i) {
                // render key cell with KeyCell Renderer
                var CellType = this.options.keyIndex == i ? KeyCell : Cell;
                // use custom cell renderer if specify
                CellType = _.result(this.options.cellRenderer, this.options.headers[i]) || CellType;
                var cell = new CellType({
                    cell: cell,
                    data: this.options.rowData.data,
                    keyIndex: this.options.keyIndex
                });
                // proxy all the events
                this.listenTo(cell, 'all', this.trigger);
                $row.append(cell.render().$el);
            }, this);

            if (this.options.allowExpand) {
                // render action cell
                var cell = new RemoveActionCell({
                    data: this.options.rowData.data,
                    keyIndex: this.options.keyIndex
                });
                // proxy all the events
                this.listenTo(cell, 'all', this.trigger);
                $row.append(cell.render().$el);
            }
            return this;
        },
        events: {
            'click .expands': 'handleRowExpand'
        },
        handleRowExpand: function (e) {
            var target = this.$(e.target);
            var dataRow = target.parent();
            var detailRow = dataRow.next('.more-info');
            if (dataRow.hasClass('expanded')) {
                //already expand, collapse it
                dataRow.removeClass('expanded');
                detailRow.hide();
                //update colspan
                target.attr('rowspan', 1);
            }
            else {
                // expand the next row
                dataRow.addClass('expanded');
                detailRow.show();
                //update colspan
                target.attr('rowspan', 2);
            }
        },
        template: '\
        <tr class="expand dashboards-table-tablerow">\
            <% if (allowExpand) { %>\
                <td class="expands" rowspan="1"><a href="#"><i class="icon-triangle-right-small"></i></a></td>\
            <% } %>\
        </tr>\
        <% if (allowExpand) { %>\
            <tr class="more-info dashboards-table-moreinfo" style="display: none;">\
                <td class="details" colspan="<%= colspan %>">\
                <p><%= details %></p>\
                </td>\
            </tr>\
        <% } %>\
        '
    });

    var Cell = BaseView.extend({
        tagName: 'td',
        initialize: function () {
            BaseView.prototype.initialize.apply(this, arguments);
            this.cell = this.options.cell;
            this.data = this.options.data;
            this.keyIndex = this.options.keyIndex;
        },
        render: function () {
            var template = this.compiledTemplate({
                cell: this.options.cell
            });
            this.$el.html(template);
            return this;
        },
        template: '<%= cell %>'
    });

    var RemoveActionCell = Cell.extend({
        tagName: 'td',
        className: 'remove',
        render: function () {
            var template = this.compiledTemplate();
            this.$el.html(template);
            return this;
        },
        events: {
            'click a': 'remove'
        },
        remove: function (e) {
            var key = this.data[this.keyIndex];
            this.trigger('onKeyRemove', key);
        },
        template: '<a href="#"><i class="row-remove icon-x-circle"></i></a>'
    });

    var KeyCell = Cell.extend({
        tagName: 'td',
        className: 'cell-key',
        render: function () {
            var template = this.compiledTemplate({
                cell: this.options.cell
            });
            this.$el.html(template);
            return this;
        },
        events: {
            'click a': 'handleKeyClick'
        },
        handleKeyClick: function (e) {
            var key = this.data[this.keyIndex];
            this.trigger('onKeyClick', key);
        },
        template: '<a href="#"><%= cell %></a>'
    });

    // expose Cell so that custom cell can extends from it.
    _.extend(TableView, {
        Cell: Cell
    });

    return TableView;
});