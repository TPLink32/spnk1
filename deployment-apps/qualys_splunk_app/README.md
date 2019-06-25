# README #

Document to get your QualysGuard for Splunk integration up and running.

### About QualysGuard for Splunk ###

QualysGuard for Splunk enables customers to programmatically index, to search, and to visualize Qualys vulnerability data in Splunk.

Features:

* Splunk Searches

    * Splunk searches on Qualys Knowledgebase data


    ![qid_info_search.png](https://bitbucket.org/repo/pgMK7p/images/3821895851-qid_info_search.png)

    

    * Splunk searches on Qualys Detection (Vulnerabilities) data 

    ![detections_search.png](https://bitbucket.org/repo/pgMK7p/images/229346370-detections_search.png)
    

* Dashboards

    * Qualys Knowledgebase
    ![Knowledgebase   Splunk.png](https://bitbucket.org/repo/pgMK7p/images/2754331492-Knowledgebase%20%20%20Splunk.png)

    * Vulnerability Dashboard (with OS Distribution, Scan Volume charts and more)
    ![Dashboard   Splunk.png](https://bitbucket.org/repo/pgMK7p/images/2816038403-Dashboard%20%20%20Splunk.png)

    * Hosts View
    ![Hosts   Splunk.png](https://bitbucket.org/repo/pgMK7p/images/1299371572-Hosts%20%20%20Splunk.png)

* Sample Reports agains Qualys Detection data

    * List of Hosts ordered by Days since last scan
     ![Days since Last scan   Splunk.png](https://bitbucket.org/repo/pgMK7p/images/1869915427-Days%20since%20Last%20scan%20%20%20Splunk.png)

    * Most Vulnerable Hosts
    ![Most Vulnerable Hosts   Splunk.png](https://bitbucket.org/repo/pgMK7p/images/1537865493-Most%20Vulnerable%20Hosts%20%20%20Splunk.png)

    * List of Hosts grouped by Vulnerability
    ![Hosts by Vulnerability   Splunk.png](https://bitbucket.org/repo/pgMK7p/images/2306015428-Hosts%20by%20Vulnerability%20%20%20Splunk.png)

    * List of Vulnerabilities group by Host
    ![Vulnerabilities by Host   Splunk.png](https://bitbucket.org/repo/pgMK7p/images/3791593549-Vulnerabilities%20by%20Host%20%20%20Splunk.png)

    

* QID parser plugin: normalize Qualys QIDs by parsing results section. Includes samples parser plugins:
    * TCP ports from QID 82023
    * UDP ports from QID 82004
    * Scan duration from QID 45038
    * Reboot pending analysis from QID 90126

# Getting started

Qualys for Splunk needs a QualysGuard username with the following rights:

1. API access
2. Must be able to reach the QualysGuard API server. Check that your IP address is not in the list of secure IPs. Manager must include this IP (QualysGuard VM > Users > Security).

## Installation

The Qualys for Splunk app needs to be installed.

1. Extract the qualys-splunk-app.tar tar ball.
2. Go to Splunk interface
3. Login as admin
4. Apps dropdown (top header on left)
5. Manage Apps
6. Install app from file
7. In "Upload an app" window, click "Choose File" button
8. Click "Upload" button.

## Initial configuration

Qualys for Splunk needs to be configured with this QualysGuard username:

1. Apps
2. Manage Apps
3. In Qualys Vulnerability Data, qualys_splunk_app row, click on Set up

![s2.png](https://bitbucket.org/repo/pgMK7p/images/2148468522-s2.png)

4. Fill in username, password, and QualysGuard API Server

## Schedule configuration

Default cron schedule is for every day at 6 AM to pull Knowledge base and every sunday morning to pull Detection data.

To run the scripts now:

1. Go to Splunk interface.
2. Login as admin.
3. In top header on the right, go to "Data Input".
4. Click on "Scripts".
5. Change schedule to your desired frequency. For example, a value of 300 (seconds) will run every 5 minutes.
6. Click the "Save" button.
7. This save will immediately trigger the execution of the script. If desired, you can change the schedule back to original frequency.

## QID Parser Plugin configuration

The QID Parser Plugin enables native Splunk data modeling against Qualys QIDs. The configuration file location is below:

    qualys_splunk_app/qualys/splunkpopulator/qid_plugins/qid_parsers.py

A few sample QID Parsers have been included.

# Troubleshoot

QualysGuard for Splunk logs get populated in Splunk's "_internal" index. 

Try this search query in Splunk:

    index=_internal sourcetype=splunkd "qualys_kb_logger.sh"
### Contribution guidelines ###

* Writing tests
* Code review
* Other guidelines

### Who do I talk to? ###

To build installable App file run this command
tar -czvf qualys_splunk_app.tar.gz -X qualys_splunk_app/.exclude_file_list qualys_splunk_app