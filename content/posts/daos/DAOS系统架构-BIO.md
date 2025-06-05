---
title: DAOS系统架构-BIO
date: 2025-06-04T09:00:00+0800
description: "本文详细介绍DAOS中BIO（Blob IO）的设计思想"
tags: [daos]
---

# 1. 概述
BIO模块是专为NVMe固态硬盘的I/O操作而设计的。BIO模块涵盖：NVMe SSD支持、故障设备检测、设备健康状况监控、NVMe SSD热插拔功能，以及基于英特尔VMD设备的SSD身份识别功能。

&nbsp;
&nbsp;
# 2. NVMe SSD支持
DAOS服务有2层存储：SCM和NVMe。SCM用于元数据和字节粒度的应用程序的数据，NVMe用于批量应用程序的数据。与使用PMDK来访问SCM一样，SPDK被用来无缝且高效的访问NVME存储。

DAOS存储分配在SCM上进行（使用一个MDK pmemobj pool）也可以在NVMe上进行（使用一个SPDK blob）。服务端的所有本地元数据都将存储在每个服务端的SCM中的pmemobj存储池中，并将包括所有当前的和相关的NVME设备、存储池、以及xstream映射信息。

DAOS聚合能力允许将数据从SCM中迁移到一个NVMe SSD中，主要是通过将较小的数据记录合并为较大的数据记录这种方式实现。

DAOS控制平面处理所有的SSD配置，DAOS数据平面借助SPDK来处理所有的存储分配，并使用内部的版本化区段分配器（VEA）来进行更精细的块级别的分配。

## 2.1. SPDK（Storage Performance Development Kit）
SPDK是一个开源的C库，当应用于存储应该程序是，可以提供比标准NVMe内核驱动高7倍以上的性能。SPDK的高性能主要归功于用户态的NVMe驱动程序，消除了所有系统调用并实现了来自应用程序的零拷贝访问。在SPDK中，会以轮询硬件的方式来获取完成情况，而不是依赖中断，从而降低总延迟和延迟差异。SPDK还提供了一个名为bdev的块设备层，它位于设备驱动程序之上，就像传统的内核存储堆栈中一样。此模块提供了可插拔模块的API，用于实现与各种不同类型的块设备连接。它包含的用于 NVMe、Malloc（ramdisk）、Linux AIO、Ceph RBD等驱动模块。

![spdk](https://raw.githubusercontent.com/henglgh/articles/main/static/images/spdk.png)

**SPDK NVMe Driver**

NVMe驱动程序是一个C库，链接到一个存储应用程序，提供了与NVMe SSD之间的直接、零拷贝数据传输。SPDK NVMe驱动程序的其他好处在于它完全在用户空间的，以轮询模式运行而不是依赖中断方式，是异步且无锁的。

**SPDK Block Device Layer**

bdev目录包含了一个块设备抽象层，用于将通用的块设备协议转换为后端设备的特殊协议，比如NVMe。此外，该层还提供了响应特定条件下I/O请求的自动排队、队列的无所发送、设备配置、重置支持以及I/O超时流量管理。

**SPDK Blobstore**

blobstore是一个专门为更高级别存储服务而设计的块分配器。分配的块在SPDK中被称为`blob`。blobs被设计为非常大（至少数百KB），因此除了blobstore之外，还需要另外一个分配器来为DAOS服务提供小的块分配。blobstore提供异步、未缓存和并行blob读取和写入接口。

## 2.2. SPDK集成
在daos_server启动/关闭时，BIO模块依赖于SPDK API来初始化/完成SPDK环境。DAOS存储模型通过以下方式与SPDK集群：
- SPDK blobstores和blobs的管理：NVMe SSD被分配给每一个DAOS server xstream。在每个NVMe SSD创建blobstore。创建blobs并与每个per-xstream VOS pool绑定。
- SPDK I/O通道与DAOS服务端的xstreams关联：一旦 SPDK I/O通道与相应的设备正确关联，NVMe硬件完成轮询器就会被集成到DAOS服务端轮询ULT中。

&nbsp;
&nbsp;
# 3. SMD（Per-Server Metadata Management）
BIO模块的主要子组件之一就是SMD。SMD子模块由一个PMDK pmemobj pool组成，该pool存在SCM中，用于跟踪每个DAOS服务端的本地元数据。

目前被跟踪的持久化元数据表包含以下几个：
- `NVMe Device Table`：NVMe SSD与DAOS服务端的xstreams的映射（本地通过PCIe连接的NVMe SSD会被分配给不同的xstream，以避免硬件争用）。除此之外，该表还记录了每个持久化设备的状态（支持的设备状态为：NORMAL 和 FAULTY）。
- `NVMe Pool Table`：NVMe SSD、DAOS server xstream以及 SPDK blob ID映射。blob大小与SPDK blob ID 一起存储，以便在NVMe设备热插拔的情况下支持在新设备上创建blob。

在daos_server启动时，这个表将会从持久化内存中加载，并用于初始化新的blobstores和blobs，或者加载以前的blobstores和blobs。此外，将来有可能扩展此模块以支持其他非NVMe相关元数据。

查询per-server的管理员命令：`dmg storage query list-devices | list-pools`

&nbsp;
&nbsp;
# 4. DMA缓冲区管理
BIO在内部管理着一个per-xstream DMA安全缓冲区，目的是可以在通过NVMe SSDs进行SPDK DMA传输。该缓冲区是使用SPDK内存分配API来分配的，并且可以按需求动态增长。该缓冲区还充当通过NVMe SSD进行RDMA传输的中间缓冲区，这意味着在DAOS批量更新时，客户端的数据将首先通过RDMA传输到这个缓冲区，然后调用BIO接口将本地缓冲区数据通过DMA传输到NVMe SSD上。在DAOS批量获取数据时，首先将NVMe SSD上的数据通过DMA传输到本地缓冲区，然后通过RDMA传输到客户端。

&nbsp;
&nbsp;
# 5. NVMe线程模型
- `Device Owner Xstream`：如果VOS XStream没有直接按照1:1方式映射到NVMe SSD，那么首先打开SPDK blobstore的VOS xstream将被命名为`Device Owner`。Device Owner Xstream主要负责维护和更新blobstore健康状况数据、处理设备状态转换以及媒介错误事件。所有非Device Owner Xstream都将事件转发给device owner。
- `Init Xstream`：第一个启动的VOS xstream被称为`Init Xstream`。init xstream主要负责SPDK bdev的初始化和完成、SPDK热插拔轮询器的注册、处理和定期检查NVMe SSD热删除和热插拔事件，以及处理所有VMD LED设备事件。

![nvme_thread_model](https://raw.githubusercontent.com/henglgh/articles/main/static/images/nvme_thread_model.png)

以上是当前NVMe线程模型，图中有2大类VOS Xstream：VOS Xstream1和VOS Xstream2。Xstream1中又包含了Device Owner Xstream和Init Xstream。Device Owner Xstream负责所有故障设备/设备重集成的回调，以及设备健康状况数据的更新。Init Xstream负责SPDK热插拔轮询器的注册以及当前SPDK bdevs设备列表和已经移除和拔出的设备列表的维护。所有的xstream都将通过`bio_nvme_poll`接口定期轮询I/O统计信息（如果在配置文件中开启），但是只有Device Owner Xstream会轮询设备事件，进行必要的状态转换，并更新设备健康状况统计信息。而init xstream将轮询任何设备移除/设备热插拔事件。另外，图中展示了三种操作：元数据操作，blob读写操作，以及轮询操作。元数据操作流程中展示了：当在Xstream1以外的任何Xstream上发生的错误事件都会通过SPDK事件框架转发给Xstream1中对应的Xstream。

&nbsp;
&nbsp;
# 6. 设备健康状况监控
device owner xstream负责所有设备健康状况数据以及所有媒介错误事件的维护和更新。这将作为设备健康状况监控功能的一部分。设备健康状态数据由原始SSD健康统计信息（通过SPDK admin APIs查询的）和内存中的健康状况数据组成。返回的原始的SSD健康状态信息包含了用于确定设备当前运行状况的有用而且关键的数据，比如温度、开机持续时间、不安全关机、严重警告等。内存中的健康状况信息包含原始SSD健康状况统计信息的子集，以及 I/O 错误（读/写/取消映射）和校验和错误计数器，这些计数器在当设备发生媒介错误事件时会更新并存储在内存中。

DAOS数据层面将每60秒监控一次NVMe SSD，包括使用当前值更新健康状况统计信息、检查当前设备状态以及进行任何必要的blobstore/device状态转换。一旦发生AULTY状态转换，监控周期将缩短到10秒，以便更快的进行状态转换和更精细的监控，直到设备被完全移除。

查询设备健康状况信息的管理员命令：`dmg storage query list-devices --health`

在监控此健康状况数据时，管理员可以决定手动移出故障设备。该健康状况数据还将用于制定故障设备的故障标准，以便实现SSD自动移除（在未来实现）。

&nbsp;
&nbsp;
# 7. 故障设备检测
故障设备的检测和以及故障设备的反应可被称为`NVMe SSD移出`。这将涉及到存储池中所有受影响的targets将会被标记为`down`状态，以及引发存储池中所有受影响的targets的数据重构事件。一个持久化设备的状态实在SMD中维护的，并且当发生SSD移出时，设备状态会从NORMAL转换成FAULTY。故障设备的反应涉及各种SPDK清理，包括释放所有的I/O通道，关闭SPDK的所有分配（blobs），以及卸载在NVMe SSD上创建的SPDK blobstore。SSD自动移出功能在默认情况下是打开的，并且可以使用`bdev_auto_faulty`配置参数来禁用该功能。

手动移出SSD的管理员命令：`dmg storage set nvme-faulty`

&nbsp;
&nbsp;
# 8. NVMe SSD热插拔
NVMe热插拔功能要求设备支持Intel VMD。DAOS 2.8版本将支持非Intel-VMD设备的完全热插拔功能。目前对非Intel VMD设备热插拔功能支持不够完善，仅供测试使用。

NVMe的热插拔功能包括：设备删除（NVMe热删除事件）和设备重新集成（NVMe热插拔事件）。以上两个事件都是发生在使用新设备更换故障设备的时候。

对于设备删除，如果该设备是一个故障设备或者是之前已经移出的设备，则在删除设备时不会执行任何进一步的操作。设备的状态将显示为`UNPLUGGED`。如果删除了DAOS当前正在使用的运行状况良好的设备，则所有的memory stubs都将被解构，该设备的状态也将变成`UNPLUGGED`。

对于设备重新集成，如果插入新设备来替换故障设备，管理员需要执行更换命令。所有in-memory stubs将会被创建，并且存储池中所有受影响的targets都会被自动重新集成到该设备上。一开始，设备的状态为`NEW`，在替换事件发生后，状态将会变成`NORMAL`。如果重新插入了故障设备或者重新插入之前已经被移出的设备，则设备的状态仍然保持为`EVICTED`。如果希望重复使用有故障的设备（不建议这样做，主要用于测试用），管理员可以相同的替换设备命令，只不过此时的新旧设备ID要相同。由于DAOS目前不支持增量重新集成，因此不会在设备上进行重新集成。

替换/复用被逐出的设备的管理员命令：`dmg storage replace nvme`

&nbsp;
&nbsp;
# 9. SSD身份识别
SSD身份识别功能是一个快速而又直观地定位设备地方法。但是该功能依赖英特尔的VMD，英特尔的VMD需要物理硬件支持，并且在BIOS中开启。该功能支持2个LED事件：定位运行状况良好的设备和定位已经被移出的设备。

## 9.1. VMD（Intel Volume Management Device）
英特尔的VMD是一种嵌入到处理器芯片中的技术，该技术将NVMe PCIe SSDs聚合连接到芯片根端口，就像HBA对SATA和SAS一样。目前，PCIe存储缺乏一种标准化的方法来闪烁LED并指示设备的状态。英特尔的VMD，再结合NVMe，为LED的管理提供了支持。

![intel_vmd](https://raw.githubusercontent.com/henglgh/articles/main/static/images/intel_vmd.png)

英特尔的VMD在服务器的PCIe根复合体中放置了一个控制点，这意味着NVMe驱动器可以热插拔，并且状态指示LED灯始终可靠。

VMD设备上的状态指示LED灯有4种状态：OFF、FAULT、REBUILD和IDENTIFY。这些通过IBPI标准（SFF-8489）中指定的闪烁模式进行传达。

| VMD LED State | Amber LED |
| -- | -- |
| off | off |
| identify | quick blinking(~4HZ) |
| rebuild | slow blinking(~1HZ) |
| fault | solid on |

Ameber LED（即：状态指示LED灯）是由VMD设备提供的。Green LED是活跃状态指示灯。

**定位运行状况良好的设备**

在发出带有设备ID和超时时间的设备身份识别命令后，管理员可以快速识别出有问题的设备。如果在命令行上未指定超时时间，默认是2分钟，如果指定了，以分钟为单位。VMD设备上的状态指示LED灯的状态将会被设置为`IDENTIFY`状态，由快速闪烁的4Hz Ameber灯表示。设备将快速闪烁，直到达到超时的时间值，之后返回默认OFF状态。

**定位已经被逐出的设备**

如果NVMe SSD出现故障，VMD设备上的状态指示LED灯将被设置为`EVICTED`状态，Ameber灯将保持常亮显示。该状态下的LED灯可以直观的表示出故障、设备需要被更换、以及DAOS不再使用该设备。VMD设备上的LED灯将保持此显示状态直到被新的设备替换。

定位已经启用VMD的NVMe SSD设备的管理员命令：`dmg storage identify vmd`

&nbsp;
&nbsp;
# 10. 设备状态
管理员查询设备状态时，设备的状态取决于SMD中持久化存储的设备状态和内存中的BIO设备列表。
- `NORMAL`：DAOS旨在使用的功能都正常的设备。
- `EVICTED`：设备已经被手动移出，并且DAOS不再使用该设备。
- `UNPLUGGED`：之前被DAOS使用的设备现在已经被拔出。
- `NEW`：可以被DAOS使用的全新设备。

![device_state](https://raw.githubusercontent.com/henglgh/articles/main/static/images/device_state.png)

查询设备状态的管理员命令：`dmg storage query list-devices`
