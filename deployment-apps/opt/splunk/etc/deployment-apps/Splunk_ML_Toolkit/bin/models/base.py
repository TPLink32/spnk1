#!/usr/bin/env python

import csv
import errno
import json
import os
import traceback
import uuid
from distutils.version import StrictVersion

import numpy as np

import cexc
import models.models_util as models_util
from codec import MLSPLEncoder, MLSPLDecoder
from exec_anaconda import get_staging_area_path
from lookups.lookups_util import file_name_to_path
from util import btool_util, rest_url_util
from util.algos import initialize_algo_class
from util.base_util import is_valid_identifier
from util.constants import DEFAULT_LOOKUPS_DIR
from util.param_util import missing_keys_in_dict
from util.rest_proxy import rest_proxy_from_searchinfo

logger = cexc.get_logger(__name__)
messages = cexc.get_messages_logger()

model_staging_dir = get_staging_area_path()


def load_model(model_name,
               searchinfo,
               namespace=None,
               model_dir=DEFAULT_LOOKUPS_DIR,
               tmp=False,
               skip_model_obj=False):
    if tmp:
        file_path = file_name_to_path(model_name_to_filename(model_name, tmp), model_dir)  # raises if invalid
    else:
        file_path = model_name_to_path_from_splunk(model_name, searchinfo, namespace)

    logger.debug('Loading model: %s' % file_path)
    algo_name, model_data, model_options = models_util.load_algo_options_from_disk(file_path=file_path)

    if skip_model_obj:
        model_obj = None
    else:
        algo_class = initialize_algo_class(algo_name, searchinfo)

        if hasattr(algo_class, 'register_codecs'):
            algo_class.register_codecs()
        model_obj = decode(model_data['model'])

        # Convert pre 2.2 variable names to feature_variables and target_variable
        model_obj, model_options = convert_variable_names(model_obj, model_options)

    return algo_name, model_obj, model_options


def model_name_to_path_from_splunk(model_name, searchinfo, namespace=None):
    if searchinfo.get('is_remote', False):
        logger.debug('Performing a distributed search')
        file_path = model_name_to_path_distributed(model_name=model_name,
                                                   searchinfo=searchinfo,
                                                   namespace=namespace)
    else:
        file_path = model_name_to_path_from_splunk_rest(model_name, searchinfo, namespace)

    return file_path


def model_name_to_path_from_splunk_rest(model_name, searchinfo, namespace=None):
    file_name = model_name_to_filename(model_name)

    rest_proxy = rest_proxy_from_searchinfo(searchinfo)
    url = rest_url_util.make_get_lookup_url(rest_proxy, namespace=namespace, lookup_file=file_name)
    reply = rest_proxy.make_rest_call('GET', url)
    json_content = models_util.parse_reply(reply)
    try:
        file_path = json_content['entry'][0]['content']['eai:data']
    except Exception as e:
        logger.debug(str(e))
        logger.debug(json_content)
        raise Exception("Please check mlspl.log for more details.")

    return file_path


def model_name_to_path_distributed(model_name, searchinfo, namespace):
    if namespace is None:
        namespace = 'user'

    # For distributed search, these searchinfo fields must be present.
    required_searchinfo_fields = (
        'app',
        'username',
        'bundle_path',
        'roles'
    )
    missing_keys = missing_keys_in_dict(required_searchinfo_fields, searchinfo)
    if missing_keys:
        logger.debug('searchinfo in getinfo missing the following keys: %s', ', '.join(missing_keys))
        raise Exception("Please check mlspl.log for more details.")

    app = searchinfo['app']
    user = searchinfo['username']
    bundle = searchinfo['bundle_path']
    roles = searchinfo['roles']

    results = {}
    # If "app:" is used, skip the user namespace
    if namespace is 'user':
        results[user] = btool_util.get_models_btool(user=user, app=app, target_dir=bundle)
    for role in roles:
        results[role] = btool_util.get_models_btool(user=role, app=app, target_dir=bundle)

    model_path = get_model_from_btool_result(
        btool_dict=results, model_name=model_name, user=user, app=app, roles=roles, namespace=namespace)
    return model_path


def get_model_from_btool_result(btool_dict, model_name, user, app, roles, namespace):
    try:
        if namespace == 'user' and user in btool_dict and model_name in btool_dict[user]:
            result = btool_dict[user][model_name]
            user_match_str = os.path.join('users', user, app, 'lookups', model_name_to_filename(model_name))
            # Here only models in the user namespace is checked, because there is a issue/bug with btool
            # if username is also a role name in Splunk (e.g. username=power and there is the "power" role),
            # btool might return objects that the user have no permission on but role does.
            if result.endswith(user_match_str):
                return result

        app_match_str = os.path.join('apps', app, 'lookups', model_name_to_filename(model_name))
        merged_result = None
        for role in roles:
            try:
                path = btool_dict[role].pop(model_name)
                if path.endswith(app_match_str):
                    return path
                else:
                    # If "app:" is not used, check global namespace
                    if namespace != 'app' and (merged_result is None or merged_result < path):
                        merged_result = path
            except KeyError:
                continue  # Do Nothing, go to next item
    except Exception:
        cexc.log_traceback()
        raise Exception("Please check mlspl.log for more details.")
    return merged_result


def save_model(model_name, algo, algo_name, options,
               max_size=None, model_dir=model_staging_dir,
               tmp=False, searchinfo=None,
               namespace=None, local=False):
    if algo:
        algo_class = type(algo)
        if hasattr(algo_class, 'register_codecs'):
            algo_class.register_codecs()
        opaque = encode(algo)
    else:
        opaque = ''

    if max_size > 0 and len(opaque) > max_size * 1024 * 1024:
        raise RuntimeError("Model exceeds size limit (%d > %d)" % (
            len(opaque), max_size * 1024 * 1024))

    try:
        os.makedirs(model_dir)
    except OSError as e:
        if e.errno == errno.EEXIST and os.path.isdir(model_dir):
            pass
        else:
            # TODO: Log traceback
            raise Exception("Error creating model: %s, %s" % (model_name, e))

    # if we're creating a real model, generate a random name for it to avoid collisions in the upload staging area
    model_name_to_open = model_name if (tmp or local) else '_' + str(uuid.uuid1()).replace('-', '_')
    file_path = file_name_to_path(model_name_to_filename(model_name_to_open, tmp), model_dir)  # raises if invalid
    logger.debug('Saving model: %s' % file_path)

    with open(file_path, mode='w') as f:
        model_writer = csv.writer(f)

        # TODO: Version attribute
        model_writer.writerow(['algo', 'model', 'options'])
        model_writer.writerow([algo_name, opaque, json.dumps(options)])

    if not (tmp or local):
        model_filename = model_name_to_filename(model_name)
        move_model_file_from_staging(model_filename, searchinfo, namespace, f)


def move_model_file_from_staging(model_filename, searchinfo, namespace, f):
    rest_proxy = rest_proxy_from_searchinfo(searchinfo)
    url = rest_url_util.make_lookup_url(rest_proxy, namespace=namespace, lookup_file=model_filename)

    payload = {
        'eai:data': f.name,
        'output_mode': 'json'
    }

    # try to update the model
    reply = rest_proxy.make_rest_call('POST', url, payload)

    # if we fail to update the model because it doesn't exist, try to create it instead
    if not reply['success']:
        if reply['error_type'] == 'ResourceNotFound':
            payload['name'] = model_filename
            reply = rest_proxy.make_rest_call('POST', url, payload)

        # the redundant-looking check is actually necessary because it prevents this logic from triggering if the update fails but the create succceeds
        if not reply['success']:
            try:
                # if the model save fails, clean up the temp model file
                os.unlink(f.name)
            # if we somehow fail to clean up the temp model, don't expose the error to the user
            except Exception as e:
                logger.debug(str(e))

            models_util.parse_reply(reply)


def model_name_to_filename(name, tmp=False):
    assert isinstance(name, basestring)
    assert is_valid_identifier(name), "Invalid model name"

    suffix = '.tmp' if tmp else ''

    return '__mlspl_' + name + '.csv' + suffix


def delete_model_with_splunk_rest(model_name, searchinfo=None, namespace=None):
    file_name = model_name_to_filename(model_name)
    logger.debug('Deleting model: %s' % file_name)
    rest_proxy = rest_proxy_from_searchinfo(searchinfo)
    url = rest_url_util.make_get_lookup_url(rest_proxy, namespace=namespace, lookup_file=file_name)
    reply = rest_proxy.make_rest_call('DELETE', url)
    models_util.parse_reply(reply)


def delete_model_from_disk(model_name, model_dir=DEFAULT_LOOKUPS_DIR, tmp=False):
    path = file_name_to_path(model_name_to_filename(model_name, tmp), model_dir)
    os.unlink(path)


def delete_model(model_name, searchinfo=None, namespace=None,
                 model_dir=DEFAULT_LOOKUPS_DIR, tmp=False):
    if not tmp:
        delete_model_with_splunk_rest(model_name, searchinfo, namespace)
    else:
        delete_model_from_disk(model_name, model_dir, tmp)


def encode(obj):
    if StrictVersion(np.version.version) >= StrictVersion('1.10.0'):
        return MLSPLEncoder().encode(obj)
    else:
        raise RuntimeError('Python for Scientific Computing version 1.1 or later is required to save models.')


def decode(payload):
    if StrictVersion(np.version.version) >= StrictVersion('1.10.0'):
        return MLSPLDecoder().decode(payload)
    else:
        raise RuntimeError('Python for Scientific Computing version 1.1 or later is required to load models.')


def convert_variable_names(algo, options):
    """Convert pre-2.2 models to use new variable names."""
    try:
        if 'explanatory_variables' in options:
            options['feature_variables'] = options.pop('explanatory_variables')
            algo.__dict__['feature_variables'] = algo.__dict__.pop('explanatory_variables')

            options['target_variable'] = options.pop('variables')
            algo.__dict__['target_variable'] = algo.__dict__.pop('response_variable')

        elif 'variables' in options:
            options['feature_variables'] = options.pop('variables')
            algo.__dict__['feature_variables'] = algo.__dict__.pop('variables')
    except Exception as e:
        logger.warn(traceback.format_exc())
        raise RuntimeError('Error while converting model variable names: {}'.format(e))
    return algo, options
