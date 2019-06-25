import splunk.admin as admin
import sc_rest

class WindowsPalettesHandler(sc_rest.BaseRestHandler):

    def __init__(self, *args, **kwargs):
        sc_rest.BaseRestHandler.__init__(self, *args, **kwargs)
        self.description = "Endpoint for Windows Palettes"

    def setup(self, *args):
        if self.requestedAction in [admin.ACTION_CREATE, admin.ACTION_EDIT]:
            self.supportedArgs.addReqArg('slug')
            self.supportedArgs.addReqArg('palette')

    def handleCreate(self, confInfo):
        sc_rest.BaseRestHandler.handleCreate(self, confInfo)

    def handleEdit(self, confInfo):
        sc_rest.BaseRestHandler.handleEdit(self,confInfo)

    def handleCustom(self, confInfo):
        if self.customAction == 'desc':
            confInfo['desc'] = self.description
            return
        raise admin.NotFoundException("This endpoint does not support action: " + self.customAction)

class WindowsPaletteResource(sc_rest.BaseResource):
    endpoint = 'configs/conf-palettepalettes'
    optional_args = ['desc']
    required_args = ['slug', 'palette']

admin.init(sc_rest.ResourceHandler(WindowsPaletteResource, 
                                   handler = WindowsPalettesHandler), 
           admin.CONTEXT_APP_AND_USER)
