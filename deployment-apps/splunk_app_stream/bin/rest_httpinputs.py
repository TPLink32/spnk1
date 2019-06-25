import splunk
import splunk.rest
import splunk.appserver.mrsparkle.lib.util as util
import logging
import logging.handlers
import json
import re
from stream_utils import *

logger = setup_logger('rest_httpinputs')

# REST Handler class to handle the API requests related to Indexers from clients using the Splunk Session key
# to authenticate. This class acts as a proxy to the stream model class.  All of the business logic is contained in
# the model class.

class Httpinputs(splunk.rest.BaseRestHandler):

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
                output['httpinputs'] = {'success': False, 'error': 'Unauthorized', 'status': 401}
                return output

        output = {}
        try:
            inputs = []

            # Get list of HEC inputs
            uri = '/services/data/inputs/http?output_mode=json'
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

            if serverResponse['status'] == '200':
                jsonResp = json.loads(serverContent)
                output['httpinputs'] = jsonResp['entry']

        except Exception as e:
            logger.exception(e)
            raise splunk.RESTException(500, 'Internal error, failed to get HEC config')

        return output


class HttpinputsConfigs(splunk.rest.BaseRestHandler):

    def handle_GET(self):
        sessionKey = None

        if 'systemAuth' in self.request and self.request['systemAuth']:
            sessionKey = self.request['systemAuth']
        else:
            sessionKey = self.sessionKey

        output = {}
        # check for auth key
        auth_key = None
        if 'systemAuth' in self.request:
            auth_key = extract_auth_key(self.request, self.args)
            auth_success  = validate_streamfwd_auth(auth_key)
            if not auth_success:
                self.response.status = 401
                output = {}
                output['httpinputs'] = {'success': False, 'error': 'Unauthorized', 'status': 401}
                return output

        try:
            inputs = []

            # Get list of HEC inputs
            uri = '/services/data/inputs/http/http?output_mode=json'
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

            if serverResponse['status'] == '200':
                jsonResp = json.loads(serverContent)
                config = jsonResp['entry'][0]['content']

            output['httpinputsconfigs'] = config

        except Exception as e:
            logger.exception(e)
            raise splunk.RESTException(500, 'Internal error, failed to get HEC inputs')
       
        return output
