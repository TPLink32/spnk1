import urllib
import urllib2
import base64
import time
import types

import xml.dom.minidom

import httplib
from httplib import HTTPConnection, HTTPS_PORT
import ssl
import socket


class HTTPSConnection(HTTPConnection):
    default_port = HTTPS_PORT

    def __init__(self, host, port=None, key_file=None, cert_file=None,
                 strict=None, timeout=socket._GLOBAL_DEFAULT_TIMEOUT,
                 source_address=None, context=None):
        HTTPConnection.__init__(self, host, port, strict, timeout,
                                source_address)
        self.key_file = key_file
        self.cert_file = cert_file

    def connect(self):
        sock = socket.create_connection((self.host, self.port),
                                        self.timeout, self.source_address)
        if self._tunnel_host:
            self.sock = sock
            self._tunnel()
        # SSL vs TLS
        self.sock = ssl.wrap_socket(
            sock,
            self.key_file,
            self.cert_file,
            ssl_version=ssl.PROTOCOL_SSLv23
        )

httplib.HTTPSConnection = HTTPSConnection

def parse_open(action, data):
    doc = xml.dom.minidom.parseString(data)
    try:
        sess = doc.getElementsByTagName('env:Header')[0].getElementsByTagName(
            'sd:oobInfo')[0].getElementsByTagName('sd:sessionId')[0]
        sessionid = sess.firstChild.wholeText
    except:
        sessionid = "IOS_ROUTER"

    subscript = doc.getElementsByTagName(
        'env:Body')[0].getElementsByTagName('sd:subscriptionId')[0]
    subscriptionid = subscript.firstChild.wholeText

    return [sessionid, subscriptionid]

def nano(epoch):
    return int(epoch * 1e9)

def epoch(nano):
    return (nano / 1e9)


class SDEE:

    def __init__(self, **kwargs):
        try:
            self._callback = kwargs['callback']
        except:
            self._callback = ''

        try:
            self._format = kwargs['format']
        except:
            self._format = 'raw'

        try:
            self._timeout = kwargs['timeout']
        except:
            self._timeout = 1

        try:
            self._user = kwargs['user']
        except:
            self._user = ''

        try:
            self._password = kwargs['password']
        except:
            self._password = ''

        try:
            self._host = kwargs['host']
        except:
            self._host = 'localhost'

        try:
            self._method = kwargs['method']
        except:
            self._method = 'https'

        try:
            self._resource = kwargs['resource']
        except:
            self._resource = 'cgi-bin/sdee-server'

        self._uri = "%s://%s/%s" % (self._method, self._host, self._resource)

        try:
            self._sessionid = kwargs['sessionid']
        except:
            self._sessionid = ''

        try:
            self._subscriptionid = kwargs['subscriptionid']
        except:
            self._subscriptionid = ''

        try:
            self._starttime = kwargs['starttime']
        except:
            self._starttime = nano(time.time())

        self._b64pass = base64.b64encode(
            "%s:%s" % (self._user, self._password)
        )

        self._response = ''

        try:
            self._force = kwargs['force']
        except:
            self._force = 'yes'

    def data(self):
        return self._response

    def Password(self, passwd):
        self._password = passwd
        self._b64pass = base64.b64encode(
            "%s:%s" %
            (self._user, self._password)
        )

    def User(self, username):
        self._user = username
        self._b64pass = base64.b64encode(
            "%s:%s" %
            (self._user, self._password)
        )

    def Host(self, host):
        self._host = host
        self._uri = "%s://%s/%s" % (self._method, self._host, self._resource)

    def Method(self, method):
        self._method = method
        self._uri = "%s://%s/%s" % (self._method, self._host, self._resource)

    def Resource(self, resource):
        self._resource = resource
        self._uri = "%s://%s/%s" % (self._method, self._host, self._resource)

    def _request(self, params, **kwargs):
        req = urllib2.Request("%s?%s" % (self._uri, params))
        req.add_header('Authorization', "BASIC %s" % (self._b64pass))
        data = urllib2.urlopen(req)
        self._response = data.read()
        if self._action == 'open':
            self._sessionid, self._subscriptionid = parse_open(
                self._action, self._response)
        elif self._action == 'close':
            print data.read()
        elif self._action == 'cancel':
            print data.read()
        elif self._action == 'get':
            if isinstance(self._callback, types.FunctionType):
                self._callback(**kwargs)
        elif self._action == 'query':
            pass

    def open(self, **kwargs):
        self._action = 'open'
        param_dict = {
            "events": "evIdsAlert",
            "action": "open",
            "force": self._force}
        if self._subscriptionid != '':
            param_dict['subscriptionId'] = self._subscriptionid
        params = urllib.urlencode(param_dict)
        self._request(params)

    def close(self, **kwargs):
        self._action = 'close'
        params = urllib.urlencode({"action": "close",
                                   "subscriptionId": self._subscriptionid})
        self._request(params)

    def cancel(self, **kwargs):
        self._action = 'cancel'
        params = urllib.urlencode({
            "action": "cancel",
            "subscriptionId": self._subscriptionid,
            "sessionId": self._sessionid})
        self._request(params)

    def get(self, **kwargs):

        self._action = 'get'
        params = urllib.urlencode({"confirm": "yes",
                                   "timeout": "1",
                                   "maxNbrofEvents": "20",
                                   "action": self._action,
                                   "subscriptionId": self._subscriptionid})
        self._request(params, **kwargs)

    def query(self, **kwargs):
        pass
