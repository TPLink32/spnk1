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
## FIELDS THAT ARE REQUIRED TO BE SET. WHETHER IN THIS FILE OR AS RETURNED FIELDS FROM THE ALERT RAW RESULTS
category = ""
contact_type = ""
##### no longer required 
##opened_by = ""
short_description = ""

######################################################
## FIELDS THAT ARE NOT REQUIRED TO BE SET. CAN BE SET IN THIS FILE OR AS RETURNED FIELDS FROM THE ALERT RAW RESULTS
subcategory = ""
state = ""
location = ""
impact = ""
urgency = ""
priority = ""
assignment_group = ""
ciIdentifier = ""
user = ""
password = ""
endpoint = ""

################################


# Define the logging function
def setup_logging():
        logger = logging.getLogger('splunk.snow')
        SPLUNK_HOME = os.environ['SPLUNK_HOME']
        LOGGING_DEFAULT_CONFIG_FILE = os.path.join(SPLUNK_HOME, 'etc', 'log.cfg')
        LOGGING_LOCAL_CONFIG_FILE = os.path.join(SPLUNK_HOME, 'etc', 'log-local.cfg')
        LOGGING_STANZA_NAME = 'python'
        LOGGING_FILE_NAME = "SNOW_IncidentIntegration.log"
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
        global category
        global subcategory
        #global opened_by
        global contact_type
        global state
        global location
        global impact
        global urgency
        global priority
        global assignment_group
        global short_description
	global user
	global password
	global endpoint	
	global ciIdentifier

        
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

        # set the fields value
        for line in csv_file:
		#Read the first line only
                if i==j:
                        print "Capturing event number ", i+1
                        if category == "":
                                logger.info("capturing category from raw results")
                                try:
                                        category_temp=line['category']
                                except KeyError:
                                        logger.error("category  must be set as a returned field in the alert raw results or hardcoded in the ServiceNow_EventIntegration.py file. Exiting python script.")
                                        raise SystemExit
                        if subcategory == "":
                                logger.info("capturing subcategory from raw results")
                                try:
                                        subcategory_temp=line['subcategory']
                                except KeyError:
                                        subcategory_temp=""
                                        logger.warning("subcategory is not set as a returned field in the alert raw results. Continuing python script execution.")
                        else:
                                subcategory_temp=subcategory
                        if contact_type == "":
                                logger.info("contact_type from raw results")
                                try:
                                        contact_type_temp=line['contact_type']
                                except KeyError:
                                        contact_type_temp =""
                                        logger.error("contact_type must be set as a returned field in the alert raw results or hardcoded in the ServiceNow_EventIntegration.py file. Exiting python script.")
                                        raise SystemExit
                        else:
                                contact_type_temp = contact_type
                        if short_description == "":
                                logger.info("capturing short_description from raw results")
                                try:
                                        short_description_temp=line['short_description']
                                except KeyError:
                                        short_description_temp = ""
                                        logger.error("short_description must be set as a returned field in the alert raw results or hardcoded in the ServiceNow_EventIntegration.py file. Exiting python script.")
                                        raise SystemExit
                        else:
                                short_description_temp=short_description
                        if state  == "":
                                logger.info("capturing state from raw results")
                                try:
                                        state_temp=line['state']
                                except KeyError:
                                        state_temp=""
                                        logger.warning("state is not set as a returned field in the alert raw results. Continuing python script execution.")
                        else:
                                state_temp=state
                        if location  == "":
                                logger.info("capturing location from raw results")
                                try:
                                        location_temp=line['location']
                                except KeyError:
                                        location_temp=""
                                        logger.warning("location is not set as a returned field in the alert raw results. Continuing python script execution.")
                        else:
                                location_temp=location
                        if impact  == "":
                                logger.info("capturing impact from raw results")
                                try:
                                        impact_temp=line['impact']
                                except KeyError:
                                        impact_temp=""
                                        logger.warning("impact is not set as a returned field in the alert raw results. Continuing python script execution.")
                        else:
                                impact_temp=impact
                        if urgency  == "":
                                logger.info("capturing urgency from raw results")
                                try:
                                        urgency_temp=line['urgency']
                                except KeyError:
                                        urgency_temp=""
                                        logger.warning("urgency is not set as a returned field in the alert raw results. Continuing python script execution.")
                        else:
                                urgency_temp=urgency
                        if priority  == "":
                                logger.info("capturing priority from raw results")
                                try:
                                        priority_temp=line['priority']
                                except KeyError:
                                        priority_temp=""
                                        logger.warning("priority is not set as a returned field in the alert raw results. Continuing python script execution.")
                        else:
                                priority_temp=priority
                        if assignment_group   == "":
                                logging.info("capturing assignment_group  from raw results")
                                try:
                                        assignment_group_temp=line['assignment_group']
                                except KeyError:
                                        assignment_group_temp=""
                                        logger.warning("assignment_group is not set as a returned field in the alert raw results. Continuing python script execution.")
                        else:
                                assignment_group_temp=assignment_group

                        if ciIdentifier  == "":
                                logging.info("capturing ciIdentifier from raw results")
                                try:
                                        ciIdentifier_temp=line['ciIdentifier']
                                except KeyError:
                                        logger.warning("ciIdentifier is not set as a returned field in the alert raw results. Setting host name as CiIdentifier")	
                                        ciIdentifier_temp=""
                        else:
                                ciIdentifier_temp=""
                        break
                i = i+1

	# get the endpoint and username from snow.conf
	snow = splunk.clilib.cli_common.getConfStanza("snow", "default")	

	#add an extra / character at the end of the url if it doesnt exist
        if (re.search(r'http.://.*\w+/', snow['url'])):
                url = snow['url']
	elif (re.search(r'http.://.*\w+', snow['url'])):
                url = snow['url'] + '/'
        else:
                logger.error("Servicenow endpoint has wrong format. Please check the app manual")
  
            
	#get snow release from snow.conf
	release = snow['release'].lower()
	logger.info("release is " + release)
        if release == "berlin":
                endpoint = url + "incident.do?JSON&sysparm_action=insert"
        elif release == "dublin":
                endpoint = url + "incident.do?JSONv2&sysparm_action=insert"
        elif release == "eureka":
                endpoint = url + "api/now/table/incident"
        else: 
                endpoint = url + "incident.do?JSONv2&sysparm_action=insert"

        #get the snow username password only the first time
        if (j==0):
	
                # get the session from splunkd
                sk = sys.stdin.readline().strip()
                logger.info("Session " + sk)
                sessionKey = re.sub(r'sessionKey=', "", sk)
                sessionKey = urllib2.unquote(sessionKey.encode('ascii')).decode('utf-8')
                
                #logger.info("Session " + sessionKey)
        
                #get the username and password from apps.conf
                user, password = authSession.getCredentials(sessionKey)
                
        logger.info("Captured Username  " + user)
        #logger.info("Captured Password  " + password)

	# How to connect/login to the ServiceNow instance
        parser.add_option("--endPoint", dest="endPoint", help="The endpoint of the web service", default=endpoint)
        parser.add_option("--user", dest="user", help="The user name credential", default=user)
        parser.add_option("--password", dest="password", help="The user password credential", default=password)

	# Fields on the Incident
        parser.add_option("--category", dest="category", help="Category of the Incident", default=category_temp)
        parser.add_option("--opened_by", dest="opened_by", help="Opened by", default=user)
        parser.add_option("--subcategory", dest="subcategory", help="Subcategory of incident", default=subcategory_temp)
        parser.add_option("--short_description", dest="short_description", help="short_description", default=short_description_temp)
        parser.add_option("--contact_type", dest="contact_type", help="Represents the contact type of the incident", default=contact_type_temp)
        parser.add_option("--state", dest="state", help="Represents the state of the incident", default=state_temp)
	parser.add_option("--location", dest="location", help="Represents the location of the incident", default=location_temp)
	parser.add_option("--impact", dest="impact", help="Represents the impact of the incident", default=impact_temp)
	parser.add_option("--urgency", dest="urgency", help="Represents the urgency of the incident", default=urgency_temp)
	parser.add_option("--priority", dest="priority", help="Represents the priority of the incident", default=priority_temp)
	parser.add_option("--assignment_group", dest="assignment_group", help="Represents the assignment group of the incident", default=assignment_group_temp)
	parser.add_option("--ciIdentifier", dest="ciIdentifier", help="Optional JSON string that represents a configuration item in the users network", default=ciIdentifier_temp)

        (options, args) = parser.parse_args()
        return options

        f1.close()


def execute():

	data = {"u_category" : options.category, "u_opened_by" : options.opened_by , "u_subcategory" : options.subcategory, "u_short_description" : options.short_description,  "u_contact_type" : options.contact_type, "u_state" : options.state, "u_location" : options.location, "u_impact" : options.impact, "u_urgency" : options.urgency, "u_priority" : options.priority, "u_assignment_group" : options.assignment_group, "u_configuration_item" : options.ciIdentifier}
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
        if (options.category !="") and (options.contact_type !="") and (options.short_description !=""):
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
		logger.error("category, contact_type and short description fields must be set. Will not send request to ServiceNow")


if __name__ == '__main__':
        logger = setup_logging()
    	logger.info("##################################")
	logger.info("Start of Service Now Alert script - Alert Name " + sys.argv[4])
	logger.info("Trigger Reason " + sys.argv[5])
	logger.info("Script  Name " + sys.argv[0])
	logger.info("Raw file " + sys.argv[8])
	logger.info("Setting Events Fields values")

        #send one request per script execution
        max = min(sys.argv[1],1)
        
        for x in range(0, max):
                options = defineOptions(x);
                logger.info("Sending Request number %d to ServiceNow Endpoint" %(x+1))
                execute();

	logger.info("Alert Script execution completed successfully")

