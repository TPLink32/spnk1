import Splunk_TA_cisco_ucs.ta_conf.app_conf as ac


class GlobalSettings(ac.AppConfStanza):

    def __init__(self, params=None):
        """
        @params: dict like object
        """

        super(GlobalSettings, self).__init__()

        self.stanza_props = {}
        if params is not None:
            self.from_params(params)

    def from_params(self, params):
        """
        @params: dict like object
        """

        assert params

        super(GlobalSettings, self).from_params(params)
        self.stanza_props.update(params)

        return self

    def to_dict(self):
        res = {}
        for k, v in self.stanza_props.iteritems():
            if v is None:
                res[k] = ""
            else:
                res[k] = v

        for p in ("id", "name", "description", "appName", "_removable"):
            v = getattr(self, p)
            if v is None:
                res[p] = ""
            else:
                res[p] = v

        if "disabled" in res:
            del res["disabled"]
        return res


class GlobalSettingsConfManager(ac.AppConfManager):

    def __init__(self, conf_file, splunkd_uri, session_key):
        super(GlobalSettingsConfManager, self).__init__(
            GlobalSettings, conf_file, splunkd_uri, session_key)

    def _needs_encrypt(self, stanza):
        if not stanza:
            return False

        if "proxy_username" not in stanza:
            return False
        return stanza.get("proxy_username") != self.ENCRYPTED_MAGIC_TOKEN

    def _needs_decrypt(self, stanza):
        if not stanza:
            return False

        return stanza.get("proxy_username") == self.ENCRYPTED_MAGIC_TOKEN

    def _get_userpass(self, stanza):
        return (stanza.get("proxy_username"), stanza.get("proxy_password"))

    def _mask_userpass(self, stanza):
        stanza["proxy_username"] = self.ENCRYPTED_MAGIC_TOKEN
        stanza["proxy_password"] = self.ENCRYPTED_MAGIC_TOKEN


if __name__ == "__main__":
    import sys
    import os.path as op
    bindir = op.dirname(op.dirname(op.abspath(__file__)))
    sys.path.append(bindir)

    import ta_util2
    from ta_util2 import credentials as cred

    data = {
        "name": "logging",
        "log_level": "DEBUG",
        "appName": "Splunk_TA_cisco-ucs",
    }

    gs = GlobalSettings(data)
    session_key = cred.CredentialManager.get_session_key("admin", "admin")
    mgr = GlobalSettingsConfManager(
        "cisco_ucs.conf", "https://localhost:8089", session_key)
    mgr.delete(gs)
    res = mgr.create(gs)
    assert res

    res = mgr.get(gs)
    assert res.to_dict().get("log_level") == "DEBUG"

    data["log_level"] = "INFO"
    res = mgr.update(GlobalSettings(data))
    assert res

    data = {
        "name": "logging",
        "log_level": "DEBUG",
        "appName": "Splunk_TA_cisco-ucs",
    }

    res = mgr.delete(res)
    assert res
