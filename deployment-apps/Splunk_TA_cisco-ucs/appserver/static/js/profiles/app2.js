var config = {
    baseUrl: $C.MRSPARKLE_ROOT_PATH + "/" + $C.LOCALE + "/static/js",
    //wrapShim: true,
    shim: {
        bootstrap: {
            deps: ['jquery']
        },
        'bootstrap_table': {
            deps: ['jquery']
        },
        'select2': {
            deps: ['jquery']
        },
        'bootstrapValidator': {
            deps: ['jquery']
        }
    },
    paths: {
        'app': '../app/Splunk_TA_cisco-ucs/js',
        'lib': '../app/Splunk_TA_cisco-ucs/js/lib',
        'coreStatic': '../../static/js',
        'bootstrap': '../app/Splunk_TA_cisco-ucs/bootstrap/js/bootstrap.min',
        'bootstrap_table': '../app/Splunk_TA_cisco-ucs/bootstrap-table/bootstrap-table.min',
        'select2': "../app/Splunk_TA_cisco-ucs/js/lib/select2-3.5.2/select2.min",
        'bootstrapValidator': '../app/Splunk_TA_cisco-ucs/jqBootstrapValidation/jqBootstrapValidation'
    },
    enforceDefine: false
};

require.config(config);
