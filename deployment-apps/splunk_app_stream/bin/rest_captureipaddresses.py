import splunk.rest
import splunk_app_stream.models.captureipaddress
from stream_utils import *


logger = setup_logger('rest_captureipaddresses')

# REST Handler class to handle the API requests related to Capture IP Addresses from clients using the Splunk Session key
# to authenticate. This class acts as a proxy to the captureipaddress model class. All of the business logic is
# contained in the model class.

class CaptureIpAddresses(splunk.rest.BaseRestHandler):

    def handle_GET(self):
        '''Return list of vocabularies'''
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
                output['captureipaddresses'] = {'success': False, 'error': 'Unauthorized', 'status': 401}
                return output

        id = None
        try:
            id = self.args['id']
        except:
            pass
        output = {}
        output['captureipaddresses'] = splunk_app_stream.models.captureipaddress.CaptureIpAddress.list(id, sessionKey)
        return output

    def handle_POST(self):
        if 'authorization' in self.request['headers']:
            sessionKey = self.request['headers']['authorization'].replace("Splunk ", "")
            form_body = self.request['payload']
            id = ''
            try:
                id = self.args['id']
            except:
                pass
            result = splunk_app_stream.models.captureipaddress.CaptureIpAddress.save(form_body, id, sessionKey)
            if 'status' in result:
                self.response.status  = result['status']
            if self.response.status > 399:
                raise splunk.RESTException(self.response.status, result['error'])
            output = {}
            output['captureipaddresses'] = result
            logger.info('save::result %s', result)
            # refresh cherrypy cache for apps metadata
            refresh_ping_cache()
            return output
        else:
            raise splunk.RESTException(401, "Unauthorized to perform POST or PUT operation")

    handle_PUT = handle_POST
