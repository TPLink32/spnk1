from django.contrib.auth.decorators import login_required
from splunkdj.decorators.render import render_to
from django.core.urlresolvers import reverse
from splunkdj.setup import config_required
from splunkdj.setup import create_setup_view_context


@render_to('cisco-app-Nexus-9k:home.html')
@login_required
def home(request):
    return {
    
    }
@render_to('cisco-app-Nexus-9k:setup_guide.html')
@login_required
#@config_required   # enable when using a real setup view
def setup_guide(request):
    return {
        # No special variables
    }

@render_to('cisco-app-Nexus-9k:howtocustom.html')
@login_required
#@config_required   # enable when using a real setup view
def howtocustom(request):
    return {
        # No special variables
    }

@render_to()
@login_required
#@config_required   # enable when using a real setup view
def render_page(request, tmpl):
    return {
        "TEMPLATE": "cisco-app-Nexus-9k:%s.html" % tmpl
    }

@render_to('cisco-app-Nexus-9k:setup.html')
@login_required
def setup(request):
    # Renders the setup view, passing the following variables to the template:
    #   * form -- Can be rendered with {{ form.as_p }}.
    #   * configured -- Whether the app has already been configured.
    #                   If false, then the existing configuration is being edited.
    return create_setup_view_context(
        request,
        SetupForm,                  # the form class to use
        # NOTE: Most apps should redirect to the home view 'splunk_wftoolkit:home'
        #       instead of back to the setup page.
        reverse('cisco-app-Nexus-9k:setup'))  # where to redirect after the completing the setup view
