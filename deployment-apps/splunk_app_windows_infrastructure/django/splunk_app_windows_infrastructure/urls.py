from django.conf.urls import patterns, include, url
from splunkdj.utility.views import render_template as render

urlpatterns = patterns(
    '',
    url(r'^setup/$', 'splunk_app_windows_infrastructure.views.setup', name='setup'),
    url(r'^windows/setup/$', 'splunk_app_windows_infrastructure.views.windowssetup', name='windowssetup'),
    url(r'^unconfigure/$', 'splunk_app_windows_infrastructure.views.unconfigure', name='unconfigure'),
    url(r'^get_license_status/$', 'splunk_app_windows_infrastructure.views.get_license_status', name='get_license_status'),
    url(r'^get_domain_aliases/$', 'splunk_app_windows_infrastructure.views.get_domain_aliases', name='get_domain_aliases'),
    url(r'^post_lm_config/$', 'splunk_app_windows_infrastructure.views.post_lm_config', name='post_lm_config'),
    url(r'^home/$', 'splunk_app_windows_infrastructure.views.home', name='home'),
    url(r'^palette/$', 'splunk_app_windows_infrastructure.views.palettes', name='palletes'),
    url(r'^palette/(?P<palette>.+?)/$', 'splunk_app_windows_infrastructure.views.palette', name='pallete'),
    url(r'^services/$', 'splunk_app_windows_infrastructure.views.cfw_services', name='services'),
    url(r'^services/(?P<palette>.+?)/$', 'splunk_app_windows_infrastructure.views.cfw_hosts', name='services'),
    url(r'^ad/(?P<tmpl>.*?)/$', 'splunk_app_windows_infrastructure.views.ad', name='ad'),
    url(r'^windows/(?P<tmpl>.*?)/$', 'splunk_app_windows_infrastructure.views.windows', name='windows'),
    url(r'^(?P<tmpl>.*)/$', 'splunk_app_windows_infrastructure.views.render_page', name='tmpl_render')
)
