---
title: Ceph集群部署-块存储
date: 2021-05-05T14:48:04+0800
description: "本文详细介绍如何部署ceph块存储系统，以及如何使用ceph块存储系统。"
tags: [ceph]
---


# 1. 前言
本文详细介绍如何部署ceph块存储系统，以及如何使用ceph块存储系统。系统环境如下：
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
osd.0           192.168.3.11      node1
osd.1           192.168.3.12      node2
osd.2           192.168.3.13      node3
ceph-delpoy     192.168.3.10      node0
```
在ceph集群中，安装了ceph软件的并且部署了一系列ceph集群服务的主机被称之为ceph集群节点，上图中的node0虽然属于管理节点，但它并不属于ceph集群，它没有安装任何ceph软件，也没有部署任何ceph集群服务。

&nbsp;
&nbsp;
# 3. 块存储部署
### 3.1. 创建数据池
在集群节点（node1）上执行以下命令：
```bash
ceph osd pool create rbd_pool 1 1
```
其中`rbd_pool`是数据池的名字，`1 1`分别是pg和pgp的数量，因为是测试集群，所以都设置为1。

### 3.2. 创建块设备镜像
在集群节点（node1）上执行以下命令：
```bash
rbd create --pool rbd_pool --image image1 --size 1024 --image-format 2 --image-feature layering
```
其中`rbd_pool`是数据池的名字，`image1`是镜像的名字，`1024`是镜像的大小，其他参数不变即可。

### 3.3. 查看创建的块设备镜像
在集群节点（node1）上执行以下命令：
```bash
rbd ls rbd_pool
-----------------------------------------------------------------------------------------------------------------------
image1
```
上述命令中`rbd_pool`是数据池的名字。

### 3.4. 查看块设备镜像详细信息
在集群节点（node1）上执行以下命令：
```bash
rbd info --pool rbd_pool --image image1
-----------------------------------------------------------------------------------------------------------------------
rbd image 'image1':
        size 1 GiB in 256 objects
        order 22 (4 MiB objects)
        snapshot_count: 0
        id: 855c42793555
        block_name_prefix: rbd_data.855c42793555
        format: 2
        features: layering
        op_features: 
        flags: 
        create_timestamp: Tue Dec 27 11:53:43 2022
        access_timestamp: Tue Dec 27 11:53:43 2022
        modify_timestamp: Tue Dec 27 11:53:43 2022
```
上述命令中`rbd_pool`是数据池的名字`image1`是rbd_pool数据池中存在的镜像的名字。

&nbsp;
&nbsp;
# 4. 块存储使用
### 4.1. 映射块设备镜像到系统块设备
在集群节点（node1）上执行以下命令：
```bash
rbd map --pool rbd_pool --image image1
```
其中`rbd_pool`是数据池的名字`image1`是rbd_pool数据池中存在的镜像的名字。

### 4.2. 查看所有镜像映射结果
在集群节点（node1）上执行以下命令：
```bash
rbd showmapped
-----------------------------------------------------------------------------------------------------------------------
id     pool        namespace     image      snap     device    
0      rbd_pool                  image1     -        /dev/rbd0
```
从结果显示rbd_pool数据池中的镜像image1已经被映射到成linux系统的一个块设备，块设备名字为`rbd0`。

### 4.3. 格式化块设备
在集群节点（node1）上执行以下命令：
```bash
mkfs.ext4 -m0 /dev/rbd0
```
其中`/dev/rbd0`为映射出的块设备路径。

### 4.4. 挂载块设备
在集群节点（node1）上执行以下命令：
```bash
mount /dev/rbd0 /mnt/rbd
```
其中`/dev/rbd0`是映射出的块设备路径，`/mnt/rbd`是挂载路径。

### 4.5. 查看挂载结果
在集群节点（node1）上执行以下命令：
```bash
df -h
-----------------------------------------------------------------------------------------------------------------------
Filesystem                 Size  Used Avail Use% Mounted on
udev                       1.9G     0  1.9G   0% /dev
tmpfs                      395M  5.8M  389M   2% /run
/dev/mapper/node--vg-root   97G  5.7G   87G   7% /
tmpfs                      2.0G     0  2.0G   0% /dev/shm
tmpfs                      5.0M     0  5.0M   0% /run/lock
tmpfs                      2.0G     0  2.0G   0% /sys/fs/cgroup
/dev/sda1                  720M  124M  560M  19% /boot
tmpfs                      2.0G   24K  2.0G   1% /var/lib/ceph/osd/ceph-1
tmpfs                      2.0G   24K  2.0G   1% /var/lib/ceph/osd/ceph-0
tmpfs                      2.0G   24K  2.0G   1% /var/lib/ceph/osd/ceph-2
tmpfs                      395M     0  395M   0% /run/user/0
/dev/rbd0                  976M  1.3M  959M   1% /mnt/rbd
```

### 4.6. 添加文件到挂载路径
在集群节点（node1）上执行以下命令：
```bash
cp test /mnt/rbd
```

### 4.7. 查看集群I/O读写状态
在集群节点（node1）上执行以下命令：
```bash
ceph -s
-----------------------------------------------------------------------------------------------------------------------
  cluster:
    id:     bd6272c1-36ef-4af0-9888-19582c0f4ef0
    health: HEALTH_OK
 
  services:
    mon: 1 daemons, quorum node (age 60m)
    mgr: node(active, since 60m)
    mds: cephfs:1 {0=node=up:active}
    osd: 3 osds: 3 up (since 60m), 3 in (since 3w)
 
  data:
    pools:   3 pools, 3 pgs
    objects: 43 objects, 39 MiB
    usage:   3.1 GiB used, 27 GiB / 30 GiB avail
    pgs:     3 active+clean
 
  io:
    client:   3.0 KiB/s wr, 0 op/s rd, 0 op/s wr
```

### 4.8. 查看数据池使用状况
在集群节点（node1）上执行以下命令：
```bash
ceph df
-----------------------------------------------------------------------------------------------------------------------
RAW STORAGE:
    CLASS     SIZE       AVAIL      USED        RAW USED     %RAW USED 
    hdd       30 GiB     27 GiB     137 MiB      3.1 GiB         10.45 
    TOTAL     30 GiB     27 GiB     137 MiB      3.1 GiB         10.45 
 
POOLS:
    POOL                ID     PGS     STORED      OBJECTS     USED        %USED     MAX AVAIL 
    rbd_pool             1       1      32 MiB          19      99 MiB      0.38       8.5 GiB
```

### 4.9. 查看数据池存储中的对象
在集群节点（node1）上执行以下命令：
```bash
rados -p rbd_ pool ls
-----------------------------------------------------------------------------------------------------------------------
rbd_data.5e8c1108e34c.00000000000000c9
rbd_data.5e8c1108e34c.000000000000004f
rbd_data.5e8c1108e34c.00000000000000dc
rbd_data.5e8c1108e34c.00000000000000d5
rbd_data.5e8c1108e34c.00000000000000d1
rbd_data.5e8c1108e34c.00000000000000da
rbd_data.5e8c1108e34c.00000000000000c2
rbd_data.5e8c1108e34c.00000000000000b9
rbd_data.5e8c1108e34c.0000000000000075
rbd_data.5e8c1108e34c.00000000000000ac
rbd_data.5e8c1108e34c.0000000000000000
rbd_data.5e8c1108e34c.0000000000000050 
rbd_data.5e8c1108e34c.00000000000000e0
rbd_data.5e8c1108e34c.0000000000000089
rbd_data.5e8c1108e34c.0000000000000095
```