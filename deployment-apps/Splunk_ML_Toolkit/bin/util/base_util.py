# Generic utility functions
import re
import fnmatch


def is_valid_identifier(name):
    """Check if name is a valid identifier.

    Returns True if 'name' is a valid Python identifier. Such
    identifiers don't allow '.' or '/', so may also be used to ensure
    that name can be used as a filename without risk of directory
    traversal.
    """
    return re.match('^[a-zA-Z_][a-zA-Z0-9_]*$', name) is not None


def match_field_globs(input_fields, requested_fields):
    """Intersect input_fields with glob expansion of requested_fields.

    Args:
        input_fields (list): the fields that are present
        requested_fields (list): the fields that are requested

    Returns:
        output_fields (list): matched field names
    """
    output_fields = []

    for f in requested_fields:
        if '*' in f:  # f contains a glob
            pat = re.compile(fnmatch.translate(f))
            matches = [x for x in list(input_fields) if not x.startswith('__mv_') and pat.match(x)]
            if len(matches) == 0:
                output_fields.append(f)
            else:
                output_fields.extend(matches)
        else:
            output_fields.append(f)

    return output_fields


class MLSPLNotImplementedError(RuntimeError):
    """Custom ML-SPL exception to capture not implemented errors."""
    pass
