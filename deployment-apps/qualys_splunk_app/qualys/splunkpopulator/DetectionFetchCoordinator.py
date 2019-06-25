__author__ = 'mwirges'

from qualys import qlogger
from qualys.splunkpopulator.assethost import HostIdRetriever
from qualys.splunkpopulator.detectionpopulator import HostDetectionPopulator

import time
import Queue
from threading import Thread, ThreadError, Lock

"""
Implementation of HostIdRetriever which takes retrieved Ids and puts them
into a fifo queue for processing.
"""


class HostIdsFifoPopulator(HostIdRetriever):
    """
    :type fifoQueue: Queue.Queue
    """
    fifoQueue = None

    def __init__(self, fifoQueue):
        super(HostIdsFifoPopulator, self).__init__()

        assert isinstance(fifoQueue, Queue.Queue)
        self.fifoQueue = fifoQueue

    # end __init__

    def _handle_idset(self, idset):
        self.fifoQueue.put(idset)


"""
Implementation of the HostDetectionPopulator which, given an explicit IDSet of
host ids, loads detection information.  Optionally it can pipe output to an
output queue.
"""


class ThreadedHostDetectionPopulator(HostDetectionPopulator):
    outboundQueue = None
    ids = None

    def __init__(self, ids, hostDetectionConfiguration=None, outboundQueue=None):
        super(ThreadedHostDetectionPopulator, self).__init__(hostDetectionConfiguration)
        self.outboundQueue = outboundQueue
        self.ids = ids

    def output(self, log, *args, **kwargs):
        if self.outboundQueue is not None:
            self.outboundQueue.put(log)
        else:
            super(ThreadedHostDetectionPopulator, self).output(log, *args, **kwargs)
            # end if

    @property
    def get_api_parameters(self):
        params = super(ThreadedHostDetectionPopulator, self).get_api_parameters
        del params['truncation_limit']
        params['ids'] = self.ids

        return params


class DetectonFetchCoordinator:
    config = {}

    detectionWorkers = []

    kbpopulator = None
    logger = None

    def __init__(self, config, hostDetectionConfiguration):
        # for now , we're just going to get a dict of config vals until this can be refactored
        self.config = config
        self.hostDetectionConfiguration = hostDetectionConfiguration
        self.host_logged = 0
        self.lock = Lock()


    @property
    def get_host_logged_count(self):
        return self.host_logged

    # end __init__

    def handleOutput(self, control, outBoundQueue):
        """
        It is possible to have the detection API output get piped into another queue,
        and this would be a serial way to process the detections.  However, since the
        loggin facility in python is used for writing out data to splunk, and it is
        thread-safe, there's practically no need for it.

        :param control:
        :param outBoundQueue:
        :return:
        """

        while True:
            try:
                qlogger.info("getting output item")
                item = outBoundQueue.get(False)
                qlogger.info("Output Thread: %s", item)
                outBoundQueue.task_done()
            except Queue.Empty, e:
                if control['out_active'] == False:
                    qlogger.info("output thread exiting")
                    break
                else:
                    qlogger.info("output thread waiting for work")
                    time.sleep(5)
                    continue
                    #end if
                    #end try
                    #end while

    #end handleOutput

    def loadDetections(self, id, control, idsetQueue, outBoundQueue=None):
        """
        :param id: int
        :param control: dict
        :param idsetQueue: Queue.Queue
        :param outBoundQueue: Queue
        :return:
        """

        #TODO make this a thread object

        while True:
            """
            :type item: IDSet
            """
            try:
                qlogger.info("getting idset inbound queue...")
                item = idsetQueue.get(False)
                # do something
                qlogger.info("processing idset: %s", item.tostring())

                thdp = ThreadedHostDetectionPopulator(item.tostring(), self.hostDetectionConfiguration, outBoundQueue)
                thdp.run()
                if thdp.get_host_logged_count > 0:
                    self.lock.acquire()
                    try:
                        self.host_logged += thdp.get_host_logged_count
                    except e:
                        qlogger.error(e)
                    finally:
                        self.lock.release()

                #outBoundQueue.put(item.tostring())
                idsetQueue.task_done()
            except Queue.Empty, e:
                qlogger.info("inboundqueue empty")
                if control['active'] == False:
                    qlogger.info("inbound queue exiting")
                    break
                else:
                    qlogger.info("waiting for more work")
                    time.sleep(5)
                    continue
                    #end if
                    #end

    #end loadDetections

    def coordinate(self):
        idsetQueue = Queue.Queue()
        #outboundQueue = Queue.Queue()

        # logic here is more or less simple, we have a pool of threads of size T
        # load them up, and they sit on the queue, until they are signaled not
        # to expect anything else; then exit

        control = {"active": True, "out_active": True}
        for i in range(self.config['num_threads']):
            qlogger.info("starting thread %d" % (i))
            th = Thread(target=self.loadDetections, args=(i, control, idsetQueue))
            th.setDaemon(True)
            th.start()
            self.detectionWorkers.append(th)
        #end for

        # for reference
        #outputProcessor = Thread(target=self.handleOutput, args=(control, outboundQueue))
        #outputProcessor.setDaemon(True)
        #outputProcessor.start()

        # now we drive with assethost stuff

        hip = HostIdsFifoPopulator(idsetQueue)
        hip.run()

        control['active'] = False
        # clean up the queue, clean up the threads
        idsetQueue.join()
        for th in self.detectionWorkers:
            th.join()

            #control['out_active'] = False
            #outboundQueue.join()
            #outputProcessor.join()

            #end coordinate
