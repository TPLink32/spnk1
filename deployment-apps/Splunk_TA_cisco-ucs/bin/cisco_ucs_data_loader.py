import traceback
import logging
import threading
from cStringIO import StringIO
import xml.etree.cElementTree as ElementTree
import httplib

from ta_util2 import rest


_LOGGER = logging.getLogger("ta_cisco_ucs")


def _parse_xml(content):
    try:
        return ElementTree.parse(StringIO(content))
    except ElementTree.ParseError:
        return None


def _get_sys_info(xml):
    sys_info = []
    sys_node = xml.find(".//topSystem")
    if sys_node is None:
        return sys_info

    for k in ("site", "name", "address"):
        v = sys_node.get(k)
        if k == "name":
            k = "system_name"
        sys_info.append((k, v))
    return ",".join(('{}="{}"'.format(kv[0], kv[1]) for kv in sys_info))


def _convert_to_modinput_format(content, class_ids, sourcetype, index, host):
    sourcetype = sourcetype if sourcetype else "cisco:ucs"
    xml = _parse_xml(content)
    if xml is None:
        return ""

    evt_fmt = ("<event><source>{0}</source><sourcetype>{1}</sourcetype>"
               "<host>{2}</host><index>{3}</index>"
               "<data><![CDATA[ {4} ]]></data></event>")
    sys_info = _get_sys_info(xml)
    if not sys_info:
        return ""

    results = []
    for cid in class_ids:
        cnodes = xml.findall(".//" + cid)
        if not cnodes:
            continue

        for node in cnodes:
            r = ('{}="{}"'.format(kv[0], kv[1]) for kv in node.items())
            r = "{},{}".format(",".join(r), sys_info)
            r = evt_fmt.format("cisco:ucs:" + cid, sourcetype, host, index, r)
            results.append(r)
    data = "".join((r for r in results))
    return data


class CiscoUcs(object):

    def __init__(self, config):
        """
        @config: dict like object, should have class_ids, url, username,
                 password, proxy_url, proxy_port, proxy_username,
                 proxy_password, cookie, path, checkpoint_dir
        """

        self._config = config
        if not self._config.get("path"):
            self._config["path"] = "/nuova"
        self._full_url = "https://{}{}".format(self._config["url"],
                                               self._config["path"])
        self._http = rest.build_http_connection(config, 1800)
        self._lock = threading.Lock()

        from ta_util2 import data_loader as dl
        self._loader = dl.GlobalDataLoader.get_data_loader(None, None, None)

    def collect_data(self):
        if self._lock.locked():
            _LOGGER.info("Last request for %s has not been done yet",
                         self._config["class_ids"])
            return None

        self._connect_to_ucs()
        try:
            with self._lock:
                res = self._do_collect()
        except Exception:
            raise
        finally:
            self._disconnect_from_ucs()
        return res

    def _do_collect(self):
        """
        @return: objs
        """

        results = []
        req = ('''<configResolveClasses cookie="{}" inHierarchical="false">'''
               '''<inIds><Id value="topSystem"/>{}</inIds>'''
               '''</configResolveClasses>''')
        class_ids = self._config["class_ids"]
        cids = "".join(('<Id value="{}"/>'.format(cid) for cid in class_ids))
        req = req.format(self._config["cookie"], cids)
        err, content = self._send_request(req, True)
        if not err and content:
            params = (content, self._config["class_ids"],
                      self._config.get("sourcetype"),
                      self._config.get("index", "main"), self._config["url"])
            content = self._loader.run_computing_job(
                _convert_to_modinput_format, params)
            if content:
                results.append(content)

        return results

    @staticmethod
    def _to_xml(err_content):
        if not err_content[0] and err_content[1]:
            xml = _parse_xml(err_content[1])
            if xml is None:
                _LOGGER.error("Failed to parse XML response %s",
                              err_content[1])
                return None
            return xml
        else:
            return None

    def _send_request(self, req, log_begin_end=False):
        resp, content = self._do_request(payload=req,
                                         log_begin_end=log_begin_end)
        if resp and resp.status in (200, 201):
            return 0, content
        else:
            return 1, None

    def _do_request(self, method="POST", payload=None, log_begin_end=False):
        if log_begin_end:
            _LOGGER.debug("start %s %s", self._full_url, payload)

        headers = {
            "Content-type": 'text/xml; charset="UTF-8"',
            "Content-length": "{}".format(len(payload)),
        }
        resp, content = None, None
        for _ in range(2):
            try:
                resp, content = self._http.request(
                    self._full_url, method=method, headers=headers,
                    body=payload)
            except httplib.ResponseNotReady:
                self._http = rest.build_http_connection(self._config, 1800)
                _LOGGER.error("Response not ready")
            except Exception:
                self._http = rest.build_http_connection(self._config, 1800)
                _LOGGER.error("Failed to connect %s, reason=%s",
                              self._full_url, traceback.format_exc())
            else:
                if resp.status not in (200, 201):
                    _LOGGER.error("Failed to connect %s, reason=%s, %s",
                                  self._full_url, resp.reason, content)
                else:
                    break

        if log_begin_end:
            _LOGGER.debug("end %s %s", self._full_url, payload)

        return resp, content

    def _connect_to_ucs(self):
        if self._config.get("cookie"):
            req = '''<aaaRefresh inName="{}" inPassword="{}" inCookie="{}"/>'''.format(
                self._config["username"], self._config["password"],
                self._config.get("cookie"))
            content = self._to_xml(self._send_request(req))
            if content is not None:
                self._config["cookie"] = content.getroot().get("outCookie")
            else:
                self._config["cookie"] = None

        if not self._config.get("cookie"):
            req = '''<aaaLogin inName="{}" inPassword="{}"/>'''.format(
                self._config["username"], self._config["password"])
            content = self._to_xml(self._send_request(req))
            if content is None:
                raise Exception("Failed to get cookie for %s",
                                self._config["url"])

            cookie = content.getroot().get("outCookie")
            if cookie:
                self._config["cookie"] = cookie
            else:
                # FIXME errcode=572
                msg = "Failed to get cookie for {}, errcode={}, reason={}".format(
                    self._config["url"],
                    content.getroot().get("errorCode"),
                    content.getroot().get("errorDescr"))
                _LOGGER.error(msg)
                raise Exception(msg)

    def _disconnect_from_ucs(self):
        cookie = self._config.get("cookie")
        if cookie:
            req = '''<aaaLogout inCookie="{}"/>'''.format(cookie)
            err, _ = self._send_request(req)
            if not err:
                return 0
        return 1

    @staticmethod
    def is_alive():
        return 1
