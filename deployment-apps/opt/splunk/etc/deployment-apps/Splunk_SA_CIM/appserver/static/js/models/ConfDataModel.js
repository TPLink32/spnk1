'use strict';

define(['jquery', 'backbone', 'underscore', 'splunk.util', 'models/SplunkDBase'], function ($, Backbone, _, splunkUtils, SplunkDBaseModel) {
    return SplunkDBaseModel.extend({
        // conf-datamodels usage intentional per SPL-138156
        // conf-datamodels write requires admin_all_objects
        urlRoot: 'configs/conf-datamodels',
        initialize: function initialize() {
            SplunkDBaseModel.prototype.initialize.apply(this, arguments);
        }
    });
});
