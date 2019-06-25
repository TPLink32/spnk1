###########################################
## Created  by Elias Hadadd elias@splunk.com
## version 2.2

import gzip
import csv
import time
import re
import sys, os
import logging, logging.handlers
import splunk

import base64
import datetime
import json
from optparse import OptionParser
import urllib2
import splunk.clilib.cli_common
import splunk.auth as auth
import authSession

#####################################################
######################################################
## OPTIONAL IF YOU WANT TO OVERWRITE VALUES FROM SEARCH
type = ""
resource = ""
severity = ""
node = ""
################################
timeOfEvent = ""
description = ""
source = "Splunk"
user = ""
password = ""
endpoint = ""
################################


# Define the logging function
def setup_logging():
        logger = logging.getLogger('splunk.foo')
        SPLUNK_HOME = os.environ['SPLUNK_HOME']
        LOGGING_DEFAULT_CONFIG_FILE = os.path.join(SPLUNK_HOME, 'etc', 'log.cfg')
        LOGGING_LOCAL_CONFIG_FILE = os.path.join(SPLUNK_HOME, 'etc', 'log-local.cfg')
        LOGGING_STANZA_NAME = 'python'
        LOGGING_FILE_NAME = "SNOW_EventIntegration.log"
        BASE_LOG_PATH = os.path.join('var', 'log', 'splunk')
        LOGGING_FORMAT = "%(asctime)s %(levelname)-s\t%(module)s:%(lineno)d - %(message)s"
        splunk_log_handler = logging.handlers.RotatingFileHandler(os.path.join(SPLUNK_HOME, BASE_LOG_PATH, LOGGING_FILE_NAME), mode='a')
        splunk_log_handler.setFormatter(logging.Formatter(LOGGING_FORMAT))
        logger.addHandler(splunk_log_handler)
        splunk.setupSplunkLogger(logger, LOGGING_DEFAULT_CONFIG_FILE, LOGGING_LOCAL_CONFIG_FILE, LOGGING_STANZA_NAME)
        return logger

def defineOptions(j):

        parser = OptionParser();

        #Global Variables
        global type
        global resource
        global severity
        global source
        global endpoint
        global hostname
        global timeOfEvent
        global description
        global node
	global user
	global password
	global endpoint	

	#logger = setup_logging()
	
	#get the script execution time
	timeOfEvent = time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime())

	time.sleep(2)
	try:
		str = sys.argv[8]
		f1=gzip.open(str,'rb')
        
	except IOError as e:
                logger.error("I/O error({0}): {1}".format(e.errno, e.strerror))
                logger.error("Could not open raw results file. Make sure you have read access to the raw results folder at "+ sys.argv[8])
		logger.error("Failed to execute Alert Script")
        
	csv_file=csv.DictReader(f1, delimiter=',')

        i=0
        node_temp=""
        type_temp=""
        additionalInfo=""
        resource_temp=""
        severity_temp=""
        description_temp=""
        

        #pick the last event which is the most recent event
        # set the node, type, resource, severity and timeOfEvent variables
        for line in csv_file:
		#Read the line that matches the request
                if i==j:
                        if node == "":
                                logger.info("capturing node name from raw results")
                                try:
                                        node_temp=line['node']
                                except KeyError:
                                        logger.warning("node  must be set as a returned field in the alert raw results or hardcoded in the ServiceNow_EventIntegration.py file. Setting the value to host")
                                        node_temp=line['host']
                        else:
                                node_temp=node
                        if resource == "":
                                logger.info("capturing resource from raw results")
                                try:
                                        resource_temp=line['resource']
                                except KeyError:
                                        resource_temp=""
                                        logger.warning("resource is not set as a returned field in the alert raw results. Continuing python script execution.")
                        else:
                                resource_temp=resource
                        if type == "":
                                logger.info("capturing type from raw results")
                                try:
                                        type_temp=line['type']
                                except KeyError:
                                        logger.error("type must be set as a returned field in the alert raw results or hardcoded in the ServiceNow_EventIntegration.py file. Exiting python script.")
                                        raise SystemExit
                        else:
                                type_temp=type
                        if severity == "":
                                logger.info("capturing severity from raw results")
                                try:
                                        severity_temp=line['severity']
                                except KeyError:
                                        logger.error("severity must be set as a returned field in the alert raw results or hardcoded in the ServiceNow_EventIntegration.py file. Exiting python script.")
                                        raise SystemExit
                        else:
                                severity_temp=severity
                        if description == "":
                                logger.info("capturing description from raw results")
                                try:
                                        description_temp=line['description']
                                except KeyError:
                                        description_temp=""
                                        logger.warning("description is not set as a returned field in the alert raw results. Continuing python script execution.")
                        else:
                                description_temp=description
                        # set additionalInfo field                       
                        str = sys.argv[6]
                        additionalInfo = "{\"url\":\"" + str  + "\"}"
                        break
                i = i+1
                
	#get the endpoint fnd username from snow.conf
        snow = splunk.clilib.cli_common.getConfStanza("snow", "default")
        logger.info("url " + snow['url'])
	#add an extra / character at the end of the url if it doesnt exist
        if (re.search(r'http..//.*\w+/', snow['url'])):
                url = snow['url']
	elif (re.search(r'http.://.*\w+', snow['url'])):
                url = snow['url'] + '/'
        else:
                logger.error("Servicenow endpoint has wrong format. Please check the app manual")
                sys.exit(1)
  
            
        endpoint = url + "api/now/table/em_event"

        #get the snow username password only the first time
        if (j==0):
                # get the session from splunkd
                sk = sys.stdin.readline().strip()
                sessionKey = re.sub(r'sessionKey=', "", sk)
                sessionKey = urllib2.unquote(sessionKey.encode('ascii')).decode('utf-8')

                #get snow release from snow.conf
                release = snow['release'].lower()
                logger.info("release is " + release)

                if release != "eureka":
                        logger.error("Event management is only supported on Eureka release onwards Please check the app manual")
                        sys.exit(1)
                        
                logger.info("get Session new  " + sessionKey)
                
                #get the username and password from apps.conf
                user, password = authSession.getCredentials(sessionKey)       

        logger.info("Username captured  " + user)        
	
	# How to connect/login to the ServiceNow instance
        parser.add_option("--endPoint", dest="endPoint", help="The endpoint of the web service", default=endpoint)
        parser.add_option("--user", dest="user", help="The user name credential", default=user)
        parser.add_option("--password", dest="password", help="The user password credential", default=password)

        # Fields on the Event
        parser.add_option("--source", dest="source", help="Source of the event", default=source)
        parser.add_option("--node", dest="node", help="Name of the node", default=node_temp)
        parser.add_option("--type", dest="type", help="Type of event", default=type_temp)
        parser.add_option("--additionalInfo", dest="additionalInfo", help="Additional Information", default=additionalInfo)
        parser.add_option("--resource", dest="resource", help="Represents the resource event is associated with", default=resource_temp)
        parser.add_option("--severity", dest="severity", help="Severity of event", default=severity_temp)
        parser.add_option("--timeOfEvent", dest="timeOfEvent", help="Time of event in GMT format", default=timeOfEvent)
        parser.add_option("--description", dest="description", help="Event description", default=description_temp)
        parser.add_option("--ciIdentifier", dest="ciIdentifier", help="Optional JSON string that represents a configuration item in the users network", default="{}")

        (options, args) = parser.parse_args()
        return options

        f1.close()


def execute():

        data = {"source" : options.source, "node" : options.node , "type" : options.type, "additional_info" : options.additionalInfo,  "resource" : options.resource, "severity" : options.severity,
                     "time_of_event" : options.timeOfEvent, "description" : options.description,
                        "ci_identifier" : options.ciIdentifier}
        data = json.dumps(data)

        ## Proxy configuration
        snow = splunk.clilib.cli_common.getConfStanza("snow", "default")
        proxy_url = snow['proxy_url']
        if proxy_url != "":
                proxyHandler = urllib2.ProxyHandler({'https': proxy_url})
                proxyOpener = urllib2.build_opener(proxyHandler)
                urllib2.install_opener(proxyOpener)

        headers = {'Content-type': 'application/json', 'Accept': 'application/json'}
        request = urllib2.Request(url=options.endPoint, data=data, headers=headers)
        base64string = base64.urlsafe_b64encode('%s:%s' % (options.user, options.password))
        request.add_header("Authorization", "Basic %s" % base64string)
	
	#Send the request only when source, type, severity and node fields are set
        if (options.source !="") and (options.node !="") and (options.type !="") and (options.severity !=""):
		logger.info("sending the following request to ServiceNow " + data)
		try: 
			f = urllib2.urlopen(request)
        		resp = f.read()
        		logger.info("Response from REST " + resp)
       			f.close()
		
		except urllib2.HTTPError, e:
			logger.error("Failed to send the request to ServiceNow Endpoint" + str(e.reason))
			raise SystemExit
		except urllib2.URLError, e:
			logger.error("Failed to send the request to ServiceNow Endpoint" + str(e.reason))
			raise SystemExit
		except httplib.HTTPException, e:
			logger.error("Failed to send the request to ServiceNow Endpoint" + str(e.reason))	
			raise SystemExit
	else:
		logger.error("source, type, node and severity fields must be set. Will not send request to ServiceNow")
		sys.exit(1)


if __name__ == '__main__':
        logger = setup_logging()
    	logger.info("##################################")
	logger.info("Start of Service Now Alert script - Alert Name " + sys.argv[4])
	logger.info("Results file " + sys.argv[8])
	logger.info("Number of events " + sys.argv[1])
	logger.info("Setting Events Fields values")

        #default is 1 event per alert execution - increase that if needed.
        max = min(sys.argv[1],1)
        
        for x in range(0, max):
                logger.info("Setting options for request number %d" %(x+1))
                options = defineOptions(x);
                logger.info("Sending Request number %d to ServiceNow Endpoint" %(x+1))
                execute();

	logger.info("Alert Script execution completed successfully")

