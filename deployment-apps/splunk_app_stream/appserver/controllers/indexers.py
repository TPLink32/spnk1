import logging
import cherrypy
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
from splunk_app_stream.models.indexer import Indexer
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
import sys
# STREAM-3375: if splunk_app_stream bin path is not present in the sys.path, then add it to sys.path to ensure python modules are loaded
bin_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_stream', 'bin'])
if bin_path not in sys.path:
    sys.path.append(bin_path)
from stream_utils import *
    
logger = setup_logger('indexers')

# Controller class to handle the API requests related to Indexers. This class acts as a proxy to the
# indexer model class. All of the business logic is contained in the model class.

class Indexers(controllers.BaseController):
    ''' Indexers Controller '''

    @route('/:id', methods=['GET'])
    @expose_page(must_login=False, methods=['GET'])
    def list(self, id='', **kwargs):
        '''Return list of indexers'''  
        session_key = cherrypy.session.get('sessionKey')
        header_auth_key = cherrypy.request.headers.get('X-SPLUNK-APP-STREAM-KEY', '')
        if not session_key:
            auth_success  = validate_streamfwd_auth(header_auth_key)        
            if not auth_success:
                cherrypy.response.status = 401
                return None
              
        content = Indexer.list(id, **kwargs)
        cherrypy.response.headers['Content-Type'] = 'application/json'
        '''Address IE6 security issue - SPL-34355'''
        return ' ' * 256 + '\n' + content

    @route('/', methods=['DELETE'])
    @expose_page(must_login=False, methods=['DELETE'])
    def delete(self, **kwargs):
        '''Return list of indexers'''                
        result = Indexer.delete()
        if 'status' in result:
            cherrypy.response.status = result['status']

        return self.render_json(result)
