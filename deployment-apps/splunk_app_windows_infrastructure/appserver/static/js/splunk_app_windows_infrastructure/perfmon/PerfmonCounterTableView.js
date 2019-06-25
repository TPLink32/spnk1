define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var Backbone = require('backbone');
    var SearchManager = require('splunkjs/mvc/searchmanager');

    require('css!splunk_app_windows_infrastructure/perfmon/PerfmonCounterTableView.css');

    var tableViewTemplate = '\
    <div class="splunk-perfmon-counter-table-view"> \
        <table class="table">\
            <thead>\
                <tr>\
                    <th>\
                        Visible\
                    </th>\
                    <th>\
                        Color\
                    </th>\
                    <th class="compare-col">\
                        Compare\
                    </th>\
                    <th class="average-col"">\
                        Average\
                    </th>\
                    <th>\
                        Counter\
                    </th>\
                    <th>\
                        Object\
                    </th>\
                    <th>\
                        Instance\
                    </th>\
                    <th>\
                        Host\
                    </th>\
                </tr>\
            </thead>\
            <tbody id="table-body">\
            </tbody>\
        </table>\
    </div>';

    var rowTemplate = '\
    <tr class="splunk-perfmon-data-row">\
        <td>\
            <div class="perfmon-visible-button <%= visicon %>"></div>\
        </td>\
        <td class="perfmon-table-color-cell">\
            <svg height="22" width="75">\
                <line x1="0" y1="11" x2="73" y2="11" style="stroke:<%= color %>;stroke-width:2" />\
            </svg>\
        </td>\
        <td class="perfmon-table-compare-cell compare-col">\
            <svg height="22" width="75">\
                <line x1="0" y1="11" x2="73" y2="11" stroke-dasharray="6, 3" style="stroke:<%= color %>;stroke-width:2"/>\
            </svg>\
        </td>\
        <td class="perfmon-table-average-cell average-col">\
            <svg height="22" width="75">\
                <line x1="0" y1="11" x2="73" y2="11" stroke-dasharray="2, 4" style="stroke:<%= color %>;stroke-width:2"/>\
            </svg>\
        </td>\
        <td class="perfmon-table-counter-cell">\
            <%= counter %>\
        </td>\
        <td class="perfmon-table-object-cell">\
            <%= object %>\
        </td>\
        <td class="perfmon-table-instance-cell">\
            <%= instance %>\
        </td>\
        <td class="perfmon-table-host-cell">\
            <%= host %>\
        </td>\
    </tr>';

    var instructionsTemplate = '\
    <tr id="instructions">\
        <td>Add counters to view timelines</td>\
        <td></td>\
        <td></td>\
        <td></td>\
        <td></td>\
        <td></td>\
    </tr>';

    var PerfmonCounterTableView = Backbone.View.extend({

        initialize: function(options){
            Backbone.View.prototype.initialize.apply(this, arguments);

            this.activeCountersCollection = options.activeCountersCollection;

            this.showCompare = options.showCompare;
            this.showAverage = options.showAverage;
        },
        
        render: function(){
            var that = this;
            this.$el.html('');
            this.$el.append($(_.template(tableViewTemplate, {})));

            var tableBody = $('#table-body', this.$el);
            tableBody.empty();
            if(this.activeCountersCollection.length < 1) {
                tableBody.append(instructionsTemplate);
            }
            else {
                this.activeCountersCollection.each(function(counterModel){
                    tableBody.append(
                        _.template(
                            rowTemplate, 
                            {
                                host: counterModel.get('host'),
                                color: counterModel.get('color'),
                                object: counterModel.get('object'),
                                counter: counterModel.get('counter'),
                                instance: counterModel.get('instance'),
                                visicon: counterModel.get('visible') ? 'icon-visible' : 'icon-hidden'
                            }
                        )
                    );
                });
                $('.splunk-perfmon-data-row .perfmon-visible-button')
                    .on('click', _.bind(that._visibleCheckBoxClick, that));

                $('.splunk-perfmon-data-row')
                    .on('click', _.bind(that._rowClick, that));
            }
            $('.compare-col').css('display', this.showCompare ? '' : 'none');
            $('.average-col').css('display', this.showAverage ? '' : 'none');
            return this;
        },

        getSelectedRowIds: function(){
            var selectedRows = this.$el.find('tr.selected');
            return _.map(selectedRows, function(row){
                return this._getCounterIdFromRow(row);
            }, this);
        },

        _rowClick: function(e){
            $(e.target).closest('tr').toggleClass('selected');
            this.trigger('change:selection', this.$el.find('tr.selected'));         
        },

        _visibleCheckBoxClick: function(e){
            var counterId = this._getCounterIdFromRow($(e.target).closest('tr'));
            e.stopPropagation();
            
            this.trigger('click:visible', counterId);
        },

        // counterId is the same here as everywhere:
        //     - host + object + counter + instance
        // This function just extracts it from the table.
        // I'm abstracting it cause its nasty jquerying and 
        // if the table changes, this needs to change.
        _getCounterIdFromRow: function(row){
            row = $(row);
            return row.find('.perfmon-table-host-cell').text().trim()
                + row.find('.perfmon-table-object-cell').text().trim()
                + row.find('.perfmon-table-counter-cell').text().trim()
                + row.find('.perfmon-table-instance-cell').text().trim()
        },

        setShowCompare: function(bool){
            this.showCompare = bool;
        },

        setShowAverage: function(bool){
            this.showAverage = bool;
        }

    });
    
    return PerfmonCounterTableView;

});