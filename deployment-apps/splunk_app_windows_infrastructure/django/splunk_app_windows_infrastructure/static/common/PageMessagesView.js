/* 
 * The PageMessagesView is a wrapper to display errors on a page
 */

define([
        'jquery',
        'underscore',
        'common/Class'
        ],
        function(
            $,
            _,
            Class
            ) {

    var PageMessagesView = function(pageSel) {
        this._pageSel = pageSel; 
        this._messagesPaneSel = this._pageSel + ' #page-messages-view';
    };
    
    var PageMessagesViewClass = Class.makeClass(PageMessagesView);
        
    PageMessagesViewClass.addMessage = function(message, messageType, messageId) {
        if (!$(this._messagesPaneSel).length) {
            $(this._pageSel).prepend(' \
                <div id="page-messages-view"> \
                </div>'
                );
        }
        
        $(this._messagesPaneSel).show();
        
        if (_.isUndefined(messageType) || _.isNull(messageType)) {
            messageType = PageMessagesViewClass.InfoMessageType;
        }
        
        var messageIdPart = !_.isUndefined(messageId) && !_.isNull(messageId) ?
            'id="' + messageId + '"' : '';
        
        $(this._messagesPaneSel).append(' \
            <div class="alert ' + messageType + ' page-message" ' + messageIdPart + 
                ' style="border-color: #a62f2f; border-style: solid; border-width: 1px;"> \
                <i class="icon-alert" style="font-size: 24px; padding-left: 5px"> </i> \
                <p>' + message + '</p> \
            </div>'
            );
        return this;
    };
    
    PageMessagesViewClass.clearMessage = function(messageId) {
        $(this._messagesPaneSel).find('#' + messageId).remove();
        return this;
    };
        
    PageMessagesViewClass.clearAllMessages = function() {
        $(this._messagesPaneSel).hide();
        $(this._messagesPaneSel).empty();
        return this;
    };
    
    PageMessagesViewClass.InfoMessageType = 'alert-info';
    PageMessagesViewClass.WarningMessageType = 'alert-warning';
    PageMessagesViewClass.ErrorMessageType = 'alert-error';
    
    return PageMessagesView;
});
