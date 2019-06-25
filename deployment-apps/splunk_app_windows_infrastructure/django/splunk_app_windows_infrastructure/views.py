from django.contrib.auth.decorators import login_required
from splunkdj.decorators.render import render_to
from splunkdj.setup import config_required
from splunkdj.setup import set_configured
from splunkdj.setup import get_configured
from splunkdj.utility import create_derived_service, get_current_app_name
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect, HttpResponse
from .windowssetup import setup_windows
from splunklib.client import Entity, Collection, ConfigurationFile, Stanza, Service
from splunk.appserver.mrsparkle.lib.util import make_splunkhome_path
import sys
sys.path.append(make_splunkhome_path(['etc', 'apps', 'splunk_app_windows_infrastructure', 'bin']))
try:
    from ad_username import DomainAliasesFileHandler
except ImportError:
    pass


import urllib
import re
import json
import base64

BREAK_NAV = False
APP = 'splunk_app_windows_infrastructure'

@render_to(APP + ':app_setup.html')
@login_required
def setup(request):
	return {
		"app_label": "Splunk App for Windows Infrastructure"
	}

@render_to(APP + ':windows/app_setup.html')
@login_required
def windowssetup(request):
	return setup_windows(request)

@login_required
def unconfigure(request):
    service = request.service 
    set_configured(service, False)
    
    return HttpResponseRedirect(reverse('splunk_app_windows_infrastructure:home'))

@render_to(APP + ':home.html')
@login_required
def home(request):
    return {
        "app_name": "splunk_app_windows_infrastructure",
        "app_label": "Splunk App for Windows Infrastructure"
    }

@render_to()
@login_required
def render_page(request, tmpl="splunk_app_windows_infrastructure:home.html"):
	return {
		"TEMPLATE": "splunk_app_windows_infrastructure:%s.html" % tmpl,
		"app_label": "Splunk App for Windows Infrastructure"
	}             

@render_to()
@login_required
def windows(request, tmpl="splunk_app_windows_infrastructure:windows/home.html"):
	return {
		"TEMPLATE": "splunk_app_windows_infrastructure:windows/%s.html" % tmpl,
		"app_label": "Splunk App for Windows Infrastructure"
	}      


@render_to()
@login_required
def ad(request, tmpl="splunk_app_windows_infrastructure:ad/home.html"):
	return {
		"TEMPLATE": "splunk_app_windows_infrastructure:ad/%s.html" % tmpl,
		"app_label": "Splunk App for Windows Infrastructure"
	}      


import logging
import pprint
import datetime
logger = logging.getLogger("spl.django.service")
localize_url_re = re.compile('([^\/]+)$')

def add_local_link(palette):
	matches = localize_url_re.search(palette.links.edit)
	palette.l_url = matches.group(0)
	return palette

def palettelist(request):
	derived_service = create_derived_service(
		request.user.service,
		owner = request.user.service.username,
		app = 'splunk_app_windows_infrastructure')

	return ConfigurationFile(
		derived_service, 
		'configs/conf-palettepalettes',
		state = {'title': 'palettepalettes'})


def stock():
        return {
                "app_name": "splunk_app_windows_infrastructure",
                "app_label": "Splunk App for Windows Infrastructure"
        }

@render_to(APP + ':cfw_services.html')
@login_required
def cfw_services(request):
        return stock()

@render_to(APP + ':cfw_hosts.html')
@login_required
def cfw_hosts(request, palette):
        return stock()

@render_to(APP + ':palettes.html')
@login_required
def palettes(request):
        return stock()

# One palette: It has to retrieve the requested palette (if it
# exists), assemble all the relevant HTML, CSS, and JS controls--
# which may mean that it has to make multiple trips back to the well--
# then splatted out to the client.

@render_to(APP + ':palette.html')
@login_required
def palette(request, palette):
        return stock()
       
def read_license_status():
	# The license validator code in LicenseAlert.py writes to this file
	# LicenseStatus.json with license status periodically
	
	licenseStatusJson = {
		'status':'valid',
		'message':'None',
		'time-bomb_status_code':'500'
	    }
	
	try:
		with open (make_splunkhome_path([
			'etc',
			'apps',
			'splunk_app_windows_infrastructure',
			'bin',
			'LicenseStatus.json'
            		]), 'r') as licenseStatusFile:
			licenseStatusJson = json.load(licenseStatusFile)
			
		with open (make_splunkhome_path([
			'etc',
			'apps',
			'splunk_app_windows_infrastructure',
			'bin',
			'TimeBombStatus.json'
            		]), 'r') as timeBombStatusFile:
			timeBombStatusJson = json.load(timeBombStatusFile)
			licenseStatusJson['timebomb_status_code'] = timeBombStatusJson['status']
	except:
		pass
	return licenseStatusJson
       
@login_required
def get_license_status(request):
	return HttpResponse(json.dumps(read_license_status()), content_type='application/json')

@login_required
def post_lm_config(request):
	lmConfig = {
		'username':base64.b64encode(request.POST.get('username', None)),
        'password':base64.b64encode(request.POST.get('password', None))
        }
    
	status = 201
	try:
		with open (make_splunkhome_path([
			'etc',
			'apps',
			'splunk_app_windows_infrastructure',
			'bin',
			'LMConfig.json'
	        	]), 'w') as lmConfigFile:
			lmConfigFile.write(json.dumps(lmConfig))
	except:
		status = 500
		
	return HttpResponse(json.dumps({'status':status}), content_type='application/json')

@login_required
def get_domain_aliases(request):
    domainAliases = DomainAliasesFileHandler()
    return HttpResponse(json.dumps(domainAliases.load()), content_type='application/json')
