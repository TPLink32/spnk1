import logging
import os
import re
import sys
import time
import json
from datetime import datetime as dt
from copy import copy
import splunk
import splunk.rest
from splunk.search import *
from splunk.util import uuid4
import splunk.appserver.mrsparkle.controllers as controllers
import splunk.appserver.mrsparkle.lib.util as util
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
import splunk.appserver.mrsparkle.lib.apps as apps
from splunk_app_stream.models.vocabulary import Vocabulary
import splunk.appserver.mrsparkle.lib.util as app_util
import splunk.version
import ast
import cgi
from stream_utils import *
from ping import Ping
from stream_kvstore_utils import *

import jsonschema
from jsonschema import *
from jsonschema.validators import *
import HTMLParser
import cherrypy
from sets import Set
import threading


logger = setup_logger('streamforwardergroup')
DIR_NAME = 'streamforwardergroups'
DEFAULT_GROUP = "defaultgroup"
DEFAULT_GROUP_DESCRIPTION = "Used when there is no matching group found for a given stream forwarder ID"
DEFAULT_GROUP_RULE = ''
# Last updated time used to refresh cache
dateLastUpdated = 0
# cache of all stream forwarder groups
stream_forwarder_groups_rules_map = {}

all_streams = set()

run_once = True
# flag to update app date last updated time if a stream forwarder group json file is modified out of band
update_app_last_date_time = False

# stream forwarder group schema location
schema_path = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'default', 'stream_forwarder_group_schema')
schema = None

#kv store
use_kv_store = is_kv_store_supported_in_splunk()

try:
    schema_data = open(schema_path, 'rb' ).read()
    schema = dict(json.loads(schema_data.decode("utf-8")))
except Exception as e:
    logger.exception(e)
    logger.error("Error reading Stream forwarder group schema file")
    raise

errors = ['NotFound', 'InvalidDefinition', 'IdMismatch']
# config files locations
default_dir = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'default', DIR_NAME)
local_dir = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'local', DIR_NAME)

lock = threading.Lock()

def init_date_last_updated():
    global dateLastUpdated
    pingData = Ping.ping()
    dateLastUpdated = pingData['dateLastUpdated']


def set_valid_streams(streams):
    global all_streams
    all_streams = streams

# returns true if the streams are valid and returns only the list of valid streams after filtering out the non existing streams
def get_valid_streams(streams):
    global all_streams
    valid_streams = list(set(streams) & all_streams)
    return (len(valid_streams) == len(streams), valid_streams)
   

# creates a default group in local using the existing streams
def create_default_group(session_key=None):
    if not use_kv_store:
        local_default_group = os.path.join(local_dir, DEFAULT_GROUP)
        if not os.path.exists(local_default_group):
            logger.info("local defaultgroup not found %s", local_default_group )
            json_data = readAsJson(os.path.join(default_dir, DEFAULT_GROUP))
            json_data['streams'] = list(all_streams)
            createDir(local_dir + os.sep)
            writeAsJson(local_default_group, json_data)
    else:
        if session_key:
            uri = stream_forwarder_groups_kv_store_coll + '/defaultgroup'
            logger.info('in creating default group: %s' % uri)
            kv_default_group = read_from_kv_store_coll(uri, session_key)
            if 'id' in kv_default_group and kv_default_group['id'] == 'defaultgroup':
                logger.info('defaultgroup already exists in kv store')
            else:
                logger.info('creating defaultgroup in kv store')
                json_data = readAsJson(os.path.join(default_dir, DEFAULT_GROUP))
                json_data['streams'] = list(all_streams)
                json_data['_key'] = json_data['id']
                kv_store_rest_request( stream_forwarder_groups_kv_store_coll, 'POST', session_key, False, json_data)


#update default group with new streams added in the upgraded version
def update_default_group(new_streams, session_key=None):
    if new_streams:
        if not use_kv_store:
            local_default_group = os.path.join(local_dir, DEFAULT_GROUP)
            if not os.path.exists(local_default_group):
                logger.error("Default group was not created")
            else:
                json_data = readAsJson(local_default_group)
                streams = set(json_data['streams']) | set(new_streams)
                json_data['streams'] = list(streams)
                writeAsJson(local_default_group, json_data)
        else:
            if session_key:
                logger.info('updating default group in kvstore')
                uri = stream_forwarder_groups_kv_store_coll + '/defaultgroup'
                kv_default_group = read_from_kv_store_coll(uri, session_key)
                if 'id' in kv_default_group and kv_default_group['id'] == 'defaultgroup':
                    streams = set(kv_default_group['streams']) | set(new_streams)
                    kv_default_group['streams'] = list(streams)
                    logger.info('uri in updating defaultgroup %s' % uri)
                    kv_store_rest_request( uri, 'POST', session_key, False, kv_default_group)




# check for duplicate rule
def is_duplicate_rule(id, rule):
    for g in list(stream_forwarder_groups_rules_map.values()):
        if id != g['id'] and rule == g['rule']:
            logger.error("Duplicate rule, already exists in Stream forwarder group %s" % g['id'])
            return True
    return False

def add_default_hec_config(json_data):
    json_data['hec'] = {}
    json_data['hec']['autoConfig'] = True 

# initialize cache, read from default and local locations 
def init_stream_forwarder_groups(session_key=None):
    global stream_forwarder_groups_rules_map, run_once, lock
    lock.acquire()
    try:
        stream_forwarder_groups_rules_map = {}

        if not use_kv_store:
            (default_ids, local_ids) = get_ids()

            for id in local_ids:        
                logger.debug("local stream forwarder group %s" % id)
                json_data = read_as_json(id, local_dir)            
                if not json_data in errors:
                    #add the default hec config if its not present in the group definition
                    if json_data and 'hec' not in json_data:
                        add_default_hec_config(json_data)
                    stream_forwarder_groups_rules_map[json_data['rule']] = json_data
        else:
            groups = read_groups_from_kv_store(session_key)
            for g in groups:
                valid_group = is_valid_group(g, g['id'])            
                if not valid_group in errors:
                    if valid_group and 'hec' not in valid_group:
                        add_default_hec_config(valid_group)
                    stream_forwarder_groups_rules_map[valid_group['rule']] = valid_group
        run_once = False
    finally:
        lock.release()

def read_groups_from_kv_store(session_key):
    return read_group_by_id_from_kv_store(session_key)

def read_group_by_id_from_kv_store(session_key, id=None):
    uri = stream_forwarder_groups_kv_store_coll
    if id:
        uri = stream_forwarder_groups_kv_store_coll + '/' + id 

    groups_kv_store = read_from_kv_store_coll(uri, session_key)
    if 'error' in groups_kv_store:
        logger.error('read_streams_from_kv_store: Error getting streams from stream kv store collection, reason %s', groups_kv_store['error'])
        return []
    else:
        return groups_kv_store

def update_cache(json_data):
    global stream_forwarder_groups_rules_map, dateLastUpdated, lock
    lock.acquire()
    try:
        for k, v in stream_forwarder_groups_rules_map.iteritems():
            if v['id'] == json_data['id']:
                if v['rule'] != json_data['rule']:
                    del stream_forwarder_groups_rules_map[k]
                break 
        stream_forwarder_groups_rules_map[json_data['rule']] = json_data
        dateLastUpdated = int(round(time.time() * 1000))
        logger.info('in update_cache %s' % dateLastUpdated)
    finally:
        lock.release()

def remove_from_cache(group_id):
    global stream_forwarder_groups_rules_map, dateLastUpdated, lock
    lock.acquire()
    try:
        for k, v in stream_forwarder_groups_rules_map.iteritems():
            if group_id == v['id']:
                del stream_forwarder_groups_rules_map[k]
                break
        dateLastUpdated = int(round(time.time() * 1000))
        logger.info('in remove_from_cache %s' % dateLastUpdated)
    finally:
        lock.release()

# reads config as json after performing validation against the schema
def read_as_json(id, dir):
    global run_once, update_app_last_date_time
    #sanitize  id to prevent directory traversal attack
    group_id = os.path.basename(id)
    group_path = os.path.join(dir, group_id)
    try:
        f = open( group_path, 'r' )
        try:
            # check if the json file is modified out of band
            if not use_kv_store and run_once and not update_app_last_date_time:
                if is_file_modified(group_path, dateLastUpdated):
                    logger.info("file %s has been modified out of band so updating app last updated time" % group_path)
                    updateAppsMeta()
                    update_app_last_date_time = True
            data = f.read()
            json_data = json.loads(data, object_pairs_hook=OrderedDict)
            return is_valid_group(json_data, group_id)
        except:
            return 'NotFound'
        finally:
            f.close()  
    except Exception, ex:
        logger.error("IOerror, unable to write to file") 
        logger.exception(ex)  

def is_valid_group(json_data, group_id):
    if is_valid(json_data):
        (v, s) = get_valid_streams(json_data['streams'])
        json_data['streams'] = s
        if json_data['id'] == group_id:
            return json_data
        else:
            logger.error("Stream forwarder group Id mismatch -- Id does not match file name at :: %s" % group_path)
            return 'IdMismatch'
    else:
        return 'InvalidDefinition'

# Delete a stream forwarder group, delete is not allowed for default group
def delete(id, session_key):
    delete_succeeded = False

    #sanitize id to prevent directory traversal attack
    group_id = os.path.basename(id)
    if group_id != DEFAULT_GROUP:    
        if not use_kv_store:
            group_path = os.path.join(local_dir, group_id)
            json_data = readAsJson(group_path)

            if json_data != "NotFound":
                try:
                    os.remove(group_path)
                    updateAppsMeta()
                    delete_succeeded = True
                except OSError:
                    pass
        else:
            try:
                serverResponse, serverContent = kv_store_rest_request(stream_forwarder_groups_kv_store_coll + '/' + group_id,
                                                                      'DELETE', session_key)
                delete_succeeded = True
                update_kv_store_apps_meta(session_key)
            except splunk.RESTException, re:
                logger.error("REST Exception Caught when invoking REST API :: %s" % str(re))            
    if delete_succeeded:
        remove_from_cache(id)
    return delete_succeeded

def is_group_id_in_cache(group_id):
    groups = stream_forwarder_groups_rules_map.values()
    for g in groups:
        if group_id == g['id']:
            return True
    else:
        return False

# update a stream forwarder group
def update(id, json_data, session_key):
    #sanitize id to prevent directory traversal attack
    group_id = os.path.basename(id)
    save_succeeded = False 
    if not use_kv_store:   
        group_path = os.path.join(local_dir, group_id)
        logger.debug("save:: %s" % group_path)
        createDir(local_dir + os.sep)
        save_succeeded = writeAsJson(group_path, json_data)
    else:
        json_data['_key'] = json_data['id']
        if is_group_id_in_cache(group_id):
            save_succeeded = save_to_kv_store(stream_forwarder_groups_kv_store_coll, group_id, json_data, session_key)
        else:
            save_succeeded = save_to_kv_store(stream_forwarder_groups_kv_store_coll, None, json_data, session_key)
    if save_succeeded:
        update_cache(json_data)
    return save_succeeded

# get ids of all stream forwarder groups
def get_ids(session_key=None):
    default_ids = []
    local_ids = []
    if not use_kv_store:
        if os.path.exists(default_dir):
            default_ids = filter(lambda(x): not x.startswith('.'), next(os.walk(default_dir))[2])

        if os.path.exists(local_dir):
            local_ids = filter(lambda(x): not x.startswith('.'), next(os.walk(local_dir))[2])
    else:
        groups = read_groups_from_kv_store(session_key)
        local_ids = [g['id'] for g in groups]

    return default_ids, local_ids

# get stream forwarder group by id
def get_by_id(id, session_key=None):
    json_data = None
    if not use_kv_store:
        id = os.path.basename(id)
        json_data = read_as_json(id, local_dir)
        if not json_data in errors:
            #add the default hec config if not present for backward compatibility
            if json_data and 'hec' not in json_data:
                add_default_hec_config(json_data)
            return json_data
        else:
            json_data = read_as_json(id, default_dir)
            if not json_data in errors: 
                #add the default hec config if not present for backward compatibility
                if json_data and 'hec' not in json_data:
                    add_default_hec_config(json_data)
                return json_data
            else:
                json_data = None
    else:
        json_data = read_group_by_id_from_kv_store(session_key, id)
        #add the default hec config if not present for backward compatibility
        if json_data and 'hec' not in json_data:
            add_default_hec_config(json_data)
    return json_data

# validate stream forwarder 
def is_valid(json_data):
    h = HTMLParser.HTMLParser()
    validator = Draft4Validator(schema)
    valid_stream_forwarder_group_id_regex = '^\w+$'
    if 'default' == json_data['id']:
        error_msg = "Invalid Stream forwarder group definition for stream with id %s --  Id cannot be called 'default' " % json_data['id']
        logger.error(error_msg)
        return False
    elif not re.compile(valid_stream_forwarder_group_id_regex).match(json_data['id']):
        error_msg = "Invalid Stream forwarder group definition for stream with id %s --  only letters, digits and underscores ('_') allowed for Id" % json_data['id']
        logger.error(error_msg)
        return False
    
    try:
        if 'hec' in json_data and 'urls' in json_data['hec']:
            for url in json_data['hec']['urls']:
                if not url.startswith('http://') and not url.startswith('https://'):
                    logger.error("Invalid url:: %s for hec config" % url)
                    return False
    except Exception as e:
        logger.exception(e)
        pass

    if not validator.is_valid(json_data):
        for error in sorted(validator.iter_errors(json_data), key=str):
            logger.error("Invalid Stream forwarder group definition for group with id %s"
                        "Validation Error %s" % (json_data['id'], error.message))
        return False
    else:      
        invalid_regex = False
        
        # check for validity of regex
        regex = json_data['rule']
        try:
            re.compile(regex)
        except Exception as e:
            logger.exception(e)
            invalid_regex = True

        # check for default group the regex is always ".*"
        if json_data['id'] == DEFAULT_GROUP and regex != DEFAULT_GROUP_RULE:
            logger.error("Invalid regex for default group, should be empty")
            return False

        if invalid_regex:                   
            logger.error("Invalid Stream forwarder group definition for group with id %s -- "
                         "Rule with invalid regex found :: %s" %
                         (json_data['id'], ', '.join(json_data['rule'])))

            return False
        else:
            return True

#update cache if dateLastUpdated is different between cached value and the persisted value
def update_stream_forwarder_groups_cache(session_key=None):
    global dateLastUpdated
    try:
        appsMeta = Ping.ping(session_key)
        if appsMeta['dateLastUpdated'] > dateLastUpdated:
            logger.debug("cachedateLastUpdated:: %d" % dateLastUpdated)
            logger.debug("appsDateLastUpdated:: %d" % appsMeta['dateLastUpdated'])
            init_stream_forwarder_groups(session_key)
            dateLastUpdated = appsMeta['dateLastUpdated']
    except Exception as e:
        # Exception happens as appsMeta file is in the process of getting written to.
        # Do Nothing and return existing cache.
        logger.exception(e)


class StreamForwarderGroup:
    
    @staticmethod
    def list(session_key=None, id='', **kwargs):
        """Return a list of stream forwarder group"""   
        global dateLastUpdated    
        stream_forwarder_id = kwargs.get('streamForwarderId', '')
        # if streamforwarderid is present then just return the matched group for the streamforwarderid
        if stream_forwarder_id:
            return StreamForwarderGroup.match(stream_forwarder_id, session_key)

        #sanitize stream forwarder group id to prevent directory traversal attack
        id = os.path.basename(id)

        #refresh cache if timestamp is different
        update_stream_forwarder_groups_cache(session_key)
        

        #If no id is specified, list all stream forwarder groups
        if not id:
            return list(stream_forwarder_groups_rules_map.values())
        else:
            id = os.path.basename(id)
            found_stream_forwarder_group = get_by_id(id, session_key)
            if found_stream_forwarder_group:
                return found_stream_forwarder_group
            else:
                return {'success': False, 'error': str("Stream forwarder group with specified id not found"), 'status': 404}


    @staticmethod
    def save(json_data, id='', user=None, session_key=None):

        #sanitize stream id to prevent directory traversal attack
        id = os.path.basename(id)

        # read POST data of type application/json
        try:
            #remove the urls from json data for hec autoconfig true
            if 'hec' in json_data:
                hec = json_data['hec']            
                if hec['autoConfig'] and 'urls' in hec:
                    del hec['urls']
    
            if not id:
                id = json_data['id']
                (default_ids, local_ids) = get_ids(session_key)
                if id in local_ids:
                    return {'success': False, 'error': str("Stream forwarder group with the same id already exists"), 'status': 400}
                elif id in default_ids: 
                    return {'success': False, 'error': str("Stream forwarder group with the same id already exists"), 'status': 400}
                else:
                    stream_forwarder_group_json = json_data
                    if user:
                        stream_forwarder_group_json['createdBy'] = user
            else:
                stream_forwarder_group_json = json_data
                stream_forwarder_group_json['id'] = id
                if id == DEFAULT_GROUP: 
                    if stream_forwarder_group_json['rule'] != DEFAULT_GROUP_RULE:
                        logger.error("defaultgroup rule cannot be modified")
                        return {'success': False, 'error': "defaultgroup rule cannot be modified", 'status': 500}
                    if len(stream_forwarder_group_json['description']) != len(DEFAULT_GROUP_DESCRIPTION) or stream_forwarder_group_json['description'] != DEFAULT_GROUP_DESCRIPTION:                            
                        logger.error("defaultgroup description cannot be modified")
                        return {'success': False, 'error': "defaultgroup description cannot be modified", 'status': 500}

                logger.debug("stream forwarder group id passed as arg: %s" % id)
                if user:
                    stream_forwarder_group_json['modifiedBy'] = user
        except Exception as e:
            logger.exception(e)
            return {'success': False, 'error': 'Internal error, updating the stream forwarder group', 'status': 500}

        if is_valid(stream_forwarder_group_json):
            if is_duplicate_rule(id, stream_forwarder_group_json['rule']):
                logger.error("Duplicate rule found for Stream forwarder group with id %s" % json_data['id'])
                return {'success': False, 'error': "Duplicate rule already exists", 'status': 500}


            (v, s) = get_valid_streams(stream_forwarder_group_json['streams'])
            if not v:
                stream_forwarder_group_json['streams'] = s
                logger.error("Saving after removing non existing streams for Stream forwarder group with id %s" % json_data['id'])
 
            saved_json = update(id, stream_forwarder_group_json, session_key)
            if saved_json == "NotFound":
                logger.error("Failed to update stream forwarder group %s" % id)
                raise Exception('Failed to update stream forwarder group')
            
            return stream_forwarder_group_json
        else:
            return {'success': False, 'error': "Invalid Stream Forwarder Group Definition", 'status': 500}

    @staticmethod
    def delete(id='', session_key=None):
        #sanitize id to prevent directory traversal attack
        id = os.path.basename(id)

        try:
            if not id:
                return {'success': False, 'error': str("Invalid Request Data"), 'status': 400}
            else:
                if delete(id, session_key):
                    return {'success': True, 'deleted': str(id)}
                else:
                    return {'success': False, 'error': str("Delete failed"), 'status': 400}
        except Exception as e:
            logger.exception(e)
            return {'success': False, 'error': 'Internal error, deleting the stream forwarder group', 'status': 500}

    @staticmethod
    def match(stream_forwarder_id='', session_key=None):
        matched_groups = []
        matched_group_ids = []
            
        rules = list(stream_forwarder_groups_rules_map.keys())

        if not rules:
            init_stream_forwarder_groups(session_key)
            rules = list(stream_forwarder_groups_rules_map.keys())
    
        # defaultgroup is used as a "catch all" group when there is no match found. It has empty regex in its rule.
        # Empty regex actually matches everything, so remove it from the list of rules before performing matching.       
        # BTW, if the user decides to create a group with ".*" explicitly, then defaultgroup is irrelevant 
        # because all streamforwarders will have at least one matched group since ".*" matches any string
        # including an empty string.
        try:
            rules.remove('')
        except:
            pass
        for r in rules:
            # adding the marker '$' to ensure exact match
            if re.compile(r+'$', re.I).match(stream_forwarder_id):
                matched_group_ids.append(stream_forwarder_groups_rules_map[r]['id'])
                matched_groups.append(stream_forwarder_groups_rules_map[r])
        #If no matched group found, then use the defaultgroup
        if matched_groups:
            logger.info("matched groups found for id %s: [%s]" % (stream_forwarder_id, ', '.join(matched_group_ids)))
        else:
            logger.info("no matched stream forwarder group found for id %s" % stream_forwarder_id)
            default_group = stream_forwarder_groups_rules_map['']
            matched_groups.append(default_group)
        return matched_groups



