from distutils.version import LooseVersion
import distutils.dir_util as dir_util
import logging
import logging.handlers
import os
import sys
import re
from pprint import pprint

import splunk
import splunk.entity
import splunk.appserver.mrsparkle.lib.util as app_util
import time
import json

SPLUNK_HOME = os.environ.get('SPLUNK_HOME')
INSTALLER_LOG_FILENAME = os.path.join(SPLUNK_HOME,'var','log','splunk','stream_installer.log')
STREAMFWD_LOG_FILENAME = os.path.join(SPLUNK_HOME,'var','log','splunk','streamfwd.log')
logger = logging.getLogger('stream_installer')
logger.setLevel(logging.DEBUG)
handler = logging.handlers.RotatingFileHandler(INSTALLER_LOG_FILENAME, maxBytes=1024000, backupCount=5)
handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
handler.setLevel(logging.DEBUG)
logger.addHandler(handler)

APP_NAME = 'splunk_app_stream'
APPS_DIR = app_util.get_apps_dir()
(ETC_DIR, APPS_STEM) = os.path.split(APPS_DIR)
DEPLOYMENT_APPS_DIR = os.path.join(ETC_DIR, 'deployment-apps')
INSTALL_DIR = os.path.join(APPS_DIR, APP_NAME, 'install')
SPLUNK_PROTOCOL = 'http'
SPLUNK_HOST = 'localhost'
SPLUNK_PORT = '8000'
SPLUNK_ROOT_ENDPOINT = '/'
STREAM_PATH = 'en-us/custom/splunk_app_stream/'
DEPENDENCY_TA = 'Splunk_TA_stream'
STREAMFWD_URI = 'servicesNS/nobody/Splunk_TA_stream/data/inputs/streamfwd/streamfwd/'
TA_RELOAD_URI = 'services/apps/local/splunk_ta_stream/_reload'

def create_inputs(appdir, location, disabled):
    localdir = os.path.join(appdir, 'local')
    if not os.path.exists(localdir):
        os.makedirs(localdir)
    inputs_file = os.path.join(localdir, 'inputs.conf')
    if not os.path.exists(inputs_file):
        try:
            fo = open(inputs_file, 'w')
            try:
                fo.write( "[streamfwd://streamfwd]\n")
                fo.write( "splunk_stream_app_location = %s\n" % location)
                fo.write( "stream_forwarder_id = %s\n" % "")
                fo.write( "disabled = %d\n" % disabled)
                logger.info("created config file (disabled=%d): %s" % (disabled, inputs_file))
            finally:
                fo.close()
        except Exception, ex:
            logger.error("IOerror, unable to write to file")
            logger.exception(ex)

def update_log_config(appdir):
    config_file = os.path.join(appdir, 'default', 'streamfwdlog.conf')
    if os.path.exists(config_file):
        with open(config_file, "r") as logconf:
            lines = logconf.readlines()
        with open(config_file, "w") as logconf:
            for line in lines:
                logconf.write(re.sub(r'^log4cplus.appender.streamfwdlog.File=.*',
                    "log4cplus.appender.streamfwdlog.File=%s" % STREAMFWD_LOG_FILENAME.encode('string-escape'), line))

def rectify_streamfwd_executables(ta_dir):
    '''
    If previously installed version is 6.6.x or 7.0.0, linux_x86_64/bin/streamfwd is symlink and linux_x86_64/bin/streamfwd-rhel5 exists.
    After 7.0.1, there should be only streamfwd and streamfwd-rhel6 under linux_86_64/bin/, so correct them before installation.
    '''
    from sys import platform as _platform
    if _platform == "linux" or _platform == "linux2" or  _platform == "darwin":
        streamfwd_link_path = os.path.join(ta_dir, "linux_x86_64", "bin", "streamfwd")
        if os.path.exists(streamfwd_link_path) and os.path.islink(streamfwd_link_path):
            logger.info("removing %s symbolic link", streamfwd_link_path)
            os.remove(streamfwd_link_path)

        streamfwd_rhel5_path = os.path.join(ta_dir, "linux_x86_64", "bin", "streamfwd-rhel5")
        if os.path.exists(streamfwd_rhel5_path):
            logger.info("renaming from %s to %s", streamfwd_rhel5_path, streamfwd_link_path)
            os.rename(streamfwd_rhel5_path, streamfwd_link_path)

def install_dependency(dep):
    src = os.path.join(INSTALL_DIR, dep)
    dst = os.path.join(APPS_DIR, dep)
    try:
        if (dep == "Splunk_TA_stream"):
            rectify_streamfwd_executables(src)
            rectify_streamfwd_executables(dst)

        dir_util.copy_tree(src, dst)
        logger.info("%s was successfully copied to %s" % (src, dst))
        if (dep == "Splunk_TA_stream"):
            location = ( "%s://%s:%s%s%s" % (SPLUNK_PROTOCOL, 'localhost', SPLUNK_PORT, SPLUNK_ROOT_ENDPOINT, STREAM_PATH) )
            create_inputs(dst, location, 0)
            update_log_config(dst)
        if os.path.exists(DEPLOYMENT_APPS_DIR):
            dst = os.path.join(DEPLOYMENT_APPS_DIR, dep)
            if (dep == "Splunk_TA_stream"):
                rectify_streamfwd_executables(dst)
            dir_util.copy_tree(src, dst )
            logger.info("%s was successfully copied to %s" % (src, dst))
            if (dep == "Splunk_TA_stream"):
                location = ( "%s://%s:%s%s%s" % (SPLUNK_PROTOCOL, SPLUNK_HOST, SPLUNK_PORT, SPLUNK_ROOT_ENDPOINT, STREAM_PATH) )
                create_inputs(dst, location, 0)

                # Don't try to update the log config in the deployment apps dir, because the path
                # depends on where Splunk_TA_stream is deployed.  streamfwd will update it the
                # first time it runs, based on where it finds itself.
                #update_log_config(dst)

    except Exception, ex:
        logger.error("unable to copy %s to %s" % (src, dst))
        logger.exception(ex)

def get_loose_version(version, build):
    pattern = re.compile('(\d+\.\d+).*')
    m = pattern.match(version)
    if m:
        version = m.group(1)
    version = "%s build %s" % (version, build)
    return LooseVersion(version)

def is_streamfwd_disabled(session_key):
    disabled = True
    serverResponse, serverContent = splunk.rest.simpleRequest(
                app_util.make_url_internal(STREAMFWD_URI + '?output_mode=json'),
                session_key,
                postargs=None,
                method='GET',
                raiseAllErrors=True,
                proxyMode=False,
                rawResult=None,
                jsonargs=None,
                timeout=splunk.rest.SPLUNKD_CONNECTION_TIMEOUT
            )
    status = serverResponse['status']
    logger.info('status of streamfwd disabled state GET request %s ' % status)
    if status == '200':
        disabled_state =  json.loads(serverContent)['entry'][0]['content']['disabled']
        logger.info("streamfwd disabled state %s " % disabled_state)
        if not(disabled_state):
            disabled = False
    return disabled


def disable_streamfwd(flag, session_key):
    uri = STREAMFWD_URI
    #true flag to disable
    if flag:
        uri = uri + 'disable'
    else:
        uri = uri + 'enable'
    serverResponse, serverContent = splunk.rest.simpleRequest(
                app_util.make_url_internal(uri),
                session_key,
                postargs=None,
                method='POST',
                raiseAllErrors=True,
                proxyMode=False,
                rawResult=None,
                jsonargs=None,
                timeout=splunk.rest.SPLUNKD_CONNECTION_TIMEOUT
            )

#reload splunk_TA_stream config for splunkd to start it as a modinput
def reload_TA_stream_config(session_key):
    serverResponse, serverContent = splunk.rest.simpleRequest(
                app_util.make_url_internal(TA_RELOAD_URI),
                session_key,
                postargs=None,
                method='GET',
                raiseAllErrors=True,
                proxyMode=False,
                rawResult=None,
                jsonargs=None,
                timeout=splunk.rest.SPLUNKD_CONNECTION_TIMEOUT
            )

if __name__ == '__main__':

    token = sys.stdin.readlines()[0]
    token = token.strip()

    logger.info("Splunk App for Stream Dependency Manager: Starting...")

    en = splunk.entity.getEntity('server/settings', 'settings', sessionKey=token)
    if (en):
        SPLUNK_PROTOCOL = ("https" if int(en['enableSplunkWebSSL'])==1 else "http")
        SPLUNK_HOST = en['host']
        SPLUNK_PORT = en['httpport']
    else:
        logger.error("unable to retrieve server settings")

    en = splunk.entity.getEntity('configs/conf-web', 'settings', sessionKey=token)
    if (en and 'root_endpoint' in en):
        SPLUNK_ROOT_ENDPOINT = en['root_endpoint']
        if not SPLUNK_ROOT_ENDPOINT.startswith('/'):
            SPLUNK_ROOT_ENDPOINT = "/" + SPLUNK_ROOT_ENDPOINT
        if not SPLUNK_ROOT_ENDPOINT.endswith('/'):
            SPLUNK_ROOT_ENDPOINT += '/'
    else:
        logger.error("unable to retrieve root_endpoint setting")

    # search for only the entity object for splunk_app_stream and add into en dictionary
    en = splunk.entity.getEntities('/apps/local', search=APP_NAME, sessionKey=token)
    if not en:
        logger.error("no entity for splunk_app_stream found, error installing")
    else:
        # search for Splunk_TA_stream dependency for splunk_app_stream
        dependency_en = splunk.entity.getEntities('/apps/local', search=DEPENDENCY_TA, sessionKey=token)
        version = get_loose_version(en[APP_NAME]['version'], en[APP_NAME]['build'])
        if not dependency_en:
            logger.info("dependency %s not found - installing..." % DEPENDENCY_TA)
            install_dependency(DEPENDENCY_TA)
            reload_TA_stream_config(token)
        else:
            dep_version = get_loose_version(dependency_en[DEPENDENCY_TA]['version'], dependency_en[DEPENDENCY_TA]['build'])
            if version > dep_version:
                logger.info("installed version of %s is %s, which is older than required version %s - updating..." % (DEPENDENCY_TA, dep_version, version))
                ####
                #during the upgrade cycle, splunkd randomly starts and stops streamfwd even when it is disabled in the config.
                #This prevents files to be copied if streamfwd is running. To workaround this, save the config state and always disable streamfwd.
                #In the end, enable streamfwd, if config was enabled before upgrade.
                ####
                #save streamfwd config state
                disabled_state = is_streamfwd_disabled(token)
                #disable streamfwd
                disable_streamfwd(True, token)
                #wait for a small duration for the process to exit/cleanup
                time.sleep(3)
                install_dependency(DEPENDENCY_TA)
                #enable streamfwd if config state was enabled before upgrade
                if not(disabled_state):
                    disable_streamfwd(False, token)
            else:
                logger.info("installed version of %s is %s, which is newer or equal to version %s - leaving alone..." % (DEPENDENCY_TA, dep_version, version))

    logger.info("Splunk App for Stream Dependency Manager: Exiting...")

