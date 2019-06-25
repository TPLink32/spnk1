#!/bin/sh
BIN_PATH=`dirname $0`
$SPLUNK_HOME/bin/splunk cmd python $BIN_PATH/../qualys_splunk_detection_populator.py
