# -*- coding: utf-8 -*-
import urlparse
import json
__author__ = "Bharat Patel <bharrat@gmail.com>"
__copyright__ = "Copyright (C) 2014, Bharat Patel"
__license__ = "New BSD"
__version__ = "1.0"
import sys
import os
from qualys.application_configuration import *
import qualys.qualys_log_populator
import qualys.splunkpopulator.utils
import splunk.clilib.cli_common
import splunk.entity as entity
from qualys.splunkpopulator.qid_plugins import QIDParser
from qualys.splunkpopulator.utils import bool_value
import qualys.lib.api as qapi
import fcntl, sys

APP_ROOT = os.path.abspath(os.path.dirname(sys.argv[0]) + '/')


pid_file = APP_ROOT + '/detections.pid'
fp = open(pid_file, 'w')
try:
    fcntl.lockf(fp, fcntl.LOCK_EX | fcntl.LOCK_NB)
except IOError:
    sys.stderr.write('Another instance of qualys_splunk_detection_populator.py already running. PID=%s' % os.getpid())
    sys.exit(0)


# load any plugins
QIDParser.load_plugins()

APP_ROOT = os.path.abspath(os.path.dirname(sys.argv[0]) + '/')
config_file = APP_ROOT + '/local/qualys.conf'
configuration_dict = splunk.clilib.cli_common.getConfStanza('qualys', 'setupentity')
#configuration_dict contains all the settings stored by splunk
# access the credentials in /servicesNS/nobody/<MyApp>/admin/passwords
def getCredentials(sessionKey):
   myapp = 'qualys_splunk_app'
   try:
      # list all credentials
      entities = entity.getEntities(['admin', 'passwords'], namespace=myapp,
                                    owner='nobody', sessionKey=sessionKey)
   except Exception, e:
      raise Exception("Could not get %s credentials from splunk. Error: %s"
                      % (myapp, str(e)))

   # return first set of credentials
   for i, c in entities.items():
        return c['username'], c['clear_password']

   raise Exception("No credentials have been found")




if 'detection_params' in configuration_dict:
    detection_params = configuration_dict['detection_params']
    try:
        json_params = json.loads(detection_params)
    except ValueError, e:
        # if its not valid JSON then it might be URL query string e.g. a=1&b=2&c=3
        #convert it to dictionary and dump it as json string
        detection_params = json.dumps(dict(urlparse.parse_qsl(configuration_dict['detection_params'])))
    finally:
        configuration_dict['detection_params'] = detection_params

sessionKey = sys.stdin.readline().strip()
api_user, api_password = getCredentials(sessionKey)
api_server = configuration_dict.get('api_server')


app_config = ApplicationConfiguration(default_settings=configuration_dict, config_file_path=config_file, config_section_name='setupentity')
app_config.load()

if bool_value(app_config.get('enable_debug')):
    qualys.enableDebug(True)
qualys.enableLogger()

use_proxy = bool_value(app_config.get('use_proxy'))
proxy_host = None
if use_proxy:
    proxy_host = app_config.get('proxy_server')



try:
    apiConfig = qapi.Client.APIConfig()
    if use_proxy and proxy_host:
        qlogger.info("Using proxy=%s", proxy_host)
        apiConfig.useProxy = True
        apiConfig.proxyHost = proxy_host

    apiConfig.username = api_user
    apiConfig.password = api_password
    apiConfig.serverRoot = api_server

    qapi.setupClient(apiConfig)
    qapi.client.validate()
    # DO not log Knowledgebase events, they should be logged separately
    populator = qualys.qualys_log_populator.QualysDetectionPopulator(settings=app_config)
    populator.run()


except qualys.splunkpopulator.utils.QualysAPIClientException, e:
    print "QualysSplunkPopulator: [ERROR] %s" % e.message