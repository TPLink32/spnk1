from ta_conf import app_conf as ac


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
