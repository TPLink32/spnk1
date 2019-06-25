import splunk.admin as admin
import sc_rest

class WindowsInputsHandler(sc_rest.BaseRestHandler):

    def __init__(self, *args, **kwargs):
        sc_rest.BaseRestHandler.__init__(self, *args, **kwargs)
        self.description = "Endpoint for Windows Inputs"

    def setup(self, *args):
        if self.requestedAction in [admin.ACTION_CREATE, admin.ACTION_EDIT]:
            self.supportedArgs.addReqArg('input')
    
    def handleCreate(self, confInfo):
        sc_rest.BaseRestHandler.handleCreate(self, confInfo)

    def handleEdit(self, confInfo):
        sc_rest.BaseRestHandler.handleEdit(self,confInfo)

    def handleCustom(self, confInfo):
        if self.customAction == 'desc':
            confInfo['desc'] = self.description
            return
        raise admin.NotFoundException("This endpoint does not support action: " + self.customAction)

class WindowsInputResource(sc_rest.BaseResource):
    endpoint = 'configs/conf-paletteinputs'
    optional_args = ['desc']
    required_args = ['input']

admin.init(sc_rest.ResourceHandler(WindowsInputResource, 
                                   handler = WindowsInputsHandler), 
           admin.CONTEXT_APP_ONLY)
