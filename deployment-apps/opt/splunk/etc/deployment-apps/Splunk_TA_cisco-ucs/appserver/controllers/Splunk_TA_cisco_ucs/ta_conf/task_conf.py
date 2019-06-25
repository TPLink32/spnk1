import Splunk_TA_cisco_ucs.ta_conf.app_conf as ac


class TaskData(ac.AppConfStanza):

    def __init__(self, params=None):
        """
        @params: dict like object
        """

        super(TaskData, self).__init__()

        self.servers = ""
        self.templates = ""
        self.index = ""
        self.sourcetype = ""
        self.disable = ""
        self.interval = 0

        if params is not None:
            self.from_params(params)

    def from_params(self, params):
        """
        @params: dict like object
        """

        assert params

        super(TaskData, self).from_params(params)

        self.interval = params.get("interval", 0)
        self.servers = params.get("servers", "")
        self.templates = params.get("templates", "")
        self.index = params.get("index", "")
        self.sourcetype = params.get("sourcetype", "")
        self.disabled = params.get("disabled", "")
        return self


class TaskConfManager(ac.AppConfManager):

    def __init__(self, task_conf_file, splunkd_uri, session_key):
        super(TaskConfManager, self).__init__(TaskData, task_conf_file,
                                              splunkd_uri, session_key)
