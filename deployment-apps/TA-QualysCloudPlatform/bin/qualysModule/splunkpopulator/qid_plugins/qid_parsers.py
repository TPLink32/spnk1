from qualysModule.splunkpopulator.qid_plugins import BaseQIDParser
from qualysModule.splunkpopulator.qid_plugins import QIDParser
import re


@QIDParser.plugin(82023)
class TCPPortParser(BaseQIDParser):
    def parse(self, qid, host_id, detection_node, logger):
        result_text = detection_node.find('RESULTS').text
        ports = []
        for line in result_text.split('\n'):
            match = re.search(r'^\s*(\d+)\s+([a-zA-Z]+).*', line)
            if match:
                ports.append('TCP_PORT=%s' % match.group(1))
        if ports:
            return ', '.join(ports)


@QIDParser.plugin(82004)
class UDPPortParser(BaseQIDParser):
    def parse(self, qid, host_id, detection_node, logger):
        result_text = detection_node.find('RESULTS').text
        ports = []
        for line in result_text.split('\n'):
            match = re.search(r'^\s*(\d+)\s+([a-zA-Z]+).*', line)
            if match:
                ports.append('UDP_PORT=%s' % match.group(1))
        if ports:
            return ', '.join(ports)


# QID 45038 scan time result analysis
@QIDParser.plugin(45038)
class Qid45038Parser(BaseQIDParser):
    def parse(self, qid, host_id, detection_node, logger):
        result_text = detection_node.find('RESULTS').text
        matchObj = re.search('^Scan duration:\s+([0-9]+)\s+seconds', result_text)
        if matchObj:
            return "SCAN_DURATION=%s" % matchObj.group(1)


# QID 90126 reboot result analysis
@QIDParser.plugin(90126)
class Qid90126Parser(BaseQIDParser):
    def parse(self, qid, host_id, detection_node, logger):
        status = detection_node.find('STATUS').text.upper()
        if status == 'FIXED':
            return 'REBOOT_PENDING=no'
        else:
            return 'REBOOT_PENDING=yes'
