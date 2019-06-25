import logging
from splunktalib.common import log
import okta_command_common as occ

_LOGGER = log.Logs().get_logger("ta_okta", level=logging.DEBUG)


def deactivate_user():
    """
    The entrance method to deactivate a user account.
    """
    _LOGGER.info("call deactivate_user()")
    occ.user_operate("POST")


if __name__ == "__main__":
    deactivate_user()
