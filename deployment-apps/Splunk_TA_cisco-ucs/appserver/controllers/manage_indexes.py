import splunk.appserver.mrsparkle.controllers as controllers
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route
import splunk.clilib.cli_common as scc


from import_protect import ensure_addon_lib_dir_in_path
ensure_addon_lib_dir_in_path()

from Splunk_TA_cisco_ucs_support import handler_helper
from Splunk_TA_cisco_ucs.ta_util2 import knowledge_objects as ko


class IndexHandler(controllers.BaseController):
    # Return including default one
    @route('=indexes')
    @expose_page(must_login=True, methods=['GET'])
    def get_all_indexes(self, **params):
        service = ko.KnowledgeObjectManager(scc.getMgmtUri(),
                                            handler_helper.get_session_key())
        indexes = [{"name": index['name']} for index in service.indexes()
                   if index['disabled'] == '0'
                   and index['isInternal'] == '0']
        indexes.insert(0, {"name": "default"})
        return self.render_json(indexes)
