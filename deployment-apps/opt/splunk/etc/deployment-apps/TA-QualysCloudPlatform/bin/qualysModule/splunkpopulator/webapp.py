__author__ = 'Prabhas Gupte'

import Queue
from qualysModule.splunkpopulator.basepopulator import BasePopulator
from qualysModule import qlogger
import qualysModule.splunkpopulator.utils
import splunk.clilib.cli_common as scc
try:
	import xml.etree.cElementTree as ET
except ImportError:
	import xml.etree.ElementTree as ET

class webAppIdFetcher(BasePopulator):
	OBJECT_TYPE = "webAppIdFetcher"
	FILE_PREFIX = "web_app_ids"
	ROOT_TAG = 'WebApp'
	ID_TAG = 'id'
	ids = []

	def __init__(self, appIdQueue):
		super(webAppIdFetcher, self).__init__()
		self.appIdQueue = appIdQueue
	# end of __init__

	@property
	def get_api_parameters(self):
		api_params = ''
		qualysConf = scc.getMergedConf("qualys")
		if 'extra_was_params' in qualysConf['setupentity'] and qualysConf['setupentity']['extra_was_params'] != '':
			extra_params_root = ET.fromstring(qualysConf['setupentity']['extra_was_params'])
			for child in extra_params_root:
				child_attribs = child.attrib
				if child_attribs['field'] == 'webApp.id':
					api_params += "<Criteria field=\"id\" operator=\"%s\">%s</Criteria>" % (child_attribs['operator'], child.text)
				# if
			# for
			if api_params != '':
				return "<ServiceRequest><filters>" + api_params + "</filters></ServiceRequest>"
			else:
				return ''
		else:
			return ''
	# end of get_api_parameters

	@property
	def api_end_point(self):
		return "/qps/rest/3.0/search/was/webapp"
	# end of api_end_point

	def getIds(self):
		return self.ids
	# end of getIds

	def run(self):
		super(webAppIdFetcher, self).run()
		# self.appIdQueue.put(self.getIdParams())
	# end of run

	def getIdParams(self, idList=None):
		if idList is not None:
			ids = idList
		else:
			ids = self.ids

		id_min = min(ids) - 1
		id_max = max(ids) + 1

		params = "<ServiceRequest>"
		params += "<preferences><verbose>true</verbose></preferences>"
		params += "<filters>"
		params += ("<Criteria field=\"id\" operator=\"GREATER\">%s</Criteria>") % id_min
		params += ("<Criteria field=\"id\" operator=\"LESSER\">%s</Criteria>") % id_max
		params += "</filters>"
		params += "</ServiceRequest>"

		return params
	# end of getIdParams

	def _process_root_element(self, elem):
		if elem.tag == self.ROOT_TAG:
			for id_elem in list(elem):
				if id_elem.tag == self.ID_TAG:
					#qlogger.debug("Processed id %s" % id_elem.text)
					# qualysModule.splunkpopulator.utils.printStreamEventXML("_internal", "Processed id %s" % id_elem.text )
					self.ids.append(id_elem.text)
					# self.appIdQueue.put(id_elem.text)
		else:
			pass
		#end if
	#end _process_root_element
# end of class webAppIdFetcher
