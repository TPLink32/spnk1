from django.conf.urls import patterns, include, url
from splunkdj.utility.views import render_template as render

urlpatterns = patterns('',
    url(r'^home/$', 'cisco-app-Nexus-9k.views.home', name='home'), 
    url(r'^setup_guide/$', 'cisco-app-Nexus-9k.views.setup_guide', name='setup_guide'),
    url(r'^forcedirected/$', render('cisco-app-Nexus-9k:forcedirected.html'), name='forcedirected'),
	url(r'^networktopology/$', render('cisco-app-Nexus-9k:networktopology.html'), name='networktopology'),
	url(r'^index/$', render('cisco-app-Nexus-9k:index.html'), name='index'),
    url(r'^jsonviewer/$', render('cisco-app-Nexus-9k:jsonviewer.html'), name='jsonviewer'),
    url(r'^howtocustom/$', 'cisco-app-Nexus-9k.views.howtocustom', name='howtocustom'),

)
