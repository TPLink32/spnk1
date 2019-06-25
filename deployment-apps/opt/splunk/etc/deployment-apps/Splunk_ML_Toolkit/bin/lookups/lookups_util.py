import copy
import csv
import json
import os

import cexc
from util.constants import DEFAULT_LOOKUPS_DIR, CSV_FILESIZE_LIMIT
from util.file_util import file_exists
from util.rest_proxy import rest_proxy_from_searchinfo
from util.rest_url_util import make_get_lookup_url

logger = cexc.get_logger(__name__)
messages = cexc.get_messages_logger()

def build_lookups_query_params(query_params, username):
    """
    Adds additional filtering to the query received from REST to show only the current user has access to

    Args:
        query_params (array): an array of tuples representing URL params, ie. [(count, -1)]
        username (string): the current user

    Returns:
        query_params_copy (array): a copy of query_params augmented with additional filtering
    """
    query_params_copy = copy.deepcopy(query_params)

    # based on availableWithUserWildCardSearchString() from SplunkWebCore's SplunkDsBase.js
    escaped_username = json.dumps(username)
    user_filter = '((eai:acl.sharing="user" AND eai:acl.owner=%s) OR (eai:acl.sharing!="user"))' % escaped_username
    query_params_copy.append(('search', user_filter))

    return query_params_copy


def get_lookups_from_splunk(searchinfo, namespace, cb_reply_parser, query_params):
    """
    Gets a list of models from Splunk's /lookup-table-files endpoint

    Args:
        searchinfo (set): a seachinfo object
        namespace (string): which namespace to get lookups from
        cb_reply_parser(function): a callback to process the reply from splunk
        query_params (list): a list of tuples representing URL params, ie. [(count, -1)]

    Returns:
        lookup_files (set): a map from a lookup file's location on disk to info about it
    """

    rest_proxy = rest_proxy_from_searchinfo(searchinfo)

    # searchinfo can be null, in which case we should fall back to the safe 'nobody' username because we can't get the user
    try:
        username = rest_proxy.splunk_user
    except AttributeError:
        username = 'nobody'

    query_params_copy = build_lookups_query_params(query_params, username)
    url = make_get_lookup_url(rest_proxy, namespace=namespace, lookup_file=None, url_params=query_params_copy)
    reply = rest_proxy.make_rest_call('GET', url)
    lookup_files = cb_reply_parser(reply)

    return lookup_files

# TODO: Refactor to not pass exception object
def lookups_parse_reply(notFound, notAuthorized, reply=None):
    if reply:
        try:
            content = reply.get('content')
            json_content = json.loads(content)
            if reply['success']:
                return json_content
            else:
                error_type = reply.get('error_type')
                error_text = json_content.get('messages')[0].get('text')
                if error_type is None:
                    raise RuntimeError(error_text)
                elif error_type == 'ResourceNotFound':
                    raise notFound
                elif error_type == 'AuthorizationFailed':
                    raise notAuthorized
                else:
                    raise RuntimeError(error_type + ', ' + error_text)
        except Exception as e:
            # TODO: If this is a general util function now,
            # better to delegate error handling to the user of the util function.
            logger.debug(e.message)
            logger.debug(reply)
            raise e
    else:
        raise RuntimeError("No reply received")


def file_name_to_path(file_name, lookups_dir=DEFAULT_LOOKUPS_DIR):
    if file_name != os.path.basename(file_name):
        raise ValueError("Invalid filename {}".format(file_name))
    file_path = os.path.join(lookups_dir, file_name)
    return file_path


def load_lookup_file_from_disk(file_path):
    """
    parse the lookup file from the given path and return the result

    Args:
        file_path (string): the path to the lookup file

    Returns:
        lookup_data (dict): result from the csv parser
    """
    if not file_exists(file_path):
        raise RuntimeError('Not valid filepath: {}'.format(file_path))

    try:
        with open(file_path, mode='r') as f:
            reader = csv.DictReader(f)
            csv.field_size_limit(CSV_FILESIZE_LIMIT)
            lookup_data = reader.next()
    except Exception as e:
        raise RuntimeError('Error reading model file: %s, %s' % (file_path, str(e)))

    return lookup_data
