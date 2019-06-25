import splunk.rest
from stream_utils import *
from stream_kvstore_utils import *

logger = setup_logger('rest_kvstore_status')

# REST Handler class to get the KVStore status. This is used by Cherrypy controllers to get the kvstore status without a session key

class KVStoreStatus(splunk.rest.BaseRestHandler):

    def handle_GET(self):
        '''Return kvstore status''' 
        output = {}
        output['kvStoreStatus'] = 'unknown' 
        sessionKey = None

        if 'systemAuth' in self.request and self.request['systemAuth']:
            sessionKey = self.request['systemAuth']
        else:
            sessionKey = self.sessionKey

        if sessionKey:
            output['kvStoreStatus'] = get_kv_store_status(sessionKey)
                          
        return output