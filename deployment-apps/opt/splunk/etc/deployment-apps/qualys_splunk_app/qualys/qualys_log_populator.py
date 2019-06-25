# -*- coding: utf-8 -*-
import urlparse

__author__ = "Bharat Patel <bharrat@gmail.com>"
__copyright__ = "Copyright (C) 2014, Bharat Patel"
__license__ = "New BSD"
__version__ = "1.0"
from abc import ABCMeta

import json
from qualys.splunkpopulator.basepopulator import BasePopulatorException
from qualys.splunkpopulator.kbpopulator import QualysKnowledgebasePopulator
from qualys.splunkpopulator.detectionpopulator import *
from qualys.splunkpopulator.DetectionFetchCoordinator import DetectonFetchCoordinator

from qualys import *
from qualys.lib import api as qapi
from qualys.splunkpopulator.utils import bool_value
import logging
import os
import qualys.application_configuration
from datetime import datetime


class QualysBaseLogPopulator(object):
    __metaclass__ = ABCMeta

    formatter = logging.Formatter('%(message)s')
    console_log_handler = logging.StreamHandler(sys.stdout)
    console_log_handler.setFormatter(formatter)


    def __init__(self, settings=None):

        """

        :param settings qualys.application_configuration.ApplicationConfiguration:
        :param api_user:
        :param api_password:
        """
        if settings is None:
            self.settings = qualys.application_configuration.ApplicationConfiguration()
            self.settings.load()
            qlogger.debug("Loading default application settings")
        elif isinstance(settings, qualys.application_configuration.ApplicationConfiguration):
            self.settings = settings
            qlogger.debug("Loading custom settings")
        else:
            raise NameError("Invalid setting object specified")

        self.preserve_api_output = False


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
        # Merge passed settings with Default APP settings
        log_output_directory = self.settings.get('log_output_directory', '')
        if log_output_directory != '' and os.path.isdir(log_output_directory) and os.access(
                log_output_directory, os.W_OK):
            pass
        else:
            self.settings.set('log_output_directory', '')

        self._run()


class QualysKBPopulator(QualysBaseLogPopulator):
    def __init__(self, settings=None):
        super(QualysKBPopulator, self).__init__(settings)
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
            if output_to_stdout:

                qlogger.info("Outputting logs to stdout")
                console_log_handler = logging.StreamHandler(sys.stdout)
                console_log_handler.setFormatter(self.formatter)
                detection_logger.addHandler(console_log_handler)

            else:

                detection_output_file = log_output_directory + '/host_detection_%s.seed' % start_time.strftime(
                    '%Y-%m-%d')
                qlogger.info("Outputting detection data to file %s", detection_output_file)
                detection_log_handler = logging.FileHandler(detection_output_file)
                detection_logger.addHandler(detection_log_handler)

            preserve_api_output = self.preserve_api_output
            kbPopulator = QualysKnowledgebasePopulator()
            kbPopulator.preserve_api_output = preserve_api_output

            log_detections = bool_value(self.settings.get('log_detections', True))
            log_host_summary = bool_value(self.settings.get('log_host_summary', True))

            if log_detections or log_host_summary:

                if not qapi.client.qweb_version or qapi.client.qweb_version < 8.3:
                    qlogger.debug('Fetching KB as part of detections because qweb_version=%s is less than 8.3.', qapi.client.qweb_version)
                    kbPopulator.run()
                detection_configuration = HostDetectionPopulatorConfiguration(kbPopulator, detection_logger);

                detection_configuration.add_detection_api_filter('status', 'New,Active,Fixed,Re-Opened')

                if self.settings.get('last_run_datetime'):
                    try:
                        qlogger.debug("Last run date time in file is %s", self.settings.get('last_run_datetime'))
                        last_fetched_date_time = datetime.strptime(self.settings.get('last_run_datetime'),
                                                                   '%Y-%m-%dT%H:%M:%S')
                        detection_configuration.add_detection_api_filter('vm_scan_since',
                                                                         self.settings.get('last_run_datetime') + 'Z')
                        qlogger.info("Fetching detection data for Hosts which were scanned after %s",
                                     self.settings.get('last_run_datetime'))
                    except ValueError:
                        qlogger.error("Incorrect date format found: %s", last_fetched_date_time)

                qlogger.info("Fetching all detection data")


                # setup custom detection api parameters
                extra_params = None
                if self.settings.get('detection_params'):
                    qlogger.debug("Parsing extra detection parameter string:%s", self.settings.get('detection_params'))
                    try:
                        extra_params = json.loads(self.settings.get('detection_params'))
                    except ValueError, e:
                        qlogger.info("Parameters are not in JSON format, parsing as regular URL params: %s. ERROR=%s",
                                      self.settings.get('detection_params'), e.message)
                        extra_params = urlparse.parse_qs(self.settings.get('detection_params'))
                        extra_params = dict(map(lambda (k, v): (k, ','.join(v)), extra_params.iteritems()))
                    if extra_params:
                        for name in extra_params:
                            qlogger.debug("Adding detection param:%s with value%s", name, extra_params[name])
                            detection_configuration.add_detection_api_filter(name, extra_params[name])
                    else:
                        qlogger.error("Error setting extra detection API parameters via string:%s", self.settings.get('detection_params'))


                detection_configuration.preserve_api_output = preserve_api_output
                detection_configuration.collect_advanced_host_summary = True
                detection_configuration.log_host_detections = log_detections
                detection_configuration.log_host_summary = log_host_summary
                detection_configuration.truncation_limit = 5000
                detection_configuration.log_host_details_in_detection = bool_value(
                    self.settings.get('log_host_details_in_detections', False))

                try:
                    # configure which fields to log for HOSTSUMMARY events
                    if self.settings.get('host_summary_fields'):
                        HostDetectionPopulator.host_fields_to_log = self.settings.get('host_summary_fields')

                    # Setup which fields to log for HOSTVULN events
                    if self.settings.get('detection_fields'):
                        HostDetectionPopulator.detection_fields_to_log = self.settings.get('detection_fields')

                    use_multi_threading = bool_value(
                        self.settings.get('use_multi_threading', False))

                    total_logged = 0
                    if use_multi_threading:
                        num_threads = int(self.settings.get('num_threads', 2))
                        if num_threads < 0 or num_threads > 10:
                            num_threads = 2
                        config = {"num_threads": num_threads}
                        qlogger.debug("Running in multi-thread mode with num_threads=%s", num_threads)
                        dfc = DetectonFetchCoordinator(config, detection_configuration)
                        dfc.coordinate()
                        total_logged = dfc.get_host_logged_count
                    else:
                        qlogger.debug("Running in single thread mode")
                        detection_api_populator = HostDetectionPopulator(detection_configuration)
                        detection_api_populator.run()
                        total_logged = detection_api_populator.get_host_logged_count

                    qlogger.info("Done loading detections for %d hosts.", total_logged)

                    # store date/time when data pull was started, only if atlease one host was logged
                    if total_logged > 0:
                        self.settings.set('last_run_datetime', start_time.strftime('%Y-%m-%dT%H:%M:%S'))
                        if self.settings.getBoolean('first_run', True):
                            self.settings.set('first_run', False)
                        self.settings.save_settings()
                except BasePopulatorException, e:
                    qlogger.error(e.message)

        except Exception, e:
            qlogger.exception("An error occurred ")

        qlogger.info("Done")