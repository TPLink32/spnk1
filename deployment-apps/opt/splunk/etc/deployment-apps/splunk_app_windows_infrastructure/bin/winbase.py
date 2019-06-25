import splunk.admin  as admin
import splunk.entity as entity
import logging

logger = logging.getLogger('splunk.palette')

class WindowsBaseHandler(admin.MConfigHandler):

    def setup(self, *args):
        pass

    def _namespace_and_owner(self):
        app  = self.context != admin.CONTEXT_NONE         and self.appName  or "-" 
        user = self.context == admin.CONTEXT_APP_AND_USER and self.userName or "nobody"
        return app, user

    def update(self, **params):
        app, user = self._namespace_and_owner()
        
        try:
            ent = entity.getEntity('/properties/' + self.confObjectName,
                                   self.callerArgs.id,
                                   namespace=app,
                                   owner=user,
                                   sessionKey=self.getSessionKey())
        except:
            ent = entity.Entity('/properties/' + self.confObjectName,
                                self.callerArgs.id,
                                namespace=app,
                                owner=user)
            
        for arg in params.keys():
            ent[arg] = params[arg] 
            
        logger.error("O3: /properties/" + self.confObjectName + '/' + self.callerArgs.id)
        logger.error("O3: " + str(arg) + "," + str(ent[arg]))
        entity.setEntity(ent, sessionKey=self.getSessionKey())

    def handleList(self, confInfo):
        panels = self.readConf('palette-' + self.confObjectName)
        confInfo[self.confObjectName].update(panels)

    def handleCreate(self, confInfo):
        self.update(panel = self.callerArgs.data['panel'][0])

    def handleEdit(self, confInfo):
        self.update(panel = self.callerArgs.data['panel'][0])

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
        
