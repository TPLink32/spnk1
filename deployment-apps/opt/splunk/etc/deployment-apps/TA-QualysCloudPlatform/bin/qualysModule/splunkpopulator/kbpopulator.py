# -*- coding: utf-8 -*-
__author__ = "Bharat Patel <bharrat@gmail.com>"
__copyright__ = "Copyright (C) 2014, Bharat Patel"
__license__ = "New BSD"
__version__ = "1.0"
import random
from qualysModule.splunkpopulator.basepopulator import BasePopulator, BasePopulatorException
from collections import namedtuple
from qualysModule import qlogger
import csv

try:
    import xml.etree.cElementTree as ET
except ImportError:
    import xml.etree.ElementTree as ET

from xml.etree.cElementTree import iterparse
from qualysModule import *

QualysQidStruct = namedtuple("QualysQid", "QID, SEVERITY")


class QualysKnowledgebasePopulator(BasePopulator):
    OBJECT_TYPE = "knowledgebase"
    FILE_PREFIX = "kb"
    ROOT_TAG = 'VULN'

    # extra fields to log with QID, by default QID_INFO and SEVERITY are already included

    # QID_EXTRA_FIELDS_TO_LOG = ["VULN_TYPE", "PATCHABLE", "PCI_FLAG", "TITLE", "CATEGORY", "DIAGNOSIS", "CONSEQUENCE", "SOLUTION", "PUBLISHED_DATETIME"]
    QID_EXTRA_FIELDS_TO_LOG = ["VULN_TYPE", "PATCHABLE", "PCI_FLAG", "TITLE", "CATEGORY", "PUBLISHED_DATETIME"]
    BOOL_FIELDS = ["PATCHABLE", "PCI_FLAG"]

    CSV_HEADER_COLUMNS = ["QID", "SEVERITY"] + QID_EXTRA_FIELDS_TO_LOG + ["CVSS_BASE", "CVSS_TEMPORAL", "CVE", "VENDOR_REFERENCE"]
    def __init__(self, logger=None):

        super(QualysKnowledgebasePopulator, self).__init__(logger)
        self._qids = {}
        self._kbLoaded = False
        # only log QIDs greater than this value, to support incremental logs for Knowledgebase
        self.min_qid_to_log = 0
        self.log = True
        self.last_qid_logged = 0
        self.create_lookup_csv = False

    @property
    def qids(self):
        return self._qids

    @property
    def api_end_point(self):
        return "/api/2.0/fo/knowledge_base/vuln/"


    @property
    def get_api_parameters(self):
        params = dict(action="list", details="Basic")
        return params

    def _process_root_element(self, elem):
        logged = False
        qid = int(elem.find('QID').text)

        if qid is not None:
            severity = int(elem.find('SEVERITY_LEVEL').text)
            qid_dict = {'QID': qid, 'SEVERITY': severity}

            for sub_ele in list(elem):
                name = sub_ele.tag
                if name in QualysKnowledgebasePopulator.QID_EXTRA_FIELDS_TO_LOG:
                    val = sub_ele.text
                    if name in ['TITLE', 'CATEGORY', 'DIAGNOSIS', 'CONSEQUENCE', 'SOLUTION']:
                        val = sub_ele.text.replace('"', '\'').encode('utf-8')
                    elif name in self.BOOL_FIELDS:
                        val = 'YES' if val == '1' else 'NO'
                    qid_dict[name] = val
                elif name == 'CVSS':
                    for sub_tag in list(sub_ele):
                        qid_dict['CVSS_%s' % sub_tag.tag] = sub_tag.text
                elif name == 'CVE_LIST':
                    cves = []
                    for cve_node in list(sub_ele):
                        cves.append(cve_node.find('ID').text)
                    if len(cves) > 0:
                        # sort by CVE id in reverse order so that latest CVE is first
                        cves.sort(reverse=True)
                        qid_dict['CVE'] = ', '.join(cves)
                elif name == 'VENDOR_REFERENCE_LIST':
                    vendor_refs = []
                    for vendor_ref_node in list(sub_ele):
                        vendor_refs.append(vendor_ref_node.find('ID').text)
                    if len(vendor_refs) > 0:
                        # sort by CVE id in reverse order so that latest CVE is first
                        vendor_refs.sort(reverse=True)
                        qid_dict['VENDOR_REFERENCE'] = ', '.join(vendor_refs)

            self._qids[qid] = qid_dict

        return logged

    def get_last_qid_logged(self):
        return self.last_qid_logged

    def get_vuln_log_line(self, vuln_struct):
        """

        :param vuln_struct QualysQidStruct:
        :return:
        """
        return "QID_INFO: QID=%s SEVERITY=%s TITLE=\"%s\" CATEGORY=\"%s\"" \
               % (vuln_struct.QID, vuln_struct.SEVERITY, vuln_struct.TITLE, vuln_struct.CATEGORY)

    def get_qid_severity(self, qid):
        qid = int(qid)
        if qid in self._qids and 'SEVERITY' in self._qids[qid]:
            return self._qids[qid]['SEVERITY']
        else:
            return None

    """
    Create lookup CSV file here, since self._qids should now contain all the QID
    """

    def _post_parse(self):
        if self.create_lookup_csv:
            TA_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__)))))
            lookup_destination = TA_ROOT + '/lookups/qualys_kb.csv'
            qlogger.info("Update lookup file: %s with %s QIDs", lookup_destination, len(self._qids))
            with open(lookup_destination, "w") as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=self.CSV_HEADER_COLUMNS)
                writer.writeheader()
                for qid in self._qids:
                    writer.writerow(self._qids[qid])
            qlogger.info("Updated lookup file: %s with %s QIDs", lookup_destination, len(self._qids))


