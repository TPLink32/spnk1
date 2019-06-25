__author__ = 'bpatel'
# -*- coding: utf-8 -*-
__author__ = "Bharat Patel <bharrat@gmail.com>"
__copyright__ = "Copyright (C) 2014, Bharat Patel"
__license__ = "New BSD"
__version__ = "1.0"

from qualysModule.splunkpopulator.basepopulator import BasePopulator, BasePopulatorException
from collections import namedtuple
from qualysModule import qlogger

try:
    import xml.etree.cElementTree as ET
except ImportError:
    import xml.etree.ElementTree as ET

from xml.etree.cElementTree import iterparse
from qualysModule import *


class QualysPoliciesPopulator(BasePopulator):
    OBJECT_TYPE = "Compliance Policies"
    FILE_PREFIX = "qualys_compliance_policies"
    DEFAULT_PARAMS = {"action": "list", "details": "Basic"}
    ROOT_TAG = 'POLICY'

    def __init__(self, api_client=None, logger=None):

        super(QualysPoliciesPopulator, self).__init__(api_client, logger)
        self.last_id_logged = 0

    @property
    def api_end_point(self):
        return "/api/2.0/fo/compliance/policy/"

    def _process_root_element(self, elem):
        logged = False
        policy_id = int(elem.find('QID').text)
        if policy_id is not None:
            if policy_id > self.last_id_logged:
                self.output("POLICY_INFO: EVENT_DATE=%s, PID=%d, TITLE=\"%s\"",
                            elem.find('CREATED').find('DATETIME').text, policy_id,
                            elem.find('TITLE').text.replace("\"", "'"))

        return logged

    def _post_parse(self):
        pass