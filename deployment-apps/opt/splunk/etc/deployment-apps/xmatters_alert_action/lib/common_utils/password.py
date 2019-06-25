"""
    A password utility for getting a named password from Splunk Storage via the api
"""
from .setup_logging import setup_logging
from .rest import RESTClient

DEFAULT_LOGGER = setup_logging('xmatters_alert_action.log', 'util')

def get_password(server_uri, session_key, password_name, **kwargs):
    """
        Gets a password via the Splunk Enterprise API
        @param server_uri: <str>, The server domain of the Splunk Enterprise API
        @param session_key: <str>, An active session key that can be used to
            access the Splunk Enterprise API
        @param password_name: <str>, The name of the password we are looking up
            the value of
        @param logger: <Logger>, An optional logger object that can be used to
            log information about requests

        @returns: <boolean|str>, The password string in clear text or false if we were unable to
            find it
    """
    logger = kwargs.get('logger', DEFAULT_LOGGER)
    logger.info('action=GET_PASSWORD server_uri=%s password_name=%s', server_uri, password_name)

    rest = RESTClient(return_json=True, logger=logger)
    url_template = '%s/servicesNS/nobody/xmatters_alert_action/storage/passwords/%%3A%s%%3A'
    url_template += '?output_mode=json'
    url = url_template % (server_uri, password_name)
    headers = {'Authorization': 'Splunk %s' % session_key}

    response_body = rest.get(url, headers=headers)
    if response_body:
        return response_body['entry'][0]['content']['clear_password']
    return False
