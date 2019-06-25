import splunk.rest
from stream_utils import *
from stream_kvstore_utils import *

logger = setup_logger('rest_server_roles')

# REST Handler class to get the server roles. This is used by Cherrypy controllers to get the server roles without a session key

class ServerRoles(splunk.rest.BaseRestHandler):

    def handle_GET(self):
        '''Return server roles''' 
        output = {}
        output['serverRoles'] = None
        sessionKey = None

        if 'systemAuth' in self.request and self.request['systemAuth']:
            sessionKey = self.request['systemAuth']
        else:
            sessionKey = self.sessionKey

        if sessionKey:
            output['serverRoles'] = get_server_roles(sessionKey)
                          
        return output