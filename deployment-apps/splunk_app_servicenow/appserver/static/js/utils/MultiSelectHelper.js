// This helper improves the multiselectview from Splunk MVC.
//
// Initially the multiselectview has default value '*' (all). If the user
// selects any other value, '*' should be removed and only selected value applied.
// 
// If the user select '*' again, then remove all other values.
define([
    'jquery',
    'underscore',
    'splunkjs/mvc',
    'splunkjs/mvc/multiselectview',
    '../utils/InputUtil',
    "splunkjs/mvc/simplexml/ready!"
], function($, _, mvc, MultiSelectView, InputUtil) {
    'use strict';

    $.each(Object.keys(mvc.Components.attributes), function(index, componentName) {
        var component = mvc.Components.get(componentName);
        if (component instanceof MultiSelectView) {
            component.val = InputUtil.multiSelectVal;
        }
    });
});


