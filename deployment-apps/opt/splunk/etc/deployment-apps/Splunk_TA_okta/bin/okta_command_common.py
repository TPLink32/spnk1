import urllib2, sys
import re
import logging
import okta_config
from splunktalib.common import log
import splunk.clilib.cli_common as scc
import splunk.Intersplunk
import okta_rest_client as oac
import time
import traceback
from splunktalib.common.util import is_true
from splunktalib import rest


_LOGGER = log.Logs().get_logger("ta_okta", level=logging.DEBUG)


def get_session_key():
    """
    When called as custom search script, splunkd feeds the following
    to the script as a single line
    'authString:<auth><userId>admin</userId><username>admin</username>\
        <authToken>31619c06960f6deaa49c769c9c68ffb6</authToken></auth>'

    When called as an alert callback script, splunkd feeds the following
    to the script as a single line
    sessionKey=31619c06960f6deaa49c769c9c68ffb6
    """
    _LOGGER.info('call get_session_key()')
    session_key = sys.stdin.readline()
    m = re.search("authToken>(.+)</authToken", session_key)
    if m:
        session_key = m.group(1)
    else:
        session_key = session_key.replace("sessionKey=", "").strip()
    session_key = urllib2.unquote(session_key.encode("ascii"))
    session_key = session_key.decode("utf-8")
    return session_key


def get_okta_server_config(session_key):
    """
    get the configuration of Okta server for custom command.
    :param session_key:

    """
    try:
        sk = session_key
        try:
            splunk_uri = scc.getMgmtUri()
        except Exception as ex:
            _LOGGER.error("Fail to get the splunk_uri: %s", ex.message)
            raise
        config = okta_config.OktaConfig(splunk_uri, sk, "")

        okta_conf = config.get_okta_conf()
        config.update_okta_conf(okta_conf)
        return okta_conf
    except Exception as ex:
        _LOGGER.error("Failed to get config of Okta server for custom command: %s", ex.message)
        _LOGGER.error(traceback.format_exc())
        raise


def member_operate(oprt):
    """
    The detail implementation of oktaaddmember and oktaremovemember commands.
    :param oprt: 'PUT' OR 'DELETE'
                 'PUT' for addmember
                 'DELETE' for remove member
    """
    sk = get_session_key()
    okta_conf = get_okta_server_config(sk)
    error_msg = ""
    if is_true(okta_conf.get("custom_cmd_enabled", "")):
        keywords, options = splunk.Intersplunk.getKeywordsAndOptions()
        results, dummyresults, settings = splunk.Intersplunk.getOrganizedResults()
        user = options.get('userid', None)
        group = options.get('groupid', None)
        username = None
        groupname = None
        if not user:
            username = options.get('username', None)
        if not group:
            groupname = options.get('groupname', None)
        if username:
            command = 'search source=okta:user|dedup id|search profile.login="' + username + '"|fields id'
            user = _do_spl_search(sk, command)
            if not user:
                error_msg = "The username {} does not exist. ".format(username)
        if groupname:
            command = 'search source=okta:group|dedup id|search profile.name="' + groupname + '"|fields id'
            group = _do_spl_search(sk, command)
            if not group:
                error_msg = "the groupname {} does not exist. ".format(groupname)
        if user and group:
            server_url = okta_conf.get('okta_server_url', '')
            server_token = okta_conf.get('okta_server_token', '')
            if server_url and server_token:
                client = oac.OktaRestClient(okta_conf)
                endpoint = '/api/v1/groups/' + group + '/users/' + user
                response = client.request(endpoint, None, oprt,
                                          'okta_server_url',
                                          'okta_server_token')
                if response.get("error"):
                    if oprt == "PUT":
                        error_msg = "Failed to add the user {0} to the group {1}. Error: ".format(
                            username or user, groupname or group) + response.get('error')[
                                0] % response.get('error')[1:]
                    elif oprt == "DELETE":
                        error_msg = "Failed to remove the user {0} from the group {1}. Error: ".format(
                            username or user,groupname or group) + response.get('error')[
                                0] % response.get('error')[1:]
                else:
                    result = {}
                    result["_time"] = time.time()
                    result["member_update_status"] = "success"
                    result["detail"] = "Add the user {0} to the group {1} successfully."\
                        .format(username or user, groupname or group) if oprt=="PUT" else \
                        "Remove the user {0} from the group {1} successfully.".format(username or user,
                                                                                      groupname or group)
                    results.append(result)
                    splunk.Intersplunk.outputResults(results)
                    _LOGGER.info(result["detail"])
        elif user:
            error_msg += "Missing Argument: 'groupid/groupname' parameter is required."
        elif group:
            error_msg += "Missing Argument: 'userid/username' parameter is required."
        else:
            error_msg += "Missing Arguments: 'userid/username' and 'groupid/groupname' parameters are required."
    else:
        error_msg = "The custom command is not enabled. Please enable it on the setup page."
    if error_msg:
        splunk.Intersplunk.parseError(error_msg)
        _LOGGER.error(error_msg)


def user_operate(oprt):
    """
    The detail implementation of oktadeactivateuser command.
    :param oprt: POST, 'POST' is for oktadeactivateuser
    :
    """
    sk = get_session_key()
    okta_conf = get_okta_server_config(sk)
    error_msg = ""
    if is_true(okta_conf.get("custom_cmd_enabled", "")):
        keywords, options = splunk.Intersplunk.getKeywordsAndOptions()
        results, dummyresults, settings = splunk.Intersplunk.getOrganizedResults(
        )
        user = options.get('userid', None)
        username = None
        if not user:
            username = options.get('username', None)
        if username:
            command = 'search source=okta:user|dedup id|search profile.login="' + username + '"|fields id'
            user = _do_spl_search(sk, command)
            if not user:
                error_msg = "The username {} doest not exist. ".format(username)
        if user:
            server_url = okta_conf.get('okta_server_url', '')
            server_token = okta_conf.get('okta_server_token', '')
            if server_url and server_token:
                client = oac.OktaRestClient(okta_conf)
                endpoint = '/api/v1/users/' + user + '/lifecycle/deactivate'
                response = client.request(endpoint, None, oprt,
                                          'okta_server_url',
                                          'okta_server_token')
                if response.get("error"):
                    if oprt == "POST":
                        error_msg = "Failed to deactivate the user {0}. The user does not exist or the user is " \
                                    "deactivated. ".format(
                            username or user)+ "Error: "+ response.get('error')[0]%response.get('error')[1:]
                else:
                    result = {}
                    result["_time"] = time.time()
                    result["user_update_status"] = "success"
                    result[
                        "detail"] = "Deactivate the user {0} successfully.".format(
                            username or user) if oprt == "POST" else ""
                    results.append(result)
                    splunk.Intersplunk.outputResults(results)
                    _LOGGER.info(result["detail"])
        else:
            error_msg += "Missing Argument: 'userid/username' parameters is required."
    else:
        error_msg = "The custom command is not enabled. Please enable it on the setup page."
    if error_msg:
        splunk.Intersplunk.parseError(error_msg)
        _LOGGER.error(error_msg)


def _do_spl_search(session_key, command):
    """
    execute the SPL command and return the userid/groupid
    :param command: SPL command
    """
    splunk_uri = scc.getMgmtUri(
    ) + '/servicesNS/admin/search/search/jobs/export?output_mode=json'
    data = {"search": command}
    resp, content = rest.splunkd_request(splunk_uri,
                                         session_key,
                                         method="POST",
                                         data=data,
                                         retry=3)
    if content:
        cont = '[' + ','.join(content.strip().split('\n')) + ']'
        import json
        cont = json.loads(cont)
        result = cont[0].get("result")
        if result:
            return result.get("id", None)
    return None
