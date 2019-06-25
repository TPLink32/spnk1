import cherrypy
import json
import splunk
import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
import sys
# STREAM-3375: if splunk_app_stream bin path is not present in the sys.path, then add it to sys.path to ensure python modules are loaded
bin_path = make_splunkhome_path(['etc', 'apps', 'splunk_app_stream', 'bin'])
if bin_path not in sys.path:
    sys.path.append(bin_path)
from splunk_app_stream.models.stream import *
from splunk.appserver.mrsparkle.lib.util import make_url
from stream_utils import *
import splunk_app_stream.models.stream_forwarder_group


logger = setup_logger('streams')
if not is_splunkd_ready():
    logger.error("Exiting since splunkd is not ready")
else:
    init_date_last_updated()


# Controller class to handle the API requests related to Streams. This class acts as a proxy to the
# stream model class. All of the business logic is contained in the model class.

class Streams(controllers.BaseController):
    """Streams Controller """

    @route('/:id', methods=['GET'])
    @expose_page(must_login=False, methods=['GET'])
    def list(self, id='', **kwargs):
        """Return list of saved streams"""
        session_key = cherrypy.session.get('sessionKey')
        user_agent = cherrypy.request.headers.get('User-Agent', '').strip()
        kwargs['user_agent'] = user_agent
        header_auth_key = cherrypy.request.headers.get('X-SPLUNK-APP-STREAM-KEY', '')

        if not session_key:
            auth_success  = validate_streamfwd_auth(header_auth_key)
            if not auth_success:
                cherrypy.response.status = 401
                return None

        result = Stream.list(session_key, id, **kwargs)
        if 'status' in result:
            cherrypy.response.status = result['status']
        return self.render_json(result)


    @route('/:id/:action', methods=['POST', 'PUT'])
    @expose_page(must_login=True, methods=['POST', 'PUT'])
    def save(self, id='', action='save', **params):
        """Update posted stream """
        session_key = cherrypy.session.get('sessionKey')
        user = get_username(session_key)
        if cherrypy.request.method == 'PUT' and action in ['enable', 'disable', 'statsOnly']:
            if not id:
                cherrypy.response.status = 400
                return self.render_json({'success': False, 'error': str("Invalid id specified")})
            else:
                try:
                    orig_stream = Stream.save('', session_key, id, action, user, **params)
                    logger.debug('save::result %s', orig_stream)
                except Exception as e:
                    logger.exception(e)
                    cherrypy.response.status = 500
                    return self.render_json({'success': False, 'error': 'Bad Request', 'status': 500})
                return self.render_json(orig_stream)
        else:
            # read POST data of type application/json
            try:
                json_dict = self.parse_json_payload()
            except Exception as e:
                logger.exception(e)
                cherrypy.response.status = 500
                return self.render_json({'success': False, 'error': 'Internal error, malformed payload in the request', 'status': 500})
            result = Stream.save(json_dict, session_key, id, None, user, **params)
            if 'status' in result:
                cherrypy.response.status = result['status']
            logger.debug('save::result %s', result)
            return self.render_json(result)


    @route('/:id', methods=['DELETE'])
    @expose_page(must_login=True, methods=['DELETE'])
    def delete(self, id='', **params):
        """delete posted stream """
        session_key = cherrypy.session.get('sessionKey')
        result = Stream.delete(session_key, id)
        if 'status' in result:
            cherrypy.response.status = result['status']
        logger.info('delete::result %s', result)
        return self.render_json(result)


    def parse_json_payload(self):
        """Read request payload and parse it as JSON"""
        body = cherrypy.request.body.read()
        if not body:
            raise Exception('request payload empty')

        try:
            data = json.loads(body)
        except Exception as e:
            logger.exception(e)
            raise Exception('could not parse JSON payload')
        return data
