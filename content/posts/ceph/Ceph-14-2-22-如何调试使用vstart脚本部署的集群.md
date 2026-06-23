---
title: "Ceph 14.2.22：如何调试使用vstart脚本部署的集群"
date: 2021-05-09T14:50:34+0800
description: "本文介绍如何调试使用vstart脚本部署的ceph集群。"
tags: [ceph]
---

# 1. 前言

使用 vstart.sh 脚本部署的集群是建立在本地已经编译的 Ceph 源码基础上的。因此如果需要调试 vstart.sh 脚本部署的集群，需要在本地编译 Ceph 源码。关于 Ceph 源码的编译方法，本文不再赘述，详细请参考 [如何编译 Ceph 源码](https://henglgh.github.io/articles/posts/ceph/Ceph-14-2-22-如何编译Ceph源码.md)。

本文将着重介绍如何在 `ubuntu 18.04` 中调试使用 vstart 脚本部署的 ceph 集群，ceph 版本为 `14.2.22`。

# 2. 集群部署

Ceph 源码提供了 vstart.sh 脚本来部署开发集群，该脚本会利用本地 ip 和不同端口来配置 `MON MGR OSD` 等。vstart.sh 脚本需要在 build 目录下运行。执行 `../src/vstart.sh -h` 可以查看 vstar.sh 使用说明。

```bash
../src/vstart.sh -h
---------------------
ex: MON=3 OSD=1 MDS=1 MGR=1 RGW=1 ../src/vstart.sh -n -d
options:
    -d, --debug
    -s, --standby_mds: Generate standby-replay MDS for each active
    -l, --localhost: use localhost instead of hostname
    -i <ip>: bind to specific ip
    -n, --new
    -N, --not-new: reuse existing cluster config (default)
    --valgrind[_{osd,mds,mon,rgw}] 'toolname args...'
    --nodaemon: use ceph-run as wrapper for mon/osd/mds
    --smallmds: limit mds cache size
    -m ip:port		specify monitor address
    -k keep old configuration files
    -x enable cephx (on by default)
    -X disable cephx
    -g --gssapi enable Kerberos/GSSApi authentication
    -G disable Kerberos/GSSApi authentication
    --hitset <pool> <hit_set_type>: enable hitset tracking
    -e : create an erasure pool
    -o config		 add extra config parameters to all sections
    --rgw_port specify ceph rgw http listen port
    --rgw_frontend specify the rgw frontend configuration
    --rgw_compression specify the rgw compression plugin
    -b, --bluestore use bluestore as the osd objectstore backend (default)
    -f, --filestore use filestore as the osd objectstore backend
    -K, --kstore use kstore as the osd objectstore backend
    --memstore use memstore as the osd objectstore backend
    --cache <pool>: enable cache tiering on pool
    --short: short object names only; necessary for ext4 dev
    --nolockdep disable lockdep
    --multimds <count> allow multimds with maximum active count
    --without-dashboard: do not run using mgr dashboard
    --bluestore-spdk <vendor>:<device>: enable SPDK and specify the PCI-ID of the NVME device
    --msgr1: use msgr1 only
    --msgr2: use msgr2 only
    --msgr21: use msgr2 and msgr1
```

## 2.1. 新建集群

```bash
MON=1 OSD=6 MDS=0 MGR=1 RGW=0 ../src/vstart.sh -d -n -x --without-dashboard
```
上述命令将创建一个包含 1 个 MON、6 个 OSD、1 个 MGR 的基本集群，该集群开启了 `cephx` 认证，开启了 `debug` 功能。

## 2.2. 重启集群或服务

目前 Ceph 14.2.22 的 vstart.sh 脚本还做不到可以单独重启某一个服务，如果需要重启某一个服务，只需要去掉 `-n` 参数即可。

```bash
MON=1 OSD=6 MDS=0 MGR=1 RGW=0 ../src/vstart.sh -d -x --without-dashboard
```

上述命令是重启集群所有服务，该命令不会新建集群。

## 2.3. 停止集群或服务

Ceph 14.2.22 的源码中提供了 stop.sh 脚本用来停止集群中的服务，目前该脚本还做不到单独停止某一个服务，但是可以停止某一类服务，也可以停止所有的服务，具体用法如下：

```bash
../src/stop.sh [all] [mon] [mds] [osd] [rgw]
```

经过测试发现，对象存储、块存储都可以正常部署并调试，文件系统部署可以正常部署，但是无法挂载。如果想要调试所有功能，不建议采取这种方式。建议生成 deb 包，然后按正常 ceph 部署，最后替换对用的动态库和二进制可执行文件即可调试。

## 2.4. 查看集群状态

Ceph 14.2.22 版本的 vstart.sh 脚本并没有将 ceph 可执行文件添加到系统环境变量中，所有的 ceph 命令都必须在 build 目录下执行。切换到 build 目录下，执行以下命令，查看集群状态。

```bash
./bin/ceph -s
---------------
cluster:
  id: 88b11a21- 7dd1- 49d8. bb24-C 18821ff09ae
  health: HEALTH ok

services:
  mon: 1 daemons, quorum a (age 5m)
  mgr: x(active, since 5m)
  osd: 6 osds: 6 up (since 4m)，6 in (since 4m)
data:
  pools:
  pools, 0 pgs
  objects: 0 objects, 0 B
  usage: 12 G1B used, 594 GiB / 606 GiB avail
  pgs:
```

执行 `./bin/ceph -s` 后默认会在终端输出如下信息：

```bash
2023-07-31 03:52:04.851 7fcff7cc5700 -1 WARNING: all dangerous and experimental features are enabled.
2023-07-31 03:52:04.907 7fcff7cc5700 -1 WARNING: all dangerous and experimental features are enabled.
```

如果不想输出这些信息，将 ceph.conf 文件中的参数 `enable experimental unrecoverable data corrupting features = *` 屏蔽掉就可以了。

## 2.5. Ceph Cache Tier 搭建

本案例需要调试 ceph 分级存储功能，为了方便调试，搭建了一个简单的分级存储。为集群分配 6 个 OSD，创建 2 个 pool，cache pool 和 ec pool，每个 pool 分配了 3 个 osd。详细部署参考 [Ceph Cache Tier 介绍与使用](https://www.cnblogs.com/cc-notes/p/19457671)。

# 3. 调试

## 3.1. 查看 PG-OSD 映射关系

如果仔细阅读源码，会发现 ceph 分级存储主要是由主 OSD 进程来负责。如果不是主 OSD，是无法调试到代码中的。所以需要查看分级存储中缓存池的 PG 映射关系。

```bash
./bin/ceph pg ls-by-pool cache_pool
-------------------------------------
PG OBJECTS DEGRADED MISPLACED UNFOUND BYTES OMAP_BYTES* OMAP_KEYS* LOG STATE 		SINCE VERSION REPORTED UP 		   ACTING		SCRUB_STAMP 					DEEP_SCRUB_STAMP
5.0		0		0			0 		0	0			0			0	18 active+clean   22h 	323'18 323:76 [2, 4,0]p2   [2,4,0]p2	2021-09-25 16:55:28.572062		2021-09-24 11:30:14.717641
```

从结果可以看到 PG5.0 对应的主 OSD 为 OSD.2。

## 3.2. 查看主 OSD 进程

```bash
ps -ef | grep osd
--------------------
admins 18806     1 1 Sep24 ?	 00:41:15 /home/admins/code/ceph/build/bin/ceph-osd -i 1 -C /home/admins/code/ceph/build/ceph.conf
admins 19096     1 1 Sep24 ?	 00:41:06 /home/admins/code/ceph/build/bin/ceph-osd -i 3 -C /home/admins/code/ceph/build/ceph.conf
admins 19242     1 1 Sep24 ?	 00:40:37 /home/admins/code/ceph/build/bin/ceph-osd -i 4 -C /home/admins/code/ceph/build/ceph.conf
admins 19415     1 1 Sep24 ?	 00:41:00 /home/admins/code/ceph/build/bin/ceph-osd -i 5 -C /home/admins/code/ceph/build/ceph.conf
admins 20385     1 1 Sep24 ?	 00:39:47 /home/admins/code/ceph/build/bin/ceph-osd -i 0 -C /home/admins/code/ceph/build/ceph.conf
admins 22235     1 1 Sep24 ?	 00:40:24 /home/admins/code/ceph/build/bin/ceph-osd -i 2 -C /home/admins/code/ceph/build/ceph.conf
```

从结果可以看到，主 OSD 进程号为 `22235`。

## 3.3. GDB 调试

### 3.3.1. 进入 gdb 模式

gdb 调试需要以管理员权限，执行以下命令，进入 gdb 模式。

```bash
sudo gdb
----------
[sudo] password for admins :
GNU gdb (Ubuntu 8.1. 1- Oubuntu1) 8.1.1
Copyright (C) 2018 Free Software Foundation, Inc.
License GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law. Type "show copying"
and "show warranty" for details.
This GDB was configured as" x86 64- linux- gnu".
Type”show configuration" for configuration details.
For bug repor ting instructions, please see:
<http://www.gnu.org/software/gdb/bugs/>.
Find the GDB manual and other documentation resources online at:
<http://www.gnu.org/software/gdb/documentation/>.
For help, type "help".
Type "apropos word" to search for commands related to "word".
(gdb)
```

### 3.3.2. attach osd2 进程

```bash
(gdb) attach 22235
--------------------
Attaching to process 22235
[New LWP 22237]
[New LWP 22238]
[New LWP 22239]
[New LWP 22248]
[New LWP 22249]
[New LWP 22250]
[New LWP 22251]
[New LWP 22254]
[New LWP 22255]
[New LWP 22256]
[New LWP 22257]
[New LWP 22258]
[New LWP 22259]
[New LWP 22260]
[New LWP 22269]
[New LWP 22270]
[New LWP 22271]
[Thread debugging using libthread db enabled]
Using host libthread db library "/lib/x86_64-linux-gnu/libthread db.so.1"
0x00007fd026a7dad3 in futex_ wait_ cancelable (private=<optimized out>, expected=0, futex_ word=0x55b3123d8910) at ../sysdeps/unix/sysv/Linux/futex-internal.h:8888	../sysdeps/unix/sysv/1inux/futex-internal.h: No such file or directory.
(gdb)
```

### 3.3.3. 设置断点

本例断电设置在 PrimaryLogPG::do_op 函数开始，设置完断点之后，执行 continue。

```bash
(gdb) b PrimaryLogPG.cc:1952
Breakpoint 1 at 0x55b305d28af2: file /home/admins/code/ceph/src/osd/PrimaryLogPG.cc, line 1952.
(gdb ) c
Continuing.
```

### 3.3.4. 测试

向存储池中写入数据，测试结果如下。

```bash
[Switching to Thread 0x7fd0034cb700 (LWP 22364)]
Thread 57 "tp_osd_tp" hit Breakpoint 1, PrimaryLogPG::do_op (this=0x55b312519400, op=...)
at /home/admins/code/ceph/src/osd/PrimaryLogPG.CC:1952
1952		{
```

从上面结果可以看到，当写入数据时，函数停在代码的 1952 行，现在就可以使用 gdb 命令进行代码调试，和正常调试代码一样。但需要值得注意的一点是，由于 ceph osd 存在心跳机制，当调试某一个 osd 时，如果长时间没有走完该走的流程，该 osd 会被标记为 down，就无法再继续调试。需要重新进入 gdb 模式。
