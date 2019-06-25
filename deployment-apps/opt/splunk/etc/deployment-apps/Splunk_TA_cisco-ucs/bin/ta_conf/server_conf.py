from ta_conf import app_conf as ac


class ServerData(ac.AppConfStanza):

    def __init__(self, params=None):
        """
        @params: dict like object
        """

        super(ServerData, self).__init__()

        self.server_url = ""
        self.account_name = ""
        self.account_password = ""
        self.protocol = ""
        self.interval = ""

        if params is not None:
            self.from_params(params)

    def from_params(self, params):
        """
        @params: dict like object
        """

        assert params

        super(ServerData, self).from_params(params)

        self.server_url = params.get("server_url", "")
        self.account_name = params.get("account_name", "")
        self.account_password = params.get("account_password", "")
        self.interval = params.get("interval", "")
        return self


class ServerConfManager(ac.AppConfManager):

    def __init__(self, server_conf_file, splunkd_uri, session_key):
        super(ServerConfManager, self).__init__(ServerData, server_conf_file,
                                                splunkd_uri, session_key)

    def _needs_encrypt(self, stanza):
        if not stanza:
            return False

        return stanza.get("account_name") != self.ENCRYPTED_MAGIC_TOKEN

    def _needs_decrypt(self, stanza):
        if not stanza:
            return False

        return stanza.get("account_name") == self.ENCRYPTED_MAGIC_TOKEN

    def _get_userpass(self, stanza):
        return (stanza.get("account_name"), stanza.get("account_password"))

    def _mask_userpass(self, stanza):
        stanza["account_name"] = self.ENCRYPTED_MAGIC_TOKEN
        stanza["account_password"] = self.ENCRYPTED_MAGIC_TOKEN
