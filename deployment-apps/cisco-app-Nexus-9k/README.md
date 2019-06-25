# ABOUT THIS APP

The Cisco Nexus 9k App for Splunk Enterprise is used to Build dashboard on indexed data provided by "Cisco Nexus 9k Add-on for Splunk Enterprise" app.

# REQUIREMENTS

* Splunk version 6.2.0.


# Recommended System configuration

* Splunk search head system should have 8 GB of RAM and a quad-core CPU to run this app smoothly.

# Topology and Setting up Splunk Environment

* This app has been distributed in two parts.

  1) Add-on app, which runs collector scripts and gathers data from nexus 9k switches and also syslogs on udp port 514, does indexing on it and provides  data to Main app.
  2) Main app, which receives indexed data from Add-on app, runs searches on it and builds dashboard using indexed data.

* This App can be set up in two ways:
  1) **Standalone Mode**: Install  main app and Add-on app on a single machine.

     * Here both the app resides on a single machine.
     * Main app uses the data collected by Add-on app and builds dashboard on it

   2) **Distributed Environment**: Install main app and Add-on app on search head and only Add-on app on forwarder system. 
     
     * Here also both the apps resides on search head machine.
     * Only Add-on app required to be installed on forwarder system.
     * Execute the following command to forward the collected data to the search head.
       /opt/splunk/bin/splunk add forward-server <search_head_ip_address>:9997
     * On Seach head machine, enable the event listening on port 9997 (recommended by Splunk).
     * Main app on search head uses the received data and builds dashboard on it.

# Installation of App

* This app can be installed either through UI through "Manage Apps" or by extracting zip file into /opt/splunk/etc/apps folder.
* Restart Splunk

# TEST YOUR INSTALL

  After TA App is configured to receive data from nexus 9k switches, The main app dashboard can take some time before the data is populated in all panels. A good test to see that you are receiving all of the data is to run this search after several minutes:

    index="n9000" | stats count by sourcetype

In particular, you should see this sourcetype:
* cisco:nexus:json


If you don't see these sourcetypes, have a look at the messages output by the scripted input: Collect.py. Here is a sample search that will show them

  index=_internal component="ExecProcessor" collect.py "Nexus Error"| table _time host log_level message



# ABOUT THE DATA


Field names are case sensitive in the nexus 9k. Every event starts with the timestamp, and always contains device from which that particular event came.For simplification we can add one additional field in each event  named "component" and provide appropriate value to it so that we can easily segregate the data on the basis of its component name.

Below are two sample event records. First one gives system resource details in Json format and the other one gives accounting logs in key=value form as a raw data.

1)

{"device": "172.21.128.76", "timestamp": "2014-06-23 01:20:19", "Row_info": {"cpuid": "0", "kernel": "0.99", "idle": "99.00", "user": "0.00"}, "component": "nxresource"}
{"device": "172.21.128.76", "timestamp": "2014-06-23 01:20:19", "Row_info": {"cpuid": "1", "kernel": "0.00", "idle": "100.00", "user": "0.00"}, "component": "nxresource"}
{"device": "172.21.128.76", "timestamp": "2014-06-23 01:20:19", "Row_info": {"cpuid": "2", "kernel": "0.00", "idle": "100.00", "user": "0.00"}, "component": "nxresource"}
{"device": "172.21.128.76", "timestamp": "2014-06-23 01:20:19", "Row_info": {"cpuid": "3", "kernel": "0.00", "idle": "100.00", "user": "0.00"}, "component": "nxresource"}

2)

{"device": "172.21.128.12", "Row_info": {"hw": "0.1010", "sw": "6.1(2)I2(2a)", "modwwn": "1", "slottype": "LC1"}, "timestamp": "2015-01-01 09:05:08", "component": "nxinventory"}


# NX-API Collector(Custom Search Command Reports)

This app provides a generic NX-API collector which empowers users to make use of NX-API provided by Nexus 9k and periodically track certain data from 9k switch. It simply takes switch CLI and convert it into NX-API call and provide data which can be saved as a dashboard.

Every time the saved dashboard is clicked, splunk makes a call to switch using NX-API and fetch current data for that dashboard. Note that this data will not be saved in splunk database.

Please follow below given steps to generate custo command reports.

1) Go to search option and enter your search in search bar.
   You have different option for custom search command:

   * | nxapicollect command="your cli"
   * | nxapicollect command="your cli" device="172.21.128.12"
   * | nxapicollect command="your cli" device="172.21.128.12,172.21.128.15" (Make sure credentials for this devices are already provided through setup page)

2) Click on Save As and click on Dashboard Panel to store your result in dashboard.

3) Enter Dashboard Title. You have to give "report" keyword in giving dashboard title.

4) You can see your dashboard in Custom reports.(In menu bar)

