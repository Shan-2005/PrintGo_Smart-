# -*- coding: utf-8 -*-
#
# (c) Copyright 2015 HP Development Company, L.P.
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
# Input file for create_plugin and hp-plugin.
# Note: models.dat must also be appropriately setup for plugins to properly work.
#
# Author: Naga Samrat Chowdary Narla, Sarbeswar Meher

# Defined directories (for 'trg=' only):
# $PPDDIR (from [dirs]/ppd= in /etc/hp/hplip.conf)
# $DRVDIR (usually [dirs]/drv= in /etc/hp/hplip.conf)
# $SANELIBDIR (usually /usr/lib/sane or /usr/lib64/sane)
# $LIBDIR (usually /usr/lib or /usr/lib64)
# $HOMEDIR (usually /usr/share/hplip, from [dirs]/home= in /etc/hp/hplip.conf)
# $DOCDIR (from [dirs]/doc= in /etc/hp/hplip.conf)
# $CUPSBACKENDDIR
# $CUPSFILTERDIR
# $RULESDIR (/etc/udev/rules.d)
# $BIN (/usr/bin)

# Other defines:
# $PRODUCT (currently being processed product name WITH hp_ or hp- prefix)
# $MODEL (same as PRODUCT, except WITHOUT hp- or hp_ prefix)
# $BITNESS ("32" or "64") [DON'T USE, USE ARCH INSTEAD]
# $ENDIAN ("big" or "little")
# $VERSION (version of installed HPLIP)
# $ARCH (x86_32,x86_64,arm,ppc,sparc,hppa...) [a list, will expand out during create_plugin. ONLY x86_32 and x86_64 currently supported]
# $VER (libusb version 1.0 or 0.1)


# During create_plugin, only these are defined (for 'src=' lines):
# $PRODUCT
# $MODEL
# $VERSION
# $ARCH
# $VER


[products]
# required
hp_laserjet_1000=laserjet_print_plugin,firmware,license
hp_laserjet_1005_series=laserjet_print_plugin,firmware,license
hp_laserjet_1018=laserjet_print_plugin,firmware,license
hp_laserjet_1020=laserjet_print_plugin,firmware,license
hp_laserjet_m1005=laserjet_print_plugin,license,marvell_scan_plugin
hp_laserjet_m1120_mfp=laserjet_print_plugin,license,marvell_scan_plugin
hp_laserjet_m1120n_mfp=laserjet_print_plugin,license,marvell_scan_plugin
hp_laserjet_m1319f_mfp=laserjet_print_plugin,license,marvell_scan_plugin,marvell_fax_plugin
hp_laserjet_p1005=laserjet_print_plugin,firmware,license
hp_laserjet_p1006=laserjet_print_plugin,firmware,license
hp_laserjet_p1007=laserjet_print_plugin,firmware,license
hp_laserjet_p1008=laserjet_print_plugin,firmware,license
hp_laserjet_p1009=laserjet_print_plugin,firmware,license
hp_laserjet_p1505=laserjet_print_plugin,firmware,license
hp_color_laserjet_cm1312_mfp=soapht_scan_plugin,license
hp_color_laserjet_cm1312nfi_mfp=soapht_scan_plugin,license
hp_color_laserjet_cm2320_mfp=soapht_scan_plugin,license
hp_color_laserjet_cm2320fxi_mfp=soapht_scan_plugin,license
hp_color_laserjet_cm2320n_mfp=soapht_scan_plugin,license
hp_color_laserjet_cm2320nf_mfp=soapht_scan_plugin,license
hp_laserjet_m1522_mfp=soapht_scan_plugin,license
hp_laserjet_m1522n_mfp=soapht_scan_plugin,license
hp_laserjet_m1522nf_mfp=soapht_scan_plugin,license
hp_laserjet_m2727_mfp=soapht_scan_plugin,license
hp_laserjet_m2727nf_mfp=soapht_scan_plugin,license
hp_laserjet_m2727nfs_mfp=soapht_scan_plugin,license
hp_color_laserjet_cm1015=soap_scan_plugin,license
hp_color_laserjet_cm1017=soap_scan_plugin,license
hp_laserjet_p2035=laserjet_print_plugin,license
hp_laserjet_p2035n=laserjet_print_plugin,license
hp_color_laserjet_1600=laserjet_print_plugin,license
hp_color_laserjet_2600n=laserjet_print_plugin,license
hp_color_laserjet_cp1215=laserjet_print_plugin,license
hp_laserjet_cp1025nw=laserjet_print_plugin,license
hp_laserjet_cp_1025nw=laserjet_print_plugin,license
hp_laserjet_cp_1025=laserjet_print_plugin,license
hp_laserjet_professional_p1102=laserjet_print_plugin,firmware,license
hp_laserjet_professional_p1102w=laserjet_print_plugin,firmware,license
hp_laserjet_professional_p1566=laserjet_print_plugin,firmware,license
hp_laserjet_professional_p1132=laserjet_print_plugin,license,marvell_scan_plugin
hp_laserjet_professional_p1212nf=laserjet_print_plugin,license,marvell_scan_plugin,marvell_fax_plugin
hp_laserjet_professional_p1136=laserjet_print_plugin,license,marvell_scan_plugin
hp_laserjet_professional_m1217nfw_mfp=laserjet_print_plugin,license,marvell_scan_plugin,marvell_fax_plugin
hp_color_laserJet_pro_mfp_m176n=laserjet_hbpl1_print_plugin,marvell_scan_plugin,license
hp_laserJet_pro_mfp_m127fw=laserjet_hbpl1_print_plugin,marvell_scan_plugin,license
envy_7640_series=escl_scan_plugin,license
hp_scanjet_7500=orblite_scan_plugin,license
hp_2000S1=hp2000S1_plugin_1,hp2000S1_plugin_2,hp2000S1_plugin_3,hp2000S1_plugin_4,hp2000S1_plugin_5,hp2000S1_plugin_6,hp2000S1_plugin_7,hp2000S1_plugin_8,hp2000S1_plugin_9,hp2000S1_plugin_10,hp2000S1_plugin_11,hp2000S1_plugin_12,hp2000S1_plugin_13,hp2000S1_plugin_14,hp2000S1_plugin_15,hp2000S1_plugin_16,hp2000S1_plugin_17,license
hpgt2500=hpgt2500_plugin_1,hpgt2500_plugin_2,hpgt2500_plugin_3,hpgt2500_plugin_4,hpgt2500_plugin_5,hpgt2500_plugin_6,hpgt2500_plugin_7,hpgt2500_plugin_8,hpgt2500_plugin_9,hpgt2500_plugin_10,hpgt2500_plugin_11,hpgt2500_plugin_12,hpgt2500_plugin_13,hpgt2500_plugin_14,hpgt2500_plugin_15,hpgt2500_plugin_16,license

# optional
hp_color_laserjet_3500=laserjet_print_plugin,license
hp_color_laserjet_3500n=laserjet_print_plugin,license
hp_color_laserjet_3550=laserjet_print_plugin,license
hp_color_laserjet_3550n=laserjet_print_plugin,license
hp_color_laserjet_3600=laserjet_print_plugin,license
#hp_color_laserjet_cp1514n=laserjet_print_plugin,license
#hp_color_laserjet_cp1515n=laserjet_print_plugin,license
#hp_color_laserjet_cp1518ni=laserjet_print_plugin,license
hp_laserjet_1022=laserjet_print_plugin,license
hp_laserjet_1022n=laserjet_print_plugin,license
hp_laserjet_1022nw=laserjet_print_plugin,license
hp_laserjet_p1505n=laserjet_print_plugin,license
hp_laserjet_p2014=laserjet_print_plugin,license
hp_laserjet_p2014n=laserjet_print_plugin,license
hp_laserjet_professional_p1606=laserjet_print_plugin,license

# **********************************************************

[firmware]
src=data/firmware/$PRODUCT.fw.gz
trg=$HOMEDIR/data/firmware/$PRODUCT.fw.gz

[laserjet_print_plugin]
src=prnt/plugins/lj-$ARCH.so
trg=$HOMEDIR/prnt/plugins/lj-$ARCH.so
link=$HOMEDIR/prnt/plugins/lj.so

[laserjet_hbpl1_print_plugin]
src=prnt/plugins/hbpl1-$ARCH.so
trg=$HOMEDIR/prnt/plugins/hbpl1-$ARCH.so
link=$HOMEDIR/prnt/plugins/hbpl1.so

[inkjet_print_plugin]
src=prnt/plugins/ij-$ARCH.so
trg=$HOMEDIR/prnt/plugins/ij-$ARCH.so
link=$HOMEDIR/prnt/plugins/ij.so



[license]
src=prnt/plugins/license.txt
trg=$HOMEDIR/data/plugins/license.txt

# new in 2.8.10 (scan-type=3)
[soap_scan_plugin]
src=scan/sane/bb_soap-$ARCH.so
trg=$HOMEDIR/scan/plugins/bb_soap-$ARCH.so
link=$HOMEDIR/scan/plugins/bb_soap.so

# new in 2.8.9 (scan-type=4)
[marvell_scan_plugin]
src=scan/sane/bb_marvell-$ARCH.so
trg=$HOMEDIR/scan/plugins/bb_marvell-$ARCH.so
link=$HOMEDIR/scan/plugins/bb_marvell.so

# new in 2.8.10 (scan-type=5)
[soapht_scan_plugin]
src=scan/sane/bb_soapht-$ARCH.so
trg=$HOMEDIR/scan/plugins/bb_soapht-$ARCH.so
link=$HOMEDIR/scan/plugins/bb_soapht.so

# new in 3.10.2 (fax-type=5)
[marvell_fax_plugin]
src=fax/plugins/fax_marvell-$ARCH.so
trg=$HOMEDIR/fax/plugins/fax_marvell-$ARCH.so
link=$HOMEDIR/fax/plugins/fax_marvell.so

#new in 3.15.9 (scan-type=9)
[escl_scan_plugin]
src=scan/sane/bb_escl-$ARCH.so
trg=$HOMEDIR/scan/plugins/bb_escl-$ARCH.so
link=$HOMEDIR/scan/plugins/bb_escl.so

#new in 3.18.2 (scan-type=10)
[orblite_scan_plugin]
src=scan/sane/bb_orblite-$ARCH.so
trg=$HOMEDIR/scan/plugins/bb_orblite-$ARCH.so
link=$HOMEDIR/scan/plugins/bb_orblite.so

[hp2000S1_plugin_1] 
src=scan/sane/libsane-hp2000S1-$ARCH.so.1.0.25
trg=/usr/lib/sane/libsane-hp2000S1-$ARCH.so.1.0.25
link=/usr/lib/sane/libsane-hp2000S1.so

[hp2000S1_plugin_2]
src=scan/sane/libsane-hp2000S1-$ARCH.so.1.0.25
trg=/usr/lib/sane/libsane-hp2000S1-$ARCH.so.1.0.25
link=/usr/lib/sane/libsane-hp2000S1.so.1

[hp2000S1_plugin_3]
src=scan/sane/libsane-hp2000S1-$ARCH.so.1.0.25
trg=/usr/lib64/sane/libsane-hp2000S1-$ARCH.so.1.0.25
link=/usr/lib64/sane/libsane-hp2000S1.so

[hp2000S1_plugin_4]
src=scan/sane/libsane-hp2000S1-$ARCH.so.1.0.25
trg=/usr/lib64/sane/libsane-hp2000S1-$ARCH.so.1.0.25
link=/usr/lib64/sane/libsane-hp2000S1.so.1

[hp2000S1_plugin_5] 
src=scan/sane/libsane-hp2000S1-$ARCH.so.1.0.25
trg=/usr/lib/sane/libsane-hp2000S1-$ARCH.so.1.0.25
link=/usr/lib/x86_64-linux-gnu/sane/libsane-hp2000S1.so

[hp2000S1_plugin_6]
src=scan/sane/libsane-hp2000S1-$ARCH.so.1.0.25
trg=/usr/lib/sane/libsane-hp2000S1-$ARCH.so.1.0.25
link=/usr/lib/x86_64-linux-gnu/sane/libsane-hp2000S1.so.1

[hp2000S1_plugin_7] 
src=scan/sane/libsane-hp2000S1-$ARCH.so.1.0.25
trg=/usr/lib/sane/libsane-hp2000S1-$ARCH.so.1.0.25
link=/usr/lib/i386-linux-gnu/sane/libsane-hp2000S1.so

[hp2000S1_plugin_8]
src=scan/sane/libsane-hp2000S1-$ARCH.so.1.0.25
trg=/usr/lib/sane/libsane-hp2000S1-$ARCH.so.1.0.25
link=/usr/lib/i386-linux-gnu/sane/libsane-hp2000S1.so.1

[hp2000S1_plugin_9] 
src=scan/sane/libsane-hp2000S1-$ARCH.so.1.0.25
trg=/usr/lib64/sane/libsane-hp2000S1-$ARCH.so.1.0.25
link=/usr/lib64/x86_64-linux-gnu/sane/libsane-hp2000S1.so

[hp2000S1_plugin_10]
src=scan/sane/libsane-hp2000S1-$ARCH.so.1.0.25
trg=/usr/lib64/sane/libsane-hp2000S1-$ARCH.so.1.0.25
link=/usr/lib64/x86_64-linux-gnu/sane/libsane-hp2000S1.so.1
 
[hp2000S1_plugin_11]
src=scan/sane/libjpeg-$ARCH.so.9.2.0 
trg=/usr/local/lib/libjpeg-$ARCH.so.9.2.0 
link=/usr/lib64/libjpeg.so.9

[hp2000S1_plugin_12]
src=scan/sane/libjpeg-$ARCH.so.9.2.0 
trg=/usr/local/lib/libjpeg-$ARCH.so.9.2.0 
link=/usr/lib/i386-linux-gnu/libjpeg.so.9

[hp2000S1_plugin_13]
src=scan/sane/libjpeg-$ARCH.so.9.2.0 
trg=/usr/local/lib/libjpeg-$ARCH.so.9.2.0 
link=/usr/local/lib/libjpeg.so.9

[hp2000S1_plugin_14]
src=scan/sane/libjpeg-$ARCH.so.9.2.0 
trg=/usr/local/lib/libjpeg-$ARCH.so.9.2.0 
link=/usr/lib/libjpeg.so.9

[hp2000S1_plugin_15]
src=scan/sane/libjpeg-$ARCH.so.9.2.0 
trg=/usr/local/lib/libjpeg-$ARCH.so.9.2.0 
link=/usr/lib/x86_64-linux-gnu/libjpeg.so.9

[hp2000S1_plugin_16]
src=scan/sane/libjpeg-$ARCH.so.9.2.0 
trg=/usr/local/lib/libjpeg-$ARCH.so.9.2.0 
link=/usr/lib64/x86_64-linux-gnu/libjpeg.so.9

[hp2000S1_plugin_17]
src=data/rules/S99-2000S1.rules
trg=/etc/udev/rules.d/S99-2000S1.rules

[hpgt2500_plugin_1]
src=scan/sane/libsane-hpgt2500-$ARCH.so.1.0.27
trg=/usr/lib/sane/libsane-hpgt2500-$ARCH.so.1.0.27
link=/usr/lib/sane/libsane-hpgt2500.so

[hpgt2500_plugin_2]
src=scan/sane/libsane-hpgt2500-$ARCH.so.1.0.27
trg=/usr/lib/sane/libsane-hpgt2500-$ARCH.so.1.0.27
link=/usr/lib/sane/libsane-hpgt2500.so.1

[hpgt2500_plugin_3]
src=scan/sane/libsane-hpgt2500-$ARCH.so.1.0.27
trg=/usr/lib64/sane/libsane-hpgt2500-$ARCH.so.1.0.27
link=/usr/lib64/sane/libsane-hpgt2500.so

[hpgt2500_plugin_4]
src=scan/sane/libsane-hpgt2500-$ARCH.so.1.0.27
trg=/usr/lib64/sane/libsane-hpgt2500-$ARCH.so.1.0.27
link=/usr/lib64/sane/libsane-hpgt2500.so.1

[hpgt2500_plugin_5]
src=scan/sane/libsane-hpgt2500-$ARCH.so.1.0.27
trg=/usr/lib/sane/libsane-hpgt2500-$ARCH.so.1.0.27
link=/usr/lib/x86_64-linux-gnu/sane/libsane-hpgt2500.so

[hpgt2500_plugin_6]
src=scan/sane/libsane-hpgt2500-$ARCH.so.1.0.27
trg=/usr/lib/sane/libsane-hpgt2500-$ARCH.so.1.0.27
link=/usr/lib/x86_64-linux-gnu/sane/libsane-hpgt2500.so.1

[hpgt2500_plugin_7]
src=scan/sane/libsane-hpgt2500-$ARCH.so.1.0.27
trg=/usr/lib/sane/libsane-hpgt2500-$ARCH.so.1.0.27
link=/usr/lib/i386-linux-gnu/sane/libsane-hpgt2500.so

[hpgt2500_plugin_8]
src=scan/sane/libsane-hpgt2500-$ARCH.so.1.0.27
trg=/usr/lib/sane/libsane-hpgt2500-$ARCH.so.1.0.27
link=/usr/lib/i386-linux-gnu/sane/libsane-hpgt2500.so.1

[hpgt2500_plugin_9]
src=scan/sane/libsane-hpgt2500-$ARCH.so.1.0.27
trg=/usr/lib64/sane/libsane-hpgt2500-$ARCH.so.1.0.27
link=/usr/lib64/x86_64-linux-gnu/sane/libsane-hpgt2500.so

[hpgt2500_plugin_10]
src=scan/sane/libsane-hpgt2500-$ARCH.so.1.0.27
trg=/usr/lib64/sane/libsane-hpgt2500-$ARCH.so.1.0.27
link=/usr/lib64/x86_64-linux-gnu/sane/libsane-hpgt2500.so.1

[hpgt2500_plugin_11]
src=scan/sane/hpgt2500_ntdcmsdll-$ARCH.so
trg=/usr/lib/sane/hpgt2500_ntdcmsdll-$ARCH.so
link=/usr/lib/sane/hpgt2500_ntdcmsdll.so

[hpgt2500_plugin_12]
src=scan/sane/hpgt2500_ntdcmsdll-$ARCH.so
trg=/usr/lib64/sane/hpgt2500_ntdcmsdll-$ARCH.so
link=/usr/lib64/sane/hpgt2500_ntdcmsdll.so

[hpgt2500_plugin_13]
src=scan/sane/hpgt2500_ntdcmsdll-$ARCH.so
trg=/usr/lib/sane/hpgt2500_ntdcmsdll-$ARCH.so
link=/usr/lib/x86_64-linux-gnu/sane/hpgt2500_ntdcmsdll.so

[hpgt2500_plugin_14]
src=scan/sane/hpgt2500_ntdcmsdll-$ARCH.so
trg=/usr/lib/sane/hpgt2500_ntdcmsdll-$ARCH.so
link=/usr/lib/i386-linux-gnu/sane/hpgt2500_ntdcmsdll.so

[hpgt2500_plugin_15]
src=scan/sane/hpgt2500_ntdcmsdll-$ARCH.so
trg=/usr/lib64/sane/hpgt2500_ntdcmsdll-$ARCH.so
link=/usr/lib64/x86_64-linux-gnu/sane/hpgt2500_ntdcmsdll.so

[hpgt2500_plugin_16]
src=data/rules/40-libsane.rules
trg=/etc/udev/rules.d/40-libsane.rules
