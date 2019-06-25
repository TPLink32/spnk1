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
from qualys.splunkpopulator.utils import bool_value
import qualys.lib.api as qapi
import fcntl, sys
import splunk.clilib.cli_common
import splunk.entity as entity

from ConfigParser import SafeConfigParser, NoSectionError

APP_ROOT = os.path.abspath(os.path.dirname(sys.argv[0]) + '/')

pid_file = APP_ROOT + '/kb.pid'
fp = open(pid_file, 'w')
try:
    fcntl.lockf(fp, fcntl.LOCK_EX | fcntl.LOCK_NB)
except IOError:
    sys.stderr.write('Another instance of qualys_splunk_kb_populator.py already running. PID=%s' % os.getpid())
    sys.exit(0)

config_file = APP_ROOT + '/local/qualys.conf'
configuration_dict = splunk.clilib.cli_common.getConfStanza('qualys', 'setupentity')
#configuration_dict contains all the settings stored by splunk

config = SafeConfigParser({'minimum_qid': 0})
try:
    with open(config_file) as fp:
        config.readfp(fp)
except IOError, e:
    pass
if not config.has_section('setupentity'):
        config.add_section('setupentity')

def get_config(key):
    try:
        return config.get('setupentity', key)
    except NoSectionError:
        return None

def set_config(key, value):
    config.set('setupentity', key, str(value))

def save_config():
    """
    Write setting file to disk
    """
    # Writing our configuration file to 'example.cfg'
    with open(config_file, 'wb') as configfile:
        config.write(configfile)


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




class QualysSplunkKBLogPopulator(qualys.qualys_log_populator.QualysBaseLogPopulator):

    def get_app_setting(self, key):
        return get_config(key)

    def save_app_setting(self, key, value):
        set_config(key, value)


    def save_settings(self):
        save_config()


minimum_qid = get_config('minimum_qid')
use_proxy = bool_value(get_config('use_proxy'))
proxy_host = None
if use_proxy:
    proxy_host = get_config('proxy_server')





if minimum_qid is not None and minimum_qid != '':
    configuration_dict['minimum_qid'] = minimum_qid

sessionKey = sys.stdin.readline().strip()

api_user, api_password = getCredentials(sessionKey)
api_server = configuration_dict.get('api_server')



app_config = ApplicationConfiguration(default_settings=configuration_dict, config_file_path=config_file, config_section_name='setupentity')
app_config.load()
if bool_value(app_config.get('enable_debug')):
    qualys.enableDebug(True)
qualys.enableLogger()

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

    # only log Knowledgebase
    populator = qualys.qualys_log_populator.QualysKBPopulator(settings=app_config)
    populator.populate_lookup_table = True
    populator.run()



except qualys.splunkpopulator.utils.QualysAPIClientException, e:
    print "QualysSplunkPopulator: [ERROR] %s" % e.message