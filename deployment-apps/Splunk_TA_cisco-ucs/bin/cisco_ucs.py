#!/usr/bin/python

"""
This is the main entry point for Cisco UCS TA
"""

import time
import sys
import traceback
import Queue

import ta_util2
from ta_util2 import job_scheduler as sched
from ta_util2 import job_source as js
from ta_util2 import data_loader as dl
from ta_util2 import utils
from ta_util2 import event_writer
from ta_util2 import configure as conf

import cisco_ucs_job_factory as jf
from cisco_ucs_config import (CiscoUcsConfig, CiscoUcsConfMonitor)


_LOGGER = utils.setup_logging("ta_cisco_ucs")


def do_scheme():
    """
    Feed splunkd the TA's scheme
    """

    print """
    <scheme>
    <title>Splunk Add-on for Cisco UCS</title>
    <description>Enable Cisco UCS inputs</description>
    <use_external_validation>true</use_external_validation>
    <streaming_mode>xml</streaming_mode>
    <use_single_instance>true</use_single_instance>
    <endpoint>
      <args>
        <arg name="name">
          <title>Unique name which identifies this data input</title>
        </arg>
        <arg name="url">
          <title>Cisico UCS server URL</title>
        </arg>
        <arg name="username">
          <title>Cisico UCS server username</title>
        </arg>
        <arg name="password">
          <title>Cisico UCS server password</title>
        </arg>
        <arg name="class_ids">
           <title>Cisco UCS Class IDs (separated by ",")</title>
        </arg>
        <arg name="duration">
           <title>Collection interval for these classes (in seconds)</title>
        </arg>
      </args>
    </endpoint>
    </scheme>
    """


def _setup_signal_handler(data_loader):
    """
    Setup signal handlers
    @data_loader: data_loader.DataLoader instance
    """

    def _handle_exit(signum, frame):
        _LOGGER.info("Cisco UCS TA is going to exit...")
        data_loader.tear_down()

    utils.handle_tear_down_signals(_handle_exit)


def _get_file_change_handler(data_loader, meta_configs):
    def reload_and_exit(changed_files):
        changed = [f for f in changed_files if not f.endswith(".signal")]
        if changed:
            _LOGGER.info("Reload conf %s", changed)
            conf.reload_confs(changed, meta_configs["session_key"],
                              meta_configs["server_uri"])
        data_loader.tear_down()

    return reload_and_exit


def _setup_logging(loglevel="INFO", refresh=False):
    ta_util2.setup_logging_for_frmk(loglevel, refresh)
    utils.setup_logging("ta_cisco_ucs", loglevel, refresh)
    utils.setup_logging("ta_app_conf", loglevel, refresh)


def _get_ucs_configs():
    _setup_logging()
    ucs_config = CiscoUcsConfig()
    tasks = ucs_config.get_tasks()

    if tasks:
        loglevel = tasks[0].get("log_level", "INFO")
        if loglevel != "INFO":
            _setup_logging(loglevel, True)
    else:
        _LOGGER.info("Data collection for Cisco UCS is not fully configured. "
                     "Please make sure you have configured tasks, and the "
                     "UCS manager and task template referenced by the tasks "
                     "are correctly configured. Refer to ta_app_conf.log for "
                     "more details. Do nothing and quit the TA.")
        return None, None

    return ucs_config.metas, tasks


class ModinputJobSource(js.JobSource):

    def __init__(self, tasks):
        self._done = False
        self._job_q = Queue.Queue()
        self.put_jobs(tasks)

    def put_jobs(self, jobs):
        for job in jobs:
            self._job_q.put(job)

    def get_jobs(self, timeout=1):
        jobs = []
        try:
            while 1:
                jobs.append(self._job_q.get(timeout=timeout))
        except Queue.Empty:
            return jobs


def run():
    """
    Main loop. Run this TA for ever
    """

    try:
        meta_configs, tasks = _get_ucs_configs()
    except Exception:
        _LOGGER.error("Failed to setup config for Cisco UCS TA: %s",
                      traceback.format_exc())
        raise

    if not tasks:
        return

    writer = event_writer.EventWriter()
    job_src = ModinputJobSource(tasks)
    job_factory = jf.CiscoUcsJobFactory(job_src, writer)
    job_scheduler = sched.JobScheduler(job_factory)
    data_loader = dl.GlobalDataLoader.get_data_loader(
        tasks, job_scheduler, writer)
    callback = _get_file_change_handler(data_loader, meta_configs)
    conf_monitor = CiscoUcsConfMonitor(callback)
    data_loader.add_timer(conf_monitor.check_changes, time.time(), 60)

    _setup_signal_handler(data_loader)
    data_loader.run()


def validate_config():
    """
    Validate inputs.conf
    """

    return 0


def usage():
    """
    Print usage of this binary
    """

    hlp = "%s --scheme|--validate-arguments|-h"
    print >> sys.stderr, hlp % sys.argv[0]
    sys.exit(1)


def main():
    """
    Main entry point
    """

    args = sys.argv
    if len(args) > 1:
        if args[1] == "--scheme":
            do_scheme()
        elif args[1] == "--validate-arguments":
            sys.exit(validate_config())
        elif args[1] in ("-h", "--h", "--help"):
            usage()
        else:
            usage()
    else:
        _LOGGER.info("Start Cisco UCS TA")
        run()
        _LOGGER.info("End Cisco UCS TA")
    sys.exit(0)


if __name__ == "__main__":
    main()
