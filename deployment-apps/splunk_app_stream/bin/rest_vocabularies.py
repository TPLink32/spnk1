import splunk.rest
from splunk_app_stream.models.vocabulary import Vocabulary
from stream_utils import *

logger = setup_logger('rest_vocabularies')

# REST Handler class to handle the API requests related to Vocabularies from clients using the Splunk Session key
# to authenticate. This class acts as a proxy to the vocabulary model class. All of the business logic is contained in
# the model class.

class Vocabularies(splunk.rest.BaseRestHandler):

    def handle_GET(self):
        '''Return list of vocabularies'''
        output = {}
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
                output['vocabularies'] = {'success': False, 'error': 'Unauthorized', 'status': 401}
                return output
                
        output['vocabularies'] = Vocabulary.list()                 
        return output
    