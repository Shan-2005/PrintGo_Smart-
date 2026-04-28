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
# Author: Don Welch
#

__version__ = '3.0'
__title__ = 'Plugin Installer'
__doc__ = "Self-installs the HPLIP plugin."
__mod__ = "hplip-plugin-install"

# Std Lib
import sys
import os
import os.path
import re
import time
try:
    import configparser
except ImportError:
    import ConfigParser as configparser

import getopt
import shutil
import stat

#if os.geteuid() == 0:
#    print("hp-plugin should not be run as root/superuser. Exiting.")
#    sys.exit(1)

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
    class_driver = config.get('configure', 'class-driver')
except:
    print("Error: plugin version mismatch ")
    sys.exit(1)

exec_str = sys.executable

if class_driver == 'yes':
#    cmd = "%s class_plugin.py"%exec_str
#    os.system(cmd)
    import class_plugin 
    sys.exit(0)    

def startGUIInstall():
    ok = installPlugin()
    app.quit()


def installPlugin():
    global exce_str
    passwordObj = password.Password(mode)
    cmd = "%s installPlugin.py"%exec_str
    cmd = passwordObj.getAuthCmd()%cmd
    status, output = utils.run(cmd, passwordObj)
    if status == 0:
        result = True
    else:
        print("Plugin installation failed")
        result = False
    return result


try:
    from base.g import *
    from base.codes import *
    from base import utils, tui, module
except ImportError:
    print("Error importing HPLIP modules.  Is HPLIP installed?")
    sys.exit(1)

mod = module.Module(__mod__, __title__, __version__, __doc__, None,
                    (INTERACTIVE_MODE, GUI_MODE),
                    (UI_TOOLKIT_QT3, UI_TOOLKIT_QT4, UI_TOOLKIT_QT5), True)

mod.setUsage()

opts, device_uri, printer_name, mode, ui_toolkit, loc = \
    mod.parseStdOpts('c:v:p',
        ['count=', 'pkit-version='],
        handle_device_printer=False)

version = None
num_files = 0
user_pkit_version = None

for o, a in opts:
    if o in ('-c', '--count'):
        try:
            num_files = int(a)
        except TypeError:
            num_files = 0

    elif o in ('-v', '--version'):
        version = a

    elif o in ('--pkit-version'):
        try:
            user_pkit_version = int(a)
        except:
            log.error("-v or --version require an integer argument")
            sys.exit(1)
        if user_pkit_version < 0 or user_pkit_version > 1:
            log.error("invalid PolicyKit version...use 0 or 1")

    elif o in ('-p'):
        pkit_installed = False

if version is None:
    version = open("version.txt", "r").read().strip()

version_mismatch = version != prop.installed_version

if version_mismatch:
    log.error("Plug-in version mismatch:")
    log.error("  Plug-in version: %s" % version)
    log.error("  Installed HPLIP version: %s" % prop.installed_version)
    log.error("  Installed HPLIP version and plug-in version must match.")
    sys.exit(1)

else:
    log.info("Plug-in version: %s" % version)
    log.info("Installed HPLIP version: %s" % prop.installed_version)

log.info("Number of files to install: %d" % num_files)
log.info("")

PKIT = utils.to_bool(sys_conf.get('configure', 'policy-kit'))
try:
    from base.pkit import *
    pkit_version = policykit_version()
    if pkit_version:
        if not user_pkit_version is None:
            pkit_version = user_pkit_version
        log.debug("pkit_version %d" % pkit_version)
    try:
        pkit = PolicyKit(pkit_version)
        pkit_installed = True
    except dbus.DBusException:
        pkit_installed = False
except ImportError:
    log.error("Unable to load pkit...is HPLIP installed?")
    sys.exit(1)
if not PKIT:
    pkit_installed = False
log.debug("pkit_installed %s" % pkit_installed)

if mode == INTERACTIVE_MODE:


    log.info(log.bold("You must agree to the license terms before installing the plug-in:"))
    log.info()

    license_f = open("license.txt", "r")

    for line1 in license_f:
        if line1:
            for line2 in tui.format_paragraph(line1):
                log.info(line2)

    ok, ans = tui.enter_yes_no("\nDo you accept the license terms for the plug-in")

    if not ok or not ans:
        log.error("License agreement not accepted. Exiting.")
        sys.exit(1)

    if not installPlugin():
        log.error("Plugin installation failed")

else: # GUI_MODE

    if ui_toolkit == 'qt3':

        try:
            from qt import *
            from ui.pluginlicenseform import PluginLicenseForm
        except ImportError:
            log.error("Unable to load Qt3 support. Is it installed?")
            sys.exit(1)

        app = QApplication(sys.argv)
        QObject.connect(app, SIGNAL("lastWindowClosed()"), app, SLOT("quit()"))


        if version_mismatch:
            QMessageBox.critical(None,
                                 "HP Device Manager - Plug-in Installer",
                                 "Plug-in version mismatch. Installed HPLIP version (%s) and plug-in version (%s) must match." % (prop.installed_version, version))
                                  # QMessageBox.Ok|
                                  # QMessageBox.NoButton)
                                  # QMessageBox.NoButton)

            sys.exit(1)

        dlg = PluginLicenseForm(open("license.txt", "r").read())

        if dlg.exec_loop() == QDialog.Accepted:
            ok = installPlugin()
            if not ok:
                log.debug("Plug-in installation failed.")
                sys.exit(1)

        else:
            log.error("License agreement not accepted. Exiting.")
            sys.exit(1)

    elif ui_toolkit == "qt4": # qt4

        try:
            from PyQt4.QtGui import *
            from PyQt4.QtCore import *
            from ui4.pluginlicensedialog import PluginLicenseDialog
        except ImportError:
            log.error("Unable to load Qt4 support. Is it installed? Try running with -i or --qt3 instead.")
            sys.exit(1)
    elif ui_toolkit == "qt5":
        try:
            log.note("Using PyQt5")
            from PyQt5.QtGui import *
            from PyQt5.QtCore import *
            from PyQt5.QtWidgets import *
            from ui5.pluginlicensedialog import PluginLicenseDialog
        except ImportError:
            log.error("Unable to load Qt5 support. Is it installed? Try running with -i or --qt3 instead.")
            sys.exit(1)


    app = QApplication(sys.argv)
    
    if version_mismatch:
        QMessageBox.critical(None,
                             "HP Device Manager - Plug-in Installer",
                             "Plug-in version mismatch. Installed HPLIP version (%s) and plug-in version (%s) must match." % (prop.installed_version, version))
        #QMessageBox.Ok,
        #QMessageBox.NoButton,
        #QMessageBox.NoButton)

        sys.exit(1)

    dlg = PluginLicenseDialog(None, open("license.txt", "r").read())

    if dlg.exec_() == QDialog.Accepted:
        ok = installPlugin()
        if not ok:
            log.debug("Plug-in installation failed")
            sys.exit(1)
        else:
            # changing permission for hplip.state
            cmd="chmod 644 /var/lib/hp/hplip.state"
            utils.run(cmd)

    else:
        log.error("License agreement not accepted. Exiting.")
        sys.exit(1)

log.info("")
log.info("Done.")
sys.exit(0)
