---
title: mpirun使用手册
date: 2025-01-24T10:23:34+0800
description: "本文详细介绍如何在使用mpirun以及相关参数解释。"
tags: [tools]
---


# 1. 前言
mpirun是openmpi的命令行工具，它提供了一种简单的方式来并行启动应用程序，但是必须依赖openmpi环境。它允许在多个节点上同时启动多个并行应用程序，每个应用程序都是以进程的方式运行，而不是线程。另外，mpirun和mpiexec是同一个工具，用法相同。


&nbsp;
&nbsp;
# 2. 语法
**一个应用程序**
```bash
mpirun [mpirun参数] [应用程序]
```

**多个应用程序**
```bash
mpirun [mpirun全局参数] 
       [mpirun局部参数] [应用程序1] :
       [mpirun局部参数] [应用程序2] :
       [mpirun局部参数] [应用程序3]
```
其中`[应用程序1]`后面必须是`空格 + :`。

**常见的用法**
```bash
mpirun [ -n X ] [ --hostfile <filename> ]  <program>
或者
mpirun [ --host hostname:X ] [ --map-by ppr:X:node ] <program>
```
上述`X`表示进程数，即启动多少个进程。


&nbsp;
&nbsp;
# 3. 参数
下面将以一个完整例子对mpirun的相关参数进行解释：
```bash
mpirun \
--allow-run-as-root \
-x LD_PRELOAD=/usr/lib64/libpil4dfs.so \
--host nodeb:32 \
--bind-to hwthread \
--map-by ppr:32:node \
ior --dataPacketType=timestamp -C -Q 1 -g -G=695406083 -F -k -e -o /mnt/testfs/test -t 4k -b 4k -s 262144 -w -D 300 -T 120 -a POSIX
```
上述采用指定host的方式而不是hostfile的方式，用mpirun在nodeb节点上启动32个进程，每个进程都运行一个ior程序。以下是参数解释：
- `--allow-run-as-root`：允许以root用户身份运行mpirun。
- `-x LD_PRELOAD=/usr/lib64/libpil4dfs.so`：设置环境变量LD_PRELOAD的值为/usr/lib64/libpil4dfs.so。
- `--host nodeb:32`：指定运行节点为nodeb，进程数为32。
- `--bind-to hwthread`：将进程绑定到硬件线程上。默认是`bind-to core`：与core进行绑定。当应用程序中启动了多线程，需要指定`--bind-to none`。
- `--map-by ppr:32:node`：将进程分布到节点上，每个节点上运行32个进程。默认是`map-by core`：按节点先后顺序以轮询的方式分布到core上。当第一个节点的core的slots数量不够时，会自动将进程分布到下一个节点上。

其中要着重说明`--host`和`--hostfile`在使用上的区别：
- 当使用`--host`参数指定mpirun要在哪些节点上启动应用程序时，一定要按照`--host hostname1:X,hostname2:X...`的格式来指定，其中`X`表示每个节点上总的slots数量。当要指定每个节点实际要启动的进程数量时，要使用`--map-by ppr:Y:node`方式。其中`X`和`Y`的关系是：Y <= X。
- 当使用`--hostfile`参数指定mpirun要在哪些节点上启动应用程序时，需要创建一个hostfile文件，文件内容按照`hostname slots=X`的格式来指定。其中`slots`表示每个节点上总的slots数量。当要指定每个节点实际要启动的进程数量时，可以使用`-n Y`方式。其中`X`和`Y`的关系是：Y <= X。(官方文档说 `-n Y`这种方式已经被抛弃了，推荐使用`--map-by ppr:Y:node`的方式)。


&nbsp;
&nbsp;
# 4. 实例
在3个节点上分别并行启动32个ior进程。  
**host方式**
```bash
mpirun \
--allow-run-as-root \
--host nodea:32,nodeb:32,nodec:32 \
--bind-to hwthread \
--map-by ppr:32:node \
ior --dataPacketType=timestamp -C -Q 1 -g -G=695406083 -F -k -e -o /mnt/testfs/test -t 4k -b 4k -s 262144 -w -D 300 -T 120 -a POSIX
```

**hostfile方式**
```bash
mpirun \
--allow-run-as-root \
--hostfile hostfile \
--bind-to hwthread \
--map-by ppr:32:node \
ior --dataPacketType=timestamp -C -Q 1 -g -G=695406083 -F -k -e -o /mnt/testfs/test -t 4k -b 4k -s 262144 -w -D 300 -T 120 -a POSIX
```
hostfile文件内容：
```bash
nodea slots=32
nodeb slots=32
nodec slots=32
```

&nbsp;
&nbsp;
# 5. 参考资料
- [https://docs.open-mpi.org/en/v5.0.x/man-openmpi/man1/mpirun.1.html](https://docs.open-mpi.org/en/v5.0.x/man-openmpi/man1/mpirun.1.html)
- [https://www-lb.open-mpi.org/](https://www-lb.open-mpi.org/)