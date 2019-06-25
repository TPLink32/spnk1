import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
import splunk.clilib.cli_common as scc

from import_protect import ensure_addon_lib_dir_in_path
ensure_addon_lib_dir_in_path()

from Splunk_TA_cisco_ucs_support import handler_helper
from Splunk_TA_cisco_ucs.ta_util2 import knowledge_objects as ko


class AppHandler(controllers.BaseController):
    # Return including default one
    @route('=apps')
    @expose_page(must_login=True, methods=['GET'])
    def get_all_apps(self, **params):

        service = ko.KnowledgeObjectManager(scc.getMgmtUri(),
                                            handler_helper.get_session_key())
        apps = [{"name": app['name']} for app in service.apps()
                if app['disabled'] == '0']

        return self.render_json(apps)
