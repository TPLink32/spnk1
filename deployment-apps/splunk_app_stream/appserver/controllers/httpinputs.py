import logging
import cherrypy
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
import sys
# STREAM-3375: if splunk_app_stream bin path is not present in the sys.path, then add it to sys.path to ensure python modules are loaded
bin_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_stream', 'bin'])
if bin_path not in sys.path:
    sys.path.append(bin_path)
from stream_utils import *

logger = setup_logger('httpinputs')

# Controller class to handle the API requests to get HttpInputs

class HttpInputs(controllers.BaseController):
    ''' HttpInputs Controller '''

    def get_tokens(self, session_key):
        '''Retrieves the list of http tokens'''
        uri = 'services/data/inputs/http'
        serverResponse, serverContent = splunk.rest.simpleRequest(
            util.make_url_internal(uri + '?output_mode=json'),
            sessionKey=session_key,
            postargs=None,
            method='GET',
            raiseAllErrors=True,
            proxyMode=False,
            rawResult=None,
            jsonargs=None,
            timeout=splunk.rest.SPLUNKD_CONNECTION_TIMEOUT
            )
        jsonResp = json.loads(serverContent)
        tokens = []
        for entry in jsonResp['entry']:
            entry['content']['name'] = entry['name']
            tokens.append(entry['content'])
        return tokens

    def get_http_inputs(self, session_key):
        '''Retrieves the list of all http inputs'''
        uri = 'services/data/inputs/http/http'
        serverResponse, serverContent = splunk.rest.simpleRequest(
            util.make_url_internal(uri + '?output_mode=json'),
            sessionKey=session_key,
            postargs=None,
            method='GET',
            raiseAllErrors=True,
            proxyMode=False,
            rawResult=None,
            jsonargs=None,
            timeout=splunk.rest.SPLUNKD_CONNECTION_TIMEOUT
            )
        jsonResp = json.loads(serverContent)
        httpinputs = jsonResp['entry'][0]['content']
        httpinputs['tokens'] = self.get_tokens(session_key)
        version = jsonResp['generator']['version']
        httpinputs['version'] = version
        return self.render_json(httpinputs)

    @route('/', methods=['GET'])
    @expose_page(must_login=True, methods=['GET'])
    def list(self, **params):
        '''Proxies to splunkd REST API that queries the current status of hec configuration'''
        try:
            session_key = cherrypy.session.get('sessionKey')
            return self.get_http_inputs(session_key)
        except Exception, e:
            logger.exception(e)
            cherrypy.response.status = 500
            return self.render_json({'success': False, 'error': 'Internal error', 'status': 500})
