"""
A handler for experiments endpoint
"""
import httplib
import json

import cexc
from experiment.experiments import (
    ExperimentNotFoundException,
    ExperimentNotAuthorizedException,
    delete_experiment,
    load_experiments,
    save_experiment,
)
from experiment.validate_experiments_json import validate_experiments_json
from util.rest_util import searchinfo_from_request

logger = cexc.get_logger(__name__)


class Experiments(object):

    @classmethod
    def handle_get(cls, request, path_parts):
        """
        Handles GET requests

        Args:
            request: a dictionary providing information about the request
            path_parts: a list of strings describing the request path
        """
        if len(path_parts) > 1:
            return {
                'payload': 'Invalid request path. path: %s' % str(path_parts),
                'status': httplib.BAD_REQUEST
            }

        searchinfo = searchinfo_from_request(request)
        query_params = [tuple(r) for r in request.get('query', [])]
        try:
            experiments = load_experiments(searchinfo, query_params)
        except Exception as e:
            logger.warn(str(e))
            return {
                'payload': 'Cannot load experiments.',
                'status': httplib.BAD_REQUEST
            }

        return {
            'payload': experiments,
            'status': httplib.OK
        }

    @staticmethod
    def error_resp(status, msg):
        return {
            'status': status,
            'payload': msg,
        }

    @staticmethod
    def success_resp(status=httplib.OK, payload=None):
        if payload is None:
            payload = {}

        return {
            'status': status,
            'payload': payload,
        }

    @classmethod
    def handle_post(cls, request, path_parts):
        """
        Handles POST requests

        Args:
            request: a dictionary providing information about the request
            path_parts: a list of strings describing the request path
        """

        if len(path_parts) == 1:
            update = False
        elif len(path_parts) == 2:
            update = True
        else:
            return {
                'payload': 'Invalid request path.',
                'status': httplib.BAD_REQUEST
            }

        try:
            new_experiment_settings = json.loads(request['payload'])
            validate_experiments_json(new_experiment_settings)
        except Exception as e:
            logger.debug(str(e))
            return {
                'payload': 'Cannot validate experiment',
                'status': httplib.BAD_REQUEST
            }

        if update and path_parts[1] != new_experiment_settings["id"]:
            return {
                'payload': 'Wrong request, path id and object id do not match.',
                'status': httplib.BAD_REQUEST
            }

        searchinfo = searchinfo_from_request(request)

        try:
            experiment = save_experiment(new_experiment_settings, update, searchinfo)
        except Exception as e:
            logger.debug("Error saving experiment with id {}: {}".format(new_experiment_settings["id"], str(e)))
            return {
                'payload': "Error saving experiment with id {}".format(new_experiment_settings["id"]),
                'status': httplib.INTERNAL_SERVER_ERROR
            }

        return {
            'payload': experiment,
            'status': httplib.CREATED
        }


    @staticmethod
    def get_namespace_from_request(request):
        return 'app' if request['ns']['user'] == 'nobody' else 'user'


    @classmethod
    def handle_delete(cls, request, path_parts):
        """
        Handles DELETE requests

        Args:
            request (dict): a dictionary providing information about the request
            path_parts (list): a list of strings describing the request path (e.g. [ 'experiments', 'experiment_id' ])
                               where experiment_id is <experiment_type>_<experiment_name>

        Returns:
            response (dict): A response object
        """
        # The ID is {experiment type}_{experiment name}
        try:
            experiment_id = path_parts[1]
        except IndexError:
            return cls.error_resp(httplib.BAD_REQUEST, 'Deletion requires an experiment ID')

        searchinfo = searchinfo_from_request(request)
        namespace = cls.get_namespace_from_request(request)
        try:
            delete_experiment(experiment_id, searchinfo, namespace)
        except ExperimentNotFoundException as e:
            logger.debug(e.message)
            return cls.error_resp(httplib.NOT_FOUND,
                                  "Experiment with id '{}' not found".format(experiment_id))
        except ExperimentNotAuthorizedException as e:
            logger.debug(e.message)
            return cls.error_resp(httplib.UNAUTHORIZED,
                                  "Could not access experiment with id '{}'".format(experiment_id))
        except Exception as e:
            logger.debug(e.message)
            return cls.error_resp(httplib.INTERNAL_SERVER_ERROR,
                                  "Error deleting experiment with id '{}': {}".format(experiment_id, e.message))

        return cls.success_resp()

