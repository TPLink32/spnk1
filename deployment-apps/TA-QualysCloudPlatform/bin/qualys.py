#!/usr/bin/python

"""
This is the main entry point for TA-QualysCloudPlatform
"""

import time
import sys
import re
from datetime import datetime
import traceback
import logging
import fcntl, sys
import json

import splunk.clilib.cli_common as scc
import splunk.entity as entity

import qualysModule.qualys_log_populator
import qualysModule.splunkpopulator.utils
from qualysModule.application_configuration import *
from qualysModule import qlogger
import qualysModule.lib.api as qapi

try:
    import xml.etree.cElementTree as ET
except ImportError:
    import xml.etree.ElementTree as ET


TA_ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
qualysModule.enableLogger()
qlogger = logging.getLogger('TA-QualysCloudPlatform')

def do_scheme():
    """
    Feed splunkd the TA's scheme
    """

    print """
    <scheme>
    <title>TA-QualysCloudPlatform</title>
    <description>Add-on for Qualys</description>
    <use_external_validation>true</use_external_validation>
    <streaming_mode>xml</streaming_mode>
    <use_single_instance>false</use_single_instance>
    <endpoint>
      <args>
        <arg name="name">
          <title>Qualys Sources</title>
        </arg>
        <arg name="duration">
          <required_on_create>0</required_on_create>
          <required_on_edit>0</required_on_edit>
           <title>Interval between subsequent runs (in seconds)</title>
        </arg>
        <arg name="start_date">
           <required_on_create>0</required_on_create>
           <required_on_edit>0</required_on_edit>
           <title>Collection data when the date is after this value</title>
           <title>Fetch data after this date</title>
        </arg>
      </args>
    </endpoint>
    </scheme>
    """

def validate_config():
    try:
        config_str = sys.stdin.read()
        print config_str
    except Exception, e:
        raise Exception, "Error getting Splunk configuration via stdin: %s" % str(e)
# end of validate_config

# read XML configuration passed from splunkd
def getConfig():
    config = {}
    stanzaDict = {}

    try:
        # read everything from stdin
        config_str = sys.stdin.read()

        # parse the config XML
        root = ET.fromstring(config_str)

        sessionKeyNode = root.find('session_key')
        config['session_key'] = sessionKeyNode.text

        checkpointDirNode = root.find('checkpoint_dir')
        config['checkpoint_dir'] = checkpointDirNode.text

        confNode = root.find("configuration")

        if confNode and confNode.tag == 'configuration':
            stanzas = confNode.findall("stanza")

            for stanza in stanzas:
                stanzaName = stanza.get("name", None)

                if stanzaName:
                    stanzaDict[stanzaName] = {}

                    params = stanza.findall("param")

                    for param in params:
                        paramName = param.get("name", None)
                        stanzaDict[stanzaName][paramName] = param.text
                    # end of for loop on params
                # end of if on stanzaName
            # end of for loop on stanzas

            config['stanzaDict'] = stanzaDict
        else:
            qlogger.debug("conf node not found")
            qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","conf node not found")
        if not config:
            raise Exception, "Invalid configuration received from Splunk."

    except Exception, e:
        raise Exception, "Error getting Splunk configuration via STDIN: %s" % str(e)

    qlogger.debug(config)
    return config
# end of get_config

def run():
    config = getConfig()

    if ('stanzaDict' not in config or \
        0 == len(config['stanzaDict'])):
        print "No input(s) configured /enabled. Doing nothing."
    else:
        api_user, api_password = qualysModule.splunkpopulator.utils.getCredentials(config['session_key'])
        qualysConf = scc.getMergedConf("qualys")

        if qualysConf['setupentity']['enable_debug'] == '1':
            qualysModule.enableDebug(True)

        appConfig = ApplicationConfiguration()
        appConfig.load()

        api_server = qualysConf['setupentity']['api_server']
        useProxy = qualysConf['setupentity']['use_proxy']
        proxy = qualysConf['setupentity']['proxy_server']

        if (api_user is None or api_user == '' or \
            api_password is None or api_password == '' or \
            api_server is None or api_server == ''):
            print "API Server/Username/Password not configured. Exiting."
            exit(1)

        apiConfig = qapi.Client.APIConfig()
        apiConfig.username = api_user
        apiConfig.password = api_password
        apiConfig.serverRoot = api_server

        if useProxy == '1':
            apiConfig.useProxy = True
            if proxy != '':
                 apiConfig.proxyHost = proxy
            else:
                 qlogger.error('You have enabled Proxy but Host field is empty. Cannot proceed further.')
                 qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","You have enabled Proxy but Host field is empty. Cannot proceed further.")
                 exit(1)
        # if

        qapi.setupClient(apiConfig)
        qapi.client.validate()

        for stanzaName, stanza in config['stanzaDict'].iteritems():
            # print "Running for %s" % stanzaName
            pureName = stanzaName.replace("qualys://", "")
            duration = stanza.get("duration", '288')
            cp = os.path.join(config.get("checkpoint_dir", "./"), pureName)
            h = stanza.get("host", "localhost")
            i = stanza.get("index", "main")
            sd = stanza.get("start_date", "1999-01-01T00:00:00Z")

            createPIDFile(pureName)

            if pureName == "knowledge_base":
                kbPopulator = qualysModule.qualys_log_populator.QualysKBPopulator(settings=appConfig, checkpoint=cp, host=h, index=i, start_date=sd)
                kbPopulator.populate_lookup_table = True
                kbPopulator.run()
            # end of if  knowledge_base

            if pureName == "host_detection":
                detectionPopulator = qualysModule.qualys_log_populator.QualysDetectionPopulator(settings=appConfig, checkpoint=cp, host=h, index=i, start_date=sd)
                detectionPopulator.run()
            # end of if host_ditection
            
            if pureName == "was_findings":
            	wasFindingsPopulator = qualysModule.qualys_log_populator.QualysWasDetectionPopulator(settings=appConfig, checkpoint=cp, host=h, index=i, start_date=sd)
            	wasFindingsPopulator.run()
            # end of if was_findings

            durationSeconds = qualysModule.splunkpopulator.utils.timeStringToSeconds(duration)
            time.sleep(int(durationSeconds))

            removePIDFile(pureName)

        # end of for loop on stanza
    # end of else
# end of run

def createPIDFile(basename):
    global TA_ROOT

    pid_file = TA_ROOT + '/' + basename + '.pid'

    current_pid = os.getpid()

    if os.path.isfile(pid_file):
        fp2 = open(pid_file, 'r')
        running_pid = fp2.readline()

        if os.path.exists('/proc/' + running_pid):
            print "Another instance of %s is already running with PID %s. I am exiting." % (basename, running_pid)
            exit(0)
        else:
            removePIDFile(basename)
        fp2.close()

    fp = open(pid_file, 'w')
    try:
        fcntl.lockf(fp, fcntl.LOCK_EX | fcntl.LOCK_NB)
        fp.write(str(current_pid))
    except IOError:
        sys.stderr.write('Another instance of %s already running. Exiting...' % basename)
        exit(0)
    fp.close()
# end of createPIDFile

def removePIDFile(basename):
    global TA_ROOT
    try:
        pid_file = TA_ROOT + '/' + basename + '.pid'
        os.remove(pid_file)
    except IOError:
        sys.stderr.write("Cannot remove %s PID file." % basename)
        exit(1)
# end of removePIDFile

def usage():
    """
    Print usage of this binary
    """

    hlp = "%s --scheme|--validate-arguments|-h"
    print >> sys.stderr, hlp % sys.argv[0]
    sys.exit(1)

def main():
    """
    Main entry point
    """

    args = sys.argv
    if len(args) > 1:
        if args[1] == "--scheme":
            do_scheme()
        elif args[1] == "--validate-arguments":
            sys.exit(validate_config())
        elif args[1] in ("-h", "--h", "--help"):
            usage()
        else:
            usage()
    else:
        qlogger.info("Start qualys TA")
        qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Start qualys TA") 
	run()
        qlogger.info("End qualys TA")
        qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "End qualys TA")
    sys.exit(0)


if __name__ == "__main__":
    main()
