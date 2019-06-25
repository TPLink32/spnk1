__author__ = 'mwirges'

"""
Thread-safe API Library

You make an APIRequest
it provides an APIResponse

"""

import abc
import base64
import urllib
import urllib2
import httplib
import re
import time
from threading import current_thread

try:
    import xml.etree.cElementTree as ET
except ImportError:
    import xml.etree.ElementTree as ET

# our includes
import qualysModule
from qualysModule import qlogger
import qualysModule.splunkpopulator.utils

class APIRequestError(Exception):
    pass


class APIResponseError(Exception):
    pass


class APIConfig:
    _username = None
    _password = None
    _serverRoot = "https://qualysapi.qualys.com"
    _useProxy = False
    _proxyHost = None

    @property
    def username(self):
        return self._username

    @property
    def password(self):
        return self._password

    @property
    def serverRoot(self):
        return self._serverRoot

    @property
    def useProxy(self):
        return self._useProxy

    @property
    def proxyHost(self):
        return self._proxyHost

    @username.setter
    def username(self, value):
        self._username = value

    @password.setter
    def password(self, value):
        self._password = value

    @serverRoot.setter
    def serverRoot(self, value):
        self._serverRoot = value

    @useProxy.setter
    def useProxy(self, value):
        if value is not True and value is not False:
            raise TypeError("must provide boolean value")
        self._useProxy = value

    @proxyHost.setter
    def proxyHost(self, value):
        self._proxyHost = value


class APIResponse:
    __metaclass__ = abc.ABCMeta

    _response = None

    @property
    def response(self):
        return self._response

    # end response

    @response.setter
    def response(self, value):
        self._response = value

    #end response

    def get_response(self):
        return self._handle_and_return_response()

    #end get_response

    @abc.abstractmethod
    def _handle_and_return_response(self):
        pass


# end APIResponse

class SimpleAPIResponse(APIResponse):
    _data = None


    def _handle_and_return_response(self):
        return self.response.read()
        #end _handle_and_return_response


class XMLFileBufferedResponse(APIResponse):
    READ_CHUNK_SIZE = 16 * 1024
    _file_name = None

    def __init__(self, file_name):
        self._file_name = file_name


    @property
    def file_name(self):
        return self._file_name


    def _handle_and_return_response(self):

        try:
            firstChunk = True
            with open(self.file_name, 'wb') as fp:
                while True:
		    try:
                    	chunk = self.response.read(XMLFileBufferedResponse.READ_CHUNK_SIZE)
		    except httplib.IncompleteRead, e:
			chunk = e.partial

                    if not chunk:
                        break

                    if firstChunk:
                        firstChunk = False
                        if chunk.startswith("<!--"):
                            (discard, chunk) = chunk.split("\n", 1)
                            #end if
                    #ned if

                    fp.write(chunk)
                    #end while
            #qlogger.debug("wrote xml data to file: %s", self.file_name)
        #printStreamEventXML("_internal","Wrote xml data to file %s" % self.file_name)
   	    return True
        except IOError, e:
            #qlogger.error("Unable to save data to file %s", self.file_name)
            qlogger.exception(e)
            raise APIResponseError("Unable to save data to file: %s: %s", self.file_name, e.message)
            #else:
            #    return True

            #end try


class APIClient:
    """ :type _config: APIConfig """
    _config = APIConfig()

    def __init__(self, apiConfig):

        """ :type: APIConfig """
        self._config = apiConfig
        self.preflight()
        self.qweb_version = None

    #end __init__

    def preflight(self):
        if self._config.useProxy:
            proxy = urllib2.ProxyHandler({"https": self._config.proxyHost})
            opener = urllib2.build_opener(proxy)
            urllib2.install_opener(opener)
            qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Installed proxy handler")
	    #end if

    #end preflight

    def validate(self):
        """:type response: str """
        response = self.get("/msp/about.php", {}, SimpleAPIResponse())
        response_text = response.get_response()

        if response_text.count("WEB-VERSION") > 0:
            root = ET.fromstring(response_text)
            qweb_version_text = root.find('WEB-VERSION').text

            if qweb_version_text is None:
                #qlogger.debug('QWEB_VERSION not found.')
                qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","QWEB VERSION not found")
		return False

            version_parts = qweb_version_text.split('.')

            if len(version_parts) > 2:
                self.qweb_version = float(version_parts[0] + '.' + version_parts[1])
            #qlogger.debug("Found QWEB_VERSION=%s", self.qweb_version)
	    qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Found QWEB VERSION=%s" % self.qweb_version)
            return True
        else:
            qlogger.debug(response_text)
            return False

    def isPortalEndpoint(self, end_point):
        # Web Application Scanning - used for WAS Findings
        if '/was/' in end_point:
            return True
        # Asset Management - used for apply Qualys tag - mod alert
        if '/am/' in end_point:
            return True
        return False
    # isPortalEndpoint

    def get(self, end_point, params, response):
        """
        :param end_point: str
        :param params: dict
        :param responseType: APIResponse
        """
        req = self._buildRequest(end_point, params, self.isPortalEndpoint(end_point))
        qlogger.info("Making request: %s with params=%s", req.get_full_url(), params)
        qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","%s making %s request with params=%s" % (current_thread().getName(), req.get_full_url(), params))
	try:
            """ :type request: urllib2.Request """
            request = urllib2.urlopen(req)

            # handle obvious errors
            if request.getcode() != 200:
                qlogger.error("Got NOK response from API: %s", request.read)
                qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Got NOK response from API %s" % request.read)
		raise APIRequestError("request failed: %s", request.read)

            response.response = request

            return response

        except urllib2.URLError, ue:
            qlogger.error("Error during request to %s, [%s] %s", end_point, ue.errno, ue.reason)
	    qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Error during request to %s,%s" % (end_point, ue.reason))
            raise APIRequestError("Error during request to %s, [%s] %s" % (end_point, ue.errno, ue.reason))
        #end try

    #end get

    def _buildHeaders(self, contentTypeXML):
		"""
    	
		:return: dict
		"""

		auth = "Basic " + base64.urlsafe_b64encode("%s:%s" % (self._config.username, self._config.password))
		
		headers = {
			"User-Agent": "QualysAPIClient",
			"X-Requested-With": "QualysSplunkApp 1.2.2",
			"Authorization": auth
		}
		
		if contentTypeXML:
			headers['Content-Type'] = 'text/xml'
				
		return headers
    #end _buildHeaders

    def _buildRequest(self, end_point, params, contentTypeXML = None):
        """

        :param end_point:  str
        :param params: dict
        :return: urllib2.Request
        """

        if contentTypeXML:
            data = params
        else:
            data = urllib.urlencode(params)

        return urllib2.Request(self._config.serverRoot + end_point, data=data, headers=self._buildHeaders(contentTypeXML))
        #end _buildRequest

#end APIClient
