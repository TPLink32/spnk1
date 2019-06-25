import sys
import os

from base_util import is_valid_identifier
from exec_anaconda import get_apps_path
from algo_loader import (
    AlgoLoader,
    BtoolAlgoLoadingStrategy,
    RestAlgoLoadingStrategy,
)


def load_algos_from_searchinfo(searchinfo):
    """
    Load the list of algorithms supported from Splunk

    Args:
        searchinfo (dict): information required for search

    Returns:
        (dict): mapping of algorithm name to a dict containing
                information about the algo (app, disabled, package)

    """
    if not searchinfo:
        return {}

    algo_loader = algo_loader_from_searchinfo(searchinfo)
    return algo_loader.load_algos()


def algo_loader_from_searchinfo(searchinfo):
    """
    Create an AlgoLoader object with the correct algo loading strategy based on information from the searchinfo

    Args:
        searchinfo (dict): information required for search

    Returns:
        (AlgoLoader): AlgoLoader instance with the correct algo loading strategy

    """
    if searchinfo.get('is_remote', False):
        # On an indexer, we need to iterate through the roles and merge the results manually
        # since btool does not have user-to-role mapping there. Pass the roles instead of the username.
        algo_loader = AlgoLoader(BtoolAlgoLoadingStrategy(searchinfo))
    else:
        # On a search head or a standalone node, REST API will get us the correctly merged results.
        algo_loader = AlgoLoader(RestAlgoLoadingStrategy(searchinfo))
    return algo_loader


def initialize_algo_class(algo_name, searchinfo):
    """Import and initialize the algorithm.

    Args:
        algo_name (str): the usual suspect
        searchinfo (dict): information required for search

    Returns:
        algo_class (class): the suspect's class

    """
    all_algos = load_algos_from_searchinfo(searchinfo)

    if not is_valid_identifier(algo_name):
        raise RuntimeError('Failed to load algorithm with an invalid name: %s' % algo_name)

    algo = {}
    try:
        if algo_name in all_algos:
            algo = all_algos[algo_name]
            if not algo['disabled']:
                bundle_path = searchinfo.get('bundle_path')
                new_sys_path = os.path.join(get_apps_path(bundle_path), algo['app'], 'bin')
                if new_sys_path not in sys.path:
                    sys.path.append(new_sys_path)
                algos = __import__("%s.%s" % (algo['package'], algo_name))
            else:
                raise RuntimeError('Algorithm "%s" is disabled' % algo_name)
        else:
            raise RuntimeError('Algorithm "%s" cannot be loaded' % algo_name)
        algo_package = getattr(algos, algo_name)
        algo_class = getattr(algo_package, algo_name)
        return algo_class
    except (ImportError, AttributeError) as e:
        package_name = algo.get('package', '')
        algo_name = '{}.{}'.format(package_name, algo_name) if package_name else algo_name
        raise RuntimeError('Failed to load algorithm "%s"' % algo_name)

