def searchinfo_from_request(request):
    """
    Generates a searchinfo-style object needed by listmodels.list_models()

    Args:
        request: the base request object from PersistentServerConnectionApplication

    Returns:
        searchinfo: dict with search information
    """
    user = request.get('ns').get('user')

    if user is None:
        user = 'nobody'

    searchinfo = {
        'splunkd_uri': request.get('server').get('rest_uri'),
        'session_key': request.get('session').get('authtoken'),
        'app': request.get('ns').get('app'),
        'username': user
    }

    return searchinfo