---
title: fio使用手册
date: 2025-01-24T16:10:10+0800
description: "本文详细介绍如何在使用fio以及相关参数解释。"
tags: [tools]
---


# 1. 前言
fio会生成多个线程或进程，按照用户指定的方式执行特定类型的I/O操作。fio接受一些全局参数，每个线程都会继承这些参数，除非为它们提供了覆盖该设置的其他参数。fio的典型用法是编写一个与用户想要模拟的I/O负载相匹配的作业文件。


&nbsp;
&nbsp;
# 2. 语法
```bash
fio [options] [jobfile] ...
```
常见的2种用法：
```bash
1. fio 命令行模式
2. fio client/server模式
```
fio命令行模式意思是在命令行中直接执行测试的完整命令，不需要任何配置文件。包括`纯命令行模式`和`配置文件模式`。在配置文件模式下，配置文件中定义的所有参数都可以直接应用在命令行模式中。

fio client/server模式是fio的另一种用法，需要提供host配置文件和jobfile文件，主要用于多客户并发测试场景。


&nbsp;
&nbsp;
# 3. 参数
下面以一个例子来说明fio用法：
```bash
fio \
--name=test \
--ioengine=libaio \
--directory=/mnt/testfs \
--direct=1 \
--sync=0 \
--time_based \
--runtime=2m \
--ramp_time=10 \
--iodepth=16 \
--rw=randwrite \
--size=1G \
--bs=4k \
--thread \
--numjobs=32 \
--stonewall \
--group_reporting
```
上述命令是测试4k随机写性能，该命令将启动32个线程，每个线程将执行一个job。每个job将在/mnt/testfs目录下创建不同的文件，每个文件的大小为1G。主要参数解释：
- `name`：job的名称。
- `ioengine`：I/O引擎，默认为libaio。
- `directory`：I/O操作的目录。如果不指定，默认是`./`。
- `filename`： I/O操作的文件名。如果不指定，fio将会自动生成文件名，文件名的格式为：`$jobname.$jobnum.$filenum`。换句话说，fio将会为每一个线程创建不同的文件。如果指定，fio最终只会创建一个文件，所有的线程都将共享同一个文件。
- `direct`：是否绕开缓存，默认为0。`direct=1`表示绕开缓存。
- `sync`：同步I/O，是否在每次I/O操作后将缓存数据刷写到物理磁盘中，导致每次I/O操作必须等待刷写到磁盘中才能提交下一个请求。在异步I/O引擎中必须要设置sync=0，否则会并行I/O变为串行I/O。
- `time_based`：表示以时间作为整体测试结束的判断依据。
- `runtime`：整体测试的运行时间。
- `ramp_time`：预热时间，如果设置了此参数，fio将在记录任何性能数据之前运行指定的工作负载一段时间。这对于在记录结果之前让性能稳定下来很有用，从而最大限度地减少获得稳定结果所需的运行时间。
- `iodepth`：I/O深度，表示一次I/O操作可以同时进行的I/O数量。用于控制异步I/O（AIO）的并发请求数量，直接影响存储系统的吞吐量（IOPS）和延迟。
- `rw`：I/O操作类型。除了上述randwrite，还有randread、read、write等。
- `size`：文件大小。
- `bs`：块大小，表示每次I/O操作的块大小。
- `thread`：表示将进程以线程的方式启动，而不是以进程的方式启动。
- `numjobs`：表示启动的线程/进程数量。
- `stonewall`：用于控制多任务（numjobs）测试时的任务同步行为，确保测试结果的公平性和一致性。当启用stonewall时，fio会强制所有任务（job）同时启动，并在任何一个任务完成时终止所有其他任务。
- `group_reporting`：表示将所有线程/进程的结果汇总。


&nbsp;
&nbsp;
# 4. 用法
## 4.1. 命令行模式
命令行模式可以以两种方式运行：纯命令行模式（不带jobfile）和配置文件模式（带jobfile）。上述命令是纯命令行模式，也可以替换成配置文件模式：
```bash
fio test.fio
```
其中test.fio为配置文件，内容如下：
```bash
[test]
ioengine=libaio
directory=/mnt/testfs
direct=1
sync=0
time_based
runtime=2m
ramp_time=10
iodepth=16
rw=randwrite
size=1G
bs=4k
thread
numjobs=32
stonewall
group_reporting
```
fio纯命令行模式也可以同时运行多个不同的测试任务，只需要指定每一个测试任务的`--name`参数，并且每个测试任务的测试命令参数也需要紧跟在`--name`参数之后：
```bash
fio --name=test1 ioengine=libaio ... --name=test2 ioengine=libaio ... 
```
上述命令修改成配置文件，类似如下：
```bash
[test1]
ioengine=libaio
...
[test2]
ioengine=libaio
...
```
当在纯命令行模式下同时运行多个不同的测试任务时，如果多个测试任务有相同的参数，可以将相同的参数提取出来，并用关键字`global`来定义相同的参数：
```bash
fio --name=global ioengine=libaio ... --name=test1 bs=4k ... --name=test1 bs=1m ...
```
上述命令修改成配置文件，类似如下：
```bash
[global]
ioengine=libaio
...
[test1]
bs=4k
...
[test2]
bs=1m
```
在配置文件模式下，如果配置文件同时配置了多个任务，在执行测试的时候可以使用`--section`参数来指定要执行的测试任务，例如：
```bash
fio --section=test1 test.fio
```

&nbsp;
## 4.2. client/server模式
client/server模式多用于待测集群多客户端并发测试场景，fio客户端和fio服务端可以运行在不同的机器上，fio客户端通过`--client`参数与fio服务端建立连接，fio服务端收到fio客户端的请求，执行测试任务，并将测试结果返回给fio客户端。从测试的角度看，真正执行测试的任务的是fio服务端，相对于测试集群而言，fio服务端就是测试集群的客户端。

client/server模式下，必须先启动fio server，通常用以下命令在测试集群客户端启动fio server：
```bash
fio --server
```
在启动fio server之后，就可以在测试集群客户端启动fio client，通常有2种启动方式：
```bash
1. fio --client=<server1> <job file(s)> --client=<server2> <job file(s)> ...
2. fio --client=host.list <job file(s)>
```
fio client只能通过定义jobfile（配置文件）的方式来执行fio命令，不能通过纯命令行模式来执行fio命令。


&nbsp;
&nbsp;
# 5. 实例
测试1客户端32进程4k随机写性能，每个线程写不同的文件，每个文件大小为1G
```bash
fio --name=randwrite_4k --ioengine=libaio --directory=/mnt/testfs --direct=1 --sync=0 --time_based --runtime=2m --ramp_time=10 --iodepth=16 --rw=randwrite --size=1G --bs=4k --thread --numjobs=32 --stonewall --group_reporting
```

测试3客户端32进程4k随机写性能，每个线程写不同的文件，每个文件大小为1G
```bash
fio --client=192.168.3.11 randwrite.fio --client=192.168.3.12 randwrite.fio --client=192.168.3.13 randwrite.fio
```
其中randwrite.fio配置如下：
```bash
[randwrite]
ioengine=libaio
directory=/mnt/testfs
direct=1
sync=0
time_based
runtime=2m
ramp_time=10
iodepth=16
rw=randwrite
size=1G
bs=4k
thread
numjobs=32
stonewall
group_reporting
```
对于上述配置文件也没有指定`filename`参数，在client/server模式下，尤其是多客户端测试场景下，如果指定`directory`参数，fio将会按照`$clientuid.$jobname.$jobnum.$filenum`的格式生成文件名。如果不指定`directory`参数，可以使用`filename_format`来指定文件名格式：`filename_format=$clientuid.$jobname.$jobnum.$filenum`。

在关于读的性能测试之前，一般是手动提前构造出完整的文件数据，再去测试读。并且，一般是都是先测试完所有关于写的性能测试项，然后再测试所有关于读的性能测试项。

&nbsp;
&nbsp;
# 6. 参考资料
- [https://fio.readthedocs.io/en/latest/index.html](https://fio.readthedocs.io/en/latest/index.html)