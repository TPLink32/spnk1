from ta_conf import app_conf as ac


class TemplateData(ac.AppConfStanza):

    def __init__(self, params=None):
        """
        @params: dict like object
        """

        super(TemplateData, self).__init__()

        self.content = ""

        if params is not None:
            self.from_params(params)

    def from_params(self, params):
        """
        @params: dict like object
        """

        assert params

        super(TemplateData, self).from_params(params)

        self.content = params.get("content", "")
        return self


class TemplateConfManager(ac.AppConfManager):

    def __init__(self, task_conf_file, splunkd_uri, session_key):
        super(TemplateConfManager, self).__init__(TemplateData, task_conf_file,
                                                  splunkd_uri, session_key)
