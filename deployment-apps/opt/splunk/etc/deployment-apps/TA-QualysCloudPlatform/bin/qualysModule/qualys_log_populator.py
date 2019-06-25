# -*- coding: utf-8 -*-
import urlparse

__author__ = "Bharat Patel"
__copyright__ = "Copyright (C) 2014, Bharat Patel"
__license__ = "New BSD"
__version__ = "1.0"
from abc import ABCMeta

import json
import logging
import os
from datetime import datetime
try:
    import xml.etree.cElementTree as ET
except ImportError:
    import xml.etree.ElementTree as ET

import splunk.clilib.cli_common as scc

import qualysModule
from qualysModule.splunkpopulator.basepopulator import BasePopulatorException
from qualysModule.splunkpopulator.kbpopulator import QualysKnowledgebasePopulator
from qualysModule.splunkpopulator.detectionpopulator import *
from qualysModule.splunkpopulator.DetectionFetchCoordinator import DetectonFetchCoordinator
from qualysModule.splunkpopulator.WASFindingsFetchCoordinator import WASFindingsFetchCoordinator
from qualysModule import *
from qualysModule.lib import api as qapi
from qualysModule.splunkpopulator.utils import bool_value
import qualysModule.application_configuration

class QualysBaseLogPopulator(object):
    __metaclass__ = ABCMeta

    formatter = logging.Formatter('%(message)s')
    console_log_handler = logging.StreamHandler(sys.stdout)
    console_log_handler.setFormatter(formatter)


    def __init__(self, settings=None, checkpoint=None, host='localhost', index='main', start_date='1999-01-01T00:00:00Z'):

        """

        :param settings qualysModule.application_configuration.ApplicationConfiguration:
        :param api_user:
        :param api_password:
        """
        if settings is None:
            self.settings = qualysModule.application_configuration.ApplicationConfiguration()
            self.settings.load()
            qlogger.debug("Loading default application settings")
	    qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Loading default application settings") 
        elif isinstance(settings, qualysModule.application_configuration.ApplicationConfiguration):
            self.settings = settings
            qlogger.debug("Loading custom settings")
	    qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "Loading custom settings")
        else:
            raise NameError("Invalid setting object specified")

        self.preserve_api_output = False
        self.HOST = host
        self.INDEX = index
        self.STARTDATE = start_date
        self.checkpoint = checkpoint
        self.checkpointData = {}
        self.loadCheckpoint()

    def loadCheckpoint(self):
        if os.path.isfile(self.checkpoint):
            # read file data and load into self.checkpointData
            try:
                with open(self.checkpoint) as f:
                    self.checkpointData = json.load(f)
            except (OSError, IOError):
                sys.stderr.write("Failed to read Checkpoint from file %s" % self.checkpoint)
            return None
        else:
            # checkpoint file does not exists.
            # create a new one
            self.saveCheckpoint()
    # end of loadCheckpoint

    def saveCheckpoint(self):
        # dump contents of self.checkpointData into self.checkpoint
        try:
            json.dumps(self.checkpointData)
            with open(self.checkpoint, "w") as f:
                ckpt = json.dumps(self.checkpointData)
                f.write(ckpt)
        except (OSError, IOError):
            sys.stderr.write("Failed to write checkpoint in file %s" % self.checkpoint)
    # end of saveCheckpoint

    def get_app_setting(self, key):
        return self.settings.get(key)

    def save_app_setting(self, key, value):
        self.settings.set(key, value)

    def save_settings(self):
        self.settings.save_settings()

    def run(self):
        """


        :type configuration_dict: dict
        :param api_user:
        :param api_password:
        :param configuration_dict:
        """

        qlogger.info("Start")

        self._run()


class QualysKBPopulator(QualysBaseLogPopulator):
    def __init__(self, settings=None, checkpoint=None, host='localhost', index='main', start_date='1999-01-01T00:00:00Z'):
        super(QualysKBPopulator, self).__init__(settings, checkpoint, host, index)
        self.populate_lookup_table = False

    def _run(self):
        """
        :rtype : object
        :type configuration_dict: dict
        :param api_user:
        :param api_password:
        :param configuration_dict:
        """

        qlogger.info("Start logging knowledgebase")
        try:
            output_to_stdout = True
            # first read from config file then check if an option was provided on command line
            log_output_directory = self.settings.get('log_output_directory', None)

            if log_output_directory is not None and log_output_directory != '':
                output_to_stdout = False

            kb_logger = logging.getLogger('KNOWLEDGEBASE')

            if output_to_stdout:
                qlogger.info("Outputting logs to stdout")
                kb_logger.addHandler(self.console_log_handler)
            else:


                kb_output_file = log_output_directory + '/qualys_knowledgebase.seed'
                kb_log_handler = logging.FileHandler(kb_output_file)
                kb_logger.addHandler(kb_log_handler)
                kb_log_handler.setFormatter(self.formatter)
                qlogger.info("Outputting knowledgebase data to file %s",
                             kb_output_file)

            kbPopulator = QualysKnowledgebasePopulator(kb_logger)
            kbPopulator.preserve_api_output = self.preserve_api_output
            kbPopulator.create_lookup_csv = self.populate_lookup_table
            kbPopulator.log = True
            try:

                resp = kbPopulator.run()

            except BasePopulatorException, e:
                qlogger.error(e.message)
            except NameError, e:
                qlogger.error(e)

        except Exception, e:
            qlogger.exception(e)

        qlogger.info('Done logging knowledgebase')


class QualysDetectionPopulator(QualysBaseLogPopulator):
    def _run(self, configuration_dict=None):
        """
        :rtype : object
        :type configuration_dict: dict
        :param api_user:
        :param api_password:
        :param configuration_dict:
        """

        qlogger.info("Start")

        try:
            output_to_stdout = True

            # first read from config file then check if an option was provided on command line
            log_output_directory = self.settings.get('log_output_directory', None)

            if log_output_directory is not None and log_output_directory != '':
                output_to_stdout = False

            detection_logger = logging.getLogger('HOST_DETECTIONS')

            start_time = datetime.utcnow()

            preserve_api_output = self.preserve_api_output
            kbPopulator = QualysKnowledgebasePopulator()
            kbPopulator.preserve_api_output = preserve_api_output

            log_detections = bool_value(self.settings.get('log_detections', True))
            log_host_summary = bool_value(self.settings.get('log_host_summary', True))

            if log_detections or log_host_summary:

                if not qapi.client.qweb_version or qapi.client.qweb_version < 8.3:
                    qlogger.info('Fetching KB as part of detections because qweb_version=%s is less than 8.3.', qapi.client.qweb_version)
		    qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "Fetching KB as part of detections becuase qweb_version=%s is less than 8.3" % qapi.client.qweb_version)    
		    kbPopulator.run()
                detection_configuration = HostDetectionPopulatorConfiguration(kbPopulator, detection_logger);

                detection_configuration.add_detection_api_filter('status', 'New,Active,Fixed,Re-Opened')

                cp_last_run_datetime = self.checkpointData.get('last_run_datetime', self.STARTDATE)
                if cp_last_run_datetime:
                    try:
                        qlogger.info("Last run date time in file is %s", cp_last_run_datetime)
		    	qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "last run date time in file is %s" % cp_last_run_datetime)
                        last_fetched_date_time = datetime.strptime(cp_last_run_datetime, '%Y-%m-%dT%H:%M:%SZ')
                        detection_configuration.add_detection_api_filter('vm_scan_since', cp_last_run_datetime)
                        qlogger.info("Fetching detection data for Hosts which were scanned after %s", cp_last_run_datetime)
                        qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Fetching detection data for Hosts which were scanned after %s" % cp_last_run_datetime)
                    except ValueError:
                        qlogger.error("Incorrect date format found: %s", last_fetched_date_time)
                        qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Incorrect date format %s" %last_fetched_date_time )

                qlogger.info("Fetching all detection data")


                # setup custom detection api parameters
                qualysConf = scc.getMergedConf("qualys")
                extra_params = None
                if 'detection_params' in qualysConf['setupentity'] and qualysConf['setupentity']['detection_params'] != '':
                    qlogger.info("Parsing extra detection parameter string:%s", qualysConf['setupentity']['detection_params'])
		    qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Parsing extra detection string %s" % qualysConf['setupentity']['detection_params'])
		    try:
                        extra_params = json.loads(qualysConf['setupentity']['detection_params'])
                    except ValueError, e:
                        qlogger.info("Parameters are not in JSON format, parsing as regular URL params: %s. ERROR=%s",
                                      qualysConf['setupentity']['detection_params'], e.message)
                        extra_params = urlparse.parse_qs(qualysConf['setupentity']['detection_params'])
                        extra_params = dict(map(lambda (k, v): (k, ','.join(v)), extra_params.iteritems()))
                    if extra_params:
                        for name in extra_params:
                            qlogger.info("Adding detection param:%s with value%s", name, extra_params[name])
			    qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "Adding detection param:%s with value %s" % (name, extra_params[name]))        
	            	    detection_configuration.add_detection_api_filter(name, extra_params[name])
                    else:
                        qlogger.error("Error setting extra detection API parameters via string:%s", qualysConf['setupentity']['detection_params'])


                detection_configuration.host = self.HOST
                detection_configuration.index = self.INDEX
                detection_configuration.preserve_api_output = preserve_api_output
                detection_configuration.collect_advanced_host_summary = True
                detection_configuration.log_host_detections = log_detections
                detection_configuration.log_host_summary = log_host_summary
                detection_configuration.truncation_limit = 5000
                detection_configuration.log_host_details_in_detection = bool_value(qualysConf['setupentity']['log_host_details_in_detections'])

                try:
                    # configure which fields to log for HOSTSUMMARY events
                    if self.settings.get('host_summary_fields'):
                        HostDetectionPopulator.host_fields_to_log = self.settings.get('host_summary_fields')

                    # Setup which fields to log for HOSTVULN events
                    if self.settings.get('detection_fields'):
                        HostDetectionPopulator.detection_fields_to_log = self.settings.get('detection_fields')

                    use_multi_threading = bool_value(qualysConf['setupentity']['use_multi_threading'])

                    total_logged = 0
                    if use_multi_threading:
                        num_threads = int(qualysConf['setupentity']['num_threads'])
                        if num_threads < 0 or num_threads > 10:
                            num_threads = 2
                        config = {"num_threads": num_threads}
                        qlogger.info("Running in multi-thread mode with num_threads=%s", num_threads)
			qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "Running in multi-thread mode with num_threads=%s" % num_threads)
			dfc = DetectonFetchCoordinator(config, detection_configuration)
                        dfc.coordinate()
                        total_logged = dfc.get_host_logged_count
                    else:
                        qlogger.info("Running in single thread mode")
			qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "Running in single thread mode")
                        detection_api_populator = HostDetectionPopulator(detection_configuration)
                        detection_api_populator.run()
                        total_logged = detection_api_populator.get_host_logged_count

                    qlogger.info("Done loading detections for %d hosts.", total_logged)

                    # store date/time when data pull was started, only if atlease one host was logged
                    #TODO: update checkpoint at this point
                    if total_logged > 0:
                        self.checkpointData['last_run_datetime'] = start_time.strftime('%Y-%m-%dT%H:%M:%SZ')
                        qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Setting checkpointData last_run_datetime to %s" % self.checkpointData['last_run_datetime'])

                        first_run = self.checkpointData.get('first_run', True)
                        if first_run:
                            self.checkpointData['first_run'] = False

                        self.saveCheckpoint()


                except BasePopulatorException, e:
                    qlogger.error(e.message)
                    qualysModule.splunkpopulator.utils.printStreamEventXML("_internal",e.message)

        except Exception, e:
            qlogger.exception("An error occurred ")

        qlogger.info("Done")
        
class QualysWasDetectionPopulator(QualysBaseLogPopulator):
    def _run(self, configuration_dict=None):
        """
        :rtype : object
        :type configuration_dict: dict
        :param api_user:
        :param api_password:
        :param configuration_dict:
        """

        qlogger.info("Start")

        try:
            qualysConf = scc.getMergedConf("qualys")
            
            output_to_stdout = True

            detection_logger = logging.getLogger('WAS_DETECTIONS')

            start_time = datetime.utcnow()

            preserve_api_output = self.preserve_api_output
            kbPopulator = QualysKnowledgebasePopulator()
            kbPopulator.preserve_api_output = preserve_api_output

            log_detections = bool_value(qualysConf['setupentity']['log_individual_findings'])
            log_host_summary = bool_value(qualysConf['setupentity']['log_webapp_summary'])
            
            if log_detections or log_host_summary:
                detection_configuration = WASDetectionPopulatorConfiguration(kbPopulator, detection_logger)
                cp_last_run_datetime = self.checkpointData.get('last_run_datetime', self.STARTDATE)

                if cp_last_run_datetime:
                    try:
                        qlogger.info("WAS findings were last fetched on %s", cp_last_run_datetime)
			qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "WAS findings were last fetched on %s" % cp_last_run_datetime)
                        last_fetched_date_time = datetime.strptime(cp_last_run_datetime, '%Y-%m-%dT%H:%M:%SZ')
                        
                        detection_configuration.add_detection_api_filter('lastTestedDate', 'GREATER', cp_last_run_datetime)
                        qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Fetching WAS findings data for web apps which were scanned after %s" % cp_last_run_datetime)
                        qlogger.info("Fetching WAS findings data for Hosts which were scanned after %s", cp_last_run_datetime)
                    except ValueError:
                        qlogger.error("Incorrect date format found: %s", last_fetched_date_time)

                qlogger.info("Fetching all WAS detection data")

                # setup custom detection api parameters

                extra_params = None
                if 'extra_was_params' in qualysConf['setupentity'] and qualysConf['setupentity']['extra_was_params'] != '':
                    qlogger.info("Parsing extra WAS parameter string:%s", qualysConf['setupentity']['extra_was_params'])
		    qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Parsing extra WAS parameter string:%s" % qualysConf['setupentity']['extra_was_params'])
                    try:
                        extra_params_root = ET.fromstring(qualysConf['setupentity']['extra_was_params'])

                        for child in extra_params_root:
                            child_attribs = child.attrib
                            qlogger.info("Adding WAS param: %s %s %s", child_attribs['field'], child_attribs['operator'], child.text)
                            qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "Adding WAS param: %s %s %s" % (child_attribs['field'], child_attribs['operator'], child.text))
                            detection_configuration.add_detection_api_filter(child_attribs['field'], child_attribs['operator'], child.text)
                    except ValueError, e:
                        qlogger.info("Error parsing extra WAS parameters: %s Error: %s", qualysConf['setupentity']['extra_was_params'], e.message)
                        qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "Error parsing extra WAS parameters: %s Error: %s" % (qualysConf['setupentity']['extra_was_params'], e.message))
                
                detection_configuration.host = self.HOST
                detection_configuration.index = self.INDEX
                detection_configuration.preserve_api_output = preserve_api_output
                detection_configuration.collect_advanced_host_summary = True
                detection_configuration.log_host_detections = log_detections
                detection_configuration.log_host_summary = log_host_summary
                detection_configuration.truncation_limit = 5000
                detection_configuration.log_host_details_in_detection = bool_value(qualysConf['setupentity']['log_host_details_in_detections'])

                try:
                    # configure which fields to log for HOSTSUMMARY events

                    if self.settings.get('host_summary_fields'):
                        WASDetectionPopulator.host_fields_to_log = self.settings.get('host_summary_fields')

                    # Setup which fields to log for HOSTVULN events
                    if self.settings.get('detection_fields'):
                        WASDetectionPopulator.detection_fields_to_log = self.settings.get('detection_fields')

                    use_multi_threading = False
                    if 'use_multi_threading_for_was' in qualysConf['setupentity']:
                        use_multi_threading = bool_value(qualysConf['setupentity']['use_multi_threading_for_was'])

                    total_logged = 0

                    if use_multi_threading:
                        num_threads = int(qualysConf['setupentity']['num_threads_for_was'])
                        if num_threads < 0 or num_threads > 10:
                            num_threads = 2
                        config = {"num_threads": num_threads}
                        qlogger.info("Running in multi-thread mode with num_threads=%s", num_threads)
                        qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "Running in multi-thread mode with num_threads=%s" % num_threads)
                        wfc = WASFindingsFetchCoordinator(num_threads, detection_configuration)
                        wfc.coordinate()
                        total_logged = wfc.getLoggedHostsCount()
                    else:
                        qlogger.info("Running in single thread mode")
                        qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "Running in single thread mode")
			detection_api_populator = WASDetectionPopulator(detection_configuration)
                        detection_api_populator.run()
                        total_logged = detection_api_populator.get_host_logged_count

                    qlogger.info("Done loading detections for %d hosts.", total_logged)

                    # store date/time when data pull was started, only if atlease one host was logged
                    if total_logged > 0:
                        self.checkpointData['last_run_datetime'] = start_time.strftime('%Y-%m-%dT%H:%M:%SZ')
                        qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","setting checkpointData last_run_datetime to %s" % self.checkpointData['last_run_datetime'])

                        first_run = self.checkpointData.get('first_run', True)
                        if first_run:
                            self.checkpointData['first_run'] = False

                        self.saveCheckpoint()

                except BasePopulatorException, e:
                    qlogger.error(e.message)
		    qualysModule.splunkpopulator.utils.printStreamEventXML("_internal",e.message)

        except Exception, e:
            qlogger.exception("An error occurred ")

        qlogger.info("Done")
# end of QualysWasDetectionPopulator class
