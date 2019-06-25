__author__ = 'Prabhas Gupte'

import time
import Queue
import copy
from threading import Thread, ThreadError, Lock
from threading import current_thread

from qualysModule import qlogger
from qualysModule.splunkpopulator.webapp import webAppIdFetcher
from qualysModule.splunkpopulator.detectionpopulator import *
import qualysModule.splunkpopulator.utils

class ThreadedWASDetectionPopulator(WASDetectionPopulator):
	idsDict = {}

	def __init__(self, ids, detectionConfiguration):
		super(ThreadedWASDetectionPopulator, self).__init__(detectionConfiguration)
		currentThreadName = current_thread().getName()
		qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Starting thread %s" % currentThreadName)

		if currentThreadName not in self.idsDict:
			self.idsDict[currentThreadName] = ids
	# end of __init__

	@property
	def get_api_parameters(self):
		currentThreadName = current_thread().getName()
		self.detectionConfiguration.add_detection_api_filter('webApp.id', 'IN', ','.join(self.idsDict[currentThreadName]))

		return self.detectionConfiguration.detection_api_filters
	# get_api_parameters

	def get_next_batch_params(self, lastId):
		currentThreadName = current_thread().getName()
		self.detectionConfiguration.add_detection_api_filter('webApp.id', 'IN', ','.join(self.idsDict[currentThreadName]))
		self.detectionConfiguration.add_detection_api_filter('id', 'GREATER', str(lastId))

		return self.detectionConfiguration.detection_api_filters
	# get_next_batch_params
# end of class ThreadedWASDetectionPopulator

class WASFindingsFetchCoordinator:
	appIdQueue = Queue.Queue()
	idChunks = []

	def __init__(self, numThreads, detectionConfiguration):
		self.numThreads = int(numThreads)
		self.detectionConfiguration = detectionConfiguration
		self.loggedHostsCount = 0
		self.lock = Lock()
	# end of __init__

	def getWebAppIds(self):
		fetcher = webAppIdFetcher(self.appIdQueue)
		fetcher.run()
		ids = fetcher.getIds()

		numIds = len(ids)
		if numIds == 0:
			qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","No web app ids found. Nothing to fetch.")
			return
		# if

		numChunks = numIds / self.numThreads

		if numIds % self.numThreads != 0:
			numChunks += 1
		# if

		idChunks = qualysModule.splunkpopulator.utils.chunks(ids, numChunks)
		for idChunk in idChunks:
			self.idChunks.append(idChunk)
	# end of getWebAppIds

	def loadWasFindings(self, idChunk):
		dc = None
		dc = copy.copy(self.detectionConfiguration)
		# dc.add_detection_api_filter('webApp.id', 'IN', ','.join(idChunk))
		populator = ThreadedWASDetectionPopulator(idChunk, dc)
		populator.run()
		total_logged = populator.get_host_logged_count

		if total_logged > 0:
			self.lock.acquire()
			try:
				self.loggedHostsCount += total_logged
			except e:
				qlogger.error(e)
			finally:
				self.lock.release()
			# end of try-except-finally
		# end of if
	# end of loadWasFindings

	def coordinate(self):
		self.getWebAppIds()

		workers = []

		i =0
		while (i < self.numThreads):
			# qualysModule.splunkpopulator.utils.printStreamEventXML("_internal","Starting thread %d" % i)
			th = Thread(target=self.loadWasFindings, args=(self.idChunks[i],))
			th.setDaemon(True)
			th.start()
			workers.append(th)
			i += 1
		# end of while

		for th in workers:
			th.join()
	# end of coordinate

	def getLoggedHostsCount(self):
		return self.loggedHostsCount
	# end of getLoggedHostsCount
# end of class WASFindingsFetchCoordinator
