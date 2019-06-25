# -*- coding: utf-8 -*-
__author__ = "Bharat Patel <bharrat@gmail.com>"
__copyright__ = "Copyright (C) 2014, Bharat Patel"
__license__ = "New BSD"
__version__ = "1.0"

import urlparse
import uuid
import urllib2
import urllib
import base64

try:
    import splunk.entity as entity
except:
    pass

from qualys import *

try:
    import xml.etree.cElementTree as ET
except ImportError:
    import xml.etree.ElementTree as ET


class QualysAPIClientException(Exception):
    pass


class QualysAPIClient:
    """
    Deprecated: see qualys.lib.api.Client
    """
    READ_CHUNK_SIZE = 256 * 10240  # read this many bytes at a time when writing to file\
    USE_PROXY = False
    PROXY_HOST = None

    def __init__(self, api_server, api_user, api_password, enable_debug=False):
        self.api_server = api_server
        self.api_user = api_user
        self.api_password = api_password
        self.debug = enable_debug
        if not api_server:
            raise QualysAPIClientException("Invalid Qualys Server URL specified.")
        if not api_user or not api_password:
            raise QualysAPIClientException("Please set valid credentials.")
        if not self._validate_credentials:
            raise QualysAPIClientException("Failed to validate credentials.")

    @property
    def _validate_credentials(self):

        ret = False
        try:
            response = self.get('/msp/about.php')
            if self.debug:
                qlogger.info(response)
            if response:
                if response['error']:
                    qlogger.info("Error occurred trying to validate credentials. Error: CODE=%s, Message=%s",
                                 response['error_code'], response['error_message'])
                elif response['status'] == 401:
                    qlogger.info("Invalid credentials provided. Please check your username and password.")
                elif response['status'] == 200:
                    try:
                        root = ET.fromstring(response['body'])
                        if root.find('WEB-VERSION') is not None:
                            ret = True
                    except ET.ParseError, e:
                        qlogger.error("Failed to parse. XML=%s", response['body'])
                        ret = False
        except QualysAPIClientException, e:
            pass

        return ret


    def get(self, end_point, params=None, write_to_file=False, file_name=None):
        """
        :param end_point:
        :param params:
        :param write_to_file:
        :param file_name:
        :return:
        """
        if params is None:
            params = {}
        if write_to_file and (not file_name or file_name is None):
            file_name = '/tmp/' + str(uuid.uuid4()) + '.xml'

        response_object = {'status': False, 'savedAsFile': write_to_file,
                           'response': None, 'fileName': None, 'error': False, 'error_message': 'None', 'error_code': 0}

        auth = 'Basic ' + base64.urlsafe_b64encode("%s:%s" % (self.api_user, self.api_password))
        headers = {'User-Agent': "QualysSplunkPopulator:PythonPackage",
                   'X-Requested-With': "QualysSplunkPopulator",
                   'Authorization': auth}
        url = self.api_server + end_point
        data = urllib.urlencode(params)
        if QualysAPIClient.USE_PROXY and QualysAPIClient.PROXY_HOST:
            qlogger.info("Using proxy=%s", QualysAPIClient.PROXY_HOST)
            proxy = urllib2.ProxyHandler({'https': QualysAPIClient.PROXY_HOST})
            opener = urllib2.build_opener(proxy)
            urllib2.install_opener(opener)

        req = urllib2.Request(url, data, headers)
        try:
            qlogger.info("Calling API:%s, with Parameters:%s", url, data)
            request = urllib2.urlopen(req)
            response_object['status'] = request.getcode()
            if response_object['status'] != 200:
                response_object['body'] = request.read()
            if write_to_file:
                try:

                    firstChunk = True
                    with open(file_name, 'wb') as fp:
                        while True:
                            chunk = request.read(QualysAPIClient.READ_CHUNK_SIZE)

                            if firstChunk:
                                firstChunk = True
                                if chunk.startswith("<!--"):
                                    # discard the first line, it's probably a leading warning
                                    (discard, chunk) = chunk.split("\n", 1)
                                    # end if
                            # end if

                            if not chunk: break
                            fp.write(chunk)
                        response_object['fileName'] = file_name

                except IOError, e:
                    qlogger.exception("Unable to save API response as FILE:%s", file_name)
                    response_object['error'] = True
                    response_object['savedAsFile'] = False
                else:
                    response_object['savedAsFile'] = True
            else:
                response_object['body'] = request.read()
            qlogger.info("API call:%s was successful. File saved: %s", url, file_name)
        except urllib2.URLError, ue:
            response_object['error'] = True
            response_object['error_message'] = ue.reason
            if ue.code:
                response_object['error_code'] = ue.code
            else:
                response_object['error_code'] = -1
        except TypeError, te:
            # qlogger.exception(te)
            response_object['error'] = True
            response_object['error_message'] = str(te)
        finally:
            try:
                request.close()
            except NameError:
                pass

        return response_object


def get_params_from_url(url):
    return dict(urlparse.parse_qsl(urlparse.urlparse(url).query))


# access the credentials in /servicesNS/nobody/<MyApp>/admin/passwords
def getCredentials(sessionKey):
    myapp = 'qualys_splunk-_app'
    try:
        # list all credentials
        entities = entity.getEntities(['admin', 'passwords'], namespace=myapp,
                                      owner='nobody', sessionKey=sessionKey)
    except Exception, e:
        raise Exception("Could not get %s credentials from splunk. Error: %s"
                        % (myapp, str(e)))

    # return first set of credentials
    for i, c in entities.items:
        return c['username'], c['clear_password']

    raise Exception("No credentials have been found")


def bool_value(string_val):
    true_values = ["yes", "y", "true", "1"]
    false_values = ["no", "n", "false", "0", ""]

    if isinstance(string_val, basestring):
        if string_val.lower() in true_values:
            return True
        if string_val.lower() in false_values:
            return False

    return bool(string_val)


class IDSet:
    """
    Simple implementation of IDSet; makes a lot of assumptions

    """

    def __init__(self):
        self.items = {}

    def addString(self, id_or_range):
        if id_or_range.count("-", 1) == 1:
            (left, right) = id_or_range.split("-", 1)
            self.items[int(left)] = int(right)
        else:
            self.items[int(id_or_range)] = int(id_or_range)
            # end if

    def addRange(self, left, right):
        self.items[left] = right

    # end addRange

    def count(self):
        id_count = 0
        for k in sorted(self.items):
            id_count = id_count + ((self.items[k] - k) + 1)
        #end for

        return id_count

    def iterRanges(self):

        def theRanges():
            for k in sorted(self.items):
                yield k, self.items[k]
                #end for

        #end theRanges

        return theRanges()

    #end iterRanges

    def split(self, max_size_of_list):
        # splits the current IDSet into multiple IDSets based on the max_size_of_list

        return IDSet.__split(list(self.iterRanges()), max_size_of_list)

    #end split

    def tostring(self):
        out = []
        for k, v in self.iterRanges():
            if k == v:
                out.append(k)
            else:
                out.append("%d-%d" % (k, v))
        #end for

        return ",".join(map(str, out))

    #end tostring

    @staticmethod
    def __split(ranges, max_size_of_list):

        lists = []
        counter = 0
        cur_list = IDSet()
        for k, v in ranges:
            t_size = v - k + 1
            if counter + t_size < max_size_of_list:
                counter += t_size
                cur_list.addRange(k, v)
            elif counter + t_size == max_size_of_list:
                cur_list.addRange(k, v)
                lists.append(cur_list)
                cur_list = IDSet()
                counter = 0
            else:
                room_left = max_size_of_list - counter
                cur_list.addRange(k, k + room_left - 1)
                lists.append(cur_list)

                # at this point, our remaining range is k+room_left to v, and that could be multiple ranges as well
                lists = lists + IDSet.__split([(k + room_left, v)], max_size_of_list)
                # get the last list
                cur_list_count = lists[-1].count()
                if cur_list_count < max_size_of_list:
                    cur_list = lists.pop()
                    counter = cur_list_count
                else:
                    cur_list = IDSet()
                    counter = 0
                    #end if
        #end for

        if cur_list.count() > 0:
            lists.append(cur_list)
        #end if

        return lists
        #end def