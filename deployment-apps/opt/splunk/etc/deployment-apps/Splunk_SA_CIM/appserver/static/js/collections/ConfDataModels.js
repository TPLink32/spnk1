'use strict';

define(['jquery', 'backbone', 'underscore', 'collections/SplunkDsBase', '../models/ConfDataModel'], function ($, Backbone, _, SplunkDBaseCollection, ConfDataModel) {
    return SplunkDBaseCollection.extend({
        // conf-datamodels usage intentional per SPL-138156
        // conf-datamodels write requires admin_all_objects
        url: 'configs/conf-datamodels',
        model: ConfDataModel,
        initialize: function initialize() {
            SplunkDBaseCollection.prototype.initialize.apply(this, arguments);
        }
    });
});
