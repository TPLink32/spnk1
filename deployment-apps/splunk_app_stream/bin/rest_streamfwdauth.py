import splunk.rest
import json
from splunk_app_stream.models.streamfwdauth import StreamForwarderAuth
from stream_utils import *

logger = setup_logger('rest_streamfwdauth')

# REST Handler class to handle the API requests related to Stream Forwarder Authentication from clients using
# the Splunk Session key to authenticate. This class acts as a proxy to the streamfwdauth model class. All of
# the business logic is contained in the model class.

class StreamfwdAuth(splunk.rest.BaseRestHandler):

    def handle_GET(self):
        sessionKey = None
        if 'systemAuth' in self.request and self.request['systemAuth']:
            sessionKey = self.request['systemAuth']
        else:
            sessionKey = self.sessionKey
        output = {}
        output['streamfwdauth'] = StreamForwarderAuth.get(sessionKey)
        return output

    def handle_POST(self):
        if 'authorization' in self.request['headers']:
            sessionKey = self.request['headers']['authorization'].replace("Splunk ", "")
            form_body = json.loads(self.request['payload'])

            if 'enabled' in form_body and 'authKey' in form_body:
                enabled = form_body['enabled']
                authKey = form_body['authKey']
            else:
                raise splunk.RESTException(400, "Invalid data for POST or PUT operation")

            result = StreamForwarderAuth.save(enabled, authKey, sessionKey)

            if 'status' in result:
                self.response.status  = result['status']
            if self.response.status > 399:
                raise splunk.RESTException(self.response.status, result['error'])

            output = {}
            output['streamfwdauth'] = result
            logger.info('save::result %s', result)
            # refresh cherrypy cache for apps metadata
            refresh_ping_cache()
            return output
        else:
            raise splunk.RESTException(401, "Unauthorized to perform POST or PUT operation")

    handle_PUT = handle_POST
