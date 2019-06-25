# -*- coding: utf-8 -*-
__author__ = "Bharat Patel"
__copyright__ = "Copyright (C) 2014, Bharat Patel"
__license__ = "New BSD"
__version__ = "1.0"

import time
from threading import current_thread

import qualysModule
from qualysModule.splunkpopulator.qid_plugins import *
from qualysModule.splunkpopulator.basepopulator import BasePopulator
from qualysModule.splunkpopulator.basepopulator import BasePopulatorException
from qualysModule import *

try:
    import xml.etree.cElementTree as ET
except ImportError:
    import xml.etree.ElementTree as ET

HOST_FIELD_MAPPINGS = {"ID": "HOST_ID"}
HOST_FIELD_TO_MAP = ["ID"]

# #These fields can have special characters or text in other languages to change to them to Utf-8
fields_to_encode = ["OS", "DNS", "NETBIOS"]

QIDParser.load_plugins()


class HostDetectionPopulatorConfiguration(object):
    _validFilters = ['ips', 'compliance_enabled', 'no_vm_scan_since',
                     'vm_scan_since', 'id_min', 'id_max',
                     'ag_ids', 'ag_titles',
                     'os_pattern', 'show_igs', 'qids', 'severities',
                     'include_search_list_titles', 'exclude_search_list_titles',
                     'include_search_list_ids', 'exclude_search_list_ids',
                     'active_kernels_only', 'use_ags', 'tag_set_by', 'tag_include_selector',
                     'tag_exclude_selector', 'tag_set_include', 'tag_set_exclude', 'show_tags', 'network_ids',
                     'max_days_since_last_vm_scan', 'status',
                     'host', 'index'
    ]

    def __init__(self, kbPopulator=None, logger=None):
        self.logger = logger
        self.detection_api_filters = {}
        self.collect_advanced_host_summary = True
        self.log_host_summary = True
        self.log_host_detections = True
        self.log_host_details_in_detection = True  # Log extra Host information with each host detection event e.g. IP, DNS, NetBIOS OS etc
        self.batch = 1
        self.kb_populator = kbPopulator
        self.truncation_limit = 1000
        self.preserve_api_output = False

    def add_detection_api_filter(self, name, value):
        if name in self._validFilters:
            self.detection_api_filters[name] = value
        else:
            qlogger.warn("Tried to add an unsupported detection API parameter:%s", name)

class WASDetectionPopulatorConfiguration(HostDetectionPopulatorConfiguration):
    _validFilters = [   'id', 'qid', 'name', 'type', 'url', 'status', 'patch', 
                        'webapp.tags.id', 'webapp.tags.name', 'webApp.id', 'webapps.name', 
                        'severity', 'ignoredDate', 'ignoredReason', 'group',
                        'owasp.name', 'owasp.code', 
                        'wasc.name', 'wasc.code', 'cwe.id',
                        'firstDetectedDate', 'lastDetectedDate', 'lastTestedDate', 'timesDetected']

    def __init__(self, kbPopulator=None, logger=None):
        super(WASDetectionPopulatorConfiguration, self).__init__(kbPopulator, logger)
        self.api_filters_list = []
        self.detection_api_filters = "<ServiceRequest><filters></filters></ServiceRequest>"
        self.api_preferences = "<preferences><verbose>true</verbose></preferences>"
        self.log_was_detections = True
        self.log_was_summary = True
    #  __init__

    def add_detection_api_filter(self, name, operator, value):
        if name in self._validFilters:
            criteriaTag = "<Criteria field=\"%s\" operator=\"%s\">" % (name, operator)

            sameFieldOperatorCriteria = [criteria for criteria in self.api_filters_list if criteriaTag in criteria]
            for matchingItem in sameFieldOperatorCriteria:
                self.api_filters_list.remove(matchingItem)
            # end of for loop

            criteriaXML = "%s%s</Criteria>" % (criteriaTag, value)
            self.api_filters_list.append(criteriaXML)

            detection_criteria = ''
            for criteria in self.api_filters_list:
                detection_criteria += criteria

            self.detection_api_filters = "<ServiceRequest>%s<filters>%s</filters></ServiceRequest>" % (self.api_preferences, detection_criteria)
        else:
            qlogger.warn("%s - Tried to add an unsupported detection API parameter '%s'.", type(self).__name__, name)
    # add_detection_api_filter
# class WASDetectionPopulatorConfiguration

class HostDetectionPopulator(BasePopulator):
    PLUGINS = []
    OBJECT_TYPE = "detection"
    FILE_PREFIX = "host_detection"
    ROOT_TAG = 'HOST'

    detection_fields_to_log = ["QID", "TYPE", "PORT", "PROTOCOL", "SSL", "STATUS", "LAST_UPDATE_DATETIME",
                               "LAST_FOUND_DATETIME", "FIRST_FOUND_DATETIME", "LAST_TEST_DATETIME"]
    host_fields_to_log = ["ID", "IP", "TRACKING_METHOD", "DNS", "NETBIOS", "OS", "LAST_SCAN_DATETIME"]

    SOURCE = 'qualys'
    SOURCETYPE = 'qualys:hostDetection'
    HOST = 'localhost'
    INDEX = 'main'


    def __init__(self, detectionConfiguration):
        """
        @type detectionConfiguration: HostDetectionPopulatorConfiguration
        """
        # whether or not to break down count of Vulns by Severity and Status and Type, in HOSTSUMMARY events
        #by default we only break down counts by Severity levels
        super(HostDetectionPopulator, self).__init__(detectionConfiguration.logger)
        self._detection_api_filters = detectionConfiguration.detection_api_filters
        self.collect_advanced_host_summary = detectionConfiguration.collect_advanced_host_summary
        self.log_host_summary = detectionConfiguration.log_host_summary
        self.log_host_detections = detectionConfiguration.log_host_detections
        self.log_host_details_in_detection = detectionConfiguration.log_host_details_in_detection
        self._batch = detectionConfiguration.batch
        self._kb_populator = detectionConfiguration.kb_populator
        self.truncation_limit = detectionConfiguration.truncation_limit
        self.preserve_api_output = detectionConfiguration.preserve_api_output
        self.host_logged = 0
        self.HOST = detectionConfiguration.host
        self.INDEX = detectionConfiguration.index

    @property
    def get_host_logged_count(self):
        return self.host_logged

    @property
    def get_api_parameters(self):
        return dict({"action": "list", "show_igs": 1,
                     'truncation_limit': self.truncation_limit}.items() + self._detection_api_filters.items())

    @property
    def api_end_point(self):
        return "/api/2.0/fo/asset/host/vm/detection/"

    def getEventXML(self, hostLine, vulnSummary):
        xmlString = "<stream><event><time>{0}</time><source>{1}</source><sourcetype>{2}</sourcetype><host>{3}</host><index>{4}</index><data><![CDATA[{5}]]></data></event></stream>"
        data = "%s %s" % (hostLine, ", ".join(vulnSummary))
          
        return xmlString.format(time.time(), self.SOURCE, self.SOURCETYPE, self.HOST, self.INDEX, data)

    def _process_root_element(self, elem):
        if elem.tag == "HOST":
            plugin_output = []
            host_summary = []
            vulns_by_type = {'POTENTIAL': 0, 'CONFIRMED': 0}
            vulns_by_status = {'ACTIVE': 0, 'NEW': 0, 'FIXED': 0, 'RE-OPENED': 0}
            vulns_by_severity = {}
            other_stats = {}
            host_vuln_count = 0

            host_id = None
            for sub_ele in list(elem):
                name = sub_ele.tag
                if name == "ID":
                    host_id = sub_ele.text
                    name = "HOST_ID"
                    host_summary.append("HOST_ID=" + host_id)

                if name in HostDetectionPopulator.host_fields_to_log:
                    val = sub_ele.text
                    if name in fields_to_encode:
                        val = val.encode('utf-8')
                    host_summary.append("%s=\"%s\"" % (name, val))

            if not host_id:
                qlogger.error("Unable to find host_id")
                return False

            host_line = ", ".join(host_summary)
            dl = elem.find('DETECTION_LIST')
            if dl is not None:
                for detection in list(dl):
                    vuln_summary = []
                    qid_node = detection.find('QID')
                    if qid_node is not None:
                        host_vuln_count += 1
                        qid = int(qid_node.text)
                        type = detection.find('TYPE').text.upper()

                        status_element = detection.find('STATUS')
                        if status_element is not None:
                            status = detection.find('STATUS').text.upper()
                        else:
                            status = "-"
                        
                        severity = detection.find('SEVERITY')
                        if severity is not None:
                            severity = severity.text
                        else:
                            severity = self.get_qid_severity(qid)

                        if severity:
                            severity_key = 'SEVERITY_%s' % severity
                            vuln_summary.append('SEVERITY=%s' % severity)

                            vulns_by_severity[severity_key] = vulns_by_severity.get(severity_key, 0) + 1
                            if self.collect_advanced_host_summary:
                                # Break down, count of vulns by each severity and each status, type
                                type_severity_key = '%s_%s' % (type, severity_key)
                                status_severity_key = '%s_%s' % (status, severity_key)
                                other_stats[type_severity_key] = other_stats.get(type_severity_key, 0) + 1
                                other_stats[status_severity_key] = other_stats.get(status_severity_key, 0) + 1

                        for sub_ele in list(detection):
                            name = sub_ele.tag
                            val = sub_ele.text.upper()

                            if name == 'TYPE':
                                vulns_by_type[val] = vulns_by_type.get(val, 0) + 1

                            if name == 'STATUS':
                                vulns_by_status[val] = vulns_by_status.get(val, 0) + 1

                            if name in HostDetectionPopulator.detection_fields_to_log:
                                vuln_summary.append("%s=\"%s\"" % (name, val))

                        if self.log_host_detections:
                            # Output HOSTVULN line
                            host_id_line = "HOSTVULN: "

                            if not self.log_host_details_in_detection:
                                host_id_line = "HOSTVULN: HOST_ID=%s," % host_id
                            else:
                                host_id_line = "HOSTVULN: %s," % host_line

                            print self.getEventXML(host_id_line, vuln_summary)

                        p_output = QIDParser.process(qid, host_id, detection, self._logger)
                        if p_output and p_output != "":
                            plugin_output.append(p_output)

            if self.log_host_summary:

                host_summary = ["HOSTSUMMARY: %s" % host_line, self.get_log_line_from_dict(vulns_by_severity),
                                self.get_log_line_from_dict(vulns_by_type),
                                self.get_log_line_from_dict(vulns_by_status)]

                if self.collect_advanced_host_summary:
                    host_summary.append(self.get_log_line_from_dict(other_stats))
                if plugin_output:
                    host_summary.append(", ".join(plugin_output))

                host_summary.append("TOTAL_VULNS=%s" % host_vuln_count)
                print self.getEventXML('', host_summary)

            self.host_logged += 1

            return True
    # _process_root_element

    def get_qid_severity(self, qid):
        if self._kb_populator:
            return self._kb_populator.get_qid_severity(qid)

    @staticmethod
    def get_log_line_from_dict(dict_obj):

        return ', '.join("%s=%r" % (key, val) for (key, val) in dict_obj.iteritems())
        
class WASDetectionPopulator(HostDetectionPopulator):
    PLUGINS = []
    OBJECT_TYPE = "WAS detection"
    FILE_PREFIX = "was_detection"
    ROOT_TAG = 'Finding'
    SOURCETYPE = 'qualys:wasFindings'

    def __init__(self, detectionConfiguration):
        super(WASDetectionPopulator, self).__init__(detectionConfiguration)
        self.detectionConfiguration = detectionConfiguration
        self.webAppSummaryDict = {}
    # __init__

    @property
    def get_host_logged_count(self):
        return self.host_logged
    # get_host_logged_count

    @property
    def get_api_parameters(self):
        return self.detectionConfiguration.detection_api_filters
    # get_api_parameters

    @property
    def api_end_point(self):
        return "/qps/rest/3.0/search/was/finding"
    # api_end_point

    def printWebAppSummary(self):
        for webAppId, summary in self.webAppSummaryDict.iteritems():
            subData = []
            for key, value in summary.iteritems():
                subData.append("%s=\"%s\"" % (key, value))

            data = "WAS_SUMMARY: webapp_id=\"%s\", %s" % (webAppId, ", ".join(subData))
            print self.createEventXML(data)
    # end of printWebAppSummary

    def run(self):
        super(WASDetectionPopulator, self).run()

        if self.log_host_summary:
            self.printWebAppSummary()
    # run

    def get_next_batch_params(self, lastId):
        self.detectionConfiguration.add_detection_api_filter('id', 'GREATER', str(lastId))
        return self.detectionConfiguration.detection_api_filters
    # get_next_batch_params

    def createEventXML(self, data):
        xmlString = "<stream><event><time>{0}</time><source>{1}</source><sourcetype>{2}</sourcetype><host>{3}</host><index>{4}</index><data><![CDATA[{5}]]></data></event></stream>"
        return xmlString.format(time.time(), self.SOURCE, self.SOURCETYPE, self.HOST, self.INDEX, data)
    # eventXMLTemplate

    def getEventXML(self, webApp, finding):
        xmlString = "<stream><event><time>{0}</time><source>{1}</source><sourcetype>{2}</sourcetype><host>{3}</host><index>{4}</index><data><![CDATA[{5}]]></data></event></stream>"
        data = "WAS_FINDING: %s, %s" % (', '.join(webApp), ", ".join(finding))
        return xmlString.format(time.time(), self.SOURCE, self.SOURCETYPE, self.HOST, self.INDEX, data)
    # getEventXML

    def _parse(self, file_name):
        qlogger.info("Parsing %s XML", self.OBJECT_TYPE)
        total = 0
        logged = 0
        response = {'error': False}
        load_next_batch = False
        lastId = 0
        next_batch_params = None

        self._pre_parse()
        try:
            context = iter(ET.iterparse(file_name, events=('end', )))

            for event, elem in context:

                if elem.tag == "responseCode":
                    code = elem.text
                    qlogger.info("API Response Code = %s", code)

                    if code != 'SUCCESS':
                        response['error_code'] = code
                        response['error_message'] = code
                        raise BasePopulatorException("API ERROR. Message={0}".format(response['error_message']))
                    elem.clear()
                if elem.tag == self.ROOT_TAG:
                    total += 1
                    if self._process_root_element(elem):
                        logged += 1
                    elem.clear()

                elif elem.tag == "hasMoreRecords" and elem.text == 'true':
                    qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Batch %d fetched.There are more records to be fetched" % self._batch)
                    load_next_batch = True
                    elem.clear()

                if load_next_batch and elem.tag == "lastId":
                    lastId = elem.text
                    # if
                    next_batch_params = self.get_next_batch_params(lastId)
        except ET.ParseError, e:
            self.output("ERROR %s", e.message)
            qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Failed to parse API Output for endpoint %s"% self.api_end_point)
        self._post_parse()
        qlogger.info("Parsed %d %s entry. Logged=%d", total, self.OBJECT_TYPE, logged)
        qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","%s Parsed %d %s entry. Logged=%d"% (current_thread().getName(), total, self.OBJECT_TYPE, logged))
        if load_next_batch and next_batch_params is not None:
            self._batch += 1
            if not self.preserve_api_output:
                #qlogger.debug("Removing tmp file " + file_name)
                qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "Removing temp file %s" % file_name)
		try:
                    os.remove(file_name)
                except OSError:
                    pass
            else:
                #qlogger.debug("Not removing tmp file " + file_name)
            	qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Not removing temp file %s" % file_name)
            response = self._BasePopulator__fetch_and_parse(next_batch_params)

        return response
    # _parse

    def _process_root_element(self, elem):
        detection_fields_to_log = ['id', "qid", "name", "type", "severity", "url", "status", "firstDetectedDate", "lastDetectedDate", "lastTestedDate", "timesDetected"]
        host_fields_to_log = ["ID", "IP", "TRACKING_METHOD", "DNS", "NETBIOS", "OS", "LAST_SCAN_DATETIME"]
        web_app_fields_to_log = ["id", "name", "url"]

        if elem.tag == WASDetectionPopulator.ROOT_TAG:
            plugin_output = []
            host_summary = []

            finding = []
            webApp = []

            vulnType = ''
            vulnStatus = '-'
            vulnSeverity = ''
            other_stats = {}
            host_vuln_count = 0

            host_id = None

            for sub_ele in list(elem):
                name = sub_ele.tag

                if name in detection_fields_to_log:
                    if name == 'id':
                        finding_id = sub_ele.text
                        finding.append("finding_id=\"%s\"" % finding_id)
                    else:
                        finding.append("%s=\"%s\"" % (name, sub_ele.text))
                        if name == 'type':
                            vulnType = sub_ele.text
                        elif name == 'status':
                            vulnStatus = sub_ele.text
                        elif name == 'severity':
                            vulnSeverity = sub_ele.text
                        # end of if-elif ladder
                elif name == 'webApp':
                    for webApp_ele in list(sub_ele):
                        if webApp_ele.tag == 'id':
                            webApp.append("webapp_id=\"%s\"" % webApp_ele.text)
                            webAppId = webApp_ele.text
                        elif webApp_ele.tag == 'url':
                            webApp.append("webapp_url=\"%s\"" % webApp_ele.text)
                        elif webApp_ele.tag == 'name':
                            webApp.append("webapp_name=\"%s\"" % webApp_ele.text)
                        else:
                            webApp.append("%s=\"%s\"" % (webApp_ele.tag, webApp_ele.text))
                        # end of else
                    # end of for
                # if
            # for
            if vulnStatus == '-':
                finding.append("status=\"-\"")

            # populate dictionary for web app summary
            if webAppId not in self.webAppSummaryDict:
                self.webAppSummaryDict[webAppId] = {
                    'type_VULNERABILITY': 0,
                    'type_SENSITIVE_CONTENT': 0,
                    'type_INFORMATION_GATHERED': 0,
                    'status_-': 0,
                    'status_NEW': 0,
                    'status_ACTIVE': 0,
                    'status_FIXED': 0,
                    'status_REOPENED': 0,
                    'severity_1': 0,
                    'severity_2': 0,
                    'severity_3': 0,
                    'severity_4': 0,
                    'severity_5': 0
                }
            # if
            self.webAppSummaryDict[webAppId]['type_' + vulnType] += 1
            self.webAppSummaryDict[webAppId]['status_' + vulnStatus] += 1
            self.webAppSummaryDict[webAppId]['severity_' + vulnSeverity] += 1

            if self.log_host_detections:
                print self.getEventXML(webApp, finding)
            
            self.host_logged += 1
        # if

        return True
    # _process_root_element
# class WASDetectionPopulator
