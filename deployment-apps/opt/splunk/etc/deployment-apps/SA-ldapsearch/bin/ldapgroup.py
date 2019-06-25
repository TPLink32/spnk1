#!/usr/bin/env python
# coding=utf-8
#
# Copyright © 2014 Splunk, Inc. All Rights Reserved

from __future__ import absolute_import, division, print_function, unicode_literals
import default
import app
import ldap3

from splunklib.searchcommands import dispatch, StreamingCommand, Configuration, Option, validators
from collections import namedtuple, OrderedDict
from itertools import chain, ifilter, imap, islice


@Configuration()
class LdapGroupCommand(StreamingCommand):
    """  Filters and augments events with information from Active Directory.

    This command follows a search or similar command in the pipeline so that you can feed it events:

        .. code-block:: text
        | ldapsearch domain=splunk.com search="(objectClass=groups)" | ldapgroup

    """
    # region Command options

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

    domain = Option(
        doc=''' Specifies the Active Directory domain to search.
        ''',
        default='default')

    groupdn = Option(
        doc=''' Specifies the name of the field holding the distinguished names of the group to expand.
        ''',
        default='distinguishedName')

    # endregion

    # region Command implementation

    Group = namedtuple('Group', (
        'dn', 'object_sid'))

    GroupMember = namedtuple('GroupMember', (
        'dn', 'is_group', 'netbios_domain_name', 'object_sid', 'primary_group_id', 'sam_account_name'))

    GroupMembership = namedtuple('GroupMemberList', (
        'cycles', 'direct', 'nested'))

    def stream(self, records):
        """
        :param records: An iterable stream of events from the command pipeline.
        :return: `None`.

        """
        configuration = app.Configuration(self, is_expanded=True)
        expanded_domain = app.ExpandedString(self.domain)
        search_scope = ldap3.SEARCH_SCOPE_BASE_OBJECT
        search_filter = '(objectCategory=Group)'
        attributes = ['objectSid']

        try:
            with configuration.open_connection_pool(attributes) as connection_pool:

                for record in records:

                    name = record.get(self.groupdn)

                    if name is None:
                        continue  # there's no value for name in the current record

                    name = name.lower()

                    if name in self.names:
                        continue  # we've already processed this name

                    domain = expanded_domain.get_value(record)

                    if domain is None:
                        continue  # there's no domain to search (bad data?)

                    connection = connection_pool.select(domain)

                    if not connection:
                        self.logger.warning('groupdn="%s": domain="%s" is not configured', self.groupdn, domain)
                        continue

                    self.paged_size = configuration.paged_size
                    self.basedn = configuration.basedn

                    try:
                        connection.search(name, search_filter, search_scope, attributes=attributes)
                    except ldap3.LDAPNoSuchObjectResult:
                        self.logger.warning('groupdn="%s" domain="%s": %s does not exist', self.groupdn, domain, name)
                        continue  # this name is not the distinguished name of a group (bad data?)
                    except ldap3.LDAPCommunicationError as error:
                        self.logger.warning(
                            'groupdn="%s" domain="%s", name="%s": %s', self.groupdn, domain, name, error)
                        continue  # this name is not the distinguished name of a group (bad data?)

                    if not connection.response:
                        self.logger.warning('groupdn="%s" domain="%s": %s is not a group', self.groupdn, domain, name)
                        continue

                    do = connection.response[0]
                    do_attributes = app.get_attributes(self, do)

                    if do_attributes:
                        group = LdapGroupCommand.Group(do['dn'], do_attributes['objectSid'])
                        membership = LdapGroupCommand.GroupMembership(cycles=OrderedDict(), direct=[], nested=[])
                        self._get_group_membership(connection, group, membership)
                        LdapGroupCommand._augment_record(record, group, membership)
                        yield record

                    self.names.add(name)

        except ldap3.LDAPException as error:
            self.error_exit(error, app.get_ldap_error_message(error, configuration))

        return

    def __init__(self):
        super(LdapGroupCommand, self).__init__()
        self.paged_size = None
        self.names = set()
        self.basedn = None
        return

    @staticmethod
    def _augment_record(record, group, membership):
        """
        :param record:
        :param group:
        :param membership:
        :return: `None`.

        """
        group_id = group.object_sid[group.object_sid.rindex('-') + 1:]

        record['errors'] = [
            (x, y) for x, y in membership.cycles.iteritems() if len(y) > 0]

        record['member_dn'] = member_dn = [
            x.dn for x in chain(membership.direct, membership.nested)]

        record['member_domain'] = member_domain = [
            x.netbios_domain_name for x in chain(membership.direct, membership.nested)]

        record['member_name'] = member_name = [
            x.sam_account_name for x in chain(membership.direct, membership.nested)]

        record['member_type'] = member_type = [
            'PRIMARY' if group_id == x.primary_group_id else y for x, y in chain(
                imap(lambda z: (z, 'DIRECT'), membership.direct), imap(lambda z: (z, 'NESTED'), membership.nested))]

        record['mv_combo'] = '###'.join(
            [','.join(member_dn), ','.join(member_name), ','.join(member_domain), ','.join(member_type)])

        return

    @staticmethod
    def _create_group_filter(members, start, stop):
        return ifilter(lambda x: x.is_group, islice(members, start, stop))

    def _get_group_membership(self, connection, group, membership):
        self._get_direct_group_members(connection, group, membership.cycles, membership.direct)
        groups = LdapGroupCommand._create_group_filter(membership.direct, 0, len(membership.direct))
        self._get_nested_group_members(connection, groups, membership.cycles, membership.nested)

    def _get_direct_group_members(self, connection, group, cycles, members):
        """
        :param members:
        :param group:
        :param connection:
        :return: `None`.

        """
        if group.dn in cycles:
            return

        search_filter = '(memberOf={0})'.format(app.escape_assertion_value(group.dn))
        cycles[group.dn] = []

        entry_generator = connection.extend.standard.paged_search(
            paged_size=self.paged_size,
            search_base=self.basedn,
            search_filter=search_filter,
            attributes=('groupType', 'msDS-PrincipalName', 'objectSid', 'primaryGroupID', 'sAMAccountName'))

        try:
            for entry in entry_generator:

                entry_attributes = app.get_attributes(self, entry)

                if entry_attributes is None:
                    continue

                member = LdapGroupCommand.GroupMember(
                    dn=entry['dn'],
                    is_group=entry_attributes.get('groupType') is not None,
                    netbios_domain_name=entry_attributes.get('msDS-PrincipalName', '').split('\\', 1)[0],
                    object_sid=entry_attributes.get('objectSid', ''),
                    primary_group_id=entry_attributes.get('primaryGroupID', ''),
                    sam_account_name=entry_attributes.get('sAMAccountName', ''))

                if member.is_group and member.dn in cycles:
                    # There's a cycle from group to member
                    cycles[group.dn].append(member.dn)

                members.append(member)
        except ldap3.LDAPInvalidFilterError as error:
            error.message += ': {0}'.format(search_filter)
            raise error

        return

    def _get_nested_group_members(self, connection, groups, cycles, members):
        """ Adds the members of each group in member_slice to member_list recursively.
        :param members: A list of GroupMember objects.
        :param groups: A slice of the GroupMember objects in member_list or--on first call--some other sequence
        of GroupMember objects.
        :param connection: A connection to an LDAP directory service that is queried for group members.
        :return: `None`.

        """
        start = len(members)
        for group in groups:
            self._get_direct_group_members(connection, group, cycles, members)
            groups = LdapGroupCommand._create_group_filter(members, start, len(members))
            self._get_nested_group_members(connection, groups, cycles, members)
        return

    # endregion

dispatch(LdapGroupCommand, module_name=__name__)
