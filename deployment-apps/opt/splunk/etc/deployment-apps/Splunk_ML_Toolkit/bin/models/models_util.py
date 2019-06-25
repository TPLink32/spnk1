"""
This module contains utility methods needed by both models.base and models.listmodels
"""

import json

import cexc
from lookups.lookups_util import lookups_parse_reply, load_lookup_file_from_disk

logger = cexc.get_logger(__name__)
messages = cexc.get_messages_logger()


class ModelNotFoundException(RuntimeError):
    def __init__(self):
        super(ModelNotFoundException, self).__init__('Model does not exist')


class ModelNotAuthorizedException(Exception):
    def __init__(self):
        super(ModelNotAuthorizedException, self).__init__('Permission denied')


def parse_reply(reply=None):
    return lookups_parse_reply(ModelNotFoundException(), ModelNotAuthorizedException(), reply)


def load_algo_options_from_disk(file_path):
    model_data = load_lookup_file_from_disk(file_path)
    algo_name = model_data['algo']
    model_options = json.loads(model_data['options'])

    return algo_name, model_data, model_options
