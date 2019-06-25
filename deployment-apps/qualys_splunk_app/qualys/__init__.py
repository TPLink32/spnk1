from __future__ import print_function

# -*- coding: utf-8 -*-
__author__ = "Bharat Patel <bharrat@gmail.com>"
__copyright__ = "Copyright (C) 2014, Bharat Patel"
__license__ = "New BSD"
__version__ = "1.0"
__APP_NAME = 'Qualys Splunk Populator'

import sys
import os
from datetime import datetime


start_time = datetime.now()

import logging
# create logger
qlogger = logging.getLogger('QualysSplunkPopulator')

debug = False


def enableDebug(on):
    global debug
    debug = on


formatter = logging.Formatter(
    'QualysSplunkPopulator: %(asctime)s PID=%(process)s [%(threadName)s] %(levelname)s: %(name)s - %(message)s', "%Y-%m-%dT%H:%M:%SZ")

# create console handler and set level to debug
#ch = logging.FileHandler('%s/qualys_%s.log' % (temp_directory, start_time.strftime('%Y-%m-%d')))
#ch.setLevel(logging.DEBUG)
#ch.setFormatter(formatter)
# qlogger.addHandler(ch)

def enableLogger():
    global debug, qlogger
    if debug:
        qlogger.setLevel(logging.DEBUG)
    else:
        qlogger.setLevel(logging.INFO)
    debug_log_handler = logging.StreamHandler(sys.stdout)
    debug_log_handler.setFormatter(formatter)
    qlogger.addHandler(debug_log_handler)


APP_ROOT = os.path.abspath(os.path.dirname(sys.argv[0]) + '/')
config_file = APP_ROOT + '/config/.qsprc'
temp_directory = APP_ROOT + '/tmp'
log_output_directory = ''
