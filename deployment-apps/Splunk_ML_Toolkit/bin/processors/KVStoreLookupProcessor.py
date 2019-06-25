#!/usr/bin/env python
# Copyright (C) 2015-2017 Splunk Inc. All Rights Reserved.
import cexc
import json
import pandas as pd
from BaseProcessor import BaseProcessor
from util import kvstore_util
from util.rest_proxy import rest_proxy_from_searchinfo

logger = cexc.get_logger(__name__)
messages = cexc.get_messages_logger()

class KVStoreLookupProcessor(BaseProcessor):
    """The KVStore processor loads combined shared and user-specific entries from a KVStore collection ."""

    @staticmethod
    def multivalue_encode(value):
        """
        Encode a value as part of a multivalue field expected by the Chunked External Command Protocol

        Args:
            value (str): the value to encode
        """
        return '$%s$' % value.replace('$', '$$')

    @classmethod
    def parse_reply(cls, reply):
        """
        Parse the reply of a KVStore REST query

        Args:
            reply: the results of a KVStore REST query, as produced by rest_proxy.make_rest_call
        """
        try:
            content = reply.get('content')
            error_type = reply.get('error_type')
            json_content = json.loads(content)

            if reply['success']:
                for i, json_content_row in enumerate(json_content):
                    encoded_multivalues = {} # stores encoded multivalued fields, if needed
                    for key, value in json_content_row.iteritems():
                        if isinstance(value, list):
                            # if the value is a list, it needs to be multivalue encoded
                            json_content[i][key] = '\n'.join(value)
                            encoded_multivalues['__mv_' + key] = ';'.join(map(cls.multivalue_encode, value))
                    json_content[i].update(encoded_multivalues)

                return json_content
            else:
                # trying to load a nonexistent collection helpfully returns a 500 (and not a 404)
                # so there's not much point bothering with fancy error handling
                error_text = json_content.get('messages')[0].get('text')
                if error_type is None:
                    raise RuntimeError(error_text)
                else:
                    raise RuntimeError(error_type + ', ' + error_text)
        except Exception as e:
            logger.debug(e.message)
            logger.debug(e)
            raise e

    @classmethod
    def load_collection(cls, collection_name, searchinfo):
        """
        Create the output table of KVStore entries.

        Args:
            collection_name (str): the name of the KVStore collection to load
            searchinfo (dict): information required for search
        """

        rest_proxy = rest_proxy_from_searchinfo(searchinfo)
        kvstore_user_reply = kvstore_util.load_collection_from_rest('user', collection_name, rest_proxy)
        kvstore_shared_reply = kvstore_util.load_collection_from_rest('app', collection_name, rest_proxy)

        formatted = cls.parse_reply(kvstore_user_reply) + cls.parse_reply(kvstore_shared_reply)

        return pd.DataFrame(formatted)

    def process(self):
        """List the KVStore rows."""
        self.df = self.load_collection(self.process_options['collection_name'], self.searchinfo)
