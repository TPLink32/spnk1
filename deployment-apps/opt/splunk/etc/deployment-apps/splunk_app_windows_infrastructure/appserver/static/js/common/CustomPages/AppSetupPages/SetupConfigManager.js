/*
 * This file implements a generic manager for setup config for an app. 
 */

define([
        'jquery',
        'underscore'
        ],
        function(
            $,
            _
           )
{   
    var SetupConfigManager = {
        /* 
         * builds config for app using appSetupConfig with following info:
         *  appInfo: basic info about app with info like name of app
         *  configurableFeatures: array of arrays containing features that
         *      are configurable
         *  lookupMigrators: array of arrays containing lookup migrators
         *  lookupBuilders: array of arrays containing lookup builders
         */
        build: function(appSetupConfig) {
            this._appInfo = appSetupConfig['appInfo'];
            if (_.isUndefined(this._appInfo) || _.isNull(this._appInfo)) {
                throw('Invalid app info passed in to setup config manager');
            }
            
            this._configurableFeatures = this.unifyLists(
                appSetupConfig['configurableFeatures'],
                'configurable features lists'
                );
            
            this._lookupMigrators = this.unifyLists(
                appSetupConfig['lookupMigrators'],
                'lookup migrators lists'
                );
            
            this._lookupBuilders = this.unifyLists(
                appSetupConfig['lookupBuilders'],
                'lookup builders lists'
                );
        },
        
        unifyLists: function(lists, listsLabel) {
            if (_.isUndefined(lists) ||
                _.isNull(lists) ||
                !_.isArray(lists)) {
                throw('Invalid ' + listsLabel + ' passed in to setup config manager');
            }
            
            if (lists.length < 1) {
                console.log('Empty ' + listsLabel + ' passed in to setup config manager');
            } else {
                var unifiedList = _.reduce(
                    lists,
                    function(listItem1, listItem2) {
                        return listItem1.concat(listItem2);
                    }
                    );
                
                return unifiedList;
            }
            
            return null;
        },
        
        getAppName: function() {
            return this._appInfo['appName'];
        },
        
        getAppRestId: function() {
            return this._appInfo['appRestId'];
        },
        
        getConfigurableFeatures: function() {
            return this._configurableFeatures;
        },
        
        getLookupBuilders: function() {
            return this._lookupBuilders;
        },
        
        getLookupMigrators: function() {
            return this._lookupMigrators;
        }
    }
    
    return SetupConfigManager;
});