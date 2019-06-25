#!/usr/bin/env python
# coding=utf-8
#
# Copyright © 2014 Splunk, Inc. All Rights Reserved

from __future__ import absolute_import, division, print_function, unicode_literals
import default

from splunklib.searchcommands import dispatch, GeneratingCommand, Configuration, Option, validators
from collections import OrderedDict
from itertools import chain, imap
from base64 import b64encode
from json import JSONEncoder
from time import time
import ldap3
import app


@Configuration(retainsevents=True)
class LdapSearchCommand(GeneratingCommand):
    """ Retrieves results from the specified search in a configured domain and generates events.

    This command must be placed at the beginning of a search pipeline:

        .. code-block:: text
        | ldapsearch domain=splunk.com search="(objectCategory=User)" attrs="distinguishedName"

    """

    search = Option(
        doc=''' Specifies an RFC 2254 compliant search string.
        ''',
        require=True)

    attrs = Option(
        doc=''' Specifies a comma separated list of attributes to be returned as fields.
        **Default:** '*', specifying that all attributes should be returned as fields.
        ''',
        default=[ldap3.ALL_ATTRIBUTES], validate=validators.List())

    basedn = Option(
        doc=''' Specifies the starting point for the search.
        Default: The value of basedn as specified in the configuration stanza for domain.
        ''')

    domain = Option(
        doc=''' Specifies the LDAP or Active Directory domain directory to search.
        ''',
        default='default')

    scope = Option(
        doc=''' Specifies the scope of the search to be one of base, one, or sub.
        **Default:** sub.
        ''',
        default='sub', validate=validators.Map(
            base=ldap3.SEARCH_SCOPE_BASE_OBJECT,
            one=ldap3.SEARCH_SCOPE_SINGLE_LEVEL,
            sub=ldap3.SEARCH_SCOPE_WHOLE_SUBTREE
        ))

    debug = Option(
        doc=''' True, if the logging_level should be set to DEBUG; otherwise False.
        **Default:** The current value of logging_level.
        ''',
        default=False, validate=validators.Boolean())

    decode = Option(
        doc=''' True, if Active Directory formatting rules should be applied to attribute types.
        **Default:** The value of decode as specified in the configuration stanza for domain.
        ''',
        default=True, validate=validators.Boolean())

    limit = Option(
        doc=''' Specifies an upper bound on the number of matching entries returned by the search.
        **Default:** 0, specifying that there is no upper bound on the number of entries returned by the search.
        ''',
        default=0, validate=validators.Integer(minimum=0))

    def generate(self):
        """
        :return: `None`.

        """
        configuration = app.Configuration(self)

        try:
            with ldap3.Connection(
                    configuration.server,
                    read_only=True,
                    raise_exceptions=True,
                    user=configuration.credentials.username,
                    password=configuration.credentials.password) as connection:

                attribute_names = app.get_normalized_attribute_names(self.attrs, connection, configuration)

                entry_generator = connection.extend.standard.paged_search(
                    search_base=self.basedn, search_filter=self.search, search_scope=self.scope, attributes=self.attrs,
                    paged_size=configuration.paged_size)

                encoder = JSONEncoder(ensure_ascii=False, separators=(',', ':'))
                time_stamp = time()
                serial_number = 0

                for entry in entry_generator:
                    attributes = app.get_attributes(self, entry)
                    if attributes:
                        dn = entry['dn']
                        yield LdapSearchCommand._record(
                            serial_number, time_stamp, connection.server.host, dn, attributes, attribute_names, encoder)
                        serial_number += 1
                    if self.limit and serial_number == self.limit:
                        break
                    pass

                pass

        except ldap3.LDAPException as error:
            self.error_exit(error, app.get_ldap_error_message(error, configuration))

        return

    @staticmethod
    def _record(serial_number, time_stamp, host, dn, attributes, attribute_names, encoder):

        # Base-64 encode binary values (they're stored as str values--byte strings--not unicode values)

        for name, value in attributes.iteritems():
            if isinstance(value, str):
                attributes[name] = b64encode(value)
            elif isinstance(value, list):
                for i in range(len(value)):
                    if isinstance(value[i], str):
                        value[i] = b64encode(value[i])

        raw = encoder.encode(attributes)

        # Formulate record

        if serial_number > 0:
            attributes['_serial'] = serial_number
            attributes['_time'] = time_stamp
            attributes['_raw'] = raw
            attributes['host'] = host
            attributes['dn'] = dn
            return attributes

        record = OrderedDict(chain(
            (('_serial', serial_number), ('_time', time_stamp), ('_raw', raw), ('host', host), ('dn', dn)),
            imap(lambda name: (name, attributes.get(name, '')), attribute_names)))

        return record

dispatch(LdapSearchCommand, module_name=__name__)
