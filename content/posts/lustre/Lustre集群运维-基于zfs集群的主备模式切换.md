---
title: Lustre集群运维-基于zfs集群的主备模式切换
date: 2021-07-01T10:27:16+0800
description: "本文详细介绍基于zfs的主备容灾模式的集群出现故障后，如何手动进行主备切换。"
tags: [lustre]
---

> lustre版本：2.15.4

# 1. 概述
Lustre没有高可用机制，当集群出现故障时，需要运维人员手动处理。本文详细介绍基于zfs的主备容灾模式的集群出现故障后（比如mgs服务出现故障），如何手动进行主备切换。

&nbsp;
&nbsp;
# 2. 主节点
## 2.1. 关闭mds服务
```bash
umount /lustre/mdt/mdt0
```

## 2.2. 导出mdtpool
```bash
zpool export mdtpool
```

## 2.3. 检查mdtpool是否已经被导出
```bash
zpool list
```
- 以上是模拟主节点中mgs服务由于某种原因导致其无法正常工作。如果主节点出现故障，比如出现断电，可以直接忽略以上步骤。
- 如果在`zpool list`列出的pool中没有mdtpool，说明已经正确从主节点中导出mdtpool。
- mdtpool必须可以通过网络在主备节点中共享，否则上述操作无法执行。

&nbsp;
&nbsp;
# 3. 备节点
## 3.1. 导入mdtpool
```bash
zpool import -o cachefile=none mdtpool
```
注：mdtpool只能同时被一个节点导入。

## 3.2. 检查mdtpool是否已经被导入
```bash
zpool list
```
如果在列出的pool中出现mdtpool，说明已经正确导入mdtpool。

## 3.3. 启动mds服务
```bash
mkdir -o /lustre/mdt/mdt0
mount -t lustre mdtpool/mdt0 /lustre/mdt/mdt0 -v
```

&nbsp;
&nbsp;
# 4. 参考资料
1. [https://wiki.lustre.org/Managing_Lustre_with_the_ZFS_backend_as_a_High_Availability_Service](https://wiki.lustre.org/Managing_Lustre_with_the_ZFS_backend_as_a_High_Availability_Service)