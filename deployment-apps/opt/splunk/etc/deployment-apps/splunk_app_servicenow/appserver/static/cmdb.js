/**
 * Created by hshen on 9/19/16.
 */
require([
        'jquery',
        'bootstrap.tooltip',
        'splunkjs/mvc/simplexml/ready!'
    ],

    function ($) {

        var TOOLTIP_TEXT = 'Enter the hostname or select one from the list.';

        var label = $('.input-multiselect label')[0];
        label.innerHTML = label.innerHTML + '<a href="#" class="tooltip-link" data-toggle="tooltip" data-placement="top" title="' +
                                            TOOLTIP_TEXT + '"> ?</a>';

        $('.input-multiselect label a').tooltip();

    }

);