__author__ = 'strong'
import os, sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

import target_manager as tm
import splunklib.client as client

class Handler(object):
    def __init__(self, options=None):
        self._options = options

    def execute(self):
        if 'help' in options:
            self.help()
        elif 'get' in options:
            self._check_args()
            self.get()
        elif 'set' in options:
            self._check_args()
            self.set()
        elif 'remove' in options:
            self._check_args()
            self.remove()
        else:
            print "Please specify action in [-help,-get,-set,-remove]"

    def help(self):
        help_text = """
    Syntax:
        [-help|-get|-set|-remove] [-parameter <value>]...

        host        the host of the splunk instance where splunk_app_servicenow installed, defaults to '127.0.0.1'

        port        the port of the splunk instance where splunk_app_servicenow installed, defaults to 8089

        username    the username that connect to the host

        password    the password that connect to the host

        t_host      the host of the splunk instance where splunk ServiceNow add-on installed

        t_username  the username of the splunk instance where splunk ServiceNow add-on installed

        t_password  the password of the splunk instance where splunk ServiceNow add-on installed

        t_port      the port of the splunk instance where splunk ServiceNow add-on installed, defaults to 8089

    Examples:

        Show the current connection to ServiceNow add-on

            ./splunk cmd python ../etc/apps/splunk_app_servicenow/bin/cli/targets_helper.py -get -username admin -password password

        Set a new connection to ServiceNow add-on

            ./splunk cmd python ../etc/apps/splunk_app_servicenow/bin/cli/targets_helper.py -set -username admin -password password -t_host new_host -t_port newport -t_username new_username -t_password new_password

        remove the current connection to ServiceNow add-on

            ./splunk cmd python ../etc/apps/splunk_app_servicenow/bin/cli/targets_helper.py -remove -username admin -password password -t_host new_host

         """
        print help_text

    def _check_args(self):
        if 'username' not in self._options:
            raise Exception('Please specify the username of the Splunk instance [%s]' % self._options['host'])
        if 'password' not in self._options:
            raise Exception('Please specify the password of the Splunk instance [%s]' % self._options['host'])

    def get(self):
        targets = self._get_target_manager().list_targets()
        (key, entry) = targets[0]
        print "============================"
        print key
        print "============================"
        for (k, v) in entry.iteritems():
            print "%s=%s" % (k, v)

    def set(self):
        if 't_host' not in self._options:
            raise Exception('Please specify t_host when setting up an ServiceNow add-on connection')
        if 't_username' not in self._options:
            raise Exception('Please specify t_username when setting up an ServiceNow add-on connection')
        if 't_password' not in self._options:
            raise Exception('Please specify t_password when setting up an ServiceNow add-on connection')
        opts = {
            'host': self._options['t_host'],
            'username': self._options['t_username'],
            'password': self._options['t_password'],
            'port': self._options['t_port'] if 't_port' in self._options else 8089
        }
        tm = self._get_target_manager()
        targets = tm.list_targets()
        for (key, entry) in targets[:-1]:
            tm.remove_target(key)
        self._get_target_manager().add_target(self._options['t_host'], opts)
        print "new ServiceNow add-on connection [%s] is successfully created" % (self._options['t_host'])

    def remove(self):
        if 't_host' not in self._options:
            raise Exception('Please specify t_host when removing an ServiceNow add-on connection')
        self._get_target_manager().remove_target(self._options['t_host'])
        print "ServiceNow add-on connection [%s] is successfully removed" % (self._options['t_host'])

    def _get_target_manager(self):
        service = client.Service(**self._options)
        session_key = service.login().token[7:]
        return tm.TargetManager(app='splunk_app_servicenow', owner='nobody', session_key=session_key)


if __name__ == '__main__':
    options = {
        'host': '127.0.0.1',
        'port': 8089
    }
    args = sys.argv[1:]
    while len(args) > 0:
        if args[0].startswith('-'):
            if len(args) > 1 and not args[1].startswith('-'):
                options[args[0][1:]] = args[1]
                args = args[2:]
            else:
                options[args[0][1:]] = True
                args = args[1:]
        else:
            args = args[1:]

    try:
        handler = Handler(options)
        handler.execute()
    except Exception as e:
        msg = e.message if e.message else e.strerror
        print msg
