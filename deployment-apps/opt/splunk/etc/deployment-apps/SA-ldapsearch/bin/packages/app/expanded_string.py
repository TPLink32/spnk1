# coding=utf-8
#
# Copyright © 2014 Splunk, Inc. All Rights Reserved.

from __future__ import absolute_import, division, print_function, unicode_literals
import re
import string
import types
from UserDict import IterableUserDict


class ExpandedString(object):
    """ Performs field value expansion on a string based on the contents of a record

    """
    class _Formatter(string.Formatter):
        def get_value(self, key, args, kwargs):
            value = args[key] if isinstance(key, (int, long)) else kwargs.get(key, u'')
            return value

    Formatter = _Formatter()
    CurlyBraces = re.compile(r'([{}])')
    ReplacementFields = re.compile(r'((?:\$\$)*)\$(([^$]+(?:\$\$)*)+)\$')

    def __init__(self, value, converter=None):

        format_spec = re.sub(ExpandedString.CurlyBraces, r'\1\1', value)
        format_spec, field_count = re.subn(ExpandedString.ReplacementFields, r'\1{\2}', format_spec)

        if field_count == 0:

            def get_value(self, record):
                return self._value

            self.get_value = types.MethodType(get_value, self)
            self._value = value

        elif converter is None:

            def get_value(self, record):
                text = ExpandedString.Formatter.vformat(self._value, tuple(), record)
                return text if len(text) > 0 else None

            self.get_value = types.MethodType(get_value, self)
            self._value = format_spec

        else:

            class FieldConverter(IterableUserDict):
                def __getitem__(self, key):
                    text = converter(unicode(self.data[key]))
                    return text

            def get_value(self, record):
                field_converter = FieldConverter()
                field_converter.data = record
                text = ExpandedString.Formatter.vformat(self._value, tuple(), field_converter)
                return text if len(text) > 0 else None

            self.get_value = types.MethodType(get_value, self)
            self._value = format_spec.encode('utf-8')

        return

    def get_value(self, record):
        # We monkey patch this method in the constructor based on whether field_count is zero or non-zero
        return NotImplemented
