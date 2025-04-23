---
title: ior使用手册
date: 2025-01-24T13:52:45+0800
description: "本文详细介绍如何在使用ior以及相关参数解释。"
tags: [tools]
---


# 1. 前言
ior是一个并行I/O基准测试工具，可用于测试并行存储系统在各种接口和访问模式下的性能。ior存储库还包括mdtest基准测试，它专门测试不同目录结构下存储系统的峰值元数据速率。这两个基准测试都依赖MPI进行并行处理。


&nbsp;
&nbsp;
# 2. 语法
```bash
ior [options]
```

&nbsp;
&nbsp;
# 3. 参数
下面以一个例子来说明ior的参数用法。
```bash
ior --dataPacketType=timestamp -C -Q 1 -g -G=695406083 -F -k -e -o /mnt/testfs/test -t 4k -b 4k -s 262144 -w -z -D 300 -T 120 -a POSIX
```
上述命令启动1个ior进程，实现小文件随机写性能测试。主要参数含义如下：
- `-F`：filePerProc，表示每个进程分别读写不同的文件。如果不指定此选项，则所有进程将读写同一个文件。
- `-k`：keepFile，表示测试结束后保留测试文件而不删除。
- `-C`：reorderTasksConstant，更改读任务顺序，用于排除缓存对读操作的影响。
- `-e`：fsync，表示当所有的写操作结束后执行fsync操作，用于排除缓存对写操作的影响。该参数只对POSIX接口生效。
- `-o`：testFile，表示测试文件路径。
- `-t`：transferSize，表示每个I/O传输的数据大小。
- `-b`：blockSize，表示单个客户端读写的数据块大小。每个数据块由1个多个transferSize组成。
- `-s`：segmentCount，表示每个文件中包含的段数。每个段由一组连续的blockSize组成。
- `-w`：writeFile ，表示进行写操作。
- `-z`：randomOffset，。它的作用是通过随机化每次I/O操作的起始位置，模拟随机访问模式。
- `-D`：deadlineForStonewalling，表示停止读写操作动前的时间。主要防止落后的任务缓慢执行从而影响性能。可以理解为如果某个读写任务在规定的时间内没有完成，则停止该任务。
- `-T`：maxTimeDuration，表示整个测试的最大时间周期。该参数对于正在进行的读写操作无效，只会影响将要读写的操作。

其中最重要的参数是`-t`、`-b`和`-s`，文件总大小计算公式：`fileSize = blockSize * segmentCount * 进程数`。


&nbsp;
&nbsp;
# 4. 实例
测试3客户端32进程1m顺序写和顺序读性能，文件总大小：32x1T
```bash
mpirun \
--allow-run-as-root \
--host nodea:32,nodeb:32,nodec:32 \
--bind-to hwthread \
--map-by ppr:32:node \
ior --dataPacketType=timestamp -Q 1 -g -G=695406083 -F -k -C -e -o /mnt/testfs/test -t 1m -b 1T -w -r -D 300 -T 120 -a POSIX
```

测试3客户端32进程4k随机写和随机读性能，文件总大小：32x4kx262144
```bash
mpirun \
--allow-run-as-root \
--host nodea:32,nodeb:32,nodec:32 \
--bind-to hwthread \
--map-by ppr:32:node \
ior --dataPacketType=timestamp -Q 1 -g -G=695406083 -F -k -C -e -z -o /mnt/testfs/test -t 4k -b 4k -s 262144 -w -r -D 300 -T 120 -a POSIX
```

在关于读的性能测试之前，一般是手动提前构造出完整的文件数据，再去测试读。并且，一般是都是先测试完所有关于写的性能测试项，然后再测试所有关于读的性能测试项。

&nbsp;
&nbsp;
# 5. 参考资料
- [https://ior.readthedocs.io/en/latest/index.html](https://ior.readthedocs.io/en/latest/index.html)