try:
    import xml.etree.cElementTree as ET
except:
    import xml.etree.ElementTree as ET

import logging
import os
import re
import sys
import time
import json
import copy
import cherrypy
import splunk
import splunk.rest
from splunk.search import *
from splunk.util import uuid4
import splunk.appserver.mrsparkle.lib.util as util
from stream_utils import *
import tempfile


logger = setup_logger('vocabulary')
vocabsDir = os.path.join(util.get_apps_dir(), 'splunk_app_stream', 'default', 'vocabularies')
content = None

class Vocabulary:

    @staticmethod
    def list():
        '''Return list of vocabularies'''
        global content
        if content is not None:
            return content
        ET.register_namespace("", "http://purl.org/cloudmeter/config")
        combinedVocab = ET.Element('Vocabulary')
        for fname in os.listdir(vocabsDir):
            tree = ET.parse(vocabsDir + os.sep + fname)
            vocab = tree.find('{http://purl.org/cloudmeter/config}Vocabulary')
            for term in vocab.findall('{http://purl.org/cloudmeter/config}Term'):
                combinedVocab.append(term)

        xmlOut = ET.ElementTree(ET.Element("CmConfig"))
        xmlOut.getroot().set('version', getAppVersion())
        xmlOut.getroot().append(combinedVocab)
        try:
            temp = tempfile.TemporaryFile()
            try:
                xmlOut.write(temp, xml_declaration=True, encoding='UTF-8')
                temp.seek(0)
                content = temp.read()
            finally:
                temp.close()
                return content
        except Exception, ex:
            logger.error("IOerror, unable to create temp file") 
            logger.exception(ex)
    