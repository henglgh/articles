---
title: lvm逻辑卷创建和使用
date: 2021-03-02T16:45:15+0800
description: "本文简单介绍vboxmanage常用的使用方法。"
tags: [others]
---

# 1. 前言
本文简单介绍vboxmanage常用的使用方法。

&nbsp;
&nbsp;
# 2. 虚拟机管理
## 2.1. 显示所有的虚拟机
```bash
vboxmanage list vms
```

## 2.2. 显示所有正在运行的虚拟机
```bash
vboxmanage list runningvms
```

## 2.3. 启动一个虚拟机
```bash
vboxmanage startvm b9901b60-e1d2-4b6b-a38c-a9bde7af9c1d --type=headless
```

## 2.4. 关闭一个虚拟机
```bash
vboxmanage controlvm b9901b60-e1d2-4b6b-a38c-a9bde7af9c1d poweroff
```

## 2.5. 为虚拟机添加一个磁盘
```bash
vboxmanage storageattach ab74d222-a713-4c81-89f8-2e9b0d31ad3f --storagectl SATA --port 1 --device 0 --type hdd --medium ./centos-8.4-3.13-disk1.vdi
```

&nbsp;
&nbsp;
# 3. 磁盘管理
## 3.1. 显示所有的磁盘
```bash
vboxmanage list hdds
```

## 3.2. 创建一个磁盘
```bash
vboxmanage createmedium --filename /vboxharddisk/centos-8.4-3.13/centos-8.4-3.13-disk1.vdi --size 1024 --format VDI
```

## 3.3. 删除一个磁盘
```bash
vboxmanage closemedium disk /vboxharddisk/centos-8.4-3.12/centos-8.4-3.12-disk1.vdi --delete
```

&nbsp;
&nbsp;
# 4. 快照管理
## 4.1. 显示某个虚拟机所有快照
```bash
vboxmanage snapshot ab74d222-a713-4c81-89f8-2e9b0d31ad3f list
```

## 4.2. 创建一个快照
```bash
vboxmanage snapshot ab74d222-a713-4c81-89f8-2e9b0d31ad3f take raid1
```

## 4.3. 删除一个快照
```bash
vboxmanage snapshot ab74d222-a713-4c81-89f8-2e9b0d31ad3f delete d074a9aa-f910-48a1-ab97-f41eb411188c
```

## 4.4. 恢复一个快照
```bash
vboxmanage snapshot ab74d222-a713-4c81-89f8-2e9b0d31ad3f restore f25f2972-3631-4472-8de9-c48f798f2525
```