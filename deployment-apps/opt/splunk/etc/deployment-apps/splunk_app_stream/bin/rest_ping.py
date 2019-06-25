from splunk_app_stream.models.ping import Ping as MPing
import splunk.rest
from stream_utils import *

logger = setup_logger('rest_ping')

# REST Handler class to handle the ping API requests from clients using the Splunk Session key to authenticate.

class Ping(splunk.rest.BaseRestHandler):

    def handle_GET(self):
        '''Return last update status and app version''' 
        sessionKey = None

        if 'systemAuth' in self.request and self.request['systemAuth']:
            sessionKey = self.request['systemAuth']
        else:
            sessionKey = self.sessionKey

        # check for auth key
        auth_key = None
        if 'systemAuth' in self.request:
            auth_key = extract_auth_key(self.request, self.args)                
            auth_success  = validate_streamfwd_auth(auth_key)
            if not auth_success:
                self.response.status = 401
                output = {}
                output['ping'] = {'success': False, 'error': 'Unauthorized', 'status': 401}
                return output

        output = {}
        output['ping'] = MPing.ping(sessionKey)                   
        return output
    