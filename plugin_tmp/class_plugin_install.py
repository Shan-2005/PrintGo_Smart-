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

try:
    import configparser
except ImportError:
    import ConfigParser as configparser

try:
    import platform
    platform_avail = True
except ImportError:
    platform_avail = False

def uniqueList(input):
    temp = []
    [temp.append(i) for i in input if not temp.count(i)]
    return temp

def getBitness():
    if platform_avail:
        return int(platform.architecture()[0][:-3])
    else:
        return struct.calcsize("P") << 3

def getEndian():
    if sys.byteorder == 'big':
        return BIG_ENDIAN
    else:
        return LITTLE_ENDIAN

def getProcessor():
    if platform_avail:
        return platform.machine().replace(' ', '_').lower() # i386, i686, power_macintosh, etc.
    else:
        return "i686" # TODO: Need a fix here

def cat(s):
    try:
        from string import Template # will fail in Python <= 2.3
    except ImportError:
        pass

    globals = sys._getframe(1).f_globals.copy()
    if 'self' in globals:
        del globals['self']

    locals = sys._getframe(1).f_locals.copy()
    if 'self' in locals:
        del locals['self']

    return Template(s).substitute(sys._getframe(1).f_globals, **locals)

LITTLE_ENDIAN = 1
BIG_ENDIAN = 0
def __getPluginFilesList(src_dir):
    if not os.path.exists(src_dir+"/plugin.spec"):
        print("%s/plugin.spec file doesn't exists."%src_dir)
        return []

    cwd = os.getcwd()
    os.chdir(src_dir)

    plugin_spec = configparser.ConfigParser()
    plugin_spec.read("plugin.spec")
#    products = plugin_spec.options("products")

    BITNESS = getBitness()
    ENDIAN = getEndian()

    config = configparser.ConfigParser()
    config.read('/etc/hp/hplip.conf')

    PPDDIR = config.get('dirs', 'ppd')
    DRVDIR = config.get('dirs', 'drv')
    HOMEDIR = config.get('dirs', 'home')
    DOCDIR = config.get('dirs', 'doc')
    CUPSBACKENDDIR = config.get('dirs', 'cupsbackend')
    CUPSFILTERDIR = config.get('dirs', 'cupsfilter')
    RULESDIR = '/etc/udev/rules.d'
    BIN = config.get('dirs', 'bin')

    # Copying plugin.spec file to home dir.
    if src_dir != HOMEDIR:
        shutil.copyfile(src_dir+"/plugin.spec", HOMEDIR+"/plugin.spec")
        os.chmod(HOMEDIR+"/plugin.spec",0o644)

    processor = getProcessor()
    if processor == 'power_machintosh':
        ARCH = 'ppc'
    elif (processor == 'armv6l' or processor == 'armv7l' or processor == 'aarch64' or processor == 'aarch32'):
        ARCH = 'arm%d' % BITNESS
    else:
        ARCH = 'x86_%d' % BITNESS

    if BITNESS == 64:
        SANELIBDIR = '/usr/lib64/sane'
        LIBDIR = '/usr/lib64'
    else:
        SANELIBDIR = '/usr/lib/sane'
        LIBDIR = '/usr/lib'

    copies = []

    trg = plugin_spec.get("firmware", 'trg')
    trg = cat(trg[:-14])
    link = '' 
    src = plugin_spec.get("firmware", 'src')
    src = os.path.basename(src[:-14])
    src_files = os.listdir(cwd)
    for name in src_files:
        if name.endswith('.gz'):
            copies.append((src + name, trg + name, link))

    src = os.path.basename(cat(plugin_spec.get("laserjet_print_plugin", 'src')))
    trg = cat(plugin_spec.get("laserjet_print_plugin", 'trg'))
    link = cat(plugin_spec.get("laserjet_print_plugin", 'link'))
    copies.append((src, trg, link))

    src = os.path.basename(cat(plugin_spec.get("laserjet_hbpl1_print_plugin", 'src')))
    trg = cat(plugin_spec.get("laserjet_hbpl1_print_plugin", 'trg'))
    link = cat(plugin_spec.get("laserjet_hbpl1_print_plugin", 'link'))
    copies.append((src, trg, link))
    
    src = os.path.basename(cat(plugin_spec.get("license", 'src')))
    trg = cat(plugin_spec.get("license", 'trg'))
    link = '' 
    copies.append((src, trg, link))

    copies.sort()

#    os.chdir(cwd)
    return copies



copies = __getPluginFilesList(os.getcwd())
#print ("%s" % copies)
os.umask(0)

for src, trg, link in copies:

    if not os.path.exists(src):
        print("Source file %s does not exist. Skipping." % src)
        continue

    if os.path.exists(trg):
        print("Target file %s already exists. Replacing." % trg)
        os.remove(trg)

    trg_dir = os.path.dirname(trg)

    if not os.path.exists(trg_dir):
        print("Target directory %s does not exist. Creating." % trg_dir)
        os.makedirs(trg_dir, 0o755)

    if not os.path.isdir(trg_dir):
        print("Target directory %s exists but is not a directory. Skipping." % trg_dir)
        continue

    try:
        shutil.copyfile(src, trg)
    except (IOError, OSError) as e:
        print("File copy failed: %s" % e.strerror)
        continue

    else:
        if not os.path.exists(trg):
            print("Target file %s does not exist. File copy failed." % trg)
            continue
        else:
            os.chmod(trg, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)

        if link:
            if os.path.exists(link):
                print("Symlink already exists. Replacing.")
                os.remove(link)

            print("Creating symlink %s (link) to file %s (target)..." %(link, trg))

            try:
                os.symlink(trg, link)
            except (OSError, IOError) as e:
                print("Unable to create symlink: %s" % e.strerror)
                pass

config = configparser.ConfigParser()
config.read('/etc/hp/hplip.conf')
hplip_version = config.get('hplip', 'version')

config = configparser.ConfigParser()
config.read('/etc/hp/hplip.conf')
hplip_version = config.get('hplip', 'version')

if not os.path.exists('/var/lib/hp/'):
    os.makedirs('/var/lib/hp/')
    os.chmod('/var/lib/hp/', 755)


with open('/var/lib/hp/hplip.state', 'w') as plugin_conf:
    plugin_conf.write('[plugin]\n')
    plugin_conf.write('installed=1\n')
    plugin_conf.write('eula=1\n')
    plugin_conf.write('version=' + hplip_version + '\n')
