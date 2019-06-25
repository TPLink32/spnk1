/*
 * This file contains helper methods that could be used in the app setup pages
 */

define(['jquery', 'underscore', 'splunkjs/mvc', 'splunkjs/splunk'], function($, _, mvc, splunkSdk) {
    var SetupHelpers = {
        checkVersionMatch: function(versionToCheck, versionToMatch) {
            var versionToCheckParts = versionToCheck.split('.');
            var versionToMatchParts = versionToMatch.split('.');
            
            var lengthToCheck = Math.min(versionToCheckParts.length, versionToMatchParts.length);
            if (lengthToCheck < 1) {
                return false;
            }
            
            for (var index = 0; index < lengthToCheck; index++) {
                if (versionToCheckParts[index] < versionToMatchParts[index]) {
                    return false;
                } else if (versionToCheckParts[index] > versionToMatchParts[index]) {
                    return true;
                } // else if equal, we need to check next level
            }
            
            return true;
        },
        
        isAppSetupRequired: function(appId, resultsCallback) {
            // Check if app has either been marked as configured or its last
            // build when the nav was revved up is current build. If either app
            // has not been marked configured or if the last nav rev build is older,
            // indicating the app has been upgraded - that is the necessary condition
            // indicating that first time setup has not been completed.
            var splunkService = mvc.createService();
            var appNamespace = {
                owner: 'admin', // only admin can make the kind of calls made here
                app: appId,
                sharing: 'app'
            };
            
            splunkService.get(
                'apps/local/' + appId,
                null,
                function(error, appInfo) {
                    if (_.isUndefined(error) || _.isNull(error)) {
                        var appBuild = appInfo.data.entry[0].content.build;
                        var appVersion = appInfo.data.entry[0].content.version;
                        
                        if (!appInfo.data.entry[0].content.configured) {
                            // App has not been marked as configured
                            resultsCallback(true, appBuild, appVersion);
                        } else {
                            var confs = splunkService.configurations(
                                appNamespace
                                );
                                
                            if (!_.isUndefined(confs)) {
                                var msftAppConfFile = confs.instantiateEntity({
                                    name: 'splunk_msftapp',
                                    acl: appNamespace
                                });
                                
                                if (!_.isUndefined(msftAppConfFile)) {
                                    var settingsStanza = msftAppConfFile.instantiateEntity({
                                        name: 'settings',
                                        acl: appNamespace
                                    });
                                    
                                    if (!_.isUndefined(settingsStanza)) {
                                        settingsStanza.fetch(function(error, stanza) {
                                            var lastNavRev = stanza.properties()['last_nav_rev']; 
                                            
                                            if (!_.isUndefined(lastNavRev) &&
                                                Number(lastNavRev) < appInfo.data.entry[0].content.build) {
                                                // App seems to have been upgraded since
                                                // current build > last nav rev
                                                resultsCallback(true, appBuild, appVersion);
                                            } else {
                                                resultsCallback(false, appBuild, appVersion);
                                            }
                                        });
                                    } else {
                                        // Cannot determine, report as first time setup
                                        resultsCallback(true, appBuild, appVersion);
                                    }
                                } else {
                                    // Cannot determine, report as first time setup
                                    resultsCallback(true, appBuild, appVersion);
                                }
                            } else {
                                // Cannot determine, report as first time setup
                                resultsCallback(true, appBuild, appVersion);
                            }
                        }
                    } else {
                        // Cannot determine, report as first time setup
                        resultsCallback(true, appBuild, appVersion);
                    }
                });
        },
        
        readSaLdapSearchConfiguration: function(resultsCallback) {
            var splunkService = mvc.createService();
                       
            // Opened bug for developer platform - DVPL-5802 since default
            // stanza needs special handling as below
            var defaultConf = new splunkSdk.Service.Endpoint(splunkService, "properties/ldap/default");
            var ldapStanzas = [];
            
            defaultConf.get(undefined, {}, function (err, response) {
                if ((_.isUndefined(err) || _.isNull(err)) &&
                    _.isArray(response.data.entry) && response.data.entry.length > 0) {
                    defaultStanza = {name: 'default', content: {}};
                    _.each(response.data.entry, function(setting, index) {
                        defaultStanza.content[setting.name] = setting.content;
                    });
                    
                    ldapStanzas = [defaultStanza];
                }
                
                var appNamespace = {
                    owner: 'admin', // only admin can make the kind of calls made here
                    app: 'SA-ldapsearch',
                    sharing: 'app'
                };
                    
                var confs = splunkService.configurations(appNamespace);
                
                if (!_.isUndefined(confs)) {
                    var ldapConfFile = confs.instantiateEntity({
                        name: 'ldap',
                        acl: appNamespace
                    });
                                        
                    if (!_.isUndefined(ldapConfFile)) {
                        ldapConfFile.fetch({}, function(error, confContent) {
                            var confStanzas = confContent.properties().entry;
                            
                            resultsCallback(true, ldapStanzas.concat(confStanzas));
                        });
                    } else {
                        resultsCallback(!_.isNull(defaultStanza), ldapStanzas);
                    }
                } else {
                    resultsCallback(!_.isNull(defaultStanza), ldapStanzas);
                }
            });
        },
        
        // This function assumes that ldapsearch is installed. 
        isSaLdapSearchConfigured: function(resultsCallback) {
            var that = this;
            dfd = $.Deferred();

            var splunkService = mvc.createService();
            var apps = splunkService.apps();
            apps.fetch({}, function(err, response){
                var ldapInfo = _.where(response.list(), {'name': 'SA-ldapsearch'})[0];
                var ldapProperties = ldapInfo.properties();
                
                // If ldapsearch is disabled, send back false
                if (ldapProperties.disabled) {
                    resultsCallback(false);
                }
                else {
                    // Check if SA-LdapSearch has been configured by looking for at least
                    // one stanza in ldap.conf with minimum required settings      
                    that.readSaLdapSearchConfiguration(function(configFound, stanzas) {
                        var isConfigured = false;
                        
                        var isValidSetting = function(setting) {
                            if (!_.isUndefined(setting) &&
                                !_.isNull(setting) &&
                                setting.length > 0) {
                                return true;
                            }
                                
                            return false;
                        };
                        
                        if (configFound && stanzas.length > 0) {
                            _.each(stanzas, function(stanza, index) {
                                if (isValidSetting(stanza.content['server']) &&
                                    isValidSetting(stanza.content['basedn'])) {
                                    isConfigured = true;
                                }
                            });
                        }
                        
                        resultsCallback(isConfigured);
                    });
                }
            });      
        }
    };
        
    return SetupHelpers;
});