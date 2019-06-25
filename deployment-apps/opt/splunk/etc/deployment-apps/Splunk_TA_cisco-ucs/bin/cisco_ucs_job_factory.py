"""
Create scheduling jobs
"""

import logging
import socket

from ta_util2 import job_factory as jf
import cisco_ucs_data_loader as udl


_LOGGER = logging.getLogger("ta_cisco_ucs")


class CiscoUcsCollectionJob(jf.Job):

    def __init__(self, job_id, config, data_collect_func):
        super(CiscoUcsCollectionJob, self).__init__(job_id, config)
        if not config.get("host", None):
            config["host"] = socket.gethostname()
        self._config = config
        self._func = data_collect_func

    def __call__(self):
        _LOGGER.debug("Start collecting from %s.", self._config["class_ids"])
        results = self._func()
        if results:
            events = "".join(("<stream>{}</stream>".format(r)
                              for r in results))
            self._config["event_writer"].write_events(events)

        _LOGGER.debug("End collecting from %s.", self._config["class_ids"])

    def get(self, key, default=None):
        return self._config.get(key, default)


class CiscoUcsJobFactory(jf.JobFactory):

    def _create_job(self, job):
        job["event_writer"] = self._event_writer
        loader = udl.CiscoUcs(job)
        return CiscoUcsCollectionJob(
            job["class_ids"], job, loader.collect_data)
