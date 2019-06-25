
import cherrypy
from splunk.appserver.mrsparkle.lib.decorators import expose_page
from splunk.appserver.mrsparkle.lib.routes import route

from import_protect import ensure_addon_lib_dir_in_path
ensure_addon_lib_dir_in_path()

from Splunk_TA_cisco_ucs_support import handler_helper
from Splunk_TA_cisco_ucs.ta_conf import server_conf as sc


class ServerHandler(handler_helper.AddOnHandler):
    def __init__(self):
        super(ServerHandler, self).__init__(
            "cisco_ucs_servers", sc.ServerData, sc.ServerConfManager)

    @route('=servers')
    @expose_page(must_login=True, methods=['GET', 'POST'])
    def handle_all(self, **params):
        return super(ServerHandler, self).handle_all(**params)

    @route('=servers/:cid')
    @expose_page(must_login=True, methods=['GET', 'PUT', 'DELETE'])
    def handle_one(self, cid, **params):
        return super(ServerHandler, self).handle_one(cid, **params)


    def get_all(self, **params):
        try:
            mgr = self.get_item_manager()
            items = mgr.all()
        except Exception:
            raise cherrypy.HTTPError(status=400, message="Bad request")

        result = [self._delPass(item.to_dict()) for item in items]
        return self.render_json(result)

    def get_one(self, cid, **params):
        try:
            item_manager = self.get_item_manager()
            item = item_manager.get(self.ItemDataCls().from_id(cid))
        except Exception:
            raise cherrypy.HTTPError(status=400, message="Bad request")

        return self.render_json(self._delPass(item.to_dict()))
    
    def create(self, **params):
        item=self._do_create(**params)[0]
        return self.render_json(self._delPass(item.to_dict()))
    
    def update(self, cid, **params):
        try:
            itemMgr = self.get_item_manager()
            itemData = itemMgr.get(self.ItemDataCls().from_id(cid))
        except Exception:
            raise cherrypy.HTTPError(status=400, message="Bad request")
        params=self._addPass(params, itemData.to_dict())
        
        item=self._do_update(cid, **params)[0]
        return self.render_json(self._delPass(item.to_dict()))
    
    def _delPass(self, item):
        item['account_password']=""
        return item
    
    def _addPass(self, itemNew, itemOld):
        if len(itemNew['account_name'])<=0:#no username
            itemNew['account_password']=""
        elif itemNew['account_name']!=itemOld['account_name'] and len(itemNew['account_password'])<=0:#username changed but no password provided
            self.error_in_managing(status=400, message="Password is required for account.")
        elif len(itemNew['account_password'])<=0:#username is not changed, and no password provided
            itemNew['account_password']=itemOld['account_password']
        #other case is username is not changed, and password is provided (for changing password)
        return itemNew
    
    