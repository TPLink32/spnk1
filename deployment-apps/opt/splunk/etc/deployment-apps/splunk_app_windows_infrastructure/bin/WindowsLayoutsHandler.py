import WindowsBaseHandler.WindowsBaseHandler as wbh

class WindowsLayoutsHandler(wbh):

    def __init__(self):
        wbh.__init__(self)
        self.confObjectName = 'layouts'
        self.description = "Base layout handler for layouts"

    def handleCustom(self, confInfo):
        if self.customAction == 'desc':
            confInfo['desc'] = self.description
            return
        raise admin.NotFoundException("This endpoint does not support action: " + self.customAction)
        
