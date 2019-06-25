#!/usr/bin/python

# -*- coding: utf-8 -*-
__author__ = "Bharat Patel <bharrat@gmail.com>"
__copyright__ = "Copyright (C) 2014, Bharat Patel"
__license__ = "New BSD"
__version__ = "1.0"
import qualys.qualys_log_populator
import qualys.splunkpopulator.utils
from qualys.application_configuration import *
from qualys import qlogger
import qualys.lib.api as qapi
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
parser.add_option("-o", "--log-output-directory", dest="output_directory",
                  help="Directory for log output, by default logs will be printed to stdout", metavar="DIR")
parser.add_option("-a", "--load-all-qids",
                  action="store_true", dest="load_all_qids", default=False,
                  help="Ignore config setting and log all QIDs")

parser.add_option("-k", "--log-knowledgebase",
                  action="store_true", dest="log_kb_api", default=False,
                  help="Log knowledgebase entries")

parser.add_option("-d", "--log-host-detections",
                  action="store_true", dest="log_detection_api", default=False,
                  help="Log Host detections")

parser.add_option("-s", "--api-server",
                  dest="api_server", default="https://qualysapi.qualys.com",
                  help="API Server URL")

parser.add_option("-u", "--username",
                  dest="username", default=None,
                  help="QG Username")

parser.add_option("-p", "--password",
                  dest="password", default=None,
                  help="QG Password")


parser.add_option("-q", "--quiet",
                  action="store_false", dest="verbose", default=True,
                  help="don't print status messages to stdout")

parser.add_option("-e", "--preserve-api-output",
                  action="store_true", dest="preserve_api_output", default=False,
                  help="Keep API output fetched from Qualys APIs ( by default temporary files are removed after creating log entries)")

parser.add_option("-x", "--proxy",
                  dest="proxy_host", default=None,
                  help="Proxy address")

parser.add_option("-g", "--debug",
                  action="store_true", dest="debug", default=False,
                  help="Debug mode")

parser.add_option("-I", "--host-ids",
                  dest="hostids", action="store_true", default=False, help="log host ids")

parser.add_option("-t", "--num-threads",
                  dest="num_threads", default=1, help="Number of fetch threads")

(options, args) = parser.parse_args()

log_kb_api = False
log_detection_api = False
log_ids = False
api_server = None
api_user = None
api_password = None
preserve_api_output = False
proxy = None

if options.debug:
    qualys.enableDebug(True)

qualys.enableLogger()

if options.proxy_host:
    proxy = options.proxy_host
if options.preserve_api_output:
    preserve_api_output = True


if options.log_kb_api:
    log_kb_api = True

if options.log_detection_api:
    log_detection_api = True

if options.hostids:
    log_ids = True

if options.api_server:
    api_server = options.api_server

if options.username:
    api_user = options.username

if options.password:
    api_password = options.password

num_threads = int(options.num_threads)

temp_directory = APP_ROOT + '/tmp'

log_output_directory = ''

if options.output_directory and options.output_directory is not None:
        ##Make sure we can write to output directory
        log_output_directory = options.output_directory
        log_output_directory = log_output_directory.rstrip('/')
        if not os.path.isdir(log_output_directory) or not os.access(log_output_directory, os.W_OK):
            print "WARNING: Log output directory specified is not writable. Logs will be outputted to stdout"
            log_output_directory = ''


l_settings = dict(log_output_directory=log_output_directory, preserve_api_output=preserve_api_output, use_multi_threading=log_ids, num_threads=num_threads)
app_config = ApplicationConfiguration(settings_override=l_settings)
app_config.load()

if api_user is None:
    api_user = app_config.get('username', None)

if api_password is None:
    api_password = app_config.get('password', None)

if proxy is None:
    proxy = app_config.get('proxy', None)

if api_server is None:
    #if not passed via CLI argument then load from config file
    api_server = app_config.get('api_server', None)

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

try:
    if proxy:
        qlogger.info("Using proxy")

    if log_kb_api:
        kb_log_populator = qualys.qualys_log_populator.QualysKBPopulator(settings=app_config)
        kb_log_populator.populate_lookup_table = True
        kb_log_populator.preserve_api_output = preserve_api_output
        kb_log_populator.run()

    if log_detection_api:
        detection_populator = qualys.qualys_log_populator.QualysDetectionPopulator(settings=app_config)
        detection_populator.preserve_api_output = preserve_api_output
        detection_populator.run()



except qualys.splunkpopulator.utils.QualysAPIClientException, e:
    qlogger.error(e.message)