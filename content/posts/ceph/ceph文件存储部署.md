---
title: ceph文件存储部署
date: 2024-12-09T14:47:49+0800
description: "本文介绍如何部署ceph文件存储系统，并使用ceph文件存储系统。"
tags: [ceph]
---


# 1. 前言
本文介绍如何部署ceph文件存储系统，并使用ceph文件存储系统。系统环境如下：
```bash
ceph:           14.2.22
linux os:       ubuntu 18.04
```
本文默认已经提前部署ceph集群，如果没有部署，请参考[ceph集群部署deploy多机模式]({{< ref "ceph集群部署deploy多机模式.md" >}})。

&nbsp;
&nbsp;
# 2. 集群规划
```bash
mon             192.168.3.11      node1
mgr             192.168.3.11      node1
mds             192.168.3.11      node1
osd.0           192.168.3.11      node1
osd.1           192.168.3.12      node2
osd.2           192.168.3.13      node3
ceph-delpoy     192.168.3.10      node0
```
在ceph集群中，安装了ceph软件的并且部署了一系列ceph集群服务的主机被称之为ceph集群节点，上图中的node0虽然属于管理节点，但它并不属于ceph集群，它没有安装任何ceph软件，也没有部署任何ceph集群服务。

&nbsp;
&nbsp;
# 3. 文件存储部署
### 3.1. 创建mds服务
在管理节点（node0）上执行以下命令：
```bash
ceph-deploy --overwrite-conf mds create node1
```
其中`node1`为集群节点的hostname，该命令将在node1上安装mds软件。

### 3.2. 创建数据池
在集群节点（node1）上执行以下命令：
```bash
ceph osd pool create cephfs_data 1 1
```
其中`cephfs_data`是数据池的名字，`1 1`分别表示pg和pgp的数量，因为是测试，所以都设置为1。

### 3.3. 创建元数据池
在集群节点（node1）上执行以下命令：
```bash
ceph osd pool create cephfs_metadata 1 1
```
其中`cephfs_metadata`是元数据池的名字，`1 1`分别表示pg和pgp的数量，因为是测试，所以都设置为1。

### 3.4. 创建文件系统
在集群节点（node1）上执行以下命令：
```bash
ceph fs new cephfs cephfs_metadata cephfs_data
```
其中`cephfs `为文件系统的名字，`cephfs_metadata和cephfs_data`分别表示元数据池的名字和数据池的名字。该命令将会创建一个名为cephfs的文件系统，文件系统的元数据将存在cephfs_metadata元数据池中，文件系统的数据将存在cephfs_data数据池中。

### 3.5. 查看创建的文件系统
在集群节点（node1）上执行以下命令：
```bash
ceph fs ls
-----------------------------------------------------------------------------------------------------------------------
name: cephfs, metadata pool: cephfs_metadata, data pools: [cephfs_data ]
```

&nbsp;
&nbsp;
# 4. 使用文件系统
### 4.1. 挂载文件系统
在集群节点（node1）上执行以下命令：
```bash
ceph-fuse /mnt/cephfs_fuse/
```
其中`/mnt/cephfs_fuse/`是文件系统cephfs将要挂载的路径。在Linux上挂载ceph文件系统有2种方式：内核挂载和ceph-fuse挂载，ceph-fuse是用户态挂在方式。

### 4.2. 查看挂载路径
在集群节点（node1）上执行以下命令：
```bash
df -h
-----------------------------------------------------------------------------------------------------------------------
Filesystem                 Size  Used Avail Use% Mounted on
udev                       2.0G     0  2.0G   0% /dev
tmpfs                      396M  5.8M  390M   2% /run
/dev/mapper/node--vg-root   97G  2.1G   90G   3% /
tmpfs                      2.0G     0  2.0G   0% /dev/shm
tmpfs                      5.0M     0  5.0M   0% /run/lock
tmpfs                      2.0G     0  2.0G   0% /sys/fs/cgroup
/dev/sda1                  720M   59M  625M   9% /boot
tmpfs                      396M     0  396M   0% /run/user/0
tmpfs                      2.0G   52K  2.0G   1% /var/lib/ceph/osd/ceph-0
tmpfs                      2.0G   52K  2.0G   1% /var/lib/ceph/osd/ceph-1
tmpfs                      2.0G   52K  2.0G   1% /var/lib/ceph/osd/ceph-2
ceph-fuse                  8.5G     0  8.5G   0% /mnt/cephfs_fuse
```

### 4.3. 添加文件到挂载路径
在集群节点（node1）上执行以下命令：
```bash
cp test /mnt/cephfs_fuse
```

### 4.4. 查看集群I/O读写状态
在集群节点（node1）上执行以下命令：
```bash
ceph -s
-----------------------------------------------------------------------------------------------------------------------
cluster:
  id:     bd6272c1-36ef-4af0-9888-19582c0f4ef0
  health: HEALTH_OK

services:
  mon: 1 daemons, quorum node (age 21m)
  mgr: node(active, since 21m)
  mds: cephfs:1 {0=node=up:active}
  osd: 3 osds: 3 up (since 21m), 3 in (since 26m)

data:
  pools:   2 pools, 2 pgs
  objects: 23 objects, 10 KiB
  usage:   3.0 GiB used, 27 GiB / 30 GiB avail
  pgs:     2 active+clean

io:
  client:   767 B/s wr, 0 op/s rd, 0 op/s wr
```

### 4.5. 查看数存储池使用状况
在集群节点（node1）上执行以下命令：
```bash
ceph df
-----------------------------------------------------------------------------------------------------------------------
RAW STORAGE:
    CLASS     SIZE       AVAIL      USED       RAW USED     %RAW USED 
    hdd       30 GiB     27 GiB     12 MiB      3.0 GiB         10.04 
    TOTAL     30 GiB     27 GiB     12 MiB      3.0 GiB         10.04 
 
POOLS:
    POOL                ID     PGS     STORED     OBJECTS     USED        %USED     MAX AVAIL 
    cephfs_data          1       1       13 B           1     192 KiB         0       8.5 GiB 
    cephfs_metadata      2       1     12 KiB          22     1.5 MiB         0       8.5 GiB 
```

### 4.6. 查看数据池存储中的对象
在集群节点（node1）上执行以下命令：
```bash
rados -p cephfs_data ls
-----------------------------------------------------------------------------------------------------------------------
10000000000.00000000
```