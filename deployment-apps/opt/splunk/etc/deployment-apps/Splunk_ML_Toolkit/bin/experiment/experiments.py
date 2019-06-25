"""
This module contains utility methods needed by both experiments.base and experiments.listexperiments
"""
# !/usr/bin/env python
import csv
import errno
import json
import os
import re
import traceback
import uuid

import cexc
from exec_anaconda import get_staging_area_path
from lookups.lookups_util import (
    file_name_to_path,
    get_lookups_from_splunk,
    load_lookup_file_from_disk,
    lookups_parse_reply,
    rest_proxy_from_searchinfo,
)
from util import rest_url_util
from util.base_util import is_valid_identifier
from util.constants import (
    EXPERIMENT_FILE_REGEX,
    EXPERIMENT_ID_REGEX,
    EXPERIMENT_PREFIX,
    EXPERIMENT_TYPES_MAP,
)

logger = cexc.get_logger(__name__)
messages = cexc.get_messages_logger()

experiment_staging_dir = get_staging_area_path()

_experiment_re = re.compile(EXPERIMENT_FILE_REGEX)


class ExperimentNotFoundException(RuntimeError):
    def __init__(self):
        super(ExperimentNotFoundException, self).__init__('Experiment does not exist')


class ExperimentNotAuthorizedException(Exception):
    def __init__(self):
        super(ExperimentNotAuthorizedException, self).__init__('Permission denied')


def parse_reply(reply=None):
    return lookups_parse_reply(ExperimentNotFoundException(), ExperimentNotAuthorizedException(), reply)


def experiment_name_to_filename(experiment_name, experiment_type):
    if not is_valid_identifier(experiment_name):
        raise Exception("Invalid experiment name '%s'" % experiment_name)
    return '_'.join((EXPERIMENT_PREFIX, experiment_type, experiment_name)) + ".csv"


def experiment_id_to_filename(experiment_id):
    m = re.search(EXPERIMENT_ID_REGEX, experiment_id)
    if not m:
        raise Exception("Invalid experiment id '%s'" % experiment_id)

    experiment_type = m.group('experiment_type')
    experiment_name = m.group('experiment_name')
    return experiment_name_to_filename(experiment_name, experiment_type)


def get_experiment_from_lookup(lookup_info):
    """
    Adds experiment-specific information to one of the entries from /lookup-table-files

    Args:
        lookup_info (dict): An entry containing information about a lookup file

    Returns:
        lookup_info (dict): The input, augmented with experiement-specific information
    """

    # define some defalt values here if something goes wrong loading the experiment
    experiment_name = 'Unknown'
    experiment_type = 'Unknown'
    try:
        match = _experiment_re.match(lookup_info['name'])
        experiment_name = match.group('experiment_name')
        experiment_type = match.group('experiment_type')
        experiment_data = load_lookup_file_from_disk(lookup_info['content']['eai:data'])
        experiment = json.loads(experiment_data['experiment'])
    except Exception as e:
        # if we fail to load the experiment, we should still populate lookup info as best we can
        experiment = {}

        logger.warn(traceback.format_exc())
        messages.warn('Failed to load experiment "%s" of type "%s"', experiment_name, experiment_type)

    experiment['id'] = experiment_name # can't use the "id" inside options because it may be inconsistent with the lookup file name
    experiment['type'] = experiment_type # can't use the "type" inside options because it may be inconsistent with the lookup file name
    lookup_info['content']['mlspl:experiment_info'] = experiment

    return lookup_info


def load_experiments(searchinfo, query_params=None, namespace='user'):
    """
    Load the experiment lookup files from disk

    Args:
        searchinfo (dict): a searchinfo object
        query_params (list): a list of tuples representing URL params, ie. [(count, -1)]
        namespace (str): namespace of the current operation

    Returns:
        lookup_files (dict): a map from a lookup file's location on disk to info with the actual experiment data attached to the content
    """
    if query_params is None:
        query_params = []
    query_params.append(('search', 'name={}_*.csv'.format(EXPERIMENT_PREFIX)))
    lookup_files = get_lookups_from_splunk(searchinfo, namespace, parse_reply, query_params)
    lookup_files['entry'] = map(get_experiment_from_lookup, lookup_files['entry'])
    return lookup_files
    

def save_experiment(experiment, update, searchinfo, experiment_dir=experiment_staging_dir, namespace='user'):
    try:
        os.makedirs(experiment_dir)
    except OSError as e:
        if e.errno == errno.EEXIST and os.path.isdir(experiment_dir):
            pass
        else:
            cexc.log_traceback()
            raise Exception("Error creating experiment: %s, %s" % (experiment["id"], e))

    experiment_name_to_open = '_' + str(uuid.uuid1()).replace('-', '_')
    # raises if invalid
    experiment_type_long = experiment['type'].lower()
    experiment_type_short = EXPERIMENT_TYPES_MAP[experiment_type_long]
    file_path = file_name_to_path(experiment_name_to_filename(experiment_name_to_open, experiment_type_short), experiment_dir)
    logger.debug('Saving experiment: %s' % file_path)

    with open(file_path, mode='w') as f:
        experiment_writer = csv.writer(f)

        # TODO: Version attribute
        experiment_writer.writerow(['experiment'])
        experiment_writer.writerow([json.dumps(experiment)])

    experiment_filename = experiment_name_to_filename(experiment["id"], experiment_type_short)
    # File is closed at this point, but f.name is still accessible.
    reply = move_experiment_file_from_staging(experiment_filename, update, searchinfo, namespace, f.name)

    # decorate the new lookup file with experiment-specific info
    reply['entry'][0] = get_experiment_from_lookup(reply['entry'][0])

    return reply


def move_experiment_file_from_staging(experiment_filename, update, searchinfo, namespace, filename):
    rest_proxy = rest_proxy_from_searchinfo(searchinfo)
    url = rest_url_util.make_lookup_url(rest_proxy, namespace, lookup_file=experiment_filename)

    payload = {
        'eai:data': filename,
        'output_mode': 'json'
    }

    if not update:
        payload['name'] = experiment_filename

    reply = rest_proxy.make_rest_call('POST', url, payload)

    try:
        parsed_reply = parse_reply(reply)
        return parsed_reply
    except Exception as parse_exception:
        try:
            # if the experiment save fails, clean up the temp experiment file
            os.unlink(filename)
        # if we somehow fail to clean up the temp experiment, don't expose the error to the user
        except Exception as delete_exception:
            logger.debug(delete_exception)
        raise parse_exception


def delete_experiment(experiment_id, searchinfo, namespace):
    """
    Delete an experiment

    Args:
        experiment_id (str): <experiment_type>_<experiment_name>
        searchinfo (dict): a searchinfo object
        namespace (str): namespace ('user' or 'app')

    Returns:
        None
    """
    rest_proxy = rest_proxy_from_searchinfo(searchinfo)
    experiment_filename = experiment_id_to_filename(experiment_id)
    url = rest_url_util.make_lookup_url(rest_proxy, namespace, lookup_file=experiment_filename)
    # Leverage on Splunk's lookup-table REST API.
    reply = rest_proxy.make_rest_call('DELETE', url)

    if not reply['success']:
        parse_reply(reply)
