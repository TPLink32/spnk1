
import cherrypy
import json
import splunk.clilib.cli_common as scc
import splunk.appserver.mrsparkle.controllers as controllers
import os.path as op


def get_post_data():
    if "Content-Length" in cherrypy.request.headers.keys():
        cl = cherrypy.request.headers["Content-Length"]
        raw_body = cherrypy.request.body.read(int(cl))
        return json.loads(raw_body)
    else:
        raise cherrypy.HTTPError(status=400, message="Bad request")


def normalize_request(params):
    method = cherrypy.request.method.upper()
    if method in {"PUT", "POST"}:
        params = get_post_data()
        return method, params

    return method, params


def routine_handler(handlers, *args, **kwargs):
    (method, kwargs) = normalize_request(kwargs)
    if method not in handlers.keys():
        raise cherrypy.HTTPError(status=400, message="Bad request")
    return handlers[method](*args, **kwargs)


def get_session_key():
    session_key = cherrypy.session.get("sessionKey")
    cherrypy.session.release_lock()
    return session_key


def _signal_ta():
    # Splunk_TA_cisco_ucs_support
    appdir = op.dirname(op.abspath(__file__))

    # controllers
    appdir = op.dirname(appdir)

    # appserver
    appdir = op.dirname(appdir)

    # app/local
    localdir = op.join(op.dirname(appdir), "local")

    try:
        if not op.exists(localdir):
            op.mkdir(localdir)

        fil = op.join(localdir, ".signal")
        with open(fil, "w"):
            pass
    except Exception:
        pass


class AddOnHandler(controllers.BaseController):
    def __init__(self, config_file, ItemDataCls, ItemMgrCls):
        super(AddOnHandler, self).__init__()
        self.config_file = config_file
        self.ItemDataCls = ItemDataCls
        self.ItemMgrCls = ItemMgrCls

    def handle_all(self, **params):
        handlers = {
            "GET": self.get_all,
            "POST": self.create
        }

        return routine_handler(handlers, **params)

    def handle_one(self, cid, **params):
        handlers = {
            "GET": self.get_one,
            "PUT": self.update,
            "DELETE": self.delete
        }

        return routine_handler(handlers, cid, **params)

    def get_item_manager(self):
        session_key = get_session_key()
        mgmt_uri = scc.getMgmtUri()
        return self.ItemMgrCls(self.config_file, mgmt_uri, session_key)

    def get_all(self, **params):
        try:
            mgr = self.get_item_manager()
            items = mgr.all()
        except Exception:
            raise cherrypy.HTTPError(status=400, message="Bad request")

        result = [item.to_dict() for item in items]
        return self.render_json(result)

    def get_one(self, cid, **params):
        try:
            item_manager = self.get_item_manager()
            item = item_manager.get(self.ItemDataCls().from_id(cid))
        except Exception:
            raise cherrypy.HTTPError(status=400, message="Bad request")

        return self.render_json(item.to_dict())

    def error_in_managing(self, **param):
        status = int(param.get("status", 409))
        errors = param.get("errors", "unknown error")
        message = str(param.get("message", errors))

        raise cherrypy.HTTPError(status, message)

    def _do_create(self, **params):
        """
        :param params:
        :return:
            (item, item_data, response)
        """
        try:
            item_data = self.ItemDataCls().from_params(params)
            item_manager = self.get_item_manager()
            item = item_manager.create(item_data)
        except Exception:
            raise cherrypy.HTTPError(status=400, message="Bad request")

        if item is None:
            msg = ("Configuration failed. Please check if an item of "
                   "the same name already exists.")
            self.error_in_managing(status=409, message=msg)
        else:
            _signal_ta()
            return item, item_data, self.render_json(item.to_dict())

    def create(self, **params):
        return self._do_create(**params)[2]

    def _do_update(self, cid, **params):
        """

        :param cid:
        :param params:
        :return: (item, item_data, response)
        """
        try:
            item_data = self.ItemDataCls().from_params(params).from_id(cid)
            item_manager = self.get_item_manager()
            item = item_manager.update(item_data)
        except Exception:
            raise cherrypy.HTTPError(status=400, message="Bad request")

        if item is None:
            self.error_in_managing(
                status=409, message="Configuration update failed.")
        else:
            _signal_ta()
            return item, item_data, self.render_json(item.to_dict())

    def update(self, cid, **params):
        return self._do_update(cid, **params)[2]

    def _do_delete(self, cid, **params):
        """
        :param cid:
        :param params:
        :return: (success, item_data, json_result)
        """
        try:
            item_data = self.ItemDataCls().from_id(cid)
            item_manager = self.get_item_manager()
            success = item_manager.delete(item_data)
        except Exception:
            raise cherrypy.HTTPError(status=400, message="Bad request")

        if not success:
            return (success, item_data,
                    self.render_json({
                        "message": "There is no item of this name."}))
        else:
            _signal_ta()
            return success, item_data, self.render_json({
                "status": 200,
                "message": "Configuration successfully deleted."
            })

    def delete(self, cid, **params):
        return self._do_delete(cid, **params)[2]
