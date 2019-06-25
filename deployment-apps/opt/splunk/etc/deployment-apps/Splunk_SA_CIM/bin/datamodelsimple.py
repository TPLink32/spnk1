import json
import logging
import logging.handlers
import splunk.Intersplunk
import sys
import time

from splunk.clilib.bundle_paths import make_splunkhome_path
sys.path.append(make_splunkhome_path(["etc", "apps", "Splunk_SA_CIM", "lib"]))
from cim_models import DataModels


class DatamodelSimpleFormatter(logging.Formatter):
    """ An extension to the logging.Formatter base class
    Hardcodes "+0000" into default datefmt
    Use in conjunction with ModularActionFormatter.converter = time.gmtime
    """
    def formatTime(self, record, datefmt=None):
        """
        Return the creation time of the specified LogRecord as formatted text.

        This method should be called from format() by a formatter which
        wants to make use of a formatted time. This method can be overridden
        in formatters to provide for any specific requirement, but the
        basic behaviour is as follows: if datefmt (a string) is specified,
        it is used with time.strftime() to format the creation time of the
        record. Otherwise, the ISO8601 format is used. The resulting
        string is returned. This function assumes time.gmtime() as the 
        'converter' attribute in the Formatter class.
        """
        ct = self.converter(record.created)
        if datefmt:
            s = time.strftime(datefmt, ct)
        else:
            t  = time.strftime("%Y-%m-%d %H:%M:%S", ct)
            s  = "%s,%03d+0000" % (t, record.msecs)
        return s

## Setup the logger
def setup_logger():
    """
    Setup a logger for the search command
    """
   
    logger = logging.getLogger('datamodelsimple')
    logger.propagate = False  # Prevent the log messages from being duplicated in the python.log file
    logger.setLevel(logging.DEBUG)
   
    file_handler = logging.handlers.RotatingFileHandler(make_splunkhome_path(['var', 'log', 'splunk', 'datamodelsimple.log']), maxBytes=25000000, backupCount=5)
    DatamodelSimpleFormatter.converter = time.gmtime
    formatter = DatamodelSimpleFormatter('%(asctime)s %(levelname)s %(message)s')
    file_handler.setFormatter(formatter)
   
    logger.addHandler(file_handler)
   
    return logger

logger = setup_logger()


if __name__ == '__main__':
    
    logger.info('Starting datamodelsimple search command')
    
    return_type = 'models'
    datamodel = None
    obj = None
    nodename = None
    
    ## Override Defaults w/ opts below
    if len(sys.argv) > 1:
        for a in sys.argv:
            if a.startswith('type='):
                where = a.find('=')
                return_type = a[where+1:len(a)]
            elif a.startswith('datamodel='):
                where = a.find('=')
                datamodel = a[where+1:len(a)]
            elif a.startswith('object='):
                where = a.find('=')
                obj = a[where+1:len(a)]
            elif a.startswith('nodename='):
                where = a.find('=')
                nodename = a[where+1:len(a)]
    
    ## if nodename is specified, create obj
    if nodename and not obj:
        obj = nodename.split('.')
        obj = obj[-1]

    results, dummyresults, settings = splunk.Intersplunk.getOrganizedResults()
    results = []  # we don't care about incoming results
  
    sessionKey = settings.get('sessionKey', False)
    
    try:
        ## validate sessionKey
        if not sessionKey:
            raise splunk.AuthenticationFailed
            
        if return_type == 'models':
            models = DataModels.getDatamodelList(sessionKey)
            results = [{'datamodel': i} for i in models]
        
        elif return_type == 'objects':
            if datamodel:
                objects   = DataModels.getDatamodelObjectList(datamodel, sessionKey)
                modelJson = DataModels.getDatamodelJson(datamodel, sessionKey)
                results   = [{'object': i, 'lineage': DataModels.getObjectLineage(i, modelJson=modelJson)} for i in objects]
            else:
                e = 'Must specify datamodel for type: objects'
                logger.error(e)
                results = splunk.Intersplunk.generateErrorResults(e)
        
        elif return_type == 'attributes':                     
            if datamodel and obj:
                ## get the model
                modelJson = DataModels.getDatamodelJson(datamodel, sessionKey)
                ## getAvailableFields for non-transforming search
                availableFieldsMap = DataModels.getAvailableFieldsMap(obj, modelJson)
                ## if we were able to determine lineage extend fields
                if availableFieldsMap is not None:
                    for lineage_field, field in availableFieldsMap.items():
                        results.append({'attribute': field, 'lineage': lineage_field})
                else:
                    e = "Could not determine lineage for datamodel: %s, object: %s" % (datamodel,obj)
                    logger.error(e)
                    raise InvalidDatamodelObject(e)
                    
            else:
                e = 'Must specify datamodel and object for type: attributes'
                logger.error(e)
                results = splunk.Intersplunk.generateErrorResults(e)
                            
    except Exception as e:
        logger.error(e)
        results = splunk.Intersplunk.generateErrorResults(str(e))
    
    splunk.Intersplunk.outputResults(results)
    logger.info('Finishing datamodelinfo search command')
