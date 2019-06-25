define(function(require, exports, module) {

    var _ = require('underscore');
    var Messages = require("splunkjs/mvc/messages");
    var console = require('util/console');

    return function(messageName) {
        var info = messageName;
        if (_.isString(messageName)) {
            info = Messages.resolve(messageName);
        }
        
        // For the choice views, we have very limited space to render
        // messages, and so we render them to a specific message container
        // created in _updateView. We also replace the original message with
        // one that is more appropriate for the choice view.
        var message = "";
        var originalMessage = "";
        switch (messageName) {
        case "no-events":
        case "no-results":
        case "no-stats": {
            message = _("Search produced no results.").t();
            originalMessage = "";
            
            // We need to update the view with the empty search results,
            // otherwise we may end up displaying stale data.
            this._updateView(this._viz, []);
            break;
        }
        case "waiting":
        case "waiting-queued":
        case "waiting-preparing": {
            message = _("Populating...").t();
            originalMessage = "";
            break;
        }
        default: {
            if (info.level === "error") {
                message = _("Could not create search.").t();
                originalMessage = info.message || "";
            }
            else {
                message = "";
                originalMessage = "";
            }
            break;
        }
        }
        
        // Put the message as the text, but also put the original message
        // as the tooltip.
        this._$messageEl.text(message);
        this._$messageEl.attr("title", originalMessage);
        try {
            this._$messageEl.tooltip('destroy');
            this._$messageEl.tooltip({animation: false});
        } catch (e) {
            console.log(e);
        }
    }
});
