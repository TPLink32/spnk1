#########################
### v2.4
##


import xml.etree.ElementTree as ET
import urllib2,os,sys,base64,csv,time
import splunk.clilib.cli_common

import splunk.auth as auth
import authSession
import re
from StringIO import StringIO
import gzip

class splunkSNOW:
    snow = []
    snow_keys = []
    latest = time.strptime("2000-01-01 00:00:00","%Y-%m-%d %H:%M:%S")
    exist = {}
    updated = 0
    added = 0
    mode = 'csv'
    user=""
    password=""

    def __init__(self,obj):
	self.object = obj
	self.settings = splunk.clilib.cli_common.getConfStanza("snow", "default")
	self.oset = splunk.clilib.cli_common.getConfStanza("snow", self.object)

	if self.oset['lookup'] == 'stream':
	    self.mode = 'stream'


    def load(self):
	if self.mode == 'stream':
	    try:
		script_dir = os.path.dirname(__file__) #<-- absolute dir the script is in
                SPLUNK_HOME = os.environ['SPLUNK_HOME']
		pos_file= "{0}.pos".format(self.object)
                abs_file_path = os.path.join(SPLUNK_HOME, 'etc', 'apps', 'snow', 'local', pos_file)
		f = open(abs_file_path, 'r' )
		d = csv.DictReader(f, quoting=csv.QUOTE_ALL)

		for row in d:
		    if row['object'] == self.object:
			self.latest = time.strptime(row['latest'], "%Y-%m-%d %H:%M:%S")

		for row in d:
		    if row['object'] == self.object:
			self.latest = time.strptime(row['latest'], "%Y-%m-%d %H:%M:%S")

	    except IOError, err:
		sys.stderr.write('%s - ERROR - Position File may not exist %s\n' % (time.strftime("%Y-%m-%d %H:%M:%S"), str(err)))
		pass

	else:
            SPLUNK_HOME = os.environ['SPLUNK_HOME']
            csvfile = os.path.join(SPLUNK_HOME, 'etc', 'apps', 'snow', 'lookups', self.oset['lookup'])
	    #csvfile = os.path.join(sys.path[0], "..", "..", "lookups", self.oset['lookup'])

	    try:
		f = open(csvfile, 'r+')
		d = csv.DictReader(f, quoting=csv.QUOTE_ALL)

		for row in d:
		    chktime = time.strptime(row[self.oset['timefield']], "%Y-%m-%d %H:%M:%S")

		    if chktime > self.latest:
			self.latest = chktime

		    self.snow.append(row)

		    self.exist[row[self.oset['keyfield']]] = len(self.snow) - 1

		self.snow_keys = d.fieldnames
		f.close()
	    except IOError, err:
		sys.stderr.write('%s - ERROR - Position File may not exist %s\n' % (time.strftime("%Y-%m-%d %H:%M:%S"), str(err)))
		pass

    def connect(self, e):
	#if self.mode != 'stream':
	    #print "SNOW: Object=%s state=initiated offset=%s " % (self.object, time.strftime("%Y-%m-%d %H:%M:%S",self.latest) )

        url =""
        #if url does not include fwd slash at the end, then add it
        if (re.search(r'http.://.*[a-zA-Z]+/', self.settings['url'])):
            url = self.settings['url']
        elif (re.search(r'http.://.*\w+', self.settings['url'])):
            url = self.settings['url'] + '/'
        else:
            sys.exit(1)
        
	endpoint = url + self.oset['endpoint']+"?XML"
        if (e==1):
            query = "&sysparm_query="+self.oset['timefield']+">"+time.strftime("%Y-%m-%d+%H:%M:%S",self.latest)
        elif (e==2):
            query = "&sysparm_query="+self.oset['timefield']+"="+time.strftime("%Y-%m-%d+%H:%M:%S",self.latest)

	orderby = "^ORDERBY"+self.oset['timefield']
        limit = "&sysparm_record_count="+self.oset['limit']
        if (e==1):
            uri = endpoint + query + orderby + limit
        elif(e==2):
            uri = endpoint + query + orderby
	#print "uri=" + uri


	#get the username from snow.conf
        snow = splunk.clilib.cli_common.getConfStanza("snow", "default")

        if (e==1):
            # get the session from splunkd
            sk = sys.stdin.readline().strip()
            sessionKey = re.sub(r'sessionKey=', "", sk)

            #get the username and password from apps.conf
            self.user, self.password = authSession.getCredentials(sessionKey)

        ## Proxy configuration
        proxy_url = self.settings['proxy_url']
        if proxy_url != "":
            proxyHandler = urllib2.ProxyHandler({'https': proxy_url})
            proxyOpener = urllib2.build_opener(proxyHandler)
            urllib2.install_opener(proxyOpener)

        self.req = urllib2.Request(uri)

        #base64string = base64.encodestring( '%s:%s' % user, password)[:-1]
        base64string = base64.urlsafe_b64encode('%s:%s' % (self.user, self.password))

	authheader =  "Basic %s" % base64string
	self.req.add_header("Authorization", authheader)

	#add compression
	self.req.add_header("Accept-Encoding", "gzip")

	try:
	    self.handle = urllib2.urlopen(self.req)
	except urllib2.HTTPError, err:
            print "if you have a proxy - check the proxy server and port are properly set"
	    sys.stderr.write('%s - ERROR - %s\n' % (time.strftime("%Y-%m-%d %H:%M:%S"), str(err)))

	except urllib2.URLError,  err:
            print "if you have a proxy - check the proxy server and port are properly set" + str(err)




    def retrieve(self):
	exclude = self.oset['exclude'].split(',')

	response_compressed = self.handle.read()
	buf = StringIO(response_compressed)
        f = gzip.GzipFile(fileobj=buf)
        response = f.read()

	try:
	    root = ET.fromstring(response)
	except:
	    raise

	for incident in root:
	    thisincident = {}

	    for child in incident:
		if child.tag in exclude:
		    continue

		thisincident[child.tag] = child.text

		if child.tag not in self.snow_keys:
		    self.snow_keys.append(child.tag)

	    chkkey = thisincident[self.oset['keyfield']]

	    if chkkey in self.exist:
		idx = self.exist[chkkey]
		if chkkey == self.snow[idx][self.oset['keyfield']]:
		    self.snow[idx] = thisincident
		    self.updated += 1
		else:
		    print "We matched a known key, but it wasn't at the expected index."
	    else:
		self.snow.append(thisincident)
		self.added += 1


    def write(self, attempt, totalRecords, numbRecords):
        p=1
        q= totalRecords + numbRecords
	if self.mode == 'stream':
            i=0
            count=1
            
	    for incident in self.snow:
		str = ''

		str += incident[self.oset['timefield']]+' '
		o = []

		chktime = time.strptime(incident[self.oset['timefield']], "%Y-%m-%d %H:%M:%S")
                #code added to get the count of records for the last second
		#print incident[self.oset['timefield']]
		if (i!=0):
                    previous_time=latest_time
		latest_time=incident[self.oset['timefield']]

		if (i!=0):
		    #print "time before printing " + previous_time + " " + latest_time
		    if (latest_time==previous_time):
			count=count+1
		    else:
                        count=1
		i=i+1
		
		if chktime > self.latest:
		    self.latest = chktime

		for k, v in incident.iteritems():
		    try:
			s = k+'="'+v+'"'
			o.append(s)
		    except:
			s = k+'=""'
			o.append(s)

                url =""
                #if url does not include fwd slash at the end, then add it
                if (re.search(r'http.://.*\w+/', self.settings['url'])):
                    url = self.settings['url']
                elif (re.search(r'http.://.*\w+', self.settings['url'])):
                    url = self.settings['url'] + '/'
                else:
                    sys.exit(1)

		#inject the endpoint at the beginning of the streem
                str = str + 'endpoint="' + url + '" ' + ','.join(o)

                if (attempt==2) & ((p<totalRecords)| (p>=q)):
                    print str
                #else:
                    #print "skipping record"
                p=p+1

	    script_dir = os.path.dirname(__file__) #<-- absolute dir the script is in
	    SPLUNK_HOME = os.environ['SPLUNK_HOME']
            pos_file= "{0}.pos".format(self.object)
            abs_file_path = os.path.join(SPLUNK_HOME, 'etc', 'apps', 'snow', 'local', pos_file)
            #rel_file_path = os.path.join( '..', '..', 'local', pos_file)
            t = open(abs_file_path, 'w+' )
	    d = csv.DictReader(t, quoting=csv.QUOTE_ALL)
	    o = []
	    k = ['object', 'latest']

	    ffu = False

	    for row in d:
		if row['object'] == self.object:
		    ffu = True
		    row['latest'] = time.strftime("%Y-%m-%d %H:%M:%S", self.latest)

		o.append(row)

	    if not ffu:
		g = {'object': self.object, 'latest': time.strftime("%Y-%m-%d %H:%M:%S",self.latest)}
		o.append(g)

	    r = csv.DictWriter(t, k, quoting=csv.QUOTE_ALL)
	    r.writeheader()
	    r.writerows(o)
	    t.close()
            return count, i

	else:
            SPLUNK_HOME = os.environ['SPLUNK_HOME']
            csvfile = os.path.join(SPLUNK_HOME, 'etc', 'apps', 'snow', 'lookups',  self.oset['lookup'])
	    tmpfile = os.path.join(SPLUNK_HOME, 'etc', 'apps', 'snow', 'lookups',  self.oset['lookup']+".tmp")

	    f = open(tmpfile, 'w+')
	    d = csv.DictWriter(f, self.snow_keys,quoting=csv.QUOTE_ALL)
	    d.writeheader()
	    d.writerows(self.snow)
	    f.close()

	    os.rename(tmpfile,csvfile)

	#if self.mode != 'stream':
	    #print "SNOW: Object=%s state=complete added=%s updated=%s" % (self.object, self.added, self.updated )

    def run(self):
	self.load()
	self.connect(1)
	self.retrieve()
	count = self.write(0)
	return count
	
if __name__ == "__main__":
    sn = splunkSNOW(sys.argv[1])
    sn.load()
    sn.connect(1)
    sn.retrieve()
    c, i = sn.write(1, 0, 0)
    if (i>0):
        sn.connect(2)
        sn.retrieve()
        t= sn.write(2, int(i), int(c))
