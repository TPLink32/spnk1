/*
 * This file contains wrappers for the state store end points
 */

define(['underscore', 'jquery', 'splunkjs/mvc'],
        function(_, $, mvc) {
    var StateStoreWrapper = {
        _splunkService: null,
        
        _splunkLogger: Splunk.Logger.getLogger('statestorewrapper'),
        
        _stateStoreBaseUrl: 'storage/collections/',

        getAllCollections: function(responseCallback) {
            this.verifySetup();

            this._splunkLogger.info('Attempting to get all KV Store collections.');

            this._splunkService.get(
                this.getCollectionConfigUrl(false, ''),
                null,
                responseCallback
                );
        },

        createCollection: function(collectionName, indexFieldNames, responseCallback) {
            this.verifySetup();
            
            this._splunkLogger.info('Creating KV Store collection named ' + collectionName);

            var that = this;

            // If the collection exists, skip the creation
            this.getAllCollections(function(error, result) {
                if ((_.isUndefined(error) || _.isNull(error)) && !(_.isUndefined(result) || _.isNull(result))) {
                    if (_.some(result.data.entry, function(item) {
                        return item.name == collectionName;
                    })) {
                        that._splunkLogger.info('Collection named '+ collectionName + 'already exists');
                        responseCallback(error, result);
                    } else {
                        params = {};
                        params['name'] = collectionName;
                        for (var index=0; index < indexFieldNames.length; index++)
                        {
                            indexFields = {};
                            indexFields[indexFieldNames[index]] = 1;
                            params['accelerated_fields.' + indexFieldNames[index]] = JSON.stringify(indexFields);
                        }
                        
                        // Create collection with default permissions:
                        //      write access to admin and power user roles only
                        //      read access to all
                        that._splunkService.post(
                            that.getCollectionConfigUrl(true),
                            params,
                            responseCallback
                            );
                    }
                } else {
                    that._splunkLogger.info('Failed to retrieve all collections');
                    responseCallback(error, result);
                }
            });
        },
        
        deleteCollection: function(collectionName, responseCallback) {
            this.verifySetup();
        
            this._splunkLogger.info('Deleting KV Store collection named ' + collectionName);
    
            this._splunkService.del(
                this.getCollectionConfigUrl(false, collectionName),
                null,
                responseCallback
                );
        },
    
        getData: function(collectionName, itemId, responseCallback) {
            this.verifySetup();
            
            this._splunkLogger.info(
                'Getting data from KV Store collection named ' + collectionName
                );
            
            // Get collection with default permissions:
            //      write access to admin and power user roles only
            //      read access to all
            
            this._splunkService.get(
                this.getCollectionDataUrl(false, collectionName, itemId),
                null,
                responseCallback
                );
        },
    
        // setData upserts data - update (overwrite) existing or create new if _key isnt found 
        setData: function(collectionName, jsonBatch, responseCallback) {
            this.verifySetup();
            
            this._splunkLogger.info(
                'Adding data to KV Store collection named ' + collectionName
                );
            
            this._splunkService.request(
                this.getCollectionDataUrl(true, collectionName),
                'POST',
                {},
                {},
                JSON.stringify(jsonBatch),
                {'Content-Type': 'application/json; charset=UTF-8'},
                responseCallback
                );
        },
    
        deleteItem: function(collectionName, itemId, responseCallback) {
            this.verifySetup();
            
            this._splunkLogger.info(
                'Adding data to KV Store collection named ' + collectionName
                );
            
            this._splunkService.del(
                this.getCollectionDataUrl(false, collectionName, itemId),
                null,
                responseCallback
                );
        },
        
        verifySetup: function() {
            if (_.isNull(this._splunkService) || _.isUndefined(this._splunkService))
            {
                // State store configurations and data changes need to be reflected
                // across user namespaces. If this requirement changes, modify this
                // interface to enable that option
                this._splunkService = mvc.createService({owner: 'nobody'});
            }
            
            if (_.isNull(this._splunkService) || _.isUndefined(this._splunkService))
            {
                throw this.stateStoreWrapperException('Could not get Splunk service instance');
            }
        },
        
        stateStoreWrapperException: function(message) {
            this.message = message;
            this.name = 'stateStoreWrapperException';
            
            var error = new Error();
            this.stack = error.stack;
            
            this._splunkLogger.error(
                'stateStoreWrapperException thrown with message: \"' + this.message +
                '\" and stack trace: ' + this.stack
                );
        },
        
        getCollectionConfigUrl: function(isCreate, collectionName) {
            var url = this._stateStoreBaseUrl + 'config/';
            
            if (!isCreate) {
                url += this._encodeForUrl(collectionName);
            }
            
            return url;
        },
        
        getCollectionDataUrl: function(isSave, collectionName, itemId) {   
            var url = this._stateStoreBaseUrl + 'data/' + 
                this._encodeForUrl(collectionName) + '/';
            
            if (isSave)
            {
                url += 'batch_save/';
            } else {
                url += this._encodeForUrl(itemId);
            }
            
            return url;
        },
        
        _encodeForUrl: function(rawString) {
            if (!_.isNull(rawString) && !_.isUndefined(rawString)) {
                // This function is called for portions of the URLs that contain
                // the / character, but not to denote path separation for the URL 
                // To preserve the / charcater, replace with encoding %2F
                return rawString.replace('/', '%2F');
            }
            
            return '';
        }
    };
    
    return StateStoreWrapper;
});