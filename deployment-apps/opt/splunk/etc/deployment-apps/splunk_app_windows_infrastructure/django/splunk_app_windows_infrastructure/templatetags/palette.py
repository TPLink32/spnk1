from django import template
from splunkdj.templatetags.tagutils import component_context

register = template.Library()

@register.inclusion_tag('splunk_app_windows_infrastructure:palette/panel-proto.html', takes_context=True)
def panel(context, about, *args, **kwargs):
    return { "about": about }
