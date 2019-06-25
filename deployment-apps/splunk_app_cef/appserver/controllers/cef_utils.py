import csv
import os
import json
import logging
import logging.handlers
import sys
import cherrypy
import urllib
import splunk.rest
import traceback

from splunk import AuthenticationFailed

from splunk.appserver.mrsparkle.lib import jsonresponse
import splunk.appserver.mrsparkle.controllers as controllers
import splunk.appserver.mrsparkle.lib.util as util
from splunk.appserver.mrsparkle.lib.routes import route
from splunk.appserver.mrsparkle.lib.decorators import expose_page

sys.path.append(util.make_splunkhome_path(["etc", "apps", "splunk_app_cef", "lib"]))
from splunk_app_cef_cim_models import DataModels

class InvalidDatamodel(Exception):
    pass
    
class InvalidDatamodelObject(Exception):
    pass

class CEFUtils(controllers.BaseController):
    '''Controller for assisting with handling CEF data in Splunk '''
    
    ## Globals
    CEF_INVENTORY_PATH = util.make_splunkhome_path(["etc", "apps", "splunk_app_cef", "lookups", "cef_inventory.csv"])

    ## CEF Value Types
    CEF_VALUE_TYPES = ['fieldmap','userdefined']  
    
    ## CEF Prefix Template
    CEF_PREFIX_TEMPLATE = '"CEF:".%s."|".%s."|".%s."|".%s."|".%s."|".%s."|".%s'
    
    ## Splunk Subject Keys
    ## These fields can take on a number of value types (ipv4, ipv6, nt_host, dns, mac, etc.)
    ## These will need special treatment when generating the CEF Extension
    ## Should not affect Syslog Header or CEF Prefix
    SPLUNK_SUBJECT_KEYS        = ['host', 'orig_host', 'src', 'dest', 'dvc']
    
    ## CEF Extension Subjects
    CEF_EXTENSION_SOURCES      = ['src','smac','shost']
    CEF_EXTENSION_DESTINATIONS = ['dst', 'dmac','dhost']
    CEF_EXTENSION_DEVICES      = ['dvc','deviceMacAddress','dvchost']
    
    ## CEF Subject Keys
    CEF_SUBJECT_KEYS           = []
    CEF_SUBJECT_KEYS.extend(CEF_EXTENSION_SOURCES)
    CEF_SUBJECT_KEYS.extend(CEF_EXTENSION_DESTINATIONS)
    CEF_SUBJECT_KEYS.extend(CEF_EXTENSION_DEVICES)
        
    CEF_EXTENSION_IPS          = ['src','dst','dvc']
    CEF_EXTENSION_MACS         = ['smac', 'dmac','deviceMacAddress']
    CEF_EXTENSION_HOSTS        = ['shost','dhost','dvchost']
    
    def render_error_json(self, msg):
        """
        Render an error such that it can be returned to the client as JSON.
        
        Arguments:
        msg -- A message describing the problem (a string)
        """
        
        output = jsonresponse.JsonResponse()
        output.data = []
        output.success = False
        output.addError(msg)
        return self.render_json(output, set_mime='text/plain')
    
    @route('/:get_data_models=get_data_models')
    @expose_page(must_login=True, methods=['GET']) 
    def getDataModelsAndObjects(self, **kwargs):
        
        # Get the session key
        sessionKey = cherrypy.session.get('sessionKey')
        
        # This will contain all of the information about the data-models and the associated objects
        data_models_info = []
        
        namespace = "splunk_app_cef"
        
        if namespace in kwargs:
            namespace = kwargs['namespace']
        
        # Get the list of data-models
        for data_model in DataModels.getDatamodelList(sessionKey, namespace):
            
            try:
                data_models_info.append( {
                                          'name' : data_model,
                                          'objects' : DataModels.getDatamodelObjectList(data_model, sessionKey)
                                          } )
            except:
                pass
        
        return self.render_json(data_models_info)

    @route('/:get_data_model_attributes=get_data_model_attributes')
    @expose_page(must_login=True, methods=['GET']) 
    def getDataModelAttributes(self, data_model, obj, **kwargs):
        
        # Get the session key
        sessionKey = cherrypy.session.get('sessionKey')
        
        # Get the model
        model_id = DataModels.build_id(data_model, None, None)
        model = DataModels.get(id=model_id, sessionKey=sessionKey)
        
        # Load the json
        model_json = json.loads(model.data)
        
        # Return the attributes
        return self.render_json(DataModels.getObjectAttributes(obj, model_json))
    
    @route('/:get_available_fields=get_available_fields')
    @expose_page(must_login=True, methods=['GET']) 
    def getAvailableFields(self, data_model, obj, **kwargs):
        
        # Get the session key
        sessionKey = cherrypy.session.get('sessionKey')
        
        # Get the model
        model_id = DataModels.build_id(data_model, None, None)
        model = DataModels.get(id=model_id, sessionKey=sessionKey)
        
        # Load the json
        model_json = json.loads(model.data)
        
        # Return the attributes
        return self.render_json(DataModels.getAvailableFields(obj, model_json))
    
    @route('/:get_cef_fields=get_cef_fields')
    @expose_page(must_login=True, methods=['GET']) 
    def getCEFFields(self, **kwargs):
                
        with open(CEFUtils.CEF_INVENTORY_PATH, 'rU') as csv_file:
            csv_reader = csv.DictReader(csv_file, dialect=csv.excel)
            return self.render_json([line for line in csv_reader])
        
    @route('/:make_search_string=make_search_string')
    @expose_page(must_login=True, methods=['GET']) 
    def makeSearchString(self, datamodel, objectName, fieldmap, **kwargs):
              
        # Get session key
        sessionKey = cherrypy.session.get('sessionKey')
        
        search, parses = CEFUtils.getCEFSearch(datamodel, objectName, json.loads(fieldmap), sessionKey)
        
        return self.render_json( {
                                    'search' : search,
                                    'parses' : parses
                                  })
    
    @route('/:change_search=change_search')
    @expose_page(must_login=True, methods=['POST'])
    def change_search(self, operation, app, owner, name, **kwargs):
        
        # Get session key
        session_key = cherrypy.session.get('sessionKey')
        
        # Get the ruleUIDs
        args = {} #kwargs
        
        if 'change_search' in kwargs:
            del kwargs['change_search']
        
        # jQuery may add "[]" to the arguments when an array of similar argument names are provided, handle this case
        if 'operation' in kwargs:
            operation = kwargs['operation']
            del kwargs['operation']
        
        # Default to JSON since that is what Javascript usually wants
        if 'output_mode' not in args:
            args['output_mode'] = 'json'
        
        # Make the URL
        uri = urllib.quote('/servicesNS/' + owner + "/" + app + "/saved/searches/" + name + '/' + operation)
        
        try:
            serverResponse, serverContent = splunk.rest.simpleRequest(uri, method='POST', sessionKey=session_key, postargs=args)
        except AuthenticationFailed:
            return None
        except Exception as e: 
            tb = traceback.format_exc()
            
            serverContent = json.dumps({
                                        'message': str(e),
                                        'success': False,
                                        'traceback:': tb })
        
        cherrypy.response.headers['Content-Type'] = 'text/json'
        return serverContent

    ## The following method returns the contents of splunk_key given the cef_key
    ## cef_key        - The cef key
    ## fieldmap       - The mapping of cef_key to splunk_key
    ## default        - What to use as splunk_key if cef_key is not in fieldmap.  Defaults to None.
    ## quoteMap       - This quotes the splunk_key, or the default if not None. Defaults to True.
    ##                  If cef_value_type==fieldmap we us single quotes
    ##                  If cef_value_type==userdefined we use double quotes
    ##                  | stats count | rename count as "the count" | eval test=if(isnotnull('the count'),'the count',"fail")
    ## quoteInt       - This determines whether we quote integer values for cef_value_type=userdefined
    ## cef_value_type - fieldmap or userdefined
    ## This method is expected to return a string suitable for eval
    @staticmethod
    def getMapping(cef_key, fieldmap, default=None, quoteMap=True, quoteInt=True, cef_value_type='fieldmap'):
        ## value to default
        value = default
        
        ## validate cef_value_type
        if cef_value_type not in CEFUtils.CEF_VALUE_TYPES:
            cef_value_type = 'fieldmap'

        ## check for cef_key in fieldmap
        if fieldmap.get(cef_key) and (fieldmap[cef_key].get('splunk_key') or fieldmap[cef_key].get('cef_value')):
            ## get cef_value type
            ## ignore if invalid
            if fieldmap[cef_key].get('cef_value_type') and fieldmap[cef_key]['cef_value_type'] in CEFUtils.CEF_VALUE_TYPES:
                cef_value_type = fieldmap[cef_key]['cef_value_type']
            
            ## update value based on cef_value_type
            if cef_value_type == 'fieldmap' and fieldmap[cef_key].get('splunk_key'):
                value = fieldmap[cef_key]['splunk_key']
            
            elif cef_value_type == 'userdefined' and fieldmap[cef_key].get('cef_value'):
                value = fieldmap[cef_key]['cef_value']
                    
        ## if value is good
        if value is not None:
            ## single quote if fieldmap
            ## double quote if userdefined (unless quoteInt=False and value is int)
            if quoteMap:
                if cef_value_type == 'fieldmap':
                    value = "'%s'" % value
                elif cef_value_type == 'userdefined':
                    if not quoteInt:             
                        try:
                            int(value, 10)
                            value = '%s' % value
                        except ValueError, TypeError:
                            value = '"%s"' % value
                    else:
                        value = '"%s"' % value
        
        return value

    ## The following method generates the syslog header for a CEF message using eval
    ## This method uses cef_key=syslog_time and cef_key=syslog_host
    ## syslog_time must be a fieldmap to one of [_time,_indextime]
    ## fieldmap - The mapping of cef_key to splunk_key
    @staticmethod
    def getSyslogHeader(fieldmap):        
        ## syslog header template
        headerTemplate     = '%s." ".%s'
        
        ## syslog_time is escaped here because it is handled outside of getMapping
        ## MV handling is done via isnotnull(strftime('%s',"%s"))
        syslogTimeTemplate = '''if(isnotnull(strftime('%s',"%s")),strftime('%s',"%s"),strftime(time(),"%s"))'''
        
        ## syslog_host template
        ## syslog_host is not escaped here because it is handled by getMapping(quoteMap=True)
        ## MV handling w/ mvcount/mvindex
        syslogHostTemplate = '''case(mvcount(%s)>=1,mvindex(%s,0),mvcount('host')>=1,mvindex('host',0),1=1,"unknown")'''
        
        ## default fieldmaps    
        syslog_time        = '_time'
        syslog_host        = 'host'
        
        ## default userdefined
        syslog_time_format = '%b %d %H:%M:%S'

        ## syslog_time
        if fieldmap.get('syslog_time') and fieldmap['syslog_time'].get('splunk_key'):
            ## enforce _time,_indextime
            if fieldmap['syslog_time']['splunk_key'] in ['_time','_indextime']:
                syslog_time = "%s" % fieldmap['syslog_time']['splunk_key']
                
                ## time format
                if fieldmap['syslog_time'].get('time_format'):
                    syslog_time_format = fieldmap['syslog_time']['time_format']
        
        ## syslog_time
        syslog_time = syslogTimeTemplate % (syslog_time,syslog_time_format,syslog_time,syslog_time_format,syslog_time_format)
        
        ## syslog_host
        syslog_host = CEFUtils.getMapping('syslog_host', fieldmap, default=syslog_host)
        syslog_host = syslogHostTemplate % (syslog_host,syslog_host)
            
        return headerTemplate % (syslog_time,syslog_host)
    
    ## The following method generates the CEF prefix for a CEF message using eval
    ## This method uses the following cef keys: version,dvc_vendor,dvc_product,dvc_version,signature_id,name,severity
    ## fieldmap - The mapping of cef_key to splunk_key
    @staticmethod
    def getCEFPrefix(fieldmap):
        ## CEF Version Template
        ## version is not escaped because we use getMapping(quoteMap=True, quoteInt=False)
        ## MV handling w/ isint
        ## WARNING: isint("1") evaluates to false
        versionTemplate       = 'if(isint(%s),%s,0)'
        ## CEF Vendor and Product Template
        ## vendor/product are not escaped because we use getMapping(quoteMap=True)
        ## MV handling w/ mvcount/mvindex
        deviceVPTemplate      = '''case(mvcount(%s)>=1 AND mvindex(%s,0)!="unknown",mvindex(%s,0),mvcount('sourcetype')>=1,mvindex('sourcetype',0),1=1,"unknown")'''
        ## CEF Device Version Template
        ## dvc_version is not excaped because we use getMapping(quoteMap=True)
        ## MV handling w/ mvcount/mvindex
        deviceVersionTemplate = '''if(mvcount(%s)>=1,mvindex(%s,0),"unknown")'''
        ## CEF Signature ID Template
        ## signature_id is not excaped because we use getMapping(quoteMap=True)
        ## MV handling w/ mvcount/mvindex
        signatureIDTemplate   = '''if(mvcount(%s)>=1,mvindex(%s,0),"unknown")'''
        ## CEF Name Template
        ## name is not escaped because we use getMapping(quoteMap=True)
        ## MV handling w/ mvcount/mvindex
        nameTemplate          = '''case(mvcount(%s)>=1,mvindex(%s,0),mvcount('name')>=1,mvindex('name',0),1=1,"unknown")'''
        ## CEF Severity Template
        ## severity is not escaped because it is used in a macro call
        ## MV handling w/ direct string comparisons
        ## | stats count | eval "my severity"="informational" | eval "my_severity"=`get_cef_severity(my severity)`
        severityTemplate      = '`get_cef_severity(%s)`'
      
        ## default fieldmaps
        dvc_vendor    = 'vendor'
        dvc_product   = 'product'
        dvc_version   = 'product_version'
        signature_id  = 'signature_id'
        name          = 'signature'
        severity      = 'severity'
        
        ## default userdefined
        version       = '0'
        
        ## version
        version = CEFUtils.getMapping('version', fieldmap, default=version, quoteInt=False, cef_value_type="userdefined")
        version = versionTemplate % (version, version)

        ## dvc_vendor
        ## This gets special treatment when splunk_key ends with "vendor_product"
        ## When ends with anything else, we take that value
        candidate_dvc_vendor = CEFUtils.getMapping('dvc_vendor', fieldmap, default=dvc_vendor)
        if not candidate_dvc_vendor.endswith("vendor_product'"):
            dvc_vendor = candidate_dvc_vendor 
        dvc_vendor = deviceVPTemplate % (dvc_vendor,dvc_vendor,dvc_vendor)
        
        ## dvc_product
        ## This gets special treatment when splunk_key ends with "vendor_product"
        ## When ends with anything else, we take that value
        candidate_dvc_product = CEFUtils.getMapping('dvc_product', fieldmap, default=dvc_product)
        if not candidate_dvc_product.endswith("vendor_product'"):
            dvc_product = candidate_dvc_product     
        dvc_product = deviceVPTemplate % (dvc_product,dvc_product,dvc_product)
        
        ## dvc_version
        dvc_version = CEFUtils.getMapping('dvc_version', fieldmap, default=dvc_version)
        dvc_version = deviceVersionTemplate % (dvc_version,dvc_version)
        
        ## signature_id
        signature_id = CEFUtils.getMapping('signature_id', fieldmap, default=signature_id)
        signature_id = signatureIDTemplate % (signature_id,signature_id)
        
        ## name
        name = CEFUtils.getMapping('name', fieldmap, default=name)
        name = nameTemplate % (name, name)
        
        ## severity
        ## This gets special handling in case we need to map from strings to integers
        cef_value_type = 'fieldmap'
        if fieldmap.get('severity'):
            ## Update cef_value_type
            if fieldmap['severity'].get('cef_value_type') and fieldmap['severity']['cef_value_type'] in CEFUtils.CEF_VALUE_TYPES:
                cef_value_type = fieldmap['severity']['cef_value_type']
                
        ## make severity    
        if cef_value_type=='fieldmap':
            severity = CEFUtils.getMapping('severity',fieldmap,default=severity,quoteMap=False,cef_value_type=cef_value_type)
            severity = severityTemplate % (severity)
        else:
            ## Alternate CEF Severity Template
            ## severity not escaped because we use getMapping(quoteMap=True, quoteInt=False)
            ## MV handling w/ isint
            ## WARNING: isint("1") evaluates to false
            severity = CEFUtils.getMapping('severity', fieldmap, default="5", quoteInt=False, cef_value_type=cef_value_type)
            severity = 'if(isint(%s) AND %s>=0 AND %s<=10,%s,5)' % (severity, severity, severity, severity)
                       
        return CEFUtils.CEF_PREFIX_TEMPLATE % (version,dvc_vendor,dvc_product,dvc_version,signature_id,name,severity)
    
    ## The following method returns a list of cef_key values where location=extension
    ## Assumes ../../lookups/cef_inventory.csv
    @staticmethod
    def getExtensionKeys():
        keys = []
        ## Lookup File Handler
        cefinvFH    = open(CEFUtils.CEF_INVENTORY_PATH, 'rU')
        ## Lookup File Dictionary
        cefinvDict  = csv.DictReader(cefinvFH)
        ## Iterate Dictionary
        for cef_key in cefinvDict:
            ## If key, location, and extension
            if cef_key.get('cef_key') and cef_key.get('location') and cef_key['location'] == 'extension':
                keys.append(cef_key['cef_key'])
        ## Close File Handler
        cefinvFH.close()
        
        return keys
    
    ## The following method generates the CEF extension for a CEF message using eval
    ## This method uses the cef_key values returned by getExtensionKeys()
    ## Currently only 
    ## fieldmap - The mapping of cef_key to splunk_key
    @staticmethod
    def getCEFExtension(fieldmap):
        extension = ''
        
        ## CEF Extension Templates
        ## MV handling w/ mvcount/mvindex
        extensionTemplate = 'if(mvcount(%s)>=1,"%s=".mvjoin(%s,"\\n")." ","")'
        
        ## CEF Subject Templates
        ipTemplate   = '''case(isnotnull('%s_ip'),"%s=".'%s_ip'." ",match('%s',"^(\d{1,3}\.){3}\d{1,3}$"),"%s=".'%s'." ",1=1,"")'''
        macTemplate  = '''case(isnotnull('%s_mac'),"%s=".'%s_mac'." ",match('%s',"^(([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}|([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}|([0-9A-Fa-f]{4}\.){2}[0-9A-Fa-f]{4})$"),"%s=".'%s'." ",1=1,"")'''
        hostTemplate = '''case(isnotnull('%s_dns'),"%s=".'%s_dns'." ",isnotnull('%s_nt_host'),"%s=".'%s_nt_host'." ",match('%s',"^(\d{1,3}\.){3}\d{1,3}$"),"",match('%s',"^(([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}|([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}|([0-9A-Fa-f]{4}\.){2}[0-9A-Fa-f]{4})$"),"",isnotnull('%s'),"%s=".'%s'." ",1=1,"")'''
        
        ## fieldmap keys
        fieldmapKeys = fieldmap.keys()

        ## extension inventory keys
        extensionInventoryKeys = CEFUtils.getExtensionKeys()

        ## extension keys
        extensionKeys = [val for val in fieldmapKeys if val in extensionInventoryKeys]
        
        ## handle subject extensions
        
        ## Step 1:  
        ## Determine if the fieldmap has any mappings to a splunk_key ending in CefUtils.SPLUNK_SUBJECT_KEYS
        ## This indicates that you want to go from a key whose value is mixed to a set of multiple keys of a specific type
        ## cef_key=smac, splunk_key=All_Traffic.dest indicates to set src/smac/shost based on the value of All_Traffic.dest
        extensionSubjects = []
        
        for cefSubject in CEFUtils.CEF_SUBJECT_KEYS:
            splunk_key = CEFUtils.getMapping(cefSubject, fieldmap, quoteMap=False)
            
            if splunk_key is not None:
                for x in xrange(0, len(CEFUtils.SPLUNK_SUBJECT_KEYS)):
                    if splunk_key.endswith(CEFUtils.SPLUNK_SUBJECT_KEYS[x]):
                        extensionSubjects.append(cefSubject)
               
        ## Step 2:
        ## Add 1 extension per src/dest/dvc set
        extensionKeyRemovals = []
        
        srcFound  = False
        destFound = False
        dvcFound  = False
                        
        for cefSubjectKey in extensionSubjects:
            splunk_key = CEFUtils.getMapping(cefSubjectKey, fieldmap, quoteMap=False)
            
            ## if cef_key is a src key
            if cefSubjectKey in CEFUtils.CEF_EXTENSION_SOURCES:
                ## if this is our first hit
                if not srcFound:
                    for cefSubject in CEFUtils.CEF_EXTENSION_SOURCES:
                        ## if subject is an IP
                        if cefSubject in CEFUtils.CEF_EXTENSION_IPS:
                            extension += ipTemplate % (splunk_key,cefSubject,splunk_key,splunk_key,cefSubject,splunk_key)
                            extension += '.'        
                        ## if subject is a MAC
                        elif cefSubject in CEFUtils.CEF_EXTENSION_MACS:
                            extension += macTemplate % (splunk_key,cefSubject,splunk_key,splunk_key,cefSubject,splunk_key)
                            extension += '.'
                        ## if subject is a Host
                        elif cefSubject in CEFUtils.CEF_EXTENSION_HOSTS:
                            extension += hostTemplate % (splunk_key,cefSubject,splunk_key,splunk_key,cefSubject,splunk_key,splunk_key,splunk_key,splunk_key,cefSubject,splunk_key)
                            extension += '.'
                        extensionKeyRemovals.append(cefSubject)
                srcFound = True
            elif cefSubjectKey in CEFUtils.CEF_EXTENSION_DESTINATIONS:
                if not destFound:
                    for cefSubject in CEFUtils.CEF_EXTENSION_DESTINATIONS:
                        ## if subject is an IP
                        if cefSubject in CEFUtils.CEF_EXTENSION_IPS:
                            extension += ipTemplate % (splunk_key,cefSubject,splunk_key,splunk_key,cefSubject,splunk_key)
                            extension += '.'        
                        ## if subject is a MAC
                        elif cefSubject in CEFUtils.CEF_EXTENSION_MACS:
                            extension += macTemplate % (splunk_key,cefSubject,splunk_key,splunk_key,cefSubject,splunk_key)
                            extension += '.'
                        ## if subject is a Host
                        elif cefSubject in CEFUtils.CEF_EXTENSION_HOSTS:
                            extension += hostTemplate % (splunk_key,cefSubject,splunk_key,splunk_key,cefSubject,splunk_key,splunk_key,splunk_key,splunk_key,cefSubject,splunk_key)
                            extension += '.'
                        extensionKeyRemovals.append(cefSubject)
                destFound = True
            elif cefSubjectKey in CEFUtils.CEF_EXTENSION_DEVICES:
                if not dvcFound:
                    for cefSubject in CEFUtils.CEF_EXTENSION_DEVICES:
                        ## if subject is an IP
                        if cefSubject in CEFUtils.CEF_EXTENSION_IPS:
                            extension += ipTemplate % (splunk_key,cefSubject,splunk_key,splunk_key,cefSubject,splunk_key)
                            extension += '.'        
                        ## if subject is a MAC
                        elif cefSubject in CEFUtils.CEF_EXTENSION_MACS:
                            extension += macTemplate % (splunk_key,cefSubject,splunk_key,splunk_key,cefSubject,splunk_key)
                            extension += '.'
                        ## if subject is a Host
                        elif cefSubject in CEFUtils.CEF_EXTENSION_HOSTS:
                            extension += hostTemplate % (splunk_key,cefSubject,splunk_key,splunk_key,cefSubject,splunk_key,splunk_key,splunk_key,splunk_key,cefSubject,splunk_key)
                            extension += '.'
                        extensionKeyRemovals.append(cefSubject)
                dvcFound = True
        
        ## Step 3. Remove extension keys already processed
        extensionKeys = [x for x in extensionKeys if x not in extensionKeyRemovals]
       
        ## iterate the rest of the extension keys
        for cef_key in extensionKeys:    
            splunk_key = CEFUtils.getMapping(cef_key, fieldmap)
            if splunk_key is not None:
                extension += extensionTemplate % (splunk_key,cef_key,splunk_key)
                extension += '.'

        ## rstrip period     
        return extension.rstrip('.')
    
    @staticmethod
    def getCEFEval(fieldmap):
        cef_extension = CEFUtils.getCEFExtension(fieldmap)
        
        if len(cef_extension)>0:
            cef_eval = 'eval _raw=%s." ".%s."|".%s' % (CEFUtils.getSyslogHeader(fieldmap),CEFUtils.getCEFPrefix(fieldmap),cef_extension)
        
        else:
            cef_eval = 'eval _raw=%s." ".%s."|"' % (CEFUtils.getSyslogHeader(fieldmap),CEFUtils.getCEFPrefix(fieldmap))            
        
        return cef_eval 
    
    @staticmethod
    def getCEFSearch(datamodel,objectName,fieldmap={},sessionKey=None):
        ## CEF Search Template
        cefSearchTemplate = '| datamodel %s %s search | %s | fields +_raw'
        
        ## Step 0:  Validate sessionKey        
        if not sessionKey:
            raise AuthenticationFailed
        
        ## Step 1:  Validate datamodel and get objects list
        if datamodel not in DataModels.getDatamodelList(sessionKey):
            e = 'No such datamodel %s' % datamodel
            raise InvalidDatamodel(e)
        
        else:
            objs = DataModels.getDatamodelObjectList(datamodel,sessionKey)
            
        ## Step 2:  Validate object
        if objectName not in objs:
            e = 'No such object %s in datamodel %s' % (objectName,datamodel)
            raise InvalidDatamodelObject(e)
        
        ## Step 3:  CEF Eval
        cefEval = CEFUtils.getCEFEval(fieldmap)
        
        ## Step 4:  Put it all together
        cefSearch = cefSearchTemplate % (datamodel,objectName,cefEval)
        
        ## Step 5:  Parsing
        parses = False
        
        if len(cefSearch)>0:
            status, contents = splunk.rest.simpleRequest("search/parser", sessionKey=sessionKey, method='GET', getargs={'q': cefSearch, 'output_mode': "json"})
                    
            if status.status == 200:
                parses = True
        
        return cefSearch, parses
