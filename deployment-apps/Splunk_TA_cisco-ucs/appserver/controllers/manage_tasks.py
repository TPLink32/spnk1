from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route


from import_protect import ensure_addon_lib_dir_in_path
ensure_addon_lib_dir_in_path()
from Splunk_TA_cisco_ucs_support import handler_helper
from Splunk_TA_cisco_ucs.ta_conf import task_conf as tc


class TaskHandler(handler_helper.AddOnHandler):

    def __init__(self):
        super(TaskHandler, self).__init__(
            "cisco_ucs_tasks", tc.TaskData, tc.TaskConfManager)

    @route('=tasks')
    @expose_page(must_login=True, methods=['GET', 'POST'])
    def handle_all(self, **params):
        return super(TaskHandler, self).handle_all(**params)

    @route('=tasks/:cid')
    @expose_page(must_login=True, methods=['GET', 'PUT', 'DELETE'])
    def handle_one(self, cid, **params):
        return super(TaskHandler, self).handle_one(cid, **params)
