import logging
from splunktalib.common import log 
import okta_command_common as occ
      

_LOGGER = log.Logs().get_logger("ta_okta", level=logging.DEBUG)

def remove_member():
    _LOGGER.info("call add_member()")
    occ.member_operate("DELETE")

if __name__ == "__main__":
    remove_member()