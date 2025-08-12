---
title: lvm逻辑卷创建和使用
date: 2021-03-02T10:45:15+0800
description: "本文介绍如何在almalinux 8.9下创建物理卷、卷组和逻辑卷。"
tags: [others]
---

# 1. 前言
本文详细介绍如何创建物理卷，卷组，逻辑卷。

&nbsp;
&nbsp;
# 2. 物理卷
## 2.1. 创建pv
```bash
pvcreate /dev/loop0
```
其中`/dev/loop0`是物理磁盘路径。

## 2.2. 查看pv简短信息
```bash
pvscan
-------
  PV /dev/sda2    VG almalinux       lvm2 [<99.00 GiB / 0    free]
  PV /dev/loop0                      lvm2 [1.00 GiB]
  Total: 2 [<100.00 GiB] / in use: 1 [<99.00 GiB] / in no VG: 1 [1.00 GiB]
```
其中`/dev/loop0`就是pv的名字。

## 2.3. 查看pv详细信息
```bash
pvdisplay /dev/loop0
---------------------
  PV Name               /dev/loop0
  VG Name               loopvg
  PV Size               1.00 GiB / not usable 4.00 MiB
  Allocatable           yes
  PE Size               4.00 MiB
  Total PE              255
  Free PE               255
  Allocated PE          0
  PV UUID               6KDcQA-sPNq-t7MC-UmCK-EuLs-pVxG-DX4T6j
```

&nbsp;
&nbsp;
# 3. 卷组
## 3.1. 创建vg
```bash
vgcreate loopvg /dev/loop0
```
其中`loopvg`是vg的名字，`/dev/loop0`是pv的名字。

## 3.2. 查看vg简短信息
```bash
vgscan
-------
  Found volume group "almalinux" using metadata type lvm2
  Found volume group "loopvg" using metadata type lvm2
```

## 3.3. 查看vg详细信息
```bash
vgdisplay loopvg
-----------------
  --- Volume group ---
  VG Name               loopvg
  System ID
  Format                lvm2
  Metadata Areas        1
  Metadata Sequence No  1
  VG Access             read/write
  VG Status             resizable
  MAX LV                0
  Cur LV                0
  Open LV               0
  Max PV                0
  Cur PV                1
  Act PV                1
  VG Size               1020.00 MiB
  PE Size               4.00 MiB
  Total PE              255
  Alloc PE / Size       0 / 0
  Free  PE / Size       255 / 1020.00 MiB
  VG UUID               QwDRoL-06Xb-wD43-iQtn-sLYx-VnD2-IgU7WM

```

&nbsp;
&nbsp;
# 4. 逻辑卷
## 4.1. 创建lv
```bash
lvcreate -L 100M -n test1 loopvg
lvcreate -L 100M -n test2 loopvg
```
其中`loopvg`是vg的名字，`test1`和`test2`是lv的名字。也可以使用百分比来创建逻辑卷。

```bash
lvcreate -l 50%VG -n test1 loopvg
lvcreate -l 50%FREE -n test2 loopvg
```
`50%VG`表示分整个VG物理卷空间的50%，`50%FREE`表示分配剩余物理卷空间的50%。

## 4.2. 查看lv简短信息
```bash
lvscan
-------
  ACTIVE            '/dev/almalinux/swap' [<3.95 GiB] inherit
  ACTIVE            '/dev/almalinux/home' [31.18 GiB] inherit
  ACTIVE            '/dev/almalinux/root' [<63.87 GiB] inherit
  ACTIVE            '/dev/loopvg/test1' [100.00 MiB] inherit
  ACTIVE            '/dev/loopvg/test2' [100.00 MiB] inherit
```

## 4.3. 查看lv详细信息
```bash
lvdisplay /dev/loopvg/test1
----------------------------
  LV Path                /dev/loopvg/test1
  LV Name                test1
  VG Name                loopvg
  LV UUID                ejeHeT-eJQC-4mA7-cG81-fndG-r6Nj-Gy1wb4
  LV Write Access        read/write
  LV Creation host, time mgs, 2024-09-29 16:10:30 +0800
  LV Status              available
  # open                 0
  LV Size                100.00 MiB
  Current LE             25
  Segments               1
  Allocation             inherit
  Read ahead sectors     auto
  - currently set to     8192
  Block device           253:3
```
此时，也可以通过`lsblk`命令查看到`/dev/loop0`已经划出2个逻辑卷。

```bash
NAME               MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
loop0                7:0    0    1G  0 loop
├─loopvg-test1     253:3    0  100M  0 lvm
└─loopvg-test2     253:4    0  100M  0 lvm
sda                  8:0    0  100G  0 disk
├─sda1               8:1    0    1G  0 part /boot
└─sda2               8:2    0   99G  0 part
  ├─almalinux-root 253:0    0 63.9G  0 lvm  /
  ├─almalinux-swap 253:1    0    4G  0 lvm  [SWAP]
  └─almalinux-home 253:2    0 31.2G  0 lvm  /home
sr0                 11:0    1 1024M  0 rom
```
逻辑卷成功创建后，可以像使用块设备一样格式化并挂载。