#!/usr/bin/env python

import logging
import logging.handlers

import splunk

from exec_anaconda import make_splunkhome_path

BASE_LOGGER_NAME = 'mlspl'
DEFAULT_LEVEL = logging.DEBUG


# DEFAULT_LEVEL = logging.INFO

def get_logger(name=BASE_LOGGER_NAME, level=DEFAULT_LEVEL):
    """Returns a general-purpose logger instance.

    The logger is configured to write to both:
      * A (rotated) file in $SPLUNK_HOME/var/log/splunk/<name>.log
      * Standard error.

    Additionally, it consults $SPLUNK_HOME/etc/log.cfg and
    log-local.cfg for default log-levels. You can configure per-logger
    log-levels by adding a property to log-local.cfg that looks like:

        [python]
        myloggername = DEBUG

    For DEBUG messages to show up in search.log as well, you will need
    to modify $SPLUNK_HOME/etc/log-searchprocess-local.cfg to contain:

        category.ChunkedExternProcessor=DEBUG

    Idiomatic usage is:

        #!/usr/bin/env python
        import setup_logging
        logger = setup_logging.get_logger()

        def foo():
            logger.warn("Red Alert, report to battle stations")

    """
    logger = logging.getLogger(name)

    # Initial setup
    if len(logger.handlers) == 0:
        logger.setLevel(level)
        logger.propagate = False

        path = make_splunkhome_path(['var', 'log', 'splunk', name + '.log'])
        file_handler = logging.handlers.RotatingFileHandler(path, maxBytes=1000000, backupCount=5)
        formatter = logging.Formatter('%(created)f %(asctime)s %(levelname)s [%(name)s] [%(funcName)s] %(message)s')
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(logging.Formatter('%(levelname)s %(message)s'))
        logger.addHandler(stream_handler)

        # Read logging level information from log.cfg so it will overwrite log
        # Note if logger level is specified on that file then it will overwrite log level
        LOGGING_DEFAULT_CONFIG_FILE = make_splunkhome_path(['etc', 'log.cfg'])
        LOGGING_LOCAL_CONFIG_FILE = make_splunkhome_path(['etc', 'log-local.cfg'])
        LOGGING_STANZA_NAME = 'python'
        splunk.setupSplunkLogger(
            logger,
            LOGGING_DEFAULT_CONFIG_FILE,
            LOGGING_LOCAL_CONFIG_FILE,
            LOGGING_STANZA_NAME,
            verbose=False
        )

    return logger
