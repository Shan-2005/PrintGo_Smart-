# -*- coding: utf-8 -*-
#
# (c) Copyright 2003-2015 HP Development Company, L.P.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 2 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307 USA
#

import os
import sys
import types
import shutil
import stat
import subprocess

try:
    import configparser
except ImportError:
    import ConfigParser as configparser

from base import utils

PY3 = sys.version_info[0] == 3

def get_distro_name():
    os_name = None
    try:
        import platform
        os_name = platform.dist()[0]
    except ImportError:
        os_name = None

    if not os_name:
        name = os.popen('lsb_release -i | cut -f 2')
        os_name = name.read().strip()
        name.close()

    if not os_name:
        name = os.popen("cat /etc/issue | awk '{print $1}' | head -n 1")
        os_name = name.read().strip()
        name.close()

    os_name = os_name.lower()
    if "redhatenterprise" in os_name:
        os_name = 'rhel'
    elif "suse" in os_name:
        os_name = 'suse'
    elif "arch" in os_name:
        os_name = 'manjarolinux'
    return os_name


def cmd_line_input(string):
    if PY3:
        return input(string)
    else:
        return raw_input(string)


def enter_yes_no(question, default_value='y', choice_prompt=None):
    if type(default_value) == type(""):
        if default_value == 'y':
            default_value = True
        else:
            default_value = False

    #assert default_value in [True, False]

    if choice_prompt is None:
        if default_value:
            question += " (y=yes*, n=no, q=quit) ? "
        else:
            question += " (y=yes, n=no*, q=quit) ? "
    else:
        question += choice_prompt

    while True:
        try:
            temp_string = question
            #temp_string = '\033[1m' + question + '\033[0m'
            user_input = cmd_line_input(temp_string).lower().strip()
        except EOFError:
            continue
        if not user_input:
            return True, default_value

        if user_input == 'n':
            return True, False

        if user_input == 'y':
            return True, True

        if user_input in ('q', 'c'):  # q -> quit, c -> cancel
            return False, default_value

        print("Please press <enter> or enter 'y', 'n', or 'q'.")


config = configparser.ConfigParser()
config.read('/etc/hp/hplip.conf')

# get the hplip version installed from hplip.conf
ver = config.get('hplip', 'version')
hplip_version = ver.split('.')[0] + '.' + \
    ver.split('.')[1] + '.' + ver.split('.')[2]
# print hplip_version

# get the plugin version from version.txt
plugin_version = open("version.txt", "r").read().strip()
# print plugin_version

# check if there is a mismatch in version
# if version mismaches then we are not supposed to install the plugins
ver_mismatch = hplip_version != plugin_version
if ver_mismatch:
    print("Plug-in version mismatch:")
    print("  Plug-in version: %s" % plugin_version)
    print("  Installed HPLIP version: %s" % hplip_version)
    print("  Installed HPLIP version and plug-in version must match.")
    sys.exit(1)

else:
    print("Plug-in version: %s" % plugin_version)
    print("Installed HPLIP version: %s" % hplip_version)


# starting the interactive mode of installation
start = '\033[1m' + '\033[95m'
end = '\033[0;0m' + '\033[0m'
s = start + 'You must agree to the license terms before installing the plug-in:' + end
print ("%s" % s)
print ("")

license_file = open('license.txt', 'r')

# printing the license file
for line in license_file:
    print ("%s" % line.strip())
print ("")

# ask user to accept or reject license agreement
s = start + "\nDo you accept the license terms for the plug-in" + end
ok, ans = enter_yes_no(s)

if not ok or not ans:
    print("License agreement not accepted. Exiting.")
    sys.exit(1)

exec_str = sys.executable
auth_type = utils.readAuthType()
if auth_type == 'sudo':
    cmd = 'sudo %s class_plugin_install.py' % exec_str
else:
    cmd = 'su -c \"%s class_plugin_install.py \"' % exec_str

subprocess.check_call(cmd, shell=True)
