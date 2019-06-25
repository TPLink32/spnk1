import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
import splunk.clilib.cli_common as scc

from import_protect import ensure_addon_lib_dir_in_path
ensure_addon_lib_dir_in_path()

from Splunk_TA_cisco_ucs_support import handler_helper
from Splunk_TA_cisco_ucs.ta_conf import global_conf as gc


class GlobalSettingHandler(handler_helper.AddOnHandler):
    def __init__(self):
        super(GlobalSettingHandler, self).__init__(
            "cisco_ucs", gc.GlobalSettings, gc.GlobalSettingsConfManager)

    @route('=global_settings')
    @expose_page(must_login=True, methods=['GET', 'POST'])
    def handle_all(self, **params):
        return super(GlobalSettingHandler, self).handle_all(**params)

    @route('=global_settings/:cid')
    @expose_page(must_login=True, methods=['GET', 'PUT', 'DELETE'])
    def handle_one(self, cid, **params):
        return super(GlobalSettingHandler, self).handle_one(cid, **params)

