import logging
import os, re
import splunk.appserver.mrsparkle.controllers as controllers
import splunk.appserver.mrsparkle.lib.util as util
from stream_utils import *
from stream_kvstore_utils import *
from ping import Ping

logger = setup_logger('streamfwdauth')

# Last updated time used to refresh cache
dateLastUpdated = 0

streamfwd_auth_file = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'local', 'streamfwdauth')
streamfwd_auth_kv_store_with_session_key_uri = misc_kv_store_uri + '/streamfwdauth'

def init_streamfwdauth(sessionKey=None):
    global dateLastUpdated
    try:
        pingData = Ping.ping(sessionKey)
        if pingData['dateLastUpdated'] > dateLastUpdated:
            logger.debug("cacheDateLastUpdated:: %d" % dateLastUpdated)
            logger.debug("appsDateLastUpdated:: %d" % pingData['dateLastUpdated'])
            dateLastUpdated = pingData['dateLastUpdated']
    except Exception as e:
        # Exception happens as appsMeta file is in the process of getting written to.
        # Do Nothing and return existing cache.
        logger.exception(e)

def create_streamfwdauth_data(enabled=False, authKey='', kvstore=False):
    data = {}
    if kvstore:
        data['id'] = 'streamfwdauth'
        data['_key'] = 'streamfwdauth'
    data['enabled'] = enabled
    data['authKey'] = authKey
    return data

def is_valid_streamfwd_auth(enabled, authKey):
    validChars = re.compile("^[0-9A-z@%+/\\'!#$^?:,(){}[\]~`\-_]*$")
    if (enabled and len(authKey) == 0) or not validChars.match(authKey):
        return False
    return True

class StreamForwarderAuth:

    @staticmethod
    def get(sessionKey=None):
        try:
            if sessionKey:
                init_streamfwdauth(sessionKey)
                if is_kv_store_supported_in_splunk(sessionKey):
                    return read_from_kv_store_coll(streamfwd_auth_kv_store_with_session_key_uri, sessionKey)
                else:
                    streamfwd_auth = readAsJson(streamfwd_auth_file)
                    if streamfwd_auth == 'NotFound':
                        return create_streamfwdauth_data()
                    return streamfwd_auth
            else:
                return {'success': False, 'error': 'Unauthorized Access', 'status': 401}
        except Exception as e:
            logger.exception(e)

    @staticmethod
    def save(enabled=False, authKey='', sessionKey=None):
        try:
            if sessionKey:
                init_streamfwdauth(sessionKey)
                authKey = authKey.strip()

                if not is_valid_streamfwd_auth(enabled, authKey):
                    return {'success': False, 'error': 'Bad Request, Invalid stream forwarder auth configuration', 'status': 400}

                if is_kv_store_supported_in_splunk(sessionKey):
                    update_kv_store_apps_meta(sessionKey)
                    data = create_streamfwdauth_data(enabled, authKey, True)
                    if not save_to_kv_store(misc_kv_store_uri, 'streamfwdauth', data, sessionKey):
                        save_to_kv_store(misc_kv_store_uri, None, data, sessionKey)
                else:
                    data = create_streamfwdauth_data(enabled, authKey)
                    writeAsJson(os.path.join(streamfwd_auth_file), data)

                return data
            else:
                return {'success': False, 'error': 'Unauthorized Access', 'status': 401}
        except Exception as e:
            logger.exception(e)
