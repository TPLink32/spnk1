from django import template
from splunkdj.templatetags.tagutils import component_context

register = template.Library()


@register.inclusion_tag('splunkdj:components/component.html', takes_context=True)
def networktopology(context, id, *args, **kwargs):
    return component_context(
        context,
        "networktopology",
        id,
        "view",
        "cisco-app-Nexus-9k/components/networktopology/networktopology",
        kwargs
    )


