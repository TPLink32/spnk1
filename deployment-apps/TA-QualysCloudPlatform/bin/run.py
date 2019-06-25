#!/usr/bin/python

# -*- coding: utf-8 -*-
__author__ = "Bharat Patel <bharrat@gmail.com>"
__copyright__ = "Copyright (C) 2014, Bharat Patel"
__license__ = "New BSD"
__version__ = "1.0"

import splunk.clilib.cli_common as scc

import qualysModule.qualys_log_populator
import qualysModule.splunkpopulator.utils
from qualysModule.application_configuration import *
from qualysModule import qlogger
import qualysModule.lib.api as qapi
import fcntl, sys

pid_file = APP_ROOT + '/run.pid'
fp = open(pid_file, 'w')
try:
    fcntl.lockf(fp, fcntl.LOCK_EX | fcntl.LOCK_NB)
except IOError:
    # another instance is running
    sys.stderr.write('Another instance of run.py already running. PID=%s' % os.getpid())
    sys.exit(0)

parser = OptionParser()

parser.add_option("-k", "--log-knowledgebase",
                  action="store_true", dest="log_kb_api", default=False,
                  help="Log knowledgebase entries")

parser.add_option("-d", "--log-host-detections",
                  action="store_true", dest="log_detection_api", default=False,
                  help="Log Host detections")

parser.add_option("-w", "--log-was-findings",
                  action="store_true", dest="log_findings_api", default=False,
                  help="Log WAS findings")

parser.add_option("-s", "--api-server",
                  dest="api_server", default="https://qualysapi.qualys.com",
                  help="API Server URL")

parser.add_option("-u", "--username",
                  dest="username", default=None,
                  help="QG Username")

parser.add_option("-p", "--password",
                  dest="password", default=None,
                  help="QG Password")

parser.add_option("-f", "--from-date",
                  dest="start_date", default="1999-01-01T00:00:00Z",
                  help="")

parser.add_option("-x", "--proxy",
                  dest="proxy_host", default=None,
                  help="Proxy address")

parser.add_option("-g", "--debug",
                  action="store_true", dest="debug", default=False,
                  help="Debug mode")

(options, args) = parser.parse_args()

log_kb_api = False
log_detection_api = False
log_findings_api = False
log_ids = False
api_server = None
api_user = None
api_password = None
proxy = None
start_date = "1999-01-01T00:00:00Z"

if options.debug:
    qualysModule.enableDebug(True)

qualysModule.enableLogger()

if options.proxy_host:
    proxy = options.proxy_host

if options.log_kb_api:
    log_kb_api = True

if options.log_detection_api:
    log_detection_api = True

if options.log_findings_api:
    log_findings_api = True

if options.api_server:
    api_server = options.api_server

if options.username:
    api_user = options.username

if options.password:
    api_password = options.password

if options.start_date:
    start_date = options.start_date

temp_directory = APP_ROOT + '/tmp'


qualysConf = scc.getMergedConf("qualys")

appConfig = ApplicationConfiguration()
appConfig.load()

if proxy is None:
    proxy = qualysConf['setupentity']['proxy_server']

if api_server is None:
    #if not passed via CLI argument then load from config file
    api_server = qualysConf['setupentity']['api_server']

if api_server is None or api_server == '':
    api_server = raw_input("QG API Server:")

if api_user is None or api_user == '':
    api_user = raw_input("QG Username:")

if api_password is None or api_password == '':
    import getpass
    api_password = getpass.getpass("QG Password:")


apiConfig = qapi.Client.APIConfig()
apiConfig.username = api_user
apiConfig.password = api_password
apiConfig.serverRoot = api_server

qapi.setupClient(apiConfig)
qapi.client.validate()

h = 'localhost'
i = 'dummy'
print "Running with host '%s' and will use '%s' as index name." % (h, i)
try:
    if proxy:
        qlogger.info("Using proxy")
        apiConfig.useProxy = True
        apiConfig.proxyHost = proxy

    if log_kb_api:
        cp = './knowledge_base'
        kbPopulator = qualysModule.qualys_log_populator.QualysKBPopulator(settings=appConfig, checkpoint=cp, host=h, index=i, start_date=start_date)
        kbPopulator.populate_lookup_table = True
        kbPopulator.run()

    if log_detection_api:
        cp = './host_detection'
        detectionPopulator = qualysModule.qualys_log_populator.QualysDetectionPopulator(settings=appConfig, checkpoint=cp, host=h, index=i, start_date=start_date)
        detectionPopulator.run()

    if log_findings_api:
        cp = './was_findings'
        wasFindingsPopulator = qualysModule.qualys_log_populator.QualysWasDetectionPopulator(settings=appConfig, checkpoint=cp, host=h, index=i, start_date=start_date)
        wasFindingsPopulator.run()

except qualysModule.splunkpopulator.utils.QualysAPIClientException, e:
    qlogger.error(e.message)

fp.close()
