import time
import logging
import splunk.appserver.mrsparkle.lib.util as util
from stream_utils import *
from stream_kvstore_utils import *

localDir = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'local')
logger = setup_logger('ping')

# used to ensure that the meta file is checked at most once per second
timeLastMetaCheck = 0
cachedAppsMetaData = {}

#kv store
use_kv_store = is_kv_store_supported_in_splunk()

class Ping:

    @staticmethod
    def ping(session_key=None, refresh=False):
        '''Return last update status and app version'''
        global cachedAppsMetaData, timeLastMetaCheck
        currentTimeSeconds = int(time.time())
        # refresh parameter to refresh the cacheAppsMetaData when changes have been made via rest_ping handler or 
        # if shc member then refresh the cacheAppsMetaData since an update could have happened via another shc member
        if refresh == True or (timeLastMetaCheck != currentTimeSeconds and is_search_head_shc_member(session_key)):
            # reset the cache
            cachedAppsMetaData = {}

        if not cachedAppsMetaData:
            if not use_kv_store:
                createDir(localDir + os.sep)
                cachedAppsMetaData = readAsJson(appsMetaFile)
                if cachedAppsMetaData is 'NotFound':
                    cachedAppsMetaData = updateAppsMeta()
                    timeLastMetaCheck = currentTimeSeconds
            else:
                cachedAppsMetaData = read_kv_store_apps_meta(session_key)            
                if not cachedAppsMetaData:
                    # no cachedAppsMetaData then it is prestine installation so update only if there is a session key
                    if session_key:
                        cachedAppsMetaData = update_kv_store_apps_meta(session_key, True)
                timeLastMetaCheck = currentTimeSeconds

        return cachedAppsMetaData

    @staticmethod
    def update_cache(json_data):
        global cachedAppsMetaData
        cachedAppsMetaData = json_data
        return cachedAppsMetaData
