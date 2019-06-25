import logging
import os
import re
import sys
import time
import json
import copy
import splunk
import splunk.rest
from splunk.search import *
from splunk.util import uuid4
import splunk.appserver.mrsparkle.lib.util as util
import ast
from stream_utils import *
from stream_kvstore_utils import *

import jsonschema
from jsonschema import *
from jsonschema.validators import *

from IPy import IP
from ping import Ping

from stream_kvstore_utils import *

logger = setup_logger('captureipaddress')

capture_addresses_dir = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'local', "captureipaddresses")
schema_file = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'default', "blacklist_whitelist_schema")
blacklist_whitelist_schema = None
default_capture_ip_addresses_ids = ['whitelist', 'blacklist']
run_once = True
# flag to update app date last updated time if the capture ip address json file is modified out of band
update_app_last_date_time = False

#kv store
use_kv_store = is_kv_store_supported_in_splunk()

# Last updated time used to refresh cache
dateLastUpdated = 0
capture_ip_addresses_json_map = {}
whitelist_kv_store = '/servicesNS/nobody/splunk_app_stream/storage/collections/data/captureipaddresses/whitelist'
blacklist_kv_store = '/servicesNS/nobody/splunk_app_stream/storage/collections/data/captureipaddresses/blacklist'
whitelist_kv_store_session_key = misc_kv_store_uri + '/whitelist'
blacklist_kv_store_session_key = misc_kv_store_uri + '/blacklist'


try:
    schema_data = open( schema_file, 'rb' ).read()
    blacklist_whitelist_schema = dict(json.loads(schema_data.decode("utf-8")))
except Exception as e:
    logger.exception(e)
    logger.error("Error reading Blacklist/Whitelist schema file")
    raise

def is_valid_ip_address_list(json_data):
    validator = Draft4Validator(blacklist_whitelist_schema, format_checker=FormatChecker())

    if validator.is_valid(json_data):
        ip_addresses = json_data['ipAddresses']
        invalid_ips = []

        for ip_address in ip_addresses:
            try:
                ip = IP(ip_address)
            except Exception as e:
                # Maybe the ip address has a wildcard
                # The IPy library does not validate with a wildcard. Replace wildcard with a 1 and retry
                if '*' in ip_address:
                    tmp_ip = ip_address.replace('*', '1')
                    try:
                        ip = IP(tmp_ip)
                    except Exception as e:
                        logger.exception(e)
                        invalid_ips.append(ip_address)                        
                else:
                    invalid_ips.append(ip_address)

        if invalid_ips:
            logger.error("Validation Error for %s -- "
                        "Invalid IP Addresses found: %s" % (json_data['id'], ', '.join([x for x in invalid_ips])))
            return False
        else:
            return True
    else:
        for error in sorted(validator.iter_errors(json_data), key=str):
            logger.error("Invalid IP Address %s -- "
                        "Validation Error %s" % (json_data['id'], error.message))
        return False

def process_ip_address_list(id):
    #sanitize id to prevent directory traversal attack
    id = os.path.basename(id)
    capture_addresses_path = os.path.join(capture_addresses_dir, id)
    json_data = readAsJson(capture_addresses_path)
    if is_valid_ip_address_list(json_data):
        return json_data
    else:
        return {'id': id, 'ipAddresses' : []}

def init_capture_ip_addresses(session_key=None):
    global capture_ip_addresses_json_map
    if not use_kv_store:
        if os.path.exists(capture_addresses_dir):
            capture_address_ids = next(os.walk(capture_addresses_dir))[2]
            for list_id in default_capture_ip_addresses_ids:
                if list_id in capture_address_ids:
                    capture_ip_addresses_json_map[list_id] = process_ip_address_list(list_id)
                else:
                    capture_ip_addresses_json_map[list_id] = {'id': list_id, 'ipAddresses' : []}
        else:
            for list_id in default_capture_ip_addresses_ids:
                capture_ip_addresses_json_map[list_id] = {'id': list_id, 'ipAddresses' : []}
    else:
        uri = whitelist_kv_store
        if session_key:
            uri = whitelist_kv_store_session_key

        json_data = read_from_kv_store_coll(uri, session_key)
        if not json_data:
            capture_ip_addresses_json_map['whitelist'] = {'id': 'whitelist', 'ipAddresses' : []}
        else:
            capture_ip_addresses_json_map['whitelist'] = json_data

        uri = blacklist_kv_store
        if session_key:
            uri = blacklist_kv_store_session_key
        json_data = read_from_kv_store_coll(uri, session_key)
        if not json_data:
            capture_ip_addresses_json_map['blacklist'] = {'id': 'blacklist', 'ipAddresses' : []}
        else:
            capture_ip_addresses_json_map['blacklist'] = json_data


def initialize(session_key=None):
    global run_once, update_app_last_date_time
    update_cache(session_key)
    if run_once and not use_kv_store:
        for id in default_capture_ip_addresses_ids:
            if not update_app_last_date_time:
                capture_addresses_path = os.path.join(capture_addresses_dir, id)
                if is_file_modified(capture_addresses_path, dateLastUpdated):
                    logger.info("file %s has been modified out of band so updating app last updated time" % capture_addresses_path)
                    updateAppsMeta()
                    update_app_last_date_time = True
        run_once = False


#update cache if dateLastUpdated is different between cached value and the persisted value
def update_cache(session_key=None):
    global dateLastUpdated
    try:
        appsMeta = Ping.ping(session_key)
        if appsMeta['dateLastUpdated'] > dateLastUpdated:
            logger.debug("cachedateLastUpdated:: %d" % dateLastUpdated)
            logger.debug("appsDateLastUpdated:: %d" % appsMeta['dateLastUpdated'])
            init_capture_ip_addresses(session_key)
            dateLastUpdated = appsMeta['dateLastUpdated']
    except Exception as e:
        # Exception happens as appsMeta file is in the process of getting written to.
        # Do Nothing and return existing cache.
        logger.exception(e)


class CaptureIpAddress:

    @staticmethod
    def list(id=None, session_key=None):
        '''Return list of captureipaddresses including whiteList and blackList'''
        update_cache(session_key)
        if id:
            return capture_ip_addresses_json_map[id]
        else:
            return capture_ip_addresses_json_map.values()
        
    @staticmethod
    def save(req_body, id='', session_key=None):
        '''Update posted captureipaddresses '''
        global capture_ip_addresses_json_map

        #sanitize id to prevent directory traversal attack
        id = os.path.basename(id)

        if id:
            req_dict = ast.literal_eval(req_body)
            req_json_data = {'id': id, 'ipAddresses': req_dict.get('ipAddresses')}
            if is_valid_ip_address_list(req_json_data):
                if use_kv_store:
                    update_kv_store_apps_meta(session_key)
                    req_json_data['_key'] = id
                    if not save_to_kv_store(misc_kv_store_uri, id, req_json_data, session_key):
                        save_to_kv_store(misc_kv_store_uri, None, req_json_data, session_key)
                else:
                    createDir(capture_addresses_dir + os.sep)
                    writeAsJson(os.path.join(capture_addresses_dir, id), req_json_data)
   
                return req_json_data
            else:
                return {'success': False, 'error': str("Bad Request, invalid ip address(es) found"), 'status': 500}
        else:
            return {'success': False, 'error': str("Bad Request, id required"), 'status': 400}