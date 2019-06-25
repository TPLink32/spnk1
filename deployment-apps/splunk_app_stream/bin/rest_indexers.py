import splunk
import splunk.rest
import logging
import logging.handlers
import json
from stream_utils import *

logger = setup_logger('rest_indexers')

# REST Handler class to handle the API requests related to Indexers from clients using the Splunk Session key
# to authenticate.

class Indexers(splunk.rest.BaseRestHandler):

    def handle_GET(self):
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
                output['indexers'] = {'success': False, 'error': 'Unauthorized', 'status': 401}
                return output
                
        output = {}
        try:
            # Get indexers list through Splunk REST API
            uri = '/services/search/distributed/peers?output_mode=json'
            serverResponse, serverContent = splunk.rest.simpleRequest(
                util.make_url_internal(uri),
                sessionKey,
                postargs=None,
                method='GET',
                raiseAllErrors=True,
                proxyMode=False,
                rawResult=None,
                jsonargs=None,
                timeout=splunk.rest.SPLUNKD_CONNECTION_TIMEOUT
            )

            jsonobj = json.loads(serverContent)
            output['indexers'] = jsonobj['entry']

        except Exception as e:
            logger.exception(e)
            raise splunk.RESTException(500, 'Internal error, failed to get indexers peer')
       
        return output
