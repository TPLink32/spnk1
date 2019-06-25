'''
Copyright (C) 2009-2014 Splunk Inc. All Rights Reserved.
'''

import splunk.admin as admin
import splunk.entity as en
import logging
from logging import handlers
import os.path
import datetime
import base64
import sys
import re
import platform
import shutil
from lxml import etree
import os
from stat import *
import splunk

# Object model imports:
from splunk.models.base import SplunkAppObjModel
from splunk.models.field import Field

class Output(SplunkAppObjModel):
    resource = '/admin/conf-outputs'
    defaultGroup = Field(api_name='defaultGroup')
    server = Field(api_name='server')

class ConfigCEFApp(admin.MConfigHandler):
    
    DEFAULT_NAMESPACE ="splunk_app_cef"
    DEFAULT_OWNER = "nobody"

    '''
    Get the default indexers
    '''
    @classmethod
    def getIndexers(cls, sessionKey):
        
        defaultOutput = cls.getDefaultOutputGroup(sessionKey)
        
        # No group is defined
        if defaultOutput is None:
            return ''
        
        # Return the indexers
        if 'server' in defaultOutput:
            return defaultOutput['server']
        else:
            return None
    
    '''
    Get the main output
    '''
    @classmethod
    def getMainOutput(cls, sessionKey):
        
        #output = Output.get( Output.build_id('tcpout', 'system', 'nobody'), sessionKey=sessionKey)
        output = en.getEntity('admin/conf-outputs', 'tcpout', sessionKey=sessionKey)
        
        # Get the default group
        return output
    
    """
    Remove the indexers output group if it exists. Returns false if nothing was needed to be done, true if the operation was necessary and succeeded.
    """
    @classmethod
    def removeDefaultOutputGroup(cls, sessionKey):
        
        output = cls.getMainOutput(sessionKey)
        """
        # Data models sux
        output.defaultGroup = ''
        output.save()
        """
        output['defaultGroup'] = ""
        output.namespace = ConfigCEFApp.DEFAULT_NAMESPACE
        output.owner = ConfigCEFApp.DEFAULT_OWNER
        en.setEntity(output, sessionKey=sessionKey)
        
        # Update tcpout
        cls.setDefaultTcpOutGroup("", sessionKey)
        
        # Remove the default output group
        defaultOutput = cls.getDefaultOutputGroup(sessionKey)
        
        if not defaultOutput:
            return False
        elif not defaultOutput.passive_delete():
            raise Exception("Default output could not be deleted")
        
        return True
    
    '''
    Get the default indexer output group
    '''
    @classmethod
    def getDefaultOutputGroup(cls, sessionKey):
        
        # Get the default group
        output = cls.getMainOutput(sessionKey)
        
        if 'defaultGroup' in output:
            defaultGroup = output['defaultGroup']
        else:
            return None
        
        # No group is defined
        if defaultGroup is None:
            return None
        
        # Get the default group
        #defaultOutput = Output.get(Output.build_id("tcpout:" + defaultGroup, None, None), sessionKey=sessionKey)
        try:
            defaultOutput = en.getEntity('admin/conf-outputs', "tcpout:" + defaultGroup, sessionKey=sessionKey)
        except splunk.ResourceNotFound:
            return None
        
        # Return the indexers
        return defaultOutput
    
    '''
    Parse out the output name from the stanza ("tcpout:indexers" would return "indexers")
    '''
    @classmethod
    def parseOutputName(cls, name):
        
        result = re.match("[^:]+[:]([^:]+)", name)
        
        if result:
            return result.groups(1)[0]
        else:
            return name
    
    '''
    Set the default indexers
    '''
    @classmethod
    def setIndexers(cls, indexers, sessionKey):
        
        # Validate the input
        cls.validateIndexers(indexers)
        
        # Get the default output group in tcpout
        defaultOutput = cls.getDefaultOutputGroup(sessionKey)
        
        # No group is defined, make it
        defaultGroupSet = True
        
        if defaultOutput is None:
            defaultGroupSet = False
            
            # See if the default group already exists
            #defaultOutput = Output.search('name=tcpout:indexCluster"', count_per_req=100, sessionKey=sessionKey)
            try:
                defaultOutput = en.getEntity('admin/conf-outputs', "tcpout:indexCluster", sessionKey=sessionKey)
            except splunk.ResourceNotFound:
                defaultOutput = None
                
            if defaultOutput is not None:
                pass
            
            # Otherwise, make the new group
            else:
                #defaultOutput = Output(ConfigCEFApp.DEFAULT_NAMESPACE, ConfigCEFApp.DEFAULT_OWNER, "tcpout:indexCluster")
                defaultOutput = en.getEntity('admin/conf-outputs', '_new', sessionKey=sessionKey)
                
                defaultOutput.namespace = ConfigCEFApp.DEFAULT_NAMESPACE
                defaultOutput.owner = ConfigCEFApp.DEFAULT_OWNER
                defaultOutput['name'] = "tcpout:indexCluster"
            
        # Update and save the entry
        #defaultOutput.server = indexers
        #defaultOutput.save()
        defaultOutput['server'] = indexers
        defaultOutput.namespace = ConfigCEFApp.DEFAULT_NAMESPACE
        defaultOutput.owner = ConfigCEFApp.DEFAULT_OWNER
        en.setEntity(defaultOutput, sessionKey=sessionKey)
            
        # Set this as the default group
        if not defaultGroupSet:
            cls.setDefaultTcpOutGroup(defaultOutput.name, sessionKey)
        
        # Disable local indexing    
        cls.disableIndexAndForward(sessionKey)
        
    '''
    Disable index and forward
    '''
    @classmethod
    def disableIndexAndForward(cls, sessionKey):
        
        try:
            # Try to get the existing entry
            indexAndForward_entity = en.getEntity('configs/conf-outputs',
                    "indexAndForward",
                    namespace = ConfigCEFApp.DEFAULT_NAMESPACE,
                    owner = ConfigCEFApp.DEFAULT_OWNER,
                    sessionKey = sessionKey )
            
        except splunk.ResourceNotFound:
            
            # Otherwise, create a new one
            indexAndForward_entity = en.getEntity('configs/conf-outputs',
                    "_new",
                    namespace = ConfigCEFApp.DEFAULT_NAMESPACE,
                    owner = ConfigCEFApp.DEFAULT_OWNER,
                    sessionKey = sessionKey )
            
            indexAndForward_entity.namespace = ConfigCEFApp.DEFAULT_NAMESPACE
            indexAndForward_entity.owner = ConfigCEFApp.DEFAULT_OWNER
            indexAndForward_entity['name'] = "indexAndForward"
    
        indexAndForward_entity['index'] = 0
        en.setEntity(indexAndForward_entity, sessionKey=sessionKey)
          
    '''
    Sets the default tcpout group using entities.
    '''
    @classmethod
    def setDefaultTcpOutGroup(cls, groupName, sessionKey):
        
        groupName = cls.parseOutputName(groupName)
        
        tcpout_entity = en.getEntity('configs/conf-outputs',
                "tcpout",
                sessionKey = sessionKey )
    
        tcpout_entity['defaultGroup'] = groupName
        tcpout_entity['indexAndForward'] = 0
        tcpout_entity.namespace = cls.DEFAULT_NAMESPACE
        tcpout_entity.owner = cls.DEFAULT_OWNER
        
        en.setEntity(tcpout_entity, sessionKey=sessionKey)
       
    @classmethod
    def validateIndexers(cls, indexers):
        
        if not indexers:
            raise admin.ArgValidationException("Indexers list cannot be blank")
        
        indexersList = indexers.split(",")
       
        hostRE = re.compile("^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])([:][0-9]+)?$");
        ipRE = re.compile("^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])([:][0-9]+)?$");
       
        for indexer in indexersList:
            if not (hostRE.match(indexer) or ipRE.match(indexer)):
                raise admin.ArgValidationException("Indexer %s is not a valid IP address or domain name" % (indexer))
        
    '''
    Sets the default tcpout group (via models). This doesn't work because the model won't save it.
    '''
    @classmethod
    def setDefaultTcpOutGroupViaModels(cls, groupName, sessionKey):
        
        groupName = cls.parseOutputName(groupName)
        
        output = cls.getMainOutput(sessionKey)
        output.defaultGroup = groupName
        return output.save()

    '''
    Set up supported arguments
    '''
    def setup(self):
        if self.requestedAction == admin.ACTION_EDIT:
            for arg in ['indexers']:
                self.supportedArgs.addOptArg(arg)
    
    '''
    Lists configurable parameters
    '''
    def handleList(self, confInfo):
        
                
        # Get the session key
        sessionKey = self.getSessionKey()
        
        stanza = "general_settings"
        confInfo[stanza].append('indexers', self.getIndexers(sessionKey))
        
    '''
    Controls parameters
    '''
    def handleEdit(self, confInfo):
        name = self.callerArgs.id
        args = self.callerArgs
        
        if 'indexers' in self.callerArgs.data:
            self.setIndexers(self.callerArgs.data['indexers'][0], self.getSessionKey())
        
         ## reload the app to trigger splunkd restart
        self.handleReload()

    def handleReload(self, confInfo=None):
        """
        Handles refresh/reload of the configuration options
        """
        refreshInfo = en.refreshEntities('apps/local/splunk_app_cef', sessionKey=self.getSessionKey())
               
# initialize the handler
admin.init(ConfigCEFApp, admin.CONTEXT_NONE)