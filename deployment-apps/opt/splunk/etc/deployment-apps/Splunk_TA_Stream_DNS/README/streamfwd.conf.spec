[streamfwd]
* This is currently the only supported stanza for this spec file.
* All streamfwd.conf settings are incorporated under this single stanza.

clientIpSslHashBytes = <integer>
* Defines number of client IP octets to use for SSL processor thread hash algorithm. (min value = 0; max value = 4)
* Applies only if you have _disabled_ useGlobalSSLSessionKeyCache

duplicatePacketWindow = <integer>
* Defines number of packets cached in memory (using a rolling window) to detect duplicate packets.
* Set this to a value greater than zero to enable automatic deduplication of network packets.

hideCreditCardNumbers = <boolean>
* Masks credit card numbers. Set to false to show all credit card numbers.

mapSslServers = <boolean>
* Set to false to disable automatic caching of SSL server certificates to corresponding servers's IP addresses.

maxEventQueueSize = <integer>
* Defines maximum number of events queued for delivery to Splunk.

maxFilesSizeToExtract = <integer>
* Defines maximum total size in bytes of content or attachment files extracted. Default value is set to 104857600 Bytes(100 MB)

maxFieldSize = <bytes>
* Defines maximum size of content field.

maxPacketQueueSize = <integer>
* Defines maximum size for each processing thread's packet queue.

maxTcpReassemblyPacketCount = <integer>
* Defines maximum number of TCP packets in reassembly queue per processing thread.

maxTcpSessionCount = <integer>
* Defines maximum number of concurrent TCP/UDP flows per processing thread.

maxFlows = <integer>
* Defines maximum number of concurrent flows per prcessing thread.

pcapBufferSize = <bytes>
* Defines buffer size for each network device. Increase the number of bytes if you see dropped packets.

pingInterval = <seconds>
* Modifies the ping server interval.

processingThreads = <integer>
* Defines number of threads to use for processing network traffic.

sessionKeyTimeout = <seconds>
* Indicates idle time before SSL session keys expire.

tcpConnectionTimeout = <seconds>
* Indicates idle time before TCP/UDP flows expire.

tcpFlowTimeout = <seconds>
* Indicates idle time before TCP flows expire.

udpFlowTimeout = <seconds>
* Indicates idle time before UDP flows expire.

arpFlowTimeout = <seconds>
* Indicates idle time before ARP flows expire.

ipFlowTimeout = <seconds>
* Indicates idle time before IP flows expire.

useGlobalSSLSessionKeyCache = <boolean>
* Enables sharing of SSL cache across processing threads. Set to true to share.

usePacketMemoryPool = <boolean>
* When set to true, Stream Forwarder uses a pool allocator to allot memory for storing network packets.
* Because the pool allocator does not release unused memory back to the operating system, setting this parameter to true may result in high memory usage.
* Set to true only when Splunk App for Stream is running on a dedicated capture server that processes large traffic volumes.

configTemplateName = <value>
* Indicates the product template to use. <value> is the valid name of an installed product template (e.g. es, itsi).

indexer.<N>.uri = <value>
* When Stream Forwarder is run in Independent Agent mode with product template configuration, use this parameter to specify the location of Splunk indexers where you want to send Stream Forwarder 
* generated events. <value> is a valid URI pointing to a Splunk indexer.

analyzeRawSSL = <value>

creditCardNumbersMask = <value>

creditCardNumbersRegex = <value>

httpEventCollectorToken = <value>
* HTTP Event Collector token value

httpEventCollectorChannelID = <value>
* HTTP Event Collector Channel ID parameter. When HTTP Event Collector Indexer Acknowledgement is enabled, use this parameter to specify the channel ID for Stream events sent by this Stream Forwarder

ipAddr = <value>

logConfig = <value>

maxEventAttributes = <value>

packetBatchSize = <value>

port = <value>

sslKey = <value>

fileServerMountPoint = <value>
* Mount point of a file server to save packets into PCAP files for targeted packet capture. This setting is also used for saving files that have been extracted while being transferred over the network.
* If this value is left blank, then the files will not be saved.

fileServerId = <value>
* File server id is used to uniquely identify the file server.
* This value needs to match the file server id set in the search head configuration. 
* If this value does not match with the value set in search head configuration, then the user will not be able to download the file using event flow action. 

maxFlowPacketsToCache = <integer>
* Maximum number of packets per flow to be cached and saved into PCAP files for targeted packet capture. 
* If the packet cache reaches this limit, then the earlier packets will be discarded to maintain this cache limit. This setting helps in managing the memory usage for targeted packet capture. 
* Higher value of this setting, will result in more memory usage.
* Default is 50.

packetSenderQueueSize = <integer>
* Defines number of files to be saved to the file server. If this queue gets full, then overflow of files will be discarded until there is space available to add a new file.
* Slow throughput to the file server could result in this queue getting full quickly.
* Default is 100000.


##############################################################################################################################
# streamfwdcapture
#
# By default, streamfwd listens for traffic on all available network interfaces.
# Using the streamfwdcapture parameter you can restrict data capture to specific interfaces only.
##############################################################################################################################

streamfwdcapture.<N>.bitsPerSecond = <integer>
* Only applies if offline is true.
* Rate limiter: if undefined, defaults to 10 Mbps if <Repeat> is true, else 100 Mbps.

streamfwdcapture.<N>.filter = <BPF>
* Lets you set a BPF (Berkeley Packet Filter) for kernel-level packet filtering. The value of this tag must comply with BPF syntax.
* Only one filter variable per streamfwdcapture parameter is supported.

streamfwdcapture.<N>.interface = <string>
* Specifies a network interface name or a path to a pcap file or a directory of pcap files.

streamfwdcapture.<N>.interfaceRegex = <regex>
* A regular expression specifying which network interfaces to capture.

streamfwdcapture.<N>.offline = <boolean>
* True means use pcap files: interface must be a pcap file or a directory to monitor for pcap files.
* False means interface is a network device name.
* Default is false.

streamfwdcapture.<N>.repeat = <boolean>
* Only applies if interface is a pcap file.
* True means to play back the pcap file repeatedly for continuous load.

streamfwdcapture.<N>.afterIngest = delete | move [<subdir>] | ignore | repeat | stop
* Only applies if interface is a directory.
* Specifies action to take after ingesting a pcap file from the directory.
* delete: Delete the file.
* move [<subdir>]: Move the file to a subdirectory (which will be created if needed).  Default is finished_pcaps.
* ignore: Leave the file but mark it as already processed.
* repeat: Continue to re-ingest all pcap files in rotation.
* stop: Leave the file.  After processing each directory once, stop monitoring.
* Default is move.

streamfwdcapture.<N>.sysTime = <boolean>
* Only applies if offline is true.
* True means to use the system time for packet timestamps instead of actual timestamps from pcap file.  Default is false.

streamfwdcapture.<N>.munge = <boolean>

##############################################################################################################################
# tcpServer
#
# Stream forwarder automatically detects the client and server endpoints when it captures the beginnings of TCP connections.
# If it starts capturing traffic after establishing a TCP connection, Stream forwarder normally assumes that the sender of the
# first packet it sees is the client.
# You can modify this behavior by using the tcpServer parameter to define the endpoints of specific TCP servers.
# If the sender of a packet matches the endpoint, Stream forwarder correctly categorizes it as a server response packet.
##############################################################################################################################

tcpServer.<N>.address = <ip address>

tcpServer.<N>.addressWildCard = <address mask>

tcpServer.<N>.port = <integer>

##############################################################################################################################
# sslServer
#
# Stream forwarder detects endpoint encryption, and attempts to decrypt SSL sessions using the available private keys.
# Optionally, you can explicitly define the traffic as encrypted by adding sslServer parameters.
##############################################################################################################################

sslServer.<N>.address = <ip address>

sslServer.<N>.port = <integer>

##############################################################################################################################
# netflowReceiver
#
# By default, streamfwd listens for traffic on all available network interfaces.
# Using the netflowReceiver parameter streamfwd can receive flow data (netflow/sflow) from network devices.
##############################################################################################################################

netflowReceiver.<N>.ip = <ip address>
* IP address to bind to. Default uses first available ip

netflowReceiver.<N>.port = <integer>
* Port number to listen for flow data.

netflowReceiver.<N>.decoder = <flow decoder>
* Flow protocol to listen for. Valid values are netflow and sflow

netflowReceiver.<N>.filter = <ip address>
* Comma separated list of ip addresses that are allowed to send flow data to this streamfwd instance. Default allows for all ip's to send data

netflowReceiver.<N>.decodingThreads = <integer>
* Number of decoding threads for netflow protocol decoding.

netflowReceiver.<N>.templateExpiry = <integer>
* Time duration in seconds after which netflow templates are considered stale and deleted. Default value is 1 hour(3600).

##############################################################################################################################
#netflowElement
#
# Allows for adding enterprise specific flow elements. This maps enterprise element id to stream forwarder vocabulary term.
# Make sure to add the termid to steamfwd vocabulary in vocabulary.xml file
##############################################################################################################################

netflowElement.<N>.enterpriseid = <integer>
* IANA defined enterprise ID e.g. 25461 for Palo Alto Networks as defined here http://www.iana.org/assignments/enterprise-numbers/enterprise-numbers

netflowElement.<N>.id = <integer>
* ID of Enterprise element e.g. 100

netflowElement.<N>.termid = <vocabulary term>
* streamfwd vocabulary term the above element id maps to e.g. netflow-paloalto.user-id.

netflowElement.<N>.termtype = <ipaddress, macaddress>
* streamfwd vocabulary term type 
