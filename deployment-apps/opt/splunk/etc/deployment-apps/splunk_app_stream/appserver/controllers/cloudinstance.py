import logging
import cherrypy
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.routes import route
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from stream_utils import *


logger = setup_logger('cloud_instance')

# Controller class to handle the API requests to get the cloud instance status

class CloudInstance(controllers.BaseController):
    ''' Cloud Instance Controller '''

    @route('/', methods=['GET'])
    @expose_page(must_login=True, methods=['GET'])
    def list(self, **params):
        try:
            return self.render_json({'is_cloud_instance': isCloudInstance()})
        except Exception, e:
            logger.exception(e)
            cherrypy.response.status = 500
            return self.render_json({'success': False, 'error': 'Internal error', 'status': 500})
