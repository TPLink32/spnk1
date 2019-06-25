import splunk.admin as admin

class WindowsBaseHandler(admin.MConfigHandler):

    def handleList(self, confInfo):
        panels = self.readConf(self.conffile)
        confInfo[self.confObjectName].update(panels)
        confInfo['demo']['foo'] = {'zoom': {'zip': 'nada'}}

    def handleCreate(self, confInfo):
        panelName = self.callerArgs.id
        panels = self.readConf(self.confObjectName).get(self.confObjectName, {})
        panels[panelName] = confInfo.data['d']
        self.writeConf(self.confObjectName, self.confObjectName, panels)

    def handleEdit(self, confInfo):
        panelName = self.callerArgs.id
        panels = self.readConf(self.confObjectName).get(self.confObjectName, {})
        panels[panelName] = confInfo.data['d']
        self.writeConf(self.confObjectName, self.confObjectName, panels)

    def handleRemove(self, confInfo):
        panelName = self.callerArgs.id
        panels = self.readConf(self.confObjectName).get(self.confObjectName, {})
        del panels[panelName]
        self.writeConf(self.confObjectName, self.confObjectName, panels)
    
    def handleCustom(self, confInfo):
        if self.customAction == 'desc':
            confInfo['desc'] = "Base handler for all classes.  This should have been overwritten with a higher-level handler."
            return
        raise admin.NotFoundException("This endpoint does not support action: " + self.customAction)
        
