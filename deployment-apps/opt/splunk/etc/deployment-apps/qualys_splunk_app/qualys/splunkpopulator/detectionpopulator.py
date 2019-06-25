# -*- coding: utf-8 -*-
__author__ = "Bharat Patel <bharrat@gmail.com>"
__copyright__ = "Copyright (C) 2014, Bharat Patel"
__license__ = "New BSD"
__version__ = "1.0"

from qualys.splunkpopulator.qid_plugins import *
from qualys.splunkpopulator.basepopulator import BasePopulator

from qualys import *

try:
    import xml.etree.cElementTree as ET
except ImportError:
    import xml.etree.ElementTree as ET

HOST_FIELD_MAPPINGS = {"ID": "HOST_ID"}
HOST_FIELD_TO_MAP = ["ID"]

# #These fields can have special characters or text in other languages to change to them to Utf-8
fields_to_encode = ["OS", "DNS", "NETBIOS"]

QIDParser.load_plugins()


class HostDetectionPopulatorConfiguration:
    _validFilters = ['ips', 'compliance_enabled', 'no_vm_scan_since',
                     'vm_scan_since', 'id_min', 'id_max',
                     'ag_ids', 'ag_titles',
                     'os_pattern', 'show_igs', 'qids', 'severities',
                     'include_search_list_titles', 'exclude_search_list_titles',
                     'include_search_list_ids', 'exclude_search_list_ids',
                     'active_kernels_only', 'use_ags', 'tag_set_by', 'tag_include_selector',
                     'tag_exclude_selector', 'tag_set_include', 'tag_set_exclude', 'show_tags', 'network_ids',
                     'max_days_since_last_vm_scan', 'status'
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


class HostDetectionPopulator(BasePopulator):
    PLUGINS = []
    OBJECT_TYPE = "detection"
    FILE_PREFIX = "host_detection"
    ROOT_TAG = 'HOST'

    detection_fields_to_log = ["QID", "TYPE", "PORT", "PROTOCOL", "SSL", "STATUS", "LAST_UPDATE_DATETIME",
                               "LAST_FOUND_DATETIME", "FIRST_FOUND_DATETIME", "LAST_TEST_DATETIME"]
    host_fields_to_log = ["ID", "IP", "TRACKING_METHOD", "DNS", "NETBIOS", "OS", "LAST_SCAN_DATETIME"]


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
                        if type != 'INFO':

                            status = detection.find('STATUS').text.upper()
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
                                if not self.log_host_details_in_detection:
                                    self.output("HOSTVULN: HOST_ID=%s, %s" % (host_id, ", ".join(vuln_summary)))
                                else:
                                    self.output("HOSTVULN: %s, %s" % (host_line, ", ".join(vuln_summary)))
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
                self.output(", ".join(host_summary))

            self.host_logged += 1

            return True


    def get_qid_severity(self, qid):
        if self._kb_populator:
            return self._kb_populator.get_qid_severity(qid)

    @staticmethod
    def get_log_line_from_dict(dict_obj):

        return ', '.join("%s=%r" % (key, val) for (key, val) in dict_obj.iteritems())