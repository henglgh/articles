---
title: vdbench使用手册
date: 2025-03-24T10:00:00+0800
description: "本文详细介绍如何在使用vdbench以及相关参数解释。"
tags: [tools]
---


# 1. 前言
Vdbench 是由 Oracle 开发的一款磁盘 I/O 工作负载生成器，主要用于对裸盘和文件系统进行测试和基准测试。它用 Java 编写，支持多种操作系统平台，具备丰富功能，可生成多种类型的存储 I/O 工作负载，还能进行详细的性能报告。


&nbsp;
&nbsp;
# 2. 语法
```bash
vdbench –f parmfile
```
parmfile中定义测试需要的各种参数，所有的参数必须按照顺序定义，否则会运行失败。对于裸盘测试，参数按照General, HD, RG, SD, WD and RD顺序定义。对于文件系统，参数按照General, HD, FSD, FWD and RD顺序定义。


&nbsp;
&nbsp;
# 3. 参数
## 3.1. 块设备（裸盘）
块设备参数文件定义顺序为：HD、SD、WD、RD
### 3.1.1. HD（Host Define）
```bash
hd=default,vdbench=/opt/vdbench50407,user=root,shell=ssh
hd=hd1,system=node1
hd=hd2,system=node2
hd=hd3,system=node3
```
- `hd`: 标识主机定义的名称，多主机运行时，可以使用hd1、hd2、hd3...区分。通常情况下`hd=default`是定义hd共同参数。如果某个hd定义需要定义不同参数，可以在该hd定义中单独定义。
- `system`: 指定主机的名称，可以是IP地址或者主机名。
- `user`: slave和master通信使用用户。
- `shell`: 多主机测试时，mater和slave主机间通信方式。默认值为`rsh`，可选值为`rsh`、`ssh`或`vdbench`。
  - 当参数值为`rsh`时，需要配置master和slave主机rsh互信，考虑到rsh使用明文传输，安全级别不够，通常情况下不建议使用这种通信方式。
  - 当参数值为`ssh`时，需要配置master和slave主机ssh互信，通常Linux主机时使用此通信方式。
  - 当参数值为`vdbench`，需要在所有slave主机运行vdbench rsh启用vdbench本身的rsh守护进程，通常Window主机时使用此通信方式。

在单机模式下，无需定义HD。

### 3.1.2. SD（Storage Define）
```bash
sd=default,lun=/dev/sdb,openflags=o_direct,threads=6
sd=sd1,hd=hd1
sd=sd3,hd=hd2
sd=sd6,hd=hd3
```
- `sd`: 标识存储定义的名称。通常情况下`sd=default`是定义sd共同参数。如果某个sd定义需要定义不同参数，可以在该sd定义中单独定义。
- `hd`: 标识主机定义的名称。
- `lun`: 写入块设备，linux使用sdb盘，则指定路径为/dev/sdb；windows使用G盘，则指定路径为\\.\G:。
- `openflags`: 通过设置为o_direct或directio，以无缓冲缓存的方式进行读写操作。
- `threads`: 对SD的最大并发I/O请求数量。

__对于裸盘测试，设置线程数必须通过SD的threads参数定义，不能通过WD的threads参数定义，因为二者代表的含义不同。但是对于文件系统测试而言，只能通过FWD的threads参数设置线程数，因为FSD没有threads参数。__

### 3.1.3. WD（Workload Define）
```bash
wd=wd1,sd=sd*,seekpct=100,rdpct=100,xfersize=8k,skew=40
wd=wd2,sd=sd*,seekpct=100,rdpct=0,xfersize=8k,skew=10
wd=wd3,sd=sd*,seekpct=100,rdpct=100,xfersize=1024k,skew=40
wd=wd4,sd=sd*,seekpct=100,rdpct=0,xfersize=1024k,skew=10
```
- `wd`: 标识工作负载定义的名称。
- `sd`: 标识存储定义的名称。
- `seekpct`: 可选值为0或100(也可使用sequential或random表示)，默认值为100，随机寻道的百分比，设置为0时表示顺序，设置为100时表示随机。
- `rdpct`: 读取请求占请求总数的百分比，设置为0时表示写，设置为100时表示读。
- `xfersize`: 要传输的数据大小。默认设置为4k。
- `skew`: 非必选项，一般在多个工作负载时需要指定，表示该工作负载占总工作量百分比（skew总和为100）。

### 3.1.4. RD（Run Define）
```bash
rd=rd1,wd=wd*,iorate=max,maxdata=400GB,warmup=30,elapse=604800,interval=5
```
- `rd`: 标识运行定义的名称。
- `wd`: 标识工作负载定义的名称。
- `iorate`: 常用可选值为100、max，此工作负载的固定I/O速率。
  - 当参数值为100时，以每秒100个I/Os的速度运行工作负载，当参数值设置为一个低于最大速率的值时，可以达到限制读写速度的效果。
  - 当参数值为max时，以最大的I/O速率运行工作负载，一般测试读写最大性能时，该参数值均为max。
- `warmup`: 预热时间（单位为秒），默认情况下vdbench会将第一个时间间隔输出数据排除在外,程序在预热时间内的测试不纳入最终测试结果中（即预热结束后，才开始正式测试）。
  - 当interval为5、elapsed为600时，测试性能为2~elapsed/interval（avg_2-120）时间间隔内的平均性能。
  - 当interval为5、warmup为60、elapsed为600时，测试性能为1+（warmup/interval）~（warmup+elapsed）/interval(avg_13-132)时间间隔内的平均性能。
- `maxdata`: 读写数据大小，通常情况下，当运行elapsed时间后测试结束；当同时指定elapsed和maxdata参数值时，以最快运行完的参数为准（即maxdata测试时间小于elapsed时，程序写完elapsed数据量后结束）。
  - 当参数值为100以下时，表示读写数据量为总存储定义大小的倍数（如maxdata=2，2个存储定义（每个存储定义数据量为100G），则实际读写数据大小为400G）。
  - 当参数值为100以上时，表示数据量为实际读写数据量（可以使用单位M、G、T等）。
- `elapsed`: 默认值为30，测试运行持续时间（单位为秒）。
- `interval`: 报告时间间隔（单位为秒）。


&nbsp;
&nbsp;
## 3.2. 文件系统
文件系统参数文件定义顺序为：HD、FSD、FWD、RD
### 3.2.1. HD（Host Define）
```bash
hd=default,vdbench=/opt/vdbench50407,user=root,shell=ssh
hd=hd1,system=node1
hd=hd2,system=node2
hd=hd3,system=node3
```
- `hd`: 标识主机定义的名称，多主机运行时，可以使用hd1、hd2、hd3...区分。通常情况下`hd=default`是定义hd共同参数。如果某个hd定义需要定义不同参数，可以在该hd定义中单独定义。
- `system`: 指定主机的名称，可以是IP地址或者主机名。
- `user`: slave和master通信使用用户。
- `shell`: 多主机测试时，mater和slave主机间通信方式。默认值为`rsh`，可选值为`rsh`、`ssh`或`vdbench`。
  - 当参数值为`rsh`时，需要配置master和slave主机rsh互信，考虑到rsh使用明文传输，安全级别不够，通常情况下不建议使用这种通信方式。
  - 当参数值为`ssh`时，需要配置master和slave主机ssh互信，通常Linux主机时使用此通信方式。
  - 当参数值为`vdbench`，需要在所有slave主机运行vdbench rsh启用vdbench本身的rsh守护进程，通常Window主机时使用此通信方式。

在单机模式下，无需定义HD。

### 3.2.2. FSD（File System Define）
```bash
fsd=default,openflags=directio,depth=2,width=3,files=2,size=128k
fsd=fsd1,anchor=/mnt/test1
fsd=fsd2,anchor=/mnt/test2
fsd=fsd3,anchor=/mnt/test3
```
- `fsd`: 标识文件系统定义的名称，多文件系统时（fsd1、fsd2、fsd3...），可以指定default（将相同的参数作为所有fsd的默认值）。
- `openflags`: 通过设置为o_direct或directio，以无缓冲缓存的方式进行读写操作。
- `anchor`: 文件写入目录，linux指定路径为/dir01；windows指定路径为E:\dir01。
- `depth`: 创建目录层级数（即目录深度）。
- `width`: 每层文件夹的子文件夹数。
- `files`: 测试文件个数（vdbench测试过程中会生成多层级目录结构，实际只有最后一层目录会生成测试文件）。
- `size`: 每个测试文件大小。
- `distribution`: 可选值为bottom或all，默认为bottom。
  - 当参数值为bottom时，程序只在最后一层目录写入测试文件。
  - 当参数值为all时，程序在每一层目录都写入测试文件。
- `shared`: 可选值为yes或no，默认值为no，一般只有在多主机测试时指定。
  - vdbench不允许不同的slave之间共享同一个目录结构下的所有文件，因为这样会带来很大的开销，但是它们允许共享同一个目录结构。加入设置了shared=yes，那么不同的slave可以平分一个目录下所有的文件来进行访问，相当于每个slave有各自等分的访问区域，因此不能测试多个客户的对同一个文件的读写。
  - 当多主机测试时，写入的根目录anchor为同一个路径时，需要指定参数值为yes。

文件和目录计算公式如下：
- 最后一层生成文件夹个数：width^depth
- 测试文件个数：(width^depth)*files


### 3.2.3. FWD（FileSystem Workload Defile）
```bash
fwd=default,operation=read,xfersize=4k,fileio=sequential,fileselect=random,threads=2
fwd=fwd1,fsd=fsd1,host=hd1
fwd=fwd2,fsd=fsd2,host=hd2
fwd=fwd3,fsd=fsd3,host=hd3
```
- `fwd`: 标识文件系统工作负载定义的名称，多文件系统工作负载定义时，可以使用fwd1、fwd2、fwd3...区分。
- `fsd`: 标识此工作负载使用文件存储定义的名称。
- `host`: 标识此工作负载使用主机。
- `operation`: 可选值为read或write,文件操作方式。
- `rdpct`: 可选值为0~100，读操作占比百分比，一般混合读写时需要指定，当值为60时，则混合读写比为6：4。
- `fileio`: 可选值为random或sequential，标识文件 I/O 将执行的方式。
- `fileselect`: random或sequential，标识选择文件或目录的方式。
- `xfersizes`: 数据传输（读取和写入操作）处理的数据大小(即单次IO大小)。
- `threads`: 此工作负载的并发线程数量。

### 3.2.4. RD（Run Define）
```bash
rd=rd1,fwd=(fwd1-fwd3),fwdrate=max,format=restart,elapsed=604800,interval=10
```
- `rd`: 标识文件系统运行定义的名称。
- `fwd`: 标识文件系统工作负载定义的名称。
- `fwdrate`: 每秒执行的文件系统操作数量。设置为max，表示不做任何限制，按照最大强度自适应。
- `format`: 可选值为no、yes、或restart，标识预处理目录和文件结构的方式。
  - `no`: 默认参数值，不执行format预处理操作，如测试目录不存在文件时，vdbench会由于无可用文件读写而异常退出。
  - `yes`: 表示删除测试目录已有文件结构，并且重新创建新的文件结构。
  - `restart`: 表示只创建未生成的目录或文件，并且增大未达到实际大小的文件。
- `elapsed`: 默认值为30，测试运行持续时间（单位为秒）。
- `interval`: 结果输出打印时间间隔（单位为秒）。


&nbsp;
&nbsp;
# 4. 实例
单节点针对裸盘测试，1M顺序写，测试时间600s，预热时间60s，报告时间间隔2s。
```bash
sd=sd1,lun=/dev/sdb,openflag=o_direct,threads=32
wd=wd1,sd=sd1,seekpct=0,rdpct=0,xfersize=1M
rd=rd1,wd=wd1,iorate=max,warmup=60,elapsed=600,interval=2
```

单节点针对文件系统测试，1M顺序写，目录深度为2，每层目录数为3，每个目录文件数为10，每个文件大小为200M，测试时间为600s，报告时间时间2s。
```bash
fsd=fsd1,anchor=/mnt/test,depth=2,width=3,files=10,size=200M
fwd=fwd1,fsd=fsd1,operation=write,xfersize=1M,fileio=sequential,fileselect=random,threads=32
rd=rd1,fwd=fwd1,fwdrate=max,format=yes,elapsed=600,interval=5
```

三节点针对裸盘测试，1M顺序写，测试数据量为400G，预热时间30s，报告间隔5s。
```bash
hd=default,vdbench=/opt/vdbench50407,user=root,shell=ssh
hd=hd1,system=node1
hd=hd2,system=node2
hd=hd3,system=node3

sd=default,lun=/dev/sdb,openflags=o_direct,threads=32
sd=sd1,hd=hd1
sd=sd2,hd=hd2
sd=sd3,hd=hd3

wd=wd1,sd=sd*,seekpct=0,rdpct=0,xfersize=1M
rd=rd1,wd=wd1,iorate=max,maxdata=100M,elapsed=64800,warmup=30,interval=5
```

三节点针对文件系统测试，1M顺序写，目录深度为2，每层目录数为3，每个目录文件数为10000，每个文件大小为200M，测试时间为600s，报告间隔1s。
```bash
hd=default,vdbench=/opt/vdbench50407,user=Micah,shell=vdbench
hd=hd1,system=node1
hd=hd2,system=node2
hd=hd3,system=node3

fsd=fsd1,anchor=/mnt/test1,depth=2,width=3,files=10000,size=200M
fsd=fsd2,anchor=/mnt/test2,depth=2,width=3,files=10000,size=200M
fsd=fsd3,anchor=/mnt/test3,depth=2,width=3,files=10000,size=200M

fwd=default,operation=write,xfersize=1M,fileio=sequential,fileselect=random,threads=32
fwd=fwd1,fsd=fsd1,host=hd1
fwd=fwd2,fsd=fsd2,host=hd2
fwd=fwd3,fsd=fsd3,host=hd3

rd=rd1,fwd=fwd*,fwdrate=max,format=yes,elapsed=600,interval=1
```


&nbsp;
&nbsp;
# 5. 参考
- [https://www.cnblogs.com/luxf0/p/13321077.html](https://www.cnblogs.com/luxf0/p/13321077.html)