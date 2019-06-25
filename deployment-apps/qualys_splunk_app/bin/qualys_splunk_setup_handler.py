import splunk.admin as admin
import splunk.entity as en

# import your required python modules

'''
Copyright (C) 2005 - 2010 Splunk Inc. All Rights Reserved.
Description:  This skeleton python script handles the parameters in the configuration page.

      handleList method: lists configurable parameters in the configuration page
      corresponds to handleractions = list in restmap.conf

      handleEdit method: controls the parameters and saves the values
      corresponds to handleractions = edit in restmap.conf

'''

class ConfigApp(admin.MConfigHandler):
  '''
  Set up supported arguments
  '''
  def setup(self):
    if self.requestedAction == admin.ACTION_EDIT:
      for arg in ['api_server', 'log_host_summary', 'log_detections', 'log_extra_host_summary',
                  'log_host_details_in_detections', 'detection_params', 'minimum_qid', 'proxy_server',
                  'proxy_user', 'proxy_password', 'use_proxy', 'use_multi_threading', 'num_threads', 'enable_debug']:
        self.supportedArgs.addOptArg(arg)

  '''
  Read the initial values of the parameters from the custom file
      myappsetup.conf, and write them to the setup screen.

  If the app has never been set up,
      uses .../<appname>/default/myappsetup.conf.

  If app has been set up, looks at
      .../local/myappsetup.conf first, then looks at
  .../default/myappsetup.conf only if there is no value for a field in
      .../local/myappsetup.conf

  For boolean fields, may need to switch the true/false setting.

  For text fields, if the conf file says None, set to the empty string.
  '''

  def handleList(self, confInfo):
    confDict = self.readConf("qualys")
    if None != confDict:
      for stanza, settings in confDict.items():
        for key, val in settings.items():
            if key in ['log_detections', 'use_proxy', 'enable_debug', 'use_multi_threading']:
                pass
            if key in ['api_server', 'detection_params', 'proxy_server', 'proxy_user', 'proxy_password'] and val in [None, '']:
                val = ''
            if key in ['minimum_qid'] and val in [None, '']:
                val = '0'
            if key in ['num_threads'] and val in [None, '']:
                val = '1'
            confInfo[stanza].append(key, val)

  '''
  After user clicks Save on setup screen, take updated parameters,
  normalize them, and save them somewhere
  '''
  def handleEdit(self, confInfo):
    name = self.callerArgs.id
    args = self.callerArgs
    #print name
    #print args
    if int(self.callerArgs.data['minimum_qid'][0]) < 0:
      self.callerArgs.data['minimum_qid'][0] = '0'

    if self.callerArgs.data['api_server'][0] in [None, '']:
      self.callerArgs.data['api_server'][0] = ''

    if self.callerArgs.data['detection_params'][0] in [None, '']:
      self.callerArgs.data['detection_params'][0] = ''

    if self.callerArgs.data['proxy_server'][0] in [None, '']:
        self.callerArgs.data['proxy_server'][0] = ''

    if self.callerArgs.data['proxy_user'][0] in [None, '']:
        self.callerArgs.data['proxy_user'][0] = ''

    if self.callerArgs.data['proxy_password'][0] in [None, '']:
        self.callerArgs.data['proxy_password'][0] = ''

    if self.callerArgs.data['num_threads'][0] in [None, '']:
        self.callerArgs.data['num_threads'][0] = '1'

    if int(self.callerArgs.data['num_threads'][0]) < 0 or int(self.callerArgs.data['num_threads'][0]) > 10:
        self.callerArgs.data['num_threads'][0] = '1'

    '''
    Since we are using a conf file to store parameters,
write them to the [setupentity] stanza
    in <appname>/local/myappsetup.conf
    '''

    self.writeConf('qualys', 'setupentity', self.callerArgs.data)

# initialize the handler
admin.init(ConfigApp, admin.CONTEXT_NONE)