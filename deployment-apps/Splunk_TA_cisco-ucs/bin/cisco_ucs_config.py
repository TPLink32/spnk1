import os.path as op
import sys
import logging

from ta_util2 import file_monitor as fm
from ta_util2 import configure as conf
from ta_util2 import utils
from ta_conf import ta_conf_task as tct


_LOGGER = logging.getLogger("ta_cisco_ucs")


class CiscoUcsConfMonitor(fm.FileMonitor):

    def __init__(self, callback):
        super(CiscoUcsConfMonitor, self).__init__(callback)

    def files(self):
        return (CiscoUcsConfig.server_file_w_path,
                CiscoUcsConfig.task_file_w_path,
                CiscoUcsConfig.template_file_w_path,
                CiscoUcsConfig.ucs_file_w_path,
                CiscoUcsConfig.signal_file_w_path)


class CiscoUcsConfig(object):

    app_dir = op.dirname(op.dirname(op.abspath(__file__)))
    app_file = op.join(app_dir, "local", "app.conf")
    server_file = "cisco_ucs_servers.conf"
    server_file_w_path = op.join(app_dir, "local", server_file)
    task_file = "cisco_ucs_tasks.conf"
    task_file_w_path = op.join(app_dir, "local", task_file)
    template_file = "cisco_ucs_templates.conf"
    template_file_w_path = op.join(app_dir, "local", template_file)
    ucs_file = "cisco_ucs.conf"
    ucs_file_w_path = op.join(app_dir, "local", ucs_file)
    signal_file_w_path = op.join(app_dir, "local", ".signal")

    def __init__(self):
        self.metas, _ = self.get_modinput_configs()
        self.metas["app_name"] = utils.get_appname_from_path(self.app_dir)
        self._conf_task = tct.TAConfTask(self.metas, self.server_file,
                                         self.template_file, self.task_file,
                                         self.ucs_file)

    def encrypt_credentials(self):
        self._conf_task.encrypt_credentials()

    def get_tasks(self):
        # Reload all configs
        confs = (self.server_file, self.template_file, self.task_file,
                 self.ucs_file)
        conf.reload_confs(confs, self.metas["session_key"],
                          self.metas["server_uri"])
        tasks = self._conf_task.get_tasks()
        # FIXME groupping tasks
        filtered_tasks = []

        # Filtered endpoint based on task, if one task have serveral task
        # templates, and some of them have dup class ids, clean them up to
        # avoid dup data collection
        existing_class_ids = {}
        for task in tasks:
            content = task["content"].strip()
            if not content:
                _LOGGER.warn("No class id specified for task=%s, ignore it",
                             task["name"])
                continue

            classids = []
            for class_id in content.split(","):
                class_id = class_id.strip()
                if not class_id:
                    continue

                cid = "``".join((task["appName"], task["server_url"],
                                 task["name"], class_id))
                if cid not in existing_class_ids:
                    task_and_temp = (task["appName"] + ":" + task["name"],
                                     task["task_template"], task["server_url"])
                    existing_class_ids[cid] = task_and_temp
                else:
                    _LOGGER.warn("class id=%s already specified in task=%s, "
                                 "template=%s for UCS manager=%s, will have "
                                 "dup data collection.", class_id,
                                 existing_class_ids[cid][0],
                                 existing_class_ids[cid][1],
                                 existing_class_ids[cid][2])
                classids.append(class_id)

            if not classids:
                _LOGGER.warn("Empty class ids in task=%s, ignore this task.",
                             task["appName"] + ":" + task["name"])
                continue

            task["url"] = task["server_url"].strip()
            if not task["url"]:
                _LOGGER.error("UCS Manager host is empty for task=%s. Ignore "
                              "this task.", task["name"])
                continue

            task["username"] = task["account_name"].strip()
            task["password"] = task["account_password"].strip()
            if not task["username"] or not task["password"]:
                _LOGGER.warn("Username or Password for UCS Manager=%s in "
                             "task=%s is empty", task["url"], task["name"])

            try:
                task["duration"] = int(task["interval"])
            except ValueError:
                _LOGGER.warn("The task interval=%s is not a integer, set to "
                             "120 seconds", task["interval"])
                task["duration"] = 120
            task["class_ids"] = classids

            for k in ("server_url", "account_name", "account_password",
                      "content"):
                del task[k]
            filtered_tasks.append(task)

        self.encrypt_credentials()
        return filtered_tasks

    @staticmethod
    def get_modinput_configs():
        modinput = sys.stdin.read()
        return conf.parse_modinput_configs(modinput)


if __name__ == "__main__":
    from ta_util2 import credentials as cred
    from cStringIO import StringIO
    utils.setup_logging("ta_cisco_ucs")
    session_key = cred.CredentialManager.get_session_key("admin", "admin")
    mod = ("""<?xml version="1.0" encoding="UTF-8"?>"""
           "<input>"
           "<server_host>Kens-MacBook-Pro.local</server_host>"
           "<server_uri>https://127.0.0.1:8089</server_uri>"
           "<session_key>123</session_key>"
           "<checkpoint_dir>.</checkpoint_dir>"
           "<configuration></configuration>"
           "</input>")

    mod = StringIO(mod.replace("123", session_key))
    stdin = sys.stdin
    sys.stdin = mod
    ucs_config = CiscoUcsConfig()
    sys.stdin = stdin
    ucs_config.encrypt_credentials()
    ucs_tasks = ucs_config.get_tasks()
    print ucs_tasks
