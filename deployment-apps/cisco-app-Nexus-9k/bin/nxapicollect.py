# Copyright (C) 2013 Cisco Systems Inc.
# All rights reserved

import platform,os,sys,subprocess, time, ConfigParser
import logging

logger = logging.getLogger()
logger.addHandler(logging.StreamHandler())
logger.setLevel("ERROR")
try:
    from splunklib.searchcommands import \
    dispatch, GeneratingCommand, Configuration, Option, validators
except Exception as e:
    logger.error("Error importing the required module: %s",str(e))
    raise

config = ConfigParser.ConfigParser()
detect_platform = platform.system().lower()
if detect_platform == "linux":
    nexus_app_path = sys.path[0]
    python_path = nexus_app_path+"/../../../../bin/"
else:
    nexus_app_path = sys.path[0]
    python_path = nexus_app_path+"\\..\\..\\..\\..\\bin"
os.chdir(python_path)
python_path = os.getcwd()+"/python"

@Configuration(local=True)
class nxapiCommand(GeneratingCommand):
    command = Option(require=True)
    device = Option(require=False)
    username = Option(require=False)
    password = Option(require=False)
    inputcsv=Option(require=False)
    def generate(self):
	file=os.path.join(nexus_app_path,"collect.py")
        if self.inputcsv:
             proc = subprocess.Popen([python_path,file,"-cmd",self.command,"-inputcsv",self.inputcsv], stdout=subprocess.PIPE)
        elif self.username:
            proc = subprocess.Popen([python_path,file,"-cmd",self.command,"-device",self.device,"-u",self.username,"-p",self.password], stdout=subprocess.PIPE)
        elif self.device:
	    proc = subprocess.Popen([python_path,file,"-cmd",self.command,"-device",self.device], stdout=subprocess.PIPE)
	else:
            proc = subprocess.Popen([python_path,file,"-cmd",self.command], stdout=subprocess.PIPE)
        outputlines = filter(lambda x:len(x)>0,(line.strip() for line in proc.stdout))
	
	for d in outputlines:
		yield {'_time': time.time(),'_raw': d }

		

dispatch(nxapiCommand, sys.argv, sys.stdin, sys.stdout, __name__)
