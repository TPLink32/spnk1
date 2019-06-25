## Table of Contents

### OVERVIEW

- About the TA-QualysCloudPlatform
- Support and resources

### INSTALLATION AND CONFIGURATION

- Hardware and software requirements
- Installation steps
- Deploy to single server instance
- Configure TA-QualysCloudPlatform

### USER GUIDE

- Data types
- Lookups

---
### OVERVIEW

#### About the TA-QualysCloudPlatform

| Author | Qualys, Inc. |
| --- | --- |
| App Version | 1.1.0 |
| Vendor Products | Qualys |
| Has index-time operations | true, this add-on must be placed on indexers |
| Create an index | false |
| Implements summarization | false |

The TA-QualysCloudPlatform allows a Splunk® Enterprise administrator to fetch the Vulnerability data from their Qualys subscription and index it. Administrator then can either analyze this data with other data sources using Splunk Enterprise Security App or use Qualys provided Apps for Splunk Enterprise to analyze Qualys specific data.

##### Scripts and binaries

This TA implements modular input. All the scripts reside in the bin directory.

#### Release notes

##### About this release

Version 1.1.0 of the TA-QualysCloudPlatform is compatible with:

| Splunk Enterprise versions | 6.1, 6.2, 6.3, 6.4, 6.5 |
| --- | --- |
| CIM version | 4.5 |
| Platforms | Linux |
| Vendor Products | Qualys |
| Lookup file changes | qualys_kb.csv contains knowledgebase, qualys_severity.csv contains numeric severity to verbal severity mapping |

##### New features

TA-QualysCloudPlatform includes the following new features:

- Use storage/passwords endpoint to store API credentials. This uses Splunk's own encryption and more safe than earlier versions.
- Ingest Information Gathered (IGs) events in Host Detection as well as WAS Findings. Now, IGs will come in by default. If you do not want them, you need to make use of extra parameters and set show_igs=0 explicitly.
- New run.py to debug this TA. For more details, go to TA directory and run: SPLUNK_HOME/bin/splunk cmd python ./bin/run.py -h
- More compatible to Splunk ES app: Adaptive Response custom action to apply given tag ids to high/critical severity web apps


##### Fixed issues

Version 1.1.0 of the TA-QualysCloudPlatform fixes the following issues:

- WAS Findings: while fetching WAS findings using multiple threads, the Web app IDs were getting mixed up among threads, leading to incorrect and incomplete data.
- To be more CIM compliant, added required extraction field which was missing earlier: 'vendor_product'.
- TA log location changed from /tmp to SPLUNK_HOME/var/log/splunk/ta_QualysCloudPlatform.log.
- Write important activities in above mentioned log.
- To make TA more ES compatible, severity mapping changed to following: 1 = informational, 2 = low, 3 = medium, 4 = high, 5 = critical.

##### Third-party software attributions

Version 1.1.0 of the TA-QualysCloudPlatform incorporates no third-party software or libraries.

##### Support and resources

**Support**

In case any assistance is needed, please visit https://www.qualys.com/forms/contact-support/


## INSTALLATION AND CONFIGURATION

#### Splunk Enterprise system requirements

Because this add-on runs on Splunk Enterprise, all of the [Splunk Enterprise system requirements](http://docs.splunk.com/Documentation/Splunk/latest/Installation/Systemrequirements) apply.

#### Download

Download the TA-QualysCloudPlatform from Splunkbase.

#### Installation steps

To install and configure this app on your supported platform, follow these steps:

1. Extract the downloaded zip tar ball.
2. Go to Splunk interface.
3. Login as admin.
4. Apps dropdown (top header on left) > Manage Apps.
5. Install app from file.
6. In "Upload an App" window, click "Choose File" button
7. Browse the tarball and click "Upload" button.


#### Configure TA-QualysCloudPlatform

TA-QualysCloudPlatform needs to be configured with Qualys credentials. The configuration is same as that of old Qualys App for Splunk Enterprise.

1. Go to Apps > Manage Apps.
2. Find TA-QualysCloudPlatform and click Set up.
3. Provide your Qualys username, password and API server in appropriate input boxes.
4. Make selection between different options provided.
5. Save.
6. Go to Settings > Data Inputs > TA-QualysCloudPlatform.
7. click New button.
8. Enter asked inputs, and click Next.
9. Again go to Settings > Data Inputs > TA-QualysCloudPlatform, and enable the input(s).

## USER GUIDE

### Data types

This app provides the index-time and search-time knowledge for the following types of data from Qualys:

** Host Detection **

This denotes a vulnerability detection on given host.

Sourcetype qualys:hostDetection is related to each such detection.

** WAS Finding **

This denotes a vulnerability detection in given web application. 

Sourcetype qualys:wasFindings is related to each such detection.


These data types support the following Common Information Model data models:

- Vulnerability

### Lookups

The TA-QualysCloudPlatform contains 2 lookup files.

** qualys_kb**

This lookup contains the Qualys Knowledgebase.

- File location: TA-QualysCloudPlatform/lookups/qualys_kb.csv
- Lookup fields: QID,SEVERITY,VULN_TYPE,PATCHABLE,PCI_FLAG,TITLE,CATEGORY,PUBLISHED_DATETIME,CVSS_BASE,CVSS_TEMPORAL,CVE,VENDOR_REFERENCE

** qualys_severity**

This lookup contains mapping between numeric and verbal severity values.

- File location: TA-QualysCloudPlatform/lookups/qualys_severity.csv
- Lookup fields: severity_id,vendor_severity,severity
