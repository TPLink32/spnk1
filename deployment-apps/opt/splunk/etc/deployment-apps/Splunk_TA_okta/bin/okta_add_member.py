import logging
from splunktalib.common import log 
import okta_command_common as occ


_LOGGER = log.Logs().get_logger("ta_okta", level=logging.DEBUG)

def add_member():
    """
    The entrance method to add a user to a group
    """
    _LOGGER.info("call add_member()")
    occ.member_operate("PUT")

if __name__ == "__main__":
    add_member()
