# Copyright (C) 2013 Cisco Systems Inc.
# All rights reserved
import sys,os,csv,getopt
import json
import re
from datetime import datetime
import logging

logger = logging.getLogger()
logger.addHandler(logging.StreamHandler())
logger.setLevel("ERROR")

try:
    utils_path = os.path.join(os.path.dirname(os.path.realpath(__file__)),'utils')

    sys.path.extend([utils_path])

    from nxapi_utils import NXAPITransport
except Exception as e:
    logger.error("Nexus Error: Error importing the required module: %s",str(e))
    raise

""" global variables """
cmdFile=''
command=''
dev_ip=''
inputcsv=''
device=''
credential_file = os.path.join(os.path.dirname(os.path.realpath(__file__)),"credentials.csv")

""" Display data in JSON format"""
def _display_data(device,component,jsonElement):
    json_row = json.dumps(jsonElement,ensure_ascii=False)
    row_string = json.loads(json_row)
    if type(row_string) is dict:
        for key,value in row_string.items():
            if value != None and type(value) == unicode:
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                    row_string[key] = value
    currentTime= datetime.now().strftime('%Y-%m-%d %H:%M:%S%z')
    response = {"timestamp":currentTime,"component":component,"device":device,"Row_info":row_string}
    print json.dumps(response,ensure_ascii=False)
    logger.info("Successfully executed %s cli on switch %s",command,device)
    return 1

""" Split JSON response"""
def _split_json(device,component,jsonData,tableName,rowName):
    if tableName in jsonData:
        single_row = jsonData[tableName][rowName]
        if type(single_row) is list:
            for element in single_row:
                _display_data(device,component,element)
        elif type(single_row) is dict:
            _display_data(device,component,single_row)
    return 1

""" execute CLI"""
def  _execute_command(command,device,component='N/A'):
    try:
        cmd_out= NXAPITransport.clid(command)
    except Exception as e:
        logger.error("Nexus Error: Not able to Execute command through NXAPI: %s",str(e))
        raise
    cmd_json=json.loads(cmd_out)
    if cmd_json !=  None:
        dataKeys=cmd_json.keys()
        rowKeyVal = [] 
        for i in range(len(dataKeys)):
            if not "TABLE" in dataKeys[i]:
                check_type = cmd_json[dataKeys[i]] 
                if type(check_type) is unicode:
                    value=cmd_json[dataKeys[i]]
                    key_value = {dataKeys[i]:value}
                    rowKeyVal.append(key_value)
                if type(check_type) is dict:
                    internal_single_row = cmd_json[dataKeys[i]]#single_row  has inside raw data in k:v pair
                    internalDataKeys = internal_single_row.keys()
                    internalTableNames=[]
                    internalRowNames=[]
            
                    for table in internalDataKeys:
                        if not "TABLE" in table:
                            internal_value = internal_single_row[table]
                            if type(internal_value) is unicode:
                                currentTime= datetime.now().strftime('%Y-%m-%d %H:%M:%S%z')
                                internal_key_value = {table:internal_value}
                                response = {"timestamp":currentTime,"component":component,"device":device,"Row_info":internal_key_value}
                                print json.dumps(response,ensure_ascii=False)
                                logger.info("Successfully executed %s cli on switch %s",command,device)
                            if type(internal_value) is dict:
                                currentTime= datetime.now().strftime('%Y-%m-%d %H:%M:%S%z')
                                response = {"timestamp":currentTime,"component":component,"device":device,"Row_info":internal_single_row[table]}
                                print json.dumps(response,ensure_ascii=False)
                                logger.info("Successfully executed %s cli on switch %s",command,device)
                     
                        if "TABLE" in table:
                            internalTableNames.append(table)
                            row=table.replace("TABLE","ROW")
                            internalRowNames.append(row)
                    for i in range(len(internalTableNames)):
                        _split_json(device,component,internal_single_row,internalTableNames[i],internalRowNames[i])  
        
        if rowKeyVal:          
            _display_data(device,component,rowKeyVal) 
        tableNames=[]
        rowNames=[]
        for table in dataKeys:
            if "TABLE" in table:
                tableNames.append(table)
                row=table.replace("TABLE","ROW")
                rowNames.append(row)
  
        for i in range(len(tableNames)):
            _split_json(device,component,cmd_json,tableNames[i],rowNames[i]) 
    
    
""" prepare execution """         
def _prepare_and_execute(file_name):
    global command,cmdFile
    filename = file_name
    if _file_exist_with_valid_type(filename,".csv"):
        try:
            with open(filename, 'rb') as f:
                reader = csv.reader(f, delimiter='\t')
                for row in reader:
                    device  = row[0]
                    username = row[1]
                    password = row[2]
        
                    target_url = "https://"+str(device)+"/ins"
                    try:
                        NXAPITransport.init(target_url=target_url, username=username, password=password, timeout=50000)
                    except Exception as e:
                        logger.error("Nexus Error: Not able to connect to NXAPI: %s",str(e))
                        raise 
                    if cmdFile:
                        cmdFile = os.path.join(os.path.dirname(os.path.realpath(__file__)),cmdFile)
                        file = open(cmdFile, 'r')
                        cmdList = file.readlines()
                        for cmdIn in cmdList:
                            cmdIn=cmdIn.strip()
                            (cmdIn,component)=cmdIn.split(',')
                            cmdIn=cmdIn.strip()
                            _execute_command(command=cmdIn,device=device,component=component)
                    elif command:
                        _execute_command(command=command,device=device) 
        except Exception as err:
            logger.error("Nexus Error: Not able to execute command: %s ",str(err))
            raise
        

""" main method """    
def main(argv):
    length_of_argv = len(argv)
    if _validate_argumnets(argv):
        _parse_command_line_arguments(argv,length_of_argv)
        _execute(argv,length_of_argv)
        
""" Validate command line arguments """
def _validate_argumnets(argv):
    for a in argv:
        if not a:
            logger.error("Nexus Error: Empty argument found. Please provide appropriate command line arguments.")
            return False
    return True

""" Parse command line arguments"""
def _parse_command_line_arguments(argv,length_of_argv):
    global cmdFile,command,dev_ip,inputcsv
    if length_of_argv > 1:
        try:
            if length_of_argv == 2:
                if argv[0] == "-inputFile":
                    cmdFile = argv[1]
                elif argv[0] == "-cmd":
                    command = argv[1]
            elif length_of_argv > 2:
                if argv[0] == "-cmd":
                    command = argv[1]
                if argv[2] == "-device":
                    dev_ip = argv[3]
                elif argv[2] == "-inputcsv":
                    inputcsv = argv[3]
        except Exception as e:
            logger.error("Nexus Error: Please enter valid arguments. %s",str(e))
            raise
    else:
        logger.error("Nexus Error: Unrecognized command line arguments")
        sys.exit()

""" Validate file exist and verify file type
    Two File types are allowed 1).txt 2).csv
"""
def _file_exist_with_valid_type(filename,filetype):
    try:
        filename = os.path.join(os.path.dirname(os.path.realpath(__file__)),filename)
        extension = os.path.splitext(filename)[1]
        if extension == filetype:
            return True
        else:
            raise Exception
    except Exception, err:
        logger.error("Nexus Error: Either %s file not found or not having valid type.Please read the README.md file : %s", filename,str(err))
        raise
    
""" execute method has following user input category:
    a) devices b) inputcsv c) cmdFile d) command
"""
def _execute(argv,length_of_argv):
    global dev_ip,credential_file,command,device,inputcsv,cmdFile
    if length_of_argv > 2:
        """ Will execute if user input is device(s)"""
        if dev_ip:
            div_ip_arr = dev_ip.split(",")
            if _file_exist_with_valid_type(credential_file,".csv"):
             
                with open(credential_file, 'rb') as f:
                    reader = csv.reader(f, delimiter='\t')
                    for row in reader:
                        for ip in div_ip_arr:
                            if ip == row[0]:
                                username = row[1]
                                password = row[2]
                                target_url = "http://"+str(ip)+"/ins"
                                try:
                                    NXAPITransport.init(target_url=target_url, username=username, password=password, timeout=50000)
                                except Exception as e:
                                    logger.error("Not able to connect to NXAPI: %s",str(e))
                                    raise
                                _execute_command(command=command,device=ip)
                
        # Will execute if user input is inputcsv(s) 
        elif inputcsv:
            inputcsv_arr = inputcsv.split(",")
            for file in inputcsv_arr:
                _prepare_and_execute(os.path.join(sys.path[0],file))
    else:
        """ this else block will use default credentials.csv file """
        """ Will execute if user input is cmdFile  """ 
        """ Will execute if user input is command """
        _prepare_and_execute(credential_file)
        
         
            
if __name__ == "__main__":
   main(sys.argv[1:])
