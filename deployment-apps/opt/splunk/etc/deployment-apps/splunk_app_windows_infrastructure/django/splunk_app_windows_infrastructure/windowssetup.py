
from .widgets import LeftRightSelectMultiple
from splunkdj.setup import forms
from splunkdj.setup import set_configured
from splunkdj.setup import get_configured
from django.http import HttpResponseRedirect
from django.core.urlresolvers import reverse
from splunklib.client import Entity, Collection, ConfigurationFile, Stanza, Service
import os

def create_setup_view_context(request, form_cls, next_url):
    """
    Prepares the specified form class to be rendered by a setup view template.
    Returns the context dictionary to be rendered with the template.
    """
    if not hasattr(form_cls, 'load') or not hasattr(form_cls, 'save'):
        raise ValueError(
            ('Expected form class %s to have "load" and "save" methods. ' +
             'Are you passing a django.forms.Form instead of ' +
             'a splunkdj.setup.forms.Form?') % form_cls.__name__)
    
    service = request.service

    if request.method == 'POST':
        form = form_cls(request.POST)
        if form.is_valid():
            # Save submitted settings and redirect to home view
            form.save(request)
            # Removing this line is the difference between classic setupfx
            # and this code
            # set_configured(service, True)
            return HttpResponseRedirect(next_url)
        else:
            # Render form with validation errors
            pass
    else:
        if get_configured(service):
            # Render form bound to existing settings
            form = form_cls.load(request)
        else:
            # Render unbound form
            form = form_cls()

    return {
        'form': form,
        'configured': get_configured(service),
    }

def get_localhost_event_input(service):
	localhost = Entity(service, '/servicesNS/-/splunk_app_windows_infrastructure/data/inputs/win-event-log-collections/localhost')
	return localhost

def load_enabled_event_inputs(request, form_cls, field):
	service = request.service
	localhost = get_localhost_event_input(service)
	return localhost['logs'] if not localhost['disabled'] == '1' else []

def save_enabled_event_inputs(request, form_cls, field, enabled_inputs):
	service = request.service

	localhost = get_localhost_event_input(service)
	if enabled_inputs:
		localhost.enable()
		localhost.update(logs=enabled_inputs, lookup_host='localhost')
	else:
		localhost.disable()


PERF_PREFIX = "splunk_app_windows_infrastructure__"

def get_namespaced_perf_name(name):
	return PERF_PREFIX + name.replace(' ', '_')

# TODO ask the REST API instead, when localization is needed
def get_all_perf_inputs():
	return (
		('Processor', 'Processor'),
		('Network Interface', 'Network Interface'),
		('Memory', 'Memory'),
		('PhysicalDisk', 'PhysicalDisk'),
		('LogicalDisk', 'LogicalDisk'),
		('Process', 'Process'),
		('System', 'System')
	)

def load_enabled_perf_inputs(request, form_cls, field):
	service = request.service
	return list(i['object'] for i in service.inputs.list('win-perfmon') if i.access.app == 'splunk_app_windows_infrastructure')

def get_canon_metadata(service, object):
	# TODO see MSAPP-1131 for why these codes are here
	content = service.get('/services/admin/win-perfmon-find-collection/PERFResult', object=object)
	canonEntity = Entity(service, '/services/admin/win-perfmon-find-collection/')
	canonEntity.refresh(canonEntity._load_state(content))

	return (canonEntity['counters'], canonEntity['instances'])

def save_enabled_perf_inputs(request, form_cls, field, enabled_input_names):
	service = request.service

	previous_input_names = load_enabled_perf_inputs(request, form_cls, field)

	# for each input enabled that wasn't enabled before
	for input_name in enabled_input_names:
		if input_name not in previous_input_names:
			(counters, instances) = get_canon_metadata(service, input_name)
			service.inputs.create(
				get_namespaced_perf_name(input_name),
				'win-perfmon',
				counters=';'.join(counters),
				interval=10,
				object=input_name,
				instances=';'.join(instances),
				index='default')

	# for each previous inpt that was not enabled, delete it
	for input_name in previous_input_names:
		if input_name not in enabled_input_names:
			service.inputs.delete(get_namespaced_perf_name(input_name))


def setup_windows(request):
	# If we're on a non-Windows search head, don't configure
	if os.name != 'nt':
		return {'is_windows': True}

	all_event_inputs = ()
	service = request.service
	canon = Collection(service, '/services/admin/win-alleventlogs')
	all_event_inputs = ((event.name, event.name) for event in canon)

	class AppSettingsForm(forms.Form):
		enabled_event_inputs = forms.MultipleChoiceField(
			load=load_enabled_event_inputs,
			save=save_enabled_event_inputs,
			choices=all_event_inputs,
			widget=LeftRightSelectMultiple(),
			required=False,
			initial=['Application', 'Security', 'System', 'Setup'])

		enabled_perf_inputs = forms.MultipleChoiceField(
			load=load_enabled_perf_inputs,
			save=save_enabled_perf_inputs,
			choices=get_all_perf_inputs(),
			widget=LeftRightSelectMultiple(),
			required=False,
			initial=['Processor', 'Network Interface', 'Memory', 'PhysicalDisk', 'LogicalDisk', 'Process', 'System'])

		disable_windows_update = forms.BooleanField(
			endpoint='/servicesNS/-/splunk_app_windows_infrastructure/data/inputs/monitor',
			entity=r'$WINDIR\WindowsUpdate.log',
			field='disabled',
			label='Disable Windows Update monitoring',
			required=False,
			initial=False)


	return create_setup_view_context(
		request,
		AppSettingsForm,
		reverse('splunk_app_windows_infrastructure:home'))