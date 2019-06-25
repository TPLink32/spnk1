import splunk.admin as admin

class PanelHandler(admin.MConfigHandler):

    def handleList(self, confInfo):
        panels = self.readConf('panels')
        confInfo['panels'].update(panels)

    

        
