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

import sys
import os
try:
    import configparser
except ImportError:
    import ConfigParser as configparser

config_file = '/etc/hp/hplip.conf'
if os.path.exists(config_file):
    config = configparser.ConfigParser()
    config.read(config_file)
    try:
        home_dir = config.get('dirs', 'home')
    except:
        print("Error setting home directory: home= under [dirs] in %s not found. Is HPLIP installed?" % config_file)
        sys.exit(1)
else:
    print("Error setting home directory: %s not found. Is HPLIP installed?" % config_file)
    sys.exit(1)

if not home_dir or not os.path.exists(home_dir):
    print("Error setting home directory: Home directory %s not found. Is HPLIP installed?" % home_dir)
    sys.exit(1)
sys.path.insert(0, home_dir)
try:
    from installer import pluginhandler
except ImportError:
    print("Failed to Import pluginhandler")
    sys.exit(1)

print("Executing installPlugin.py")
pluginObj = pluginhandler.PluginHandle()
 
status = False
 
if os.geteuid() == 0:
    status = pluginObj.copyFiles(os.getcwd())
    if status == True:
        sanefp = open('/etc/sane.d/dll.conf', "r+")
        contents = sanefp.read()
        if "hp2000S1" in contents:
            pass
        else:
            sanefp.write("hp2000S1\n")

        if "hpgt2500" in contents:
            pass
        else:
            sanefp.write("hpgt2500\n")
        sanefp.close()
        sys.exit(0)
    else:
        sys.exit(1)
else:
    print("Insufficient permissions to install plugin. Exiting..")
    sys.exit(1)
