#!/usr/bin/env python
# coding=utf-8
#
# Copyright © 2014 Splunk, Inc. All Rights Reserved

from __future__ import absolute_import, division, print_function, unicode_literals
import default
import app
import ldap3

from splunklib.searchcommands import dispatch, StreamingCommand, Configuration, Option, validators


@Configuration()
class LdapFetchCommand(StreamingCommand):
    """  Filters and augments events with information from Active Directory.

    This command follows a search or similar command in the pipeline so that you can feed it events:

        .. code-block:: text
        | ldapsearch domain=splunk.com search="(objectClass=groups)"
        | ldapfetch domain=splunk.com dn=memberOf attributes="cn,description"

    """
    # region Command options

    attrs = Option(
        doc=''' Specifies a comma separated list of attributes to return as fields.
        **Default:** '*', specifying that all attributes should be returned as fields.
        ''',
        default=[ldap3.ALL_ATTRIBUTES], validate=validators.List())

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

    dn = Option(
        doc=''' Specifies the name of the field holding the distinguished name to fetch.
        ''',
        default='distinguishedName')

    domain = Option(
        doc=''' Specifies the Active Directory domain to search.
        ''',
        default='default')

    # endregion

    # region Command implementation

    def stream(self, records):
        """
        :param records: An iterable stream of events from the command pipeline.
        :return: `None`.

        """
        configuration = app.Configuration(self, is_expanded=True)
        expanded_domain = app.ExpandedString(self.domain)
        search_scope = ldap3.SEARCH_SCOPE_BASE_OBJECT
        search_filter = '(objectClass=*)'

        try:
            with configuration.open_connection_pool(self.attrs) as connection_pool:
                attribute_names = connection_pool.attributes
                for record in records:
                    dn = record.get(self.dn)
                    if not dn:  # got a falsey value
                        yield record
                        continue
                    domain = expanded_domain.get_value(record)
                    if domain is None:
                        yield record
                        continue
                    connection = connection_pool.select(domain)
                    if not connection:
                        self.logger.warning('dn="%s": domain="%s" is not configured', self.dn, domain)
                        yield record
                        continue
                    for search_base in dn if isinstance(dn, list) else (dn,):
                        if search_base:
                            try:
                                connection.search(search_base, search_filter, search_scope, attributes=attribute_names)
                            except ldap3.LDAPNoSuchObjectResult:
                                self.logger.warning(
                                    'dn="%s" domain="%s": distinguishedName="%s" does not exist', self.dn, domain,
                                    search_base)
                            else:
                                response = connection.response[0]
                                attributes = app.get_attributes(self, connection.response[0])
                                if attributes:
                                    self._augment_record(record, response['dn'], attributes, attribute_names)
                        yield record
                    pass

        except ldap3.LDAPException as error:
            self.error_exit(error, app.get_ldap_error_message(error, configuration))

        return

    def _augment_record(self, record, dn, attributes, attribute_names):
        """
        :param record:
        :param dn:
        :param attributes:
        :return:

        """
        record[self.dn] = dn
        for name in attribute_names:
            record[name] = attributes.get(name, '')
        return

    # endregion

dispatch(LdapFetchCommand, module_name=__name__)
