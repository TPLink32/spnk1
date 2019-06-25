import os
import subprocess
import re
import cexc
logger = cexc.get_logger(__name__)


def btool(conf_file, user, app, target_dir=None):
    """
    Use subprocess to run the btool command of splunk, get the raw returns

    Args:
        conf_file (string): confFile for the btool command, 'lookups' or 'algos'
        user (string): username or role of the splunk user
        app (string): splunk app name
        target_dir (string): target dir for btool to search

    Returns:
        btool_results (string): raw output from btool command
    """

    if conf_file not in ['lookups', 'algos']:
        logger.debug("Unrecognized confFile in btool call: expect either 'lookups' or 'algos'")
        raise RuntimeError("Please check mlspl.log for more details.")

    SPLUNK_HOME = os.environ['SPLUNK_HOME']
    SPLUNK_EXEC = os.path.join(SPLUNK_HOME, 'bin', 'splunk')

    try:
        btool_command = [SPLUNK_EXEC, 'cmd', 'btool', '--debug',
                         '--user=%s' % user, '--app=%s' % app]
        if target_dir:
            btool_command.append('--dir=%s' % target_dir)
        btool_command += [conf_file, 'list']
        btool_results = subprocess.check_output(btool_command, stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError as e:
        logger.debug("btool subprocess exited with non-zero error code '%d'" % e.returncode)
        logger.debug('> %s', e.output)
        raise RuntimeError("Please check mlspl.log for more details.")

    return btool_results


def get_models_btool(user, app, target_dir=None):
    """
    Use subprocess to run the btool lookups command,
    parse the results and extract mlspl models

    Args:
        user (string): username or role of the splunk user
        app (string): splunk app name
        target_dir (string): target dir for btool to search

    Returns:
        results (dict):
            {
                <MODEL_NAME>: <ABSOLUTE_FILE_PATH_OF_THE_MODEL>,
                ...
            }
    """

    btool_results = btool(conf_file='lookups', user=user, app=app, target_dir=target_dir)
    return parse_btool_lookups(btool_results)


def get_algos_btool(user, app, target_dir=None):
    """
    Use subprocess to run the btool algos command,
    parse the results

    Args:
        user (string): username or role of the splunk user
        app (string): splunk app name
        target_dir (string): target dir for btool to search

    Returns:
        results (dict):
            {
                <ALGO_NAME>: {
                                'args': {
                                            <KEY_IN_STANZA>: <VALUE_IN_STANZA>,
                                            ...
                                        },
                                'conf_path': <ABSOLUTE_PATH_OF_THE_CONF_FILE>
                             },
                ...
            }
    """

    btool_results = btool(conf_file='algos', user=user, app=app, target_dir=target_dir)
    return parse_btool_algos(btool_results)


def parse_btool_lookups(btool_results):
    """
    Parse the results from btool lookups list

    Args:
        btool_results (string): raw output from btool lookups list

    Returns:
        results (dict):
            {
                <MODEL_NAME>: <ABSOLUTE_FILE_PATH_OF_THE_MODEL>,
                ...
            }
    """

    results = {}
    lookups_re = re.compile('^(?P<file_path>.*__mlspl_[a-zA-Z_][a-zA-Z0-9_]*\.csv)\s*\[__mlspl_(?P<model_name>[a-zA-Z_][a-zA-Z0-9_]*)\.csv\]')
    for lookup in btool_results.splitlines():
        match = lookups_re.match(lookup)
        if match:
            model_name = match.group('model_name')
            file_path = match.group('file_path')
            results[model_name] = file_path
    return results


def parse_btool_algos(btool_results):
    """
    Parse the results from btool algos list

    Args:
        btool_results (string): raw output from btool algos list

    Returns:
        results (dict):
            {
                <ALGO_NAME>: {
                                'args': {
                                            <KEY_IN_STANZA>: <VALUE_IN_STANZA>,
                                            ...
                                        },
                                'conf_path': <ABSOLUTE_PATH_OF_THE_CONF_FILE>
                             },
                ...
            }
    """

    results = {}
    current_algo = None
    for algo_stanza in btool_results.splitlines():
        algos_re = re.compile('^(?P<conf_path>.*\.conf)\s*\[(?P<algo_name>[a-zA-Z_][a-zA-Z0-9_]*)\]')
        args_re = re.compile('^(?P<conf_path>.*\.conf)\s*(?P<args_key>[a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(?P<args_value>[^=]*)')
        algos_match = algos_re.match(algo_stanza)
        args_match = args_re.match(algo_stanza)
        if algos_match:
            current_algo = algos_match.group('algo_name')
            conf_path = algos_match.group('conf_path')
            if current_algo not in results:
                results[current_algo] = {'conf_path': None, 'args': {}}
            results[current_algo]['conf_path'] = conf_path
        if args_match:
            if current_algo is None or current_algo not in results:
                logger.debug("Failed parsing btool algos list returns: key value pairs specified before algo name")
                logger.debug('btool algos list returns: %s' % btool_results)
                raise RuntimeError("Please check mlspl.log for more details.")
            conf_path = args_match.group('conf_path')
            args_key = args_match.group('args_key')
            args_value = args_match.group('args_value')
            if results[current_algo]['conf_path'] != conf_path:
                logger.debug("Failed parsing btool algos list returns: algo name and key value pairs are from different conf files")
                logger.debug('btool algos list returns: %s' % btool_results)
                cexc.messages.warn('There are duplicate %s algorithm names defined in multiple algos.conf files: '
                                   'please check algos.conf' % current_algo)
                raise RuntimeError("Please check mlspl.log for more details.")
            results[current_algo]['args'][args_key] = args_value

    return results

