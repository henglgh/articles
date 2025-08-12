---
title: iscsi target创建和使用
date: 2021-03-01T16:45:15+0800
description: "本文介绍如何在almalinux 8.9下创建、挂载和卸载iscsi target。"
tags: [others]
---

# 1. 前言
本文介绍如何在almalinux 8.9下创建、挂载和卸载iscsi target。

&nbsp;
&nbsp;
# 2. 服务端
## 2.1. 关闭防火墙
```bash
systemctl stop firewalld.service
systemctl disable firewalld.service
```

## 2.2. 安装targetcli
```bash
dnf install targetcli
```

## 2.3. 配置target
```bash
[root@node0 ~]# targetcli
-----------------------------
Warning: Could not load preferences file /root/.targetcli/prefs.bin.
targetcli shell version 2.1.53
Copyright 2011-2013 by Datera, Inc and others.
For help on commands, type 'help'.
/> 
/> ls
o- / ............................................................................. [...]
  o- backstores .................................................................. [...]
  | o- block ...................................................... [Storage Objects: 0]
  | o- fileio ..................................................... [Storage Objects: 0]
  | o- pscsi ...................................................... [Storage Objects: 0]
  | o- ramdisk .................................................... [Storage Objects: 0]
  o- iscsi ................................................................ [Targets: 0]
  o- loopback ............................................................. [Targets: 0]
/> 
/> cd backstores/block 
/backstores/block> create disk0 /dev/md0
Created block storage object disk0 using /dev/md0.
/backstores/block> 
/backstores/block> create disk1 /dev/md1
Created block storage object disk1 using /dev/md1.

/backstores/block> create disk2 /dev/md2
Created block storage object disk2 using /dev/md2.
/backstores/block> 
/backstores/block> create disk3 /dev/md3
Created block storage object disk3 using /dev/md3.
/backstores/block> 
/backstores/block> create disk4 /dev/md4
Created block storage object disk4 using /dev/md4.
/backstores/block> 
/backstores/block> ls
o- block ......................................................... [Storage Objects: 5]
  o- disk0 .............................. [/dev/md0 (1022.0MiB) write-thru deactivated]
  | o- alua .......................................................... [ALUA Groups: 1]
  |   o- default_tg_pt_gp .............................. [ALUA state: Active/optimized]
  o- disk1 .............................. [/dev/md1 (1022.0MiB) write-thru deactivated]
  | o- alua .......................................................... [ALUA Groups: 1]
  |   o- default_tg_pt_gp .............................. [ALUA state: Active/optimized]
  o- disk2 .............................. [/dev/md2 (1022.0MiB) write-thru deactivated]
  | o- alua .......................................................... [ALUA Groups: 1]
  |   o- default_tg_pt_gp .............................. [ALUA state: Active/optimized]
  o- disk3 .............................. [/dev/md3 (1022.0MiB) write-thru deactivated]
  | o- alua .......................................................... [ALUA Groups: 1]
  |   o- default_tg_pt_gp .............................. [ALUA state: Active/optimized]
  o- disk4 .............................. [/dev/md4 (1022.0MiB) write-thru deactivated]
    o- alua .......................................................... [ALUA Groups: 1]
      o- default_tg_pt_gp .............................. [ALUA state: Active/optimized]
/backstores/block> 
/backstores/block>  cd /iscsi 
/iscsi> 
/iscsi> ls
o- iscsi ................................................................. [Targets: 0]
/iscsi> 
/iscsi> create 
Created target iqn.2003-01.org.linux-iscsi.node0.x8664:sn.ca0479954481.
Created TPG 1.
Global pref auto_add_default_portal=true
Created default portal listening on all IPs (0.0.0.0), port 3260.
/iscsi> ls
o- iscsi ................................................................. [Targets: 1]
  o- iqn.2003-01.org.linux-iscsi.node0.x8664:sn.ca0479954481 ................ [TPGs: 1]
    o- tpg1 .................................................... [no-gen-acls, no-auth]
      o- acls ............................................................... [ACLs: 0]
      o- luns ............................................................... [LUNs: 0]
      o- portals ......................................................... [Portals: 1]
        o- 0.0.0.0:3260 .......................................................... [OK]
/iscsi> 
/iscsi> cd iqn.2003-01.org.linux-iscsi.node0.x8664:sn.ca0479954481
/iscsi/iqn.20....ca0479954481> ls
o- iqn.2003-01.org.linux-iscsi.node0.x8664:sn.ca0479954481 .................. [TPGs: 1]
  o- tpg1 ...................................................... [no-gen-acls, no-auth]
    o- acls ................................................................. [ACLs: 0]
    o- luns ................................................................. [LUNs: 0]
    o- portals ........................................................... [Portals: 1]
      o- 0.0.0.0:3260 ............................................................ [OK]
/iscsi/iqn.20....ca0479954481> cd tpg1/luns 
/iscsi/iqn.20...481/tpg1/luns> ls
o- luns ..................................................................... [LUNs: 0]
/iscsi/iqn.20...481/tpg1/luns> 
/iscsi/iqn.20...481/tpg1/luns> create /backstores/block/disk0
Created LUN 0.
/iscsi/iqn.20...481/tpg1/luns> create /backstores/block/disk1
Created LUN 1.
/iscsi/iqn.20...481/tpg1/luns> create /backstores/block/disk2
Created LUN 2.
/iscsi/iqn.20...481/tpg1/luns> create /backstores/block/disk3
Created LUN 3.
/iscsi/iqn.20...481/tpg1/luns> create /backstores/block/disk4
Created LUN 4.
/iscsi/iqn.20...481/tpg1/luns> ls
o- luns ...................................................................... [LUNs: 5]
  o- lun0 .................................. [block/disk0 (/dev/md0) (default_tg_pt_gp)]
  o- lun1 .................................. [block/disk1 (/dev/md1) (default_tg_pt_gp)]
  o- lun2 .................................. [block/disk2 (/dev/md2) (default_tg_pt_gp)]
  o- lun3 .................................. [block/disk3 (/dev/md3) (default_tg_pt_gp)]
  o- lun4 .................................. [block/disk4 (/dev/md4) (default_tg_pt_gp)]
/iscsi/iqn.20...481/tpg1/luns> 
/iscsi/iqn.20...481/tpg1/luns> cd ../portals/
/iscsi/iqn.20.../tpg1/portals> ls
o- portals ................................................................ [Portals: 1]
  o- 0.0.0.0:3260 ................................................................. [OK]
/iscsi/iqn.20.../tpg1/portals> 
/iscsi/iqn.20.../tpg1/portals> delete 0.0.0.0 3260 
Deleted network portal 0.0.0.0:3260
/iscsi/iqn.20.../tpg1/portals> ls
o- portals ................................................................ [Portals: 0]
/iscsi/iqn.20.../tpg1/portals> 
/iscsi/iqn.20.../tpg1/portals> create 192.168.3.13
Using default IP port 3260
Created network portal 192.168.3.13:3260.
/iscsi/iqn.20.../tpg1/portals> ls
o- portals ................................................................ [Portals: 1]
  o- 192.168.3.13:3260 ............................................................ [OK]
/iscsi/iqn.20.../tpg1/portals> 
/iscsi/iqn.20.../tpg1/portals> cd ../acls 
/iscsi/iqn.20...481/tpg1/acls> ls
o- acls ...................................................................... [ACLs: 0]
/iscsi/iqn.20...481/tpg1/acls> 
/iscsi/iqn.20...481/tpg1/acls> create iqn.1994-05.com.redhat:548b94f7b6c4
Created Node ACL for iqn.1994-05.com.redhat:548b94f7b6c4
Created mapped LUN 4.
Created mapped LUN 3.
Created mapped LUN 2.
Created mapped LUN 1.
Created mapped LUN 0.
/iscsi/iqn.20...481/tpg1/acls> ls
o- acls ....................................................................... [ACLs: 1]
  o- iqn.1994-05.com.redhat:548b94f7b6c4 ............................... [Mapped LUNs: 5]
    o- mapped_lun0 .............................................. [lun0 block/disk0 (rw)]
    o- mapped_lun1 .............................................. [lun1 block/disk1 (rw)]
    o- mapped_lun2 .............................................. [lun2 block/disk2 (rw)]
    o- mapped_lun3 .............................................. [lun3 block/disk3 (rw)]
    o- mapped_lun4 .............................................. [lun4 block/disk4 (rw)]
/iscsi/iqn.20...481/tpg1/acls> 
/iscsi/iqn.20...481/tpg1/acls> cd ../
/iscsi/iqn.20...79954481/tpg1> 
/iscsi/iqn.20...79954481/tpg1> set attribute demo_mode_write_protect=0
Parameter demo_mode_write_protect is now '0'.
/iscsi/iqn.20...79954481/tpg1> set attribute generate_node_acls=1
Parameter generate_node_acls is now '1'.
/iscsi/iqn.20...79954481/tpg1> 
```

## 2.4. 启动target.service
```bash
systemctl enable target.service
systemctl start target.service
```

&nbsp;
&nbsp;
# 3. 客户端
## 3.1. 关闭防火墙
```bash
systemctl stop firewalld.service
systemctl disable firewalld.service
```

## 3.2. 修改/etc/iscsi/initiatorname.iscsi文件
```ini
InitiatorName=iqn.1994-05.com.redhat:node1
```
不同机器的`InitiatorName`一定要不同。`iqn.1994-05.com.redhat:node1`是固定格式，通常只需要更改最后的`node1`部分即可。

## 3.3. 启动iscid服务
```bash
systemctl start iscsid.service
```

## 3.4. 发现目标
```bash
iscsiadm -m discovery -t st -p 192.168.3.13
```

## 3.5. 挂载目标
```bash
iscsiadm -m node -T iqn.2003-01.org.linux-iscsi.node0.x8664:sn.ca0479954481 -p 192.168.3.13 -l
```

## 3.6. 卸载目标
```bash
iscsiadm -m node -T iqn.2003-01.org.linux-iscsi.node0.x8664:sn.ca0479954481 -p 192.168.3.13 -u
```

&nbsp;
&nbsp;
# 4. 参考资料
- [https://access.redhat.com/documentation/zh-cn/red_hat_enterprise_linux/8/html/managing_storage_devices/index](https://access.redhat.com/documentation/zh-cn/red_hat_enterprise_linux/8/html/managing_storage_devices/index)
- [https://github.com/Datera/targetcli?tab=readme-ov-file](https://github.com/Datera/targetcli?tab=readme-ov-file)