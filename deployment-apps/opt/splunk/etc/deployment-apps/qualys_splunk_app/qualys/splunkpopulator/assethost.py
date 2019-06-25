__author__ = 'mwirges'

from qualys.splunkpopulator.basepopulator import BasePopulator
from qualys.splunkpopulator.utils import IDSet
from qualys import qlogger

import Queue

"""
It would be nice to decouple the apiclient and result parser a bit more, but
we'll follow convention for now.
"""


class HostIdRetriever(BasePopulator):
    truncation_limit = 5

    OBJECT_TYPE = "ids"
    FILE_PREFIX = "host_ids"
    ROOT_TAG = 'ID_SET'

    def __init__(self):

        super(HostIdRetriever, self).__init__()
        self.truncation_limit = 1000

    # end __init__

    @property
    def get_api_parameters(self):
        return dict({"action": "list", "details": "None", "truncation_limit": self.truncation_limit}.items())

    #end get_api_parameters

    @property
    def api_end_point(self):
        return "/api/2.0/fo/asset/host/"

    #end api_end_point

    def get_idset(self):
        return self.idset

    def _process_root_element(self, elem):
        qlogger.debug("processing id set")
        ids = IDSet()
        if elem.tag == "ID_SET":
            for id in list(elem):
                if id.tag == 'ID' or id.tag == 'ID_RANGE':
                    ids.addString(id.text)
                else:
                    #do something about this maybe?
                    pass
                    #end if
                    #end for
        else:
            pass
        #end if

        self._handle_idset(ids)

    #end _process_root_element

    def _handle_idset(self, idset):
        qlogger.debug("Got Host IDs: %s" % (idset.tostring()))
