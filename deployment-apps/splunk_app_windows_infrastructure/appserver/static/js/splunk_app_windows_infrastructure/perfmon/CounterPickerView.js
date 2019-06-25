requirejs.config({
    shim: {
        'CollapsibleLists': {
            deps: ['jquery'],
            exports: 'CollapsibleLists'
        }
    }
});

define(function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var Backbone = require('backbone');
    var mvc = require('splunkjs/mvc');
    var DropdownView = require("splunkjs/mvc/dropdownview");
    var SearchManager = require("splunkjs/mvc/searchmanager");
    var Modal = require('views/shared/Modal');
    var ListPickerView = require('common/customvisualizations/listpickercontrol/listpickerview');
    var ListItemModel = require('common/customvisualizations/listpickercontrol/listitemmodel');
    var ListItemCollection = require('common/customvisualizations/listpickercontrol/listitemcollection');
    var CollapsibleLists = require('common/contrib/CollapsibleLists/v1/CollapsibleLists');

    require('css!splunk_app_windows_infrastructure/perfmon/CounterPickerView.css');

    var CounterPickerView = Modal.extend({

        initialize: function(options) {
            Modal.prototype.initialize.apply(this, arguments);

            this.title = 'Select Performance Counters';
            this.hostSearchManager = options.hostSearchManager;
            this.addItemsCallback = options.addItemsCallback;

            this.counterPromise = options.counterPromise;
            this.selectedCountersCollection = new ListItemCollection()
            this.unselectedCountersCollection = new ListItemCollection();

            var that = this;
            this.counterPromise.done(function(availableCounters){
                that.availableCountersList = that._counterArrayToListItems(availableCounters);
                that.unselectedCountersCollection.add(that.availableCountersList);
                CollapsibleLists.applyTo(document.getElementById('left-items'));
            });
        },

        events: $.extend({}, Modal.prototype.events, {
            'click a.modal-btn-primary': function (e) {
                var selectedHost = this.hostsDropdown.val();
                var selectedCounters = this._itemsToCounters(this.selectedCountersCollection);
                this.addItemsCallback(selectedHost, selectedCounters);
                this.hide();
                this._reset();
                e.preventDefault();          
            },
            
            'click a.modal-btn-cancel': function (e) {
                this.hide();
                this._reset();
                e.preventDefault();
            },
            
            'click button.close': function (e) {
                this.hide();
                this._reset();
                e.preventDefault();
            }
        }),

        _reset: function(){
            if(this.counterListPicker) {
                this.counterListPicker.rightSideItemsColl.reset();
            }
        },
        
        render: function(){
            this.$el.html(Modal.TEMPLATE);
            this.$el.addClass(Modal.CLASS_MODAL_WIDE);
            
            this.$(Modal.HEADER_TITLE_SELECTOR).html(this.title);
            
            this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);

            this.$(Modal.BODY_FORM_SELECTOR).append('<h5>Hosts</h5>\
                <div id="hosts-dropdown"></div>'
            );
            this.$(Modal.BODY_FORM_SELECTOR).append('<div id="counter-filters">\
                    <div style="display: inline-block; width: 50%;">\
                        <h5>Available Counters</h5>\
                        <div id="available-filter"></div>\
                    </div>\
                     <div style="display: inline-block;">\
                        <h5>Selected Counters</h5>\
                        <div id="selected-filter"></div>\
                    </div>\
                </div>'
            );
            this.$(Modal.BODY_FORM_SELECTOR).append('<div id="list-view-container"></div>');
            
            this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
            this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_SAVE);

            // We need this to be in the dom to set up the child views
            $('body').append(this.$el);

            this.hostsDropdown = new DropdownView({
                'id': 'hostsDropdown',
                'managerid': this.hostSearchManager.settings.get('id'),
                'labelField': 'Host',
                'valueField': 'Host',
                'selectFirstChoice': true,
                'value': mvc.tokenSafe('$addCounterHost$'),
                'el': $('#hosts-dropdown')
            }).render();

            this.counterListPicker = new ListPickerView({
                elSel: '#list-view-container',
                rightSideItemsColl: this.selectedCountersCollection,
                leftSideItemsColl: this.unselectedCountersCollection,
                selectableItemsSel: '.perfmon-list-instance',
                customMoveFunction: _.bind(this._moveListItems, this),
                showColumnCounts: false
            }); 
            
            this.counterListPicker.render();     

            return this;
        },

        // Takes a folded list with the format below and returns
        // an array of listItems for the listpicker.
        //
        // Names passed to map functions are meaningful (not generic) 
        // here because this is assumed to always take lists of the same format:
        //  
        //  {
        //      objectName: {
        //          counterName: [instanceName, ...],
        //          ...
        //      },
        //      ...
        //  }
        //
        _foldedCounterListToListItems: function(foldedList){
            return _.map(foldedList, function(counterList, objectName){
                // Make Item Html            
                var wrapper = $('<div></div>');
                var objectItem = $('<div class="perfmon-list-object">' + objectName + '</div>');
                var counterListHtml = $('<ul></ul>');
                counterListHtml.append(
                    _.map(counterList, function(instanceArray, counterName){
                        var counterListItem = $('<li class="perfmon-list-counter">' + counterName + '</li>');
                        var instanceListHtml = $('<ul></ul>');
                        instanceListHtml.append(
                            _.map(instanceArray, function(instanceName){
                                return '<li class="perfmon-list-instance">' 
                                    + instanceName 
                                    + '<div class="object-data" style="display:none;">'
                                    + objectName
                                    + '</div>'
                                    + '<div class="counter-data" style="display:none;">'
                                    + counterName
                                    + '</div>'
                                    + '<div class="instance-data" style="display:none;">'
                                    + instanceName
                                    + '</div>'
                                    + '</li>';
                            })
                        )
                        counterListItem.append(instanceListHtml);
                        return counterListItem;
                    })
                );
                objectItem.append(counterListHtml);
                wrapper.append(objectItem);

                // Make Item Data
                var itemData = {};
                itemData[objectName] = counterList;

                return {
                    itemId: _.uniqueId(),
                    itemHtml: wrapper.html(),
                    itemData: itemData
                }
            });

        },

        _counterArrayToListItems : function(counterArray){
            var foldedCounterList = {};
            _.each(counterArray, function(counterObject){ 
                if(!foldedCounterList[counterObject.object]) {
                    foldedCounterList[counterObject.object] = {};
                }
                if(!foldedCounterList[counterObject.object][counterObject.counter]) {
                    foldedCounterList[counterObject.object][counterObject.counter] = [];
                }
                foldedCounterList[counterObject.object][counterObject.counter].push(counterObject.instance);
            });

            return this._foldedCounterListToListItems(foldedCounterList);
        },

        _moveListItems: function(sourceCol, destCol, $selectedItems){
            var that = this;

            function getMatchingTargetObject(objectName, col){
                return destCol.filter(function(destColItem){
                    return _.contains(_.keys(destColItem.get('itemData')), objectName)
                })[0];
            }
            
            _.each($selectedItems, function(selectedItem){
                var $selectedItem = $(selectedItem);
                var objectName = $selectedItem.find('.object-data').text();
                var counterName = $selectedItem.find('.counter-data').text();
                var instanceName = $selectedItem.find('.instance-data').text();

                // If moving from the left, we create items
                if(sourceCol === that.counterListPicker.leftSideItemsColl) {
                    // If the object exists in the destination, add to it
                    matchingTargetObject = getMatchingTargetObject(objectName, destCol);
                    if(matchingTargetObject) {

                        var targetItemData = matchingTargetObject.get('itemData');
                        if(!targetItemData[objectName][counterName]) {
                            targetItemData[objectName][counterName] = [];
                        }
                        targetItemData[objectName][counterName].push(instanceName);
                        targetItemData[objectName][counterName] = _.uniq(targetItemData[objectName][counterName]).sort();

                        var newListItem = that._foldedCounterListToListItems(targetItemData)[0];

                        matchingTargetObject.set('itemData', newListItem.itemData);
                        matchingTargetObject.set('itemHtml', newListItem.itemHtml);

                        matchingTargetObject.collection.trigger('change', matchingTargetObject);
                    }
                    // Object does not exist, create it
                    else {
                        var itemData = {};
                        itemData[objectName] = {};
                        itemData[objectName][counterName] = [instanceName];

                        var newListItem = that._foldedCounterListToListItems(itemData)[0];

                        destCol.add(newListItem);
                    }
                }

                // If moving from the right, we remove items
                if(sourceCol === that.counterListPicker.rightSideItemsColl) {
                    var $sourceParentListItem = $selectedItem.closest('.perfmon-list-object').parent();
                    var sourceObjectId = $sourceParentListItem.attr('id')
                    var sourceObject = sourceCol.get(sourceObjectId);
                    var sourceObjectData = sourceObject.get('itemData');

                    sourceObjectData[objectName][counterName] = _.without(sourceObjectData[objectName][counterName], instanceName);
                    // If there are no instances remove the counter
                    if(sourceObjectData[objectName][counterName].length < 1) {
                        delete sourceObjectData[objectName][counterName];
                    }

                    // If there are no counters, remove the object
                    if(_.keys(sourceObjectData[objectName]).length < 1) {
                        sourceCol.remove(sourceObjectId);
                    }
                    else {
                        var updatedSourceListItem = that._foldedCounterListToListItems(sourceObjectData)[0];
                        sourceObject.set('itemData', updatedSourceListItem.itemData);
                        sourceObject.set('itemHtml', updatedSourceListItem.itemHtml);
                    }
                }
                $selectedItem.removeClass('list-picker-control-chosen-item');
            });
        },

        _itemsToCounters: function(counterCollection){
            var countersArray = [];
            counterCollection.each(function(counterItem){
                var itemData = counterItem.get('itemData');
                var objectName = _.keys(itemData)[0];
                var counterName = _.keys(itemData[objectName])[0];
                _.each(itemData[objectName][counterName], function(instanceName){
                    countersArray.push({
                        object: objectName,
                        counter: counterName,
                        instance: instanceName
                    })
                });
            });
            return countersArray;
        }
    });
    
    return CounterPickerView;

});