# -*- coding: utf-8 -*-
__author__ = "Bharat Patel"
__copyright__ = "Copyright (C) 2014, Bharat Patel"
__license__ = "New BSD"
__version__ = "1.0"

import sys
import abc
from threading import current_thread
from qualysModule.splunkpopulator.utils import QualysAPIClient
from qualysModule import *
import qualysModule
from qualysModule.lib import api

import qualysModule.lib.api as qapi
import qualysModule.splunkpopulator.utils
import time

try:
    import xml.etree.cElementTree as ET
except ImportError:
    import xml.etree.ElementTree as ET


class BasePopulatorException(Exception):
    pass


class BasePopulator():
    __metaclass__ = abc.ABCMeta

    # Set proper values in child classes
    #
    OBJECT_TYPE = "Unknown"
    FILE_PREFIX = "unknown"
    ROOT_TAG = 'NONE'


    def __init__(self, logging_handler=None):

        """

        :rtype : BasePopulator
        """
        assert isinstance(qapi.client, qualysModule.lib.api.Client.APIClient)

        self.api_client = qapi.client

        if logging_handler is None:
            logger = logging.getLogger('BASE')
            console_log_handler = logging.StreamHandler(sys.stdout)
            logger.addHandler(console_log_handler)
            formatter = logging.Formatter('%(message)s')
            console_log_handler.setFormatter(formatter)
            self._logger = logger
        else:
            self._logger = logging_handler

        self._logger.setLevel(logging.INFO)
        self.preserve_api_output = False
        self._batch = 1
        self._logged = 0
        self._parsed = 0


    @abc.abstractmethod
    def run(self):
        return

    @property
    @abc.abstractmethod
    def api_end_point(self):
        return

    def run(self):
        self._logged = 0
        self._parsed = 0
        return self.__fetch_and_parse()

    @property
    def get_api_parameters(self):
        return {"action": "list", "details": "Basic"}


    def __fetch(self, params=None):

        if self.api_end_point:
            api_params = self.get_api_parameters
            if params is not None:
                WASApi = self.api_client.isPortalEndpoint(self.api_end_point)
                if WASApi:
                    api_params = params
                else:
                    api_params = dict(api_params.items() + params.items())
            filename = temp_directory + "/%s_%s_%s_%s_batch_%s.xml" % (
                self.FILE_PREFIX, start_time.strftime('%Y-%m-%d-%M-%S'), current_thread().getName(), os.getpid(), self._batch)
            response = self.api_client.get(self.api_end_point, api_params, api.Client.XMLFileBufferedResponse(filename))
            return response
        else:
            raise Exception("API endpoint not set, when fetching values for Object type:%", self.OBJECT_TYPE)


    def __fetch_and_parse(self, params=None):

        response = self.__fetch(params)
        if response.get_response() != True:
            raise BasePopulatorException("could not load API response")

        qlogger.info("%s fetched", self.OBJECT_TYPE)

        self._parse(response.file_name)

        if not self.preserve_api_output:
            #qlogger.debug("Removing tmp file " + response.file_name)
	    qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "Removing temp file %s " % response.file_name)
	    try:
                os.remove(response.file_name)
            except OSError:
                pass
        else:
            #qlogger.debug("Not removing tmp file " + response.file_name)
	    qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Not removing temp file %s " % response.file_name) 
        return response


    def _parse(self, file_name):
        qlogger.info("Parsing %s XML", self.OBJECT_TYPE)
        total = 0
        logged = 0
        response = {'error': False}
        load_next_batch = False
        next_url = None

        self._pre_parse()
        try:
            context = iter(ET.iterparse(file_name, events=('end', )))
            _, root = next(context)
            # print "<stream>"
            for event, elem in context:

                if elem.tag == "RESPONSE":
                    code = elem.find('CODE')
                    if code is not None:
                        response['error_code'] = code.text
                        response['error_message'] = elem.find('TEXT').text
                        raise BasePopulatorException("API ERROR. Code={0}, Message={1}".format(response['error_code'],
                                                                                               response[
                                                                                                   'error_message']))
                    elem.clear()
                if elem.tag == self.ROOT_TAG:
                    total += 1
                    if self._process_root_element(elem):
                        logged += 1
                    elem.clear()

                elif elem.tag == "WARNING":
                    load_next_batch = True
                    next_url = elem.find('URL')
                    elem.clear()
                root.clear()
            # print "</stream>"
        except ET.ParseError, e:
            self.output("ERROR %s", e.message)
            qlogger.error("Failed to parse API Output for endpoint %s.", self.api_end_point)
            qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Failed to parse API Output for endpoint %s"% self.api_end_point)

        self._post_parse()
        qlogger.info("Parsed %d %s entry. Logged=%d", total, self.OBJECT_TYPE, logged)

        if load_next_batch and next_url is not None:
            self._batch += 1
            if not self.preserve_api_output:
                qlogger.debug("Removing tmp file " + file_name)
                qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Removing tmp file %s" % file_name)
		try:
                    os.remove(file_name)
                except OSError:
                    pass
            else:
                #qlogger.debug("Not removing tmp file " + file_name)
		 qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Not removing tmp file %s" % file_name)
 	    	 qlogger.info("Found truncation warning, auto loading next batch from url:%s" % next_url.text)
            next_batch_params = qualysModule.splunkpopulator.utils.get_params_from_url(next_url.text)
            response = self.__fetch_and_parse(next_batch_params)

        return response


    """
    This method will be called whenever we found self.ROOT_TAG element
    Return boolean True if we end up creating a log entry for this  element else return false
    """

    @abc.abstractmethod
    def _process_root_element(self, elem):
        """


        :param elem:
        :rtype : bool
        """
        pass

    """
    Implement any post parsing logic you want here, this method will be called after each batch, before next batch is fetched,
    good place to log any breadcrumbs
    """

    def _post_parse(self):
        pass

    """
    Anything to be done before parsing the XML
    """

    def _pre_parse(self):
        pass


    @staticmethod
    def get_log_line_from_tuple(tuple_obj, prefix=""):
        to_log = []
        if prefix:
            to_log.append(prefix)
        for attr in tuple_obj._fields:
            to_log.append('%s %s=%r' % (prefix, attr, tuple_obj.__getattribute__(attr)))
        return " ".join(to_log)

    def set_preserve_api_output(self, preserve):
        self.preserve_api_output = preserve

    def output(self, log, *args, **kwargs):
        self._logger.info(log, *args, **kwargs)

    @staticmethod
    def convert_zulu_date(zulu_string):
        pass
