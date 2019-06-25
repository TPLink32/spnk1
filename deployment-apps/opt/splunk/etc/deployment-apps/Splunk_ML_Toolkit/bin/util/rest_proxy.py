import rest_bouncer


class SplunkRestProxy(object):
    def __init__(self, uri, key, app, user):
        """Initialize the Splunk rest API proxy object.

        Args: (all the args come from search info, this proxy object is created in the chunked controller
                and passed to the processors. From the processors use self.rest_proxy to access this util)
            uri (string): Splunk URI
            key (string): Sessionkey of the current logged in user
            app (string): App namespace
            user (string): Username
        """
        # Attributes
        self.splunkd_uri = uri
        self.session_key = key
        self.splunk_app = app
        self.splunk_user = user
        self.name_space_str = 'servicesNS'

    def make_rest_call(self, method, url, args=None):
        """Make rest call to Splunk rest endpoint using the bouncer.

        Args: (all the args come from search info, this proxy object is created in the chunked controller
                and passed to the processors. From the processors use self.rest_proxy to access this util)
            method (string): REST method - GET, POST and etc.
            url (string): The complete URL for making the rest call, usually is 
                            {splunk_uri}/{namespaces}/{rest_endpoint}. Refer to Docs.
            args (dict): Payload that has all necessary info. Refer to Docs.
        """
        postargs = {}
        if args:
            postargs.update(args)
        return rest_bouncer.make_rest_call(
            self.session_key,
            method,
            url,
            postargs)


def rest_proxy_from_searchinfo(searchinfo):
    if searchinfo is None:
        return None
    else:
        return SplunkRestProxy(
            searchinfo['splunkd_uri'],
            searchinfo['session_key'],
            searchinfo['app'],
            searchinfo['username']
        )
