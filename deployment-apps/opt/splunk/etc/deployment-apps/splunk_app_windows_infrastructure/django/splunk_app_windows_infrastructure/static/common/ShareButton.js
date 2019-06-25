/*global define */
define(function(require, exports, module) {
    var $ = require('jquery');
    var _ = require('underscore');
    var Backbone = require('backbone');
    
    var shareTemplate = '<div class="modal-dialog"> \
        <div class="modal-content"> \
            <div class="modal-header"> \
                <button type="button" class="close" data-dismiss="modal"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button> \
                <h4 class="modal-title" id="share-modal-title">Share Perfmon Search</h4> \
            </div> \
            <div class="modal-body"> \
                <p>Copy the link to share this page</p> \
                 \
                 <input id="share-modal-text-field" style="width: 90%" type="text"> \
                    \
            </div> \
            <div class="modal-footer"> \
                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button> \
            </div> \
        </div> \
    </div>';

    return Backbone.View.extend({
        id: 'share-modal',
        className: 'modal fade',

        render: function() {
            this.$el.attr('tabindex', '-1')
                .attr('role', 'dialog')
                .attr('aria-labelledby', 'share-modal-title')
                .attr('aria-hidden', 'true')
                .css('display', 'none');
            this.$el.html(shareTemplate);
            this.$el.on('shown.bs.modal', function(){
                this.$('#share-modal-text-field').select();
            });
            return this;
        },

        show: function() {
            this.$('#share-modal-text-field').val(document.URL);
            this.$('#share-modal-link').attr('href', document.URL);
            this.$el.modal('show');
        }
    });
});
