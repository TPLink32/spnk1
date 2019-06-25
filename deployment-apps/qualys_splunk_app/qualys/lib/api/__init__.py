__author__ = 'mwirges'

import Client

client = None


def setupClient(config):
    global client

    client = Client.APIClient(config)

# end setupClient
