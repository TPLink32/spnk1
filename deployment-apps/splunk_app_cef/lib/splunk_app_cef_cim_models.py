'''
Copyright (C) 2005 - 2014 Splunk Inc. All Rights Reserved.
'''
import json
from splunk import AuthenticationFailed
from splunk.models.base import SplunkAppObjModel
from splunk.models.field import Field

class DataModels(SplunkAppObjModel):
    '''Class for data model json'''

    resource    = '/data/models'
    
    acl         = Field(api_name="eai:acl")
    data        = Field(api_name="eai:data")
    baseObjects = ['BaseEvent', 'BaseSearch', 'BaseTransaction']
    ## per SOLNESS-5244: this list should only include fields avail to
    ## both | datamodel and | tstats with the exception of _raw    
    baseEventAttributes = ['_time', '_raw', 'source', 'sourcetype', 'host']

    ## This method will remove the baseObject from a lineage string/list
    ## This method returns a string
    @staticmethod
    def stripBaseObject(lineage, outputMode='basestring'):
        if len(lineage)>0:
            if isinstance(lineage, basestring):
                lineage = lineage.split('.')
            
            if lineage[0] in DataModels.baseObjects:
                lineage = lineage[1:len(lineage)]

            if outputMode=="list":
                return lineage
            else:
                return '.'.join(lineage)

        return ''

    ## This method returns the lineage of an object as a string
    ## If includeBaseObject=True we include the baseObject
    @staticmethod
    def getObjectLineage(objectName, modelJson, includeBaseObject=False):
        parents = {obj['objectName']: obj['parentName'] for obj in modelJson['objects']}
        lineage = []
        tmp = objectName
    
        if tmp in parents:
            while tmp in parents:
                lineage.append(tmp)
                tmp = parents[tmp]
            if includeBaseObject:
                lineage.append(tmp)    
            lineage.reverse()
            return '.'.join(lineage)
        else:
            return ''

    ## This method returns a list of data models
    @staticmethod
    def getDatamodelList(sessionKey, namespace=None):
        if not sessionKey:
            raise AuthenticationFailed
        
        if namespace is not None:
            return [model.name for model in DataModels.all(sessionKey=sessionKey) if (model.acl['app']==namespace or model.acl['sharing'] == 'global')]
        else:
            return [model.name for model in DataModels.all(sessionKey=sessionKey)]

    ## This method returns a list of objects for a particular datamodel
    @staticmethod
    def getDatamodelObjectList(datamodel, sessionKey, baseEventOnly=False):
        if not sessionKey:
            raise AuthenticationFailed
        
        objects = []
        
        ## get the model
        model_id = DataModels.build_id(datamodel, None, None)
        model = DataModels.get(id=model_id, sessionKey=sessionKey)
        
        ## load the json
        modelJson = json.loads(model.data)
        
        if modelJson.get('objects', False):
            for object in modelJson['objects']:
                if object.get('objectName', False):
                    objectName = object['objectName']
                    
                    if baseEventOnly:
                        objectLineage = DataModels.getObjectLineage(objectName, modelJson, includeBaseObject=True)
                        if objectLineage.startswith('BaseEvent'):
                            objects.append(objectName)
                    
                    else:    
                        objects.append(objectName)

        return objects
    
    ## This method returns a list of object specific attributes
    ## This method does NOT return attributes from it's parent(s)
    @staticmethod
    def getObjectAttributes(objectName, modelJson):
        attributes = []
        
        for obj in modelJson['objects']:
            if obj.get('objectName', None) == objectName:
                for field in obj.get('fields', []):
                    attributes.append(field.get('fieldName', []))
                for fields in [calc.get('outputFields') for calc in obj.get('calculations', {})]:
                    attributes.extend([field.get('fieldName', []) for field in fields ])
        
        return attributes
    
    ## This method returns a list of all available object attributes
    ## This method recurses through the objects parents (including the baseObject)
    ## This method returns None if we could not get a proper lineage
    ## Otherwise this method returns a list
    @staticmethod
    def getAvailableFields(objectName, modelJson):
        ## 0.  initialize availableFields list
        availableFields = []
        
        ## 1. retrieve lineage
        lineage = DataModels.getObjectLineage(objectName, modelJson=modelJson, includeBaseObject=True)
        
        ## 2. length should be a non-zero lenght string
        if len(lineage)>0:
            ## string to list
            lineage = lineage.split('.')
            
            if lineage[0]=='BaseEvent':
                availableFields.extend(DataModels.baseEventAttributes)

            ## discard BaseObject
            lineage = DataModels.stripBaseObject(lineage, outputMode="list")

            ## iterate through lineage
            ## get attributes for each object
            for x in range(0,len(lineage)):
                ## create lineage_part
                lineage_part = lineage[x]
                ## get attribute lineage
                ## note the x+1 here which does not overflow
                ## >>> mylist = ['a', 'b', 'c', 'd', 'e']
                ## >>> '.'.join(mylist[:5])
                ## >>> 'a.b.c.d.e'
                attributeLineage = '.'.join(lineage[0:x+1])
                 
                ## get attributes for this object
                attributes = DataModels.getObjectAttributes(lineage_part,modelJson)

                ## add each attribute w/ it's lineage to the list of avail fields
                for attribute in attributes:
                    availableFields.append('%s.%s' % (attributeLineage,attribute))
            
            return availableFields
                            
        else:
            return None
