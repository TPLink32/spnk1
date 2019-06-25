import logging

# bindir = op.dirname(op.dirname(op.abspath(__file__)))
# sys.path.append(bindir)

from Splunk_TA_cisco_ucs.ta_util2 import configure as conf
from Splunk_TA_cisco_ucs.ta_util2 import credentials as cred

# sys.path.pop(0)


_LOGGER = logging.getLogger("ta_app_conf")


class AppConfStanza(object):

    def __init__(self):
        """
        @params: dict like object
        """

        self.id = ""
        self.name = ""
        self.description = ""
        self.appName = ""
        self._removable = False

    def from_params(self, params):
        assert params.get("appName")
        assert params.get("name")

        self.name = params["name"]
        self.appName = params["appName"]
        self.id = "{}:{}".format(self.appName, self.name)
        self.description = params.get("description", "")
        self._removable = params.get("_removable", False)

    def from_id(self, cid):
        """
        @cid: appName:name
        """

        self.id = cid
        parts = cid.split(":")
        self.appName = parts[0]
        self.name = parts[1]
        return self

    def to_dict(self):
        res = {}
        for k, v in self.__dict__.iteritems():
            if v is None:
                res[k] = ""
            else:
                res[k] = v
        return res


class AppConfManager(object):

    ENCRYPTED_MAGIC_TOKEN = "******"
    USER_PASS_MAGIC_SEP = "``"
    DUMMY_USER_TEMP = "_{0}_account_#{0}#{1}"

    def __init__(self, Cls, conf_file, splunkd_uri, session_key):
        if conf_file.endswith(".conf"):
            conf_file = conf_file[:-5]
        self._conf_cls = Cls
        self._conf_file = conf_file
        self._conf_mgr = conf.ConfManager(splunkd_uri, session_key)
        self._cred_mgr = cred.CredentialManager(session_key, splunkd_uri)

    def create(self, data, owner="nobody"):
        """
        @data: a object of AppConfStanza
        @return AppConfStanzaObject if success otherwise None
        """

        assert data.appName and data.name

        if self.get(data):
            return None

        return self.update(data, owner)

    def update(self, data, owner="nobody"):
        """
        @data: a object of class AppConfStanza
        @return: new AppConfStanza if sucess otherwise None
        """

        res = self.get(data)
        if res is None:
            # stanza doesn't exist, create it
            r, failed_stanzas = self._conf_mgr.create_conf(
                owner, data.appName, self._conf_file, (data.name,))
            if not r:
                return None

        stanza = data.to_dict()
        del stanza["_removable"]
        del stanza["id"]

        r = self._encrypt_userpass(stanza, owner)
        if not r:
            return None

        for key in ("appName", "name", "eai:acl", "userName", "stanza"):
            if key in stanza:
                del stanza[key]

        r = self._conf_mgr.update_conf_properties(
            owner, data.appName, self._conf_file, data.name, stanza)
        if not r:
            return None

        return self.get(data)

    def delete(self, data, owner="nobody"):
        """
        @data: a object of class AppConfStanza
        @return: true if sucess otherwise false
        """

        assert data.appName and data.name

        res = self._conf_mgr.get_conf(owner, data.appName,
                                      self._conf_file, data.name)
        if res:
            res[0]["name"] = data.name
            self._delete_encrypted_userpass(res[0])

        res = self._conf_mgr.delete_conf_stanzas(
            owner, data.appName, self._conf_file, (data.name,))
        if res:
            return False
        return True

    def get(self, data, owner="nobody", decrypt=True):
        """
        @data: a object of class AppConfStanza
        @return: AppConfStanza object if sucess otherwise None
        """

        assert data.appName and data.name

        res = self._conf_mgr.get_conf(owner, data.appName,
                                      self._conf_file, data.name)
        if res:
            res[0]["name"] = data.name
            if decrypt:
                self._decrypt_userpass(res[0])
            res[0]["_removable"] = res[0]["eai:acl"].get("removable")
            res = self._conf_cls(res[0])
            return res
        return None

    def all(self, appname="-", owner="-", decrypt=True):
        """
        @return: a list of AppConfStanza objects if success
                 otherwise return empty list
        """

        results = []
        stanzas = self._conf_mgr.get_conf(owner, appname, self._conf_file)
        if not stanzas:
            return results

        for stanza in stanzas:
            stanza["name"] = stanza["stanza"]
            stanza["_removable"] = stanza["eai:acl"].get("removable")
            if decrypt:
                self._decrypt_userpass(stanza)
            results.append(self._conf_cls(stanza))
        return results

    def _needs_decrypt(self, stanza):
        return False

    def _needs_encrypt(self, stanza):
        return False

    def _get_userpass(self, stanza):
        return ("", "")

    def _mask_userpass(self, stanza):
        pass

    def _delete_encrypted_userpass(self, stanza, owner="nobody"):
        """
        @stanza: dict object contains clear username password
        @return: True if success otherwise false
        """

        if not self._needs_decrypt(stanza):
            return True

        realm = self.DUMMY_USER_TEMP.format(stanza["appName"], stanza["name"])
        res = self._cred_mgr.delete(realm, "user", stanza["appName"], owner)
        if not res:
            return res

    def _encrypt_userpass(self, stanza, owner="nobody"):
        """
        @stanza: dict object contains clear username password
        @return: True if success otherwise false
        """

        if not self._needs_encrypt(stanza):
            return True

        realm = self.DUMMY_USER_TEMP.format(stanza["appName"], stanza["name"])
        real_userpass = self.USER_PASS_MAGIC_SEP.join(
            self._get_userpass(stanza))
        res = self._cred_mgr.update(
            realm, "user", real_userpass, stanza["appName"], owner)

        if res:
            self._mask_userpass(stanza)
        return res

    def _decrypt_userpass(self, stanza, owner="nobody"):
        """
        @stanza: dict object contains encrypted username password
        @return: True if success otherwise false
        """

        if not self._needs_decrypt(stanza):
            return True

        realm = self.DUMMY_USER_TEMP.format(stanza["appName"], stanza["name"])
        res = self._cred_mgr.get_clear_password(
            realm, "user", stanza["appName"], owner)
        if not res:
            return res

        userpass = res.split(self.USER_PASS_MAGIC_SEP)
        stanza["account_name"], stanza["account_password"] = userpass
        return True

    def reload(self):
        self._conf_mgr.reload_confs((self._conf_file,), "-")
