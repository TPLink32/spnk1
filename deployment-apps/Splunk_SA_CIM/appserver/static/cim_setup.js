'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/**
 * Copyright (C) 2018 Splunk Inc. All Rights Reserved.
 */

require.config({
    paths: {
        'Macros': '../app/Splunk_SA_CIM/js/collections/Macros',
        'CIMSetupView': '../app/Splunk_SA_CIM/js/views/CIMSetupView'
    }
});

require(['jquery', 'underscore', 'backbone', 'util/splunkd_utils', 'splunkjs/mvc', 'splunkjs/mvc/sharedmodels', 'models/SplunkDBase', 'collections/SplunkDsBase', 'collections/services/data/Indexes', 'collections/services/datamodel/DataModels', 'Macros', '../app/Splunk_SA_CIM/js/collections/ConfDataModels', '../app/Splunk_SA_CIM/js/models/ConfDataModel', '../app/Splunk_SA_CIM/js/collections/Tags', 'CIMSetupView', 'splunk.util', 'bootstrap.tab', 'splunkjs/mvc/simplexml/ready!'], function ($, _, Backbone, splunkd_utils, mvc, SharedModel, SplunkDBase, SplunkDsBase, Indexes, DataModels, Macros, ConfDataModels, ConfDataModel, Tags, CIMSetupView, splunkUtils) {

    function reltime_compare(a, b) {
        // empty string or 0: All time = max integer
        var re = /^-(\d+)(d|m|w|q|y)/,
            order = {
            d: 1,
            w: 7,
            m: 30,
            q: 90,
            y: 365
        },
            am = a.match(re),
            bm = b.match(re),
            ascore = am ? am[1] * order[am[2]] : a === '0' || a.length === 0 ? Number.MAX_SAFE_INTEGER : 0,
            bscore = bm ? bm[1] * order[bm[2]] : b === '0' || b.length === 0 ? Number.MAX_SAFE_INTEGER : 0;
        return a === b ? 0 : ascore - bscore;
    }

    function accel_validation(attrs, options) {
        var re = /^(-\d+(d|days?|mon|months?|y|yrs?|years?|w|weeks?|q|qtrs?|quarters?)|0)$/,
            bools = [1, 0, true, false],
            enabled = Number(attrs.acceleration),
            max_time = Number(attrs['acceleration.max_time'] || 0),
            earliest_time = attrs['acceleration.earliest_time'] || "",
            backfill_time = attrs['acceleration.backfill_time'] || earliest_time,
            max_concurrent = Number(attrs['acceleration.max_concurrent'] || 0),
            errors = {};
        if (bools.indexOf(enabled) == -1) {
            errors.enabled = "Enabled should be boolean";
        }
        if (enabled === 1 || enabled === true) {
            if (earliest_time.length && !earliest_time.match(re)) {
                errors.earliest_time = "Invalid earliest_time";
            }
            if (backfill_time.length && !backfill_time.match(re)) {
                errors.backfill_time = "Invalid backfill_time";
            }
            if (reltime_compare(backfill_time, earliest_time) > 0) {
                errors.backfill_time = "backfill_time should be more recent than earliest_time";
            }
            if (isNaN(max_time) || parseInt(max_time) !== max_time) {
                errors.max_time = "max_time should be an integer";
            }
            if (isNaN(max_concurrent) || parseInt(max_concurrent) !== max_concurrent) {
                errors.max_concurrent = "max_concurrent should be an integer";
            }
            if (bools.indexOf(Number(attrs['acceleration.manual_rebuilds'])) == -1) {
                errors.manual_rebuilds = "manual_rebuilds should be boolean";
            }
        }

        if (!_.isEmpty(errors)) {
            return errors;
        }
    }

    function hasCapability(capability) {
        var promise = $.Deferred();

        // Get all capabilities for the logged in user
        $.ajax({
            url: splunkUtils.make_url('/splunkd/__raw/services/authentication/current-context?output_mode=json'),
            type: 'GET',
            async: true,
            success: function success(result) {
                if (result !== undefined && result.isOk === false) {
                    promise.reject('Context could not be obtained: ' + result.message);
                } else if (result.entry.length != 1) {
                    promise.reject('Context could not be obtained - wrong number of results: ' + result.entry.length);
                } else {
                    var res = false;
                    if ($.inArray(capability, result.entry[0].content.capabilities) >= 0) {
                        res = true;
                    }
                    promise.resolve(res);
                }
            },
            error: function error(jqXHR, textStatus, errorThrown) {
                promise.reject(jqXHR);
            }
        });

        return promise;
    }

    var user = SharedModel.get('user'),
        app = SharedModel.get('app').get('app'),
        viewmodel = new Backbone.Model({
        user: user,
        app: app
    }),
        dmmacros = new Macros(),
        indexes = new Indexes(),
        datamodelConfigs = new ConfDataModels(),
        datamodels = new DataModels(),
        tags = new Tags(),
        tagsArr = [],
        indexesArr = [],
        splunk_apps_url = splunkUtils.make_url('/manager/' + app + '/apps/local'),
        dfd1 = $.Deferred(),
        dfd2 = $.Deferred(),
        dfd3 = $.Deferred(),
        dfd4 = $.Deferred(),
        dfd5 = $.Deferred();

    $.when(
    // CIM-558 - using admin_all_objects over accelerate_datamodel
    hasCapability('admin_all_objects')).then(function (capabilityExists) {
        if (capabilityExists) {
            dmmacros.fetch({
                data: {
                    search: $.param({
                        name: 'cim_*_indexes'
                    }),
                    count: -1
                },
                success: function success(collection, resp, options) {
                    dfd1.resolve();
                },
                error: function error(collection, resp, options) {
                    console.error(resp);
                    dfd1.reject();
                }
            });

            indexes.fetch({
                data: {
                    count: -1
                },
                success: function success(collection, resp, options) {
                    collection.each(function (model) {
                        indexesArr.push(model.entry.get('name'));
                    });
                    dfd2.resolve();
                },
                error: function error(collection, resp, options) {
                    dfd2.reject();
                }
            });

            datamodelConfigs.fetch({
                data: {
                    count: -1
                },
                success: function success(collection, resp, options) {
                    collection.each(function (model) {
                        var acc = model.entry.content;
                        acc.validate = accel_validation;
                    });
                    dfd3.resolve();
                },
                error: function error(collection, resp, options) {
                    dfd3.reject();
                }
            });

            //still need these to init tags
            datamodels.fetch({
                data: {
                    count: -1
                },
                success: function success(collection, resp, options) {
                    dfd4.resolve();
                },
                error: function error(collection, resp, options) {
                    dfd4.reject();
                }
            });

            tags.fetch({
                data: {
                    count: -1
                },
                success: function success(collection, resp, options) {
                    collection.each(function (model) {
                        tagsArr.push(model.entry.get('name'));
                    });
                    dfd5.resolve();
                },
                error: function error(collection, resp, options) {
                    dfd5.reject();
                }
            });

            $.when(dfd1, dfd2, dfd3, dfd4, dfd5).then(function () {
                var accelerations = _.object(datamodelConfigs.map(function (model) {
                    var entry = model.entry;
                    return [entry.get('name'), entry.content.toJSON()];
                }));

                var view = new CIMSetupView({
                    el: $("#cim_setup_container"),
                    model: viewmodel,
                    datamodels: datamodels,
                    datamodelConfigs: datamodelConfigs,
                    dmmacros: dmmacros,
                    tags: tagsArr,
                    indexes: indexesArr
                });

                view.on('save', function (macros) {
                    view.setPrimaryBtn(_('Saving').t(), true);

                    var indexPromises = _.map(macros, function (mainMacro) {
                        var model = dmmacros.find(function (dmMacro) {
                            return dmMacro.entry.get('name') === mainMacro.get('name');
                        });

                        if (model) {
                            var previous = mainMacro.get('indexesInit');
                            var changed = mainMacro.get('indexes');
                            var indexesArray = changed.split(',');

                            if (changed !== previous) {
                                var definition = _.map(indexesArray, function (indexStr) {
                                    return indexStr !== '' ? 'index=' + indexStr : '';
                                }).join(' OR ');

                                mainMacro.set('indexesInit', changed);
                                model.entry.content.set('definition', '(' + definition + ')');
                                return model.save({}, {
                                    success: function success() {
                                        view.showUpdateStatus(mainMacro.get('name'), false);
                                    },
                                    error: function error(model, response, options) {
                                        console.error(response);
                                        view.showUpdateStatus(mainMacro.get('name'), true);
                                    }
                                });
                            } else {
                                return true;
                            }
                        }
                    });

                    var accelPromises = datamodelConfigs.filter(function (model) {
                        var name = model.entry.get('name'),
                            acc = model.entry.content,
                            prev = accelerations[name],
                            errors = acc.validate(acc.attributes);
                        if (errors) {
                            var attrs = _.chain(errors).map(function (val, key) {
                                return [key, prev[key]];
                            }).object().value();
                            acc.set(attrs, {
                                silent: true
                            });
                        }
                        return !_.isEqual(acc.toJSON(), prev);
                    }).map(function (model) {
                        var macroname = 'cim_' + model.entry.get('name') + '_indexes';
                        return model.save({}, {
                            success: function success(m) {
                                view.showUpdateStatus(macroname, false);
                            },
                            error: function error(m, response, options) {
                                console.error(response);
                                view.showUpdateStatus(macroname, true);
                            }
                        });
                    });

                    $.when.apply($, _toConsumableArray(indexPromises).concat(_toConsumableArray(accelPromises))).done(function () {
                        view.setPrimaryBtn(_('Save').t(), false);
                    });
                });

                view.on('cancel', function () {
                    window.location = splunk_apps_url;
                });

                view.render();
            });
        } else {
            $('#cim_setup_container').html(_("You do not have permission to access this page. Please contact your Splunk administrator.").t());
        }
    }, function (failedResp) {
        console.error(failedResp);
    });
});
