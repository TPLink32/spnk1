/*
 * Implementation for a list picker view with a left hand side list of 
 * items and a right hand side list of items. It is up to the  consumer
 * to decide which side is populated and selected.
 */

requirejs.config({
    enforceDefine: false,
    paths: {
        'text': './contrib/text',
        'css': 'splunkjs/contrib/require-css/css'
    }
});

define([
        'jquery',
        'underscore',
        'backbone',
        'common/customvisualizations/listpickercontrol/listitemmodel',
        'common/customvisualizations/listpickercontrol/listitemcollection',
        'text!common/customvisualizations/listpickercontrol/listpickercontrol.html',
        'css!common/customvisualizations/listpickercontrol/listpickercontrol.css'
        ],
        function(
            $,
            _,
            Backbone,
            ListItemModel,
            ListItemCollection,
            ControlMarkup,
            CSS
            )
{   
    var listPickerView = Backbone.View.extend({
        leftSideItemsColl: null,
        
        rightSideItemsColl: null,
        
        elSel: null,
        
        /*
         * @param {string} options.elSel - selector string to add the control to
         * @param {Object} options.leftSideItemsColl -  left side items collection
         *                                              must be of type ListItemCollection
         * @param {Object} options.rightSideItemsColl - right side items collection
         *                                              must be of type ListItemCollection
         * @param {string} options.selectableItemsSel - selector to use for item selection
         *                                              instead of the default lis in the list.
         *                                              Use for cases when list contains items that
         *                                              are not meant to be selectable (as in a hierarchy)
         * @param {function} options.customMoveFuntion - a function to move items between columns. Use
         *                                               when transformation needs to be done between columns.
         *                                               Function signature is: (sourceCol, destCol, $selectedItems)
         * @param {bool} options.showColumnCounts - specifies whether to display item counts for each column
         */
        initialize: function(options) {
            this.elSel = options.elSel;
            this.leftSideItemsColl = options.leftSideItemsColl;
            this.rightSideItemsColl = options.rightSideItemsColl;
            this.selectableItemsSel = options.selectableItemsSel;
            this.moveItemsFunction = options.customMoveFunction || this.moveSelectedItems;
            this.showColumnCounts = !_.isUndefined(options.showColumnCounts) ? options.showColumnCounts : true;
        },
        
        render: function() {
            var that = this;
            
            $(that.elSel).html(ControlMarkup);
            
            that.populateFromCollection(this.leftSideItemsColl, '#left-items');
            that.populateFromCollection(this.rightSideItemsColl, '#right-items');
            
            this.listenTo(this.leftSideItemsColl, "add", function(itemModel) {
                this.addItemToList(itemModel, '#left-items');
            });
            this.listenTo(this.leftSideItemsColl, "remove", function(itemModel) {
                $('#left-items #' + itemModel.get('itemId')).remove();
            });
            this.listenTo(this.leftSideItemsColl, "reset", function() {
                $('#left-items').empty();
            });
            this.leftSideItemsColl.on('change', _.bind(this._itemChanged, this));
            
            this.listenTo(this.rightSideItemsColl, "add", function(itemModel) {
                this.addItemToList(itemModel, '#right-items');
            });
            this.listenTo(this.rightSideItemsColl, "remove", function(itemModel) {
                $('#right-items #' + itemModel.get('itemId')).remove();
            });
            this.listenTo(this.rightSideItemsColl, "reset", function() {
                $('#right-items').empty();
            });
            this.rightSideItemsColl.on('change', _.bind(this._itemChanged, this));
            
            $('#select-item').on('click', function() {
                that.moveItems(true);
            });
            
            $('#unselect-item').on('click', function() {
                that.moveItems(false); 
            });

            $('.list-picker-control-list-count-cell').css('display', this.showColumnCounts ? 'inline-block' : 'none' );
        },
        
        // When adding more than one item at a time, we do not make 
        // use of the single-item addItemToList. This is to avoid
        // calling $.append many times, which can be a perf problem 
        populateFromCollection: function(collection, populateToSel) {
            var that = this;
            
            var listToPopulate = $(populateToSel);
            listToPopulate.empty();
            var itemStrings = [];
            collection.each(function(itemModel) {
                var itemId = itemModel.get('itemId');
                var itemHtml = itemModel.get('itemHtml');

                itemStrings.push('<li id="' + itemId + '">' + itemHtml + '</li>');
            });

            listToPopulate.append(itemStrings.join(' '));

            this._addItemClickHandlers(listToPopulate, 'li');

            that.updateItemCounts();
        },

        _addItemClickHandlers: function($container, childSel){
            var that = this;

            var $items = null;
            if(that.selectableItemsSel){
                $items = $container.find(that.selectableItemsSel);
            }
            else{
                $items = childSel ? $container.find(childSel) : $container;
            }

            $items.click(function (e){
                that.markAsChosenInUi(this);
            });
        },
        
        addItemToList: function(itemModel, listSel) {
            var that = this;
            var itemId = itemModel.get('itemId');
            var itemHtml = itemModel.get('itemHtml');

            $(listSel).append('<li id="' + itemId + '"></li>');
            
            var itemSel = listSel + ' > #' + itemId;
            $(itemSel).html(itemHtml);
            
            this._addItemClickHandlers($(itemSel));
        },

        markAsChosenInUi: function(element) {
            if ($(element).hasClass('list-picker-control-chosen-item') === true) {
                $(element).removeClass('list-picker-control-chosen-item');
            } else {
                $(element).addClass('list-picker-control-chosen-item');
            }
        },
        
        moveItems: function(isMoveToSelected) {
            var sourceCol = this.leftSideItemsColl;
            var destCol = this.rightSideItemsColl;
            
            if (isMoveToSelected) {
                sourceCol = this.rightSideItemsColl;
                destCol = this.leftSideItemsColl;
            }
            
            this.moveItemsFunction(sourceCol, destCol, $('.list-picker-control-chosen-item'));
            
            this.updateItemCounts();
        },

        moveSelectedItems: function(sourceCol, destCol, $selectedItems){
            var selectedItemIds = $selectedItems.map(function(){ 
                return $(this).attr('id');
            });
            itemsToMove = sourceCol.filter(function(li){
                return _.contains(selectedItemIds, li.get('itemId'));
            });
            
            _.each(itemsToMove, function(itemModel) {
                sourceCol.remove(itemModel);
                destCol.add(itemModel);
            });
        },
        
        updateItemCounts: function() {
            $('#left-count').text(this.leftSideItemsColl.length.toString());
            $('#right-count').text(this.rightSideItemsColl.length.toString());
        },

        _itemChanged: function(item) {
            var that = this;
            var itemId = item.get('itemId');
            var itemHtml = item.get('itemHtml');
            $('#' + itemId).html(itemHtml);

            this._addItemClickHandlers($('#' + itemId));
        }
    });
    
    return listPickerView;
});