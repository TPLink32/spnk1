import Splunk_TA_cisco_ucs.ta_conf.app_conf as ac


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
        self.interval = 0

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


if __name__ == "__main__":
    import sys
    import os.path as op
    bindir = op.dirname(op.dirname(op.abspath(__file__)))
    sys.path.append(bindir)

    import ta_util2
    from ta_util2 import utils
    from ta_util2 import credentials as cred

    data = {
        "name": "Test",
        "server_url": "172.16.107.244",
        "account_name": "user",
        "account_password": "Password",
        "interval": "60",
        "description": "test",
        "appName": "Splunk_TA_cisco-ucs",
    }

    sd = ServerData(data)
    session_key = cred.CredentialManager.get_session_key("admin", "admin")
    mgr = ServerConfManager(
        "cisco_ucs_servers.conf", "https://localhost:8089", session_key)
    res = mgr.create(sd)
    assert res

    res = mgr.get(sd)
    assert res.account_name == "user"
    assert res.account_password == "Password"

    res = mgr.all()
    assert res and len(res) >= 1
    assert res[0].account_name == "user"
    assert res[0].account_password == "Password"

    sd.account_name = "user1"
    sd.account_password = "Password1"
    res = mgr.update(sd)
    assert res
    res = mgr.get(sd)
    assert res.account_name == "user1"
    assert res.account_password == "Password1"
    res = mgr.delete(res)
    assert res
