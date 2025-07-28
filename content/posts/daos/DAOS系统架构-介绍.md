---
title: DAOS系统架构-介绍
date: 2025-04-01T16:03:00+0800
description: "本文全面介绍DAOS.2.6.0系统，包括但不局限于DAOS系统特性、各个模块的功能等等。"
tags: [daos]
---

> daos:           2.6.0

# 1. 概述
DAOS是一个开源的软件定义的横向扩展对象存储（和ceph的rados中object概念类似），它为应用程序提供高带宽和高IOPS性能，并支持和满足仿真、数据分析和机器学习三个领域的存储需求。DAOS不仅提供存储功能，还能有效地支持需要处理大量数据并进行复杂计算的现代数据中心应用场景。

与传统的专门为机械盘设计的存储系统不同，DAOS的架构是利用新的NVM技术从头开始开始设计，并且非常轻量级，因为它完全是在用户空间运行的，并且是端到端的，完全绕开操作系统。另外，DAOS提供了一种新的I/O设计模型：支持细粒度数据访问，并释放下一代存储技术性能。而不是传统的基于块和高延迟存储设计的I/O模型。（在传统的基于块的存储系统中，数据通常被划分为固定大小的块进行存储和管理。这种基于块的存储方式便于操作系统和存储设备对数据进行组织、寻址和传输。例如，传统的硬盘驱动器（HDD）就是以扇区为基本单位来存储数据，多个扇区组成一个块。文件系统会将文件的数据分散存储在不同的块中，并通过索引等方式来记录文件数据的存储位置，以便在需要时能够准确地读取和写入数据。）


&nbsp;
&nbsp;
# 2. DAOS 特性
## 2.1. DAOS 接口
DAOS依赖`Open Fabric Interface(OFI)`接口实现低延迟通信，并且将数据`storage-class memory(SCM)`和NVMe storage中。DAOS提供了一种原生的`key-array-value`存储接口，该接口提供了一个统一的存储模型。特定领域的数据模型（比如 HDF5, MPI-IO, 以及Apache Hadoop）可以移植到该模型中。另外DAOS还提供了一个基于DAOS API实现的POSIX语义的I/O模型。

## 2.2. DAOS I/O
DAOS的I/O操作会被记录下来，然后插入到一个持久化索引中，该索引是由SCM来维护。每个I/O都带有一个特定的时间戳，称为`epoch`，并且与数据集的特定版本相关联。write操作是非破坏性的，并且对对齐不敏感。在read请求时，DAOS服务遍历持久索引，并创建一个复杂的分散-收集远程直接内存访问（RDMA）描述符，以直接在应用程序提供的缓冲区中重建请求版本的数据。

## 2.3. DAOS SCM
SCM通过内存直接映射一片地址空间，该空间有DAOS服务管理，DAOS服务通过直接load/store操作管理SCM中的持久化索引。得利于DAOS I/O的特性，DAOS服务可以决定将I/O数据存储到SCM中还是NVMe中：对于延时非常敏感的I/O，比如元数据和字节粒度的数据通常存储在SCM中。像批量数据和checkpoints一般都存储在NVMe中。这种设计思想允许DAOS通过将数据流式传输到NVMe存储中，并在SCM中维护内部元数据索引，为批量数据提供原始的NVMe带宽。为了实现这个目的，DAOS在技术上采用了`PMDK(Persistent Memory Development Kit)`和`SPDK(Storage Performance Development Kit)`。PMDK允许管理事务性访问SCM，SPDK允许用户空间直接对NVMe设备读写。

## 2.4. DAOS 设计目标
- 在任意对齐和大小下实现高吞吐量和高IOPS。
- 具有真正零拷贝I/O到存储级内存（SCM）的细粒度 I/O 操作。
- 通过跨存储服务器的可扩展集合通信对大规模分布式非易失性内存（NVM）存储的支持。
- 非阻塞数据和元数据操作，以允许I/O和计算重叠。
- 考虑故障域在内的高级数据放置规则。
- 软件管理的冗余，支持复制和纠删码，并具有在线重建功能。
- 端到端数据完整性。
- 具有保证数据一致性和自动恢复功能的可扩展分布式事务。
- 数据集快照。
- 用于管理存储池访问控制的安全框架。
- 软件定义的存储管理，用于在商用现货硬件上配置、设置、修改和监控存储池。
- DAOS数据模型对分层数据格式（HDF）5、MPI-IO和POSIX命名空间的原生支持。
- 灾难恢复工具。
- 与Lustre并行文件系统无缝集成。
- 提供Mover agent，允许在在DAOS存储池之间迁移数据集，以及在并行文件系统和DAOS之间进行双向迁移。


&nbsp;
&nbsp;
# 3. DAOS 系统
一个DAOS系统由一个系统名称来标识，并且由一组DAOS存储节点组成，这些存储节点连接到同一网络。每个DAOS存储节点运行一个`DAOS server`实例，每个DAOS server实例启动一个或者多个`DAOS Engine`进程，每个DAOS Engine进程与一个物理CPU绑定。DAOS server的成员关系被映射到`system map`中。该system map将每一个DAOS Engine与特定ID的rank(抽象的概念)绑定。两个不同的DAOS系统由两个不相交的DAOS server集合组成，并且彼此之间不进行协调。
```bash
Rank UUID                                 Control Address     Fault Domain State  Reason 
---- ----                                 ---------------     ------------ -----  ------ 
0    82e4649d-6271-45a5-a2e6-58d93a158b65 172.10.10.142:10001 /node2       Joined        
1    b593fd40-46f4-442d-8fe3-28ec4ced7566 172.10.10.144:10001 /node4       Joined        
2    f54d03e1-4889-45b4-ad5b-fa2dfb8ecbb9 172.10.10.143:10001 /node3       Joined        
```
上述示例的DAOS系统中运行3个server，每个server运行在单独的节点：node2、node3、node4。每个server启动一个engine(rank)：rank0、rank1、rank2。

## 3.1. DAOS server
DAOS server以多租户守护进程在每个存储节点上运行。它监听一个管理端口，以及一个或多个fabric endpoints。DAOS server通过位于`/etc/daos`的YAML文件进行配置，包括其Engine的配置。
```bash
tcp        0      0 0.0.0.0:10001           0.0.0.0:*               LISTEN      400791/daos_server
tcp        0      0 172.10.10.142:31325     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31326     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31327     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31328     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31329     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31330     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31331     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31316     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31317     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31318     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31319     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31320     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31321     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31322     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31323     0.0.0.0:*               LISTEN      402905/daos_engine
tcp        0      0 172.10.10.142:31324     0.0.0.0:*               LISTEN      402905/daos_engine
```

## 3.2. DAOS target
在DAOS Engine内部，为了优化并发性，存储在target之间是`静态分区`的，每个target负责存储空间的一部分。为了避免争用，每个target都有自己的私有存储，自己的service线程池，自己的network上下文。其中，network上下文可以通过fabric直接寻址，与同一存储节点上的其他target之间的network上下文相互独立。

当为每个engine配置N个target时，每个target使用1/N的SCM容量。同样，当为每个engine配置N个NVMe disks和M个target时，每个target将管理每块NVMe磁盘的N/M容量。
```bash
-----
daos2
-----
  Devices
    UUID:a649adcd-2476-4bfb-ad63-62e035c99311 [TrAddr:0000:86:00.0 NSID:1]
      Roles:wal SysXS Targets:[0 1 2 3 4 5 6 7 8 9 10 11] Rank:0 State:NORMAL LED:NA
    UUID:fd67ff56-59e4-4098-acbc-baacf06c858c [TrAddr:0000:88:00.0 NSID:1]
      Roles:meta SysXS Targets:[0 1 2 3 4 5 6 7 8 9 10 11] Rank:0 State:NORMAL LED:NA
    UUID:7a699f78-0c1e-477b-bbb7-e46bf038641e [TrAddr:0000:d8:00.0 NSID:1]
      Roles:data Targets:[0 4 8] Rank:0 State:NORMAL LED:NA
    UUID:69bfc190-2e23-4dae-a615-d55b3c5002b0 [TrAddr:0000:d9:00.0 NSID:1]
      Roles:data Targets:[1 5 9] Rank:0 State:NORMAL LED:NA
    UUID:bc871b11-c119-4f36-875e-b9ad45f1df0a [TrAddr:0000:da:00.0 NSID:1]
      Roles:data Targets:[2 6 10] Rank:0 State:NORMAL LED:NA
    UUID:718cc30e-71a2-4617-80d3-70516bc673f0 [TrAddr:0000:db:00.0 NSID:1]
      Roles:data Targets:[3 7 11] Rank:0 State:NORMAL LED:NA
```
上述示例中，可以看到名为daos2的节点中，target数量有12个：[0-11]，role为data的NVMe磁盘总共有4个，那么每个target管理4/12=1/3的单个NVMe磁盘空间：target[0,4,8]负责管理NVMe[0000:d8:00.0]。

target没有针对存储介质故障实施任何内部数据保护机制。因此，target是一个单点故障，并且是故障的单元。这意味着如果存储系统中的一个target出现问题，比如由于存储介质故障，那么这个target就会成为整个系统出现故障的一个点，并且整个系统的故障以target为单位进行考量。

同样，target也是DAOS系统性能的最小单元，每个target的性能被与之相关的存储介质、CPU核心数以及网络制约着。

每个DAOS Engine的target数量是可以配置的，并且依赖于底层硬件，尤其是为每个engine分配的SCM模块和NVMe磁盘数量。作为最佳实践，每个DAOS Engine的target数量应为该Engine所服务的NVMe驱动器数量的整数倍。

## 3.3. DAOS agent
DAOS agent是运行在客户端节点上的守护进程，它与DAOS库进行交互以对应用程序进程进行身份验证。它是一个受信任的实体，可以使用证书对DAOS库凭证进行签名。它可以支持不同的身份验证框架，并使用Unix域套接字与DAOS库进行通信。


&nbsp;
&nbsp;
# 4. DAOS 存储模型
对于DAOS整个系统而言，DAOS pool是整个系统数据存储和空间隔离的`系统单元`。DAOS pool是一个预分配的逻辑空间，该空间被平均分成多个pool shard，均匀分布在一组target中。比如：当pool横跨4个target时，pool会被分成4个pool shard，最终结果导致，每个target上有一个pool shard。预分配的逻辑空间可以是该组target总空间容量的全部或者部分。DAOS pool的总空间容量是在创建pool的时候指定的，pool的空间容量可以被拓展，理论上有2种方式：增大相关联的target空间容量和增加相关联的target数量，目前只支持后者方式。

![daos_abstractions](https://raw.githubusercontent.com/henglgh/articles/main/static/images/daos_abstractions.png)

一个DAOS pool可以容纳一个或多个被称为`DAOS container`的事务性存对象存储，每个container在pool中都是一个私有的对象地址空间，可以通过事务性方式修改container，并且同一个pool中的所有container之间是相互独立的。container是快照和数据管理的基本单元。归属于同一个container中的DAOS object可以被分发到pool中的任何一个target上，以实现好的性能和弹性，并且可以通过不同的API进行访问，以有效地表示结构化、半结构化和非结构化数据。

## 4.1. DAOS Pool
每个pool都有唯一的UUID标识，而且维护着一个`pool map`，pool map是一个持久化的列表。pool map中记录着target成员数量，target在pool map中通常是有序编号的。当pool中target成员数量改变时，对应于pool map中target的编号也是相应有序变化的。比如：当往pool中新增一个target时，相应的pool map中会增加一个target，并且target编号是递增的。

pool map不仅维护着active targets的列表，还维护着一个记录存储拓扑结构的树。这个树通常用于识别哪些target共享着相同的硬件组件。比如：树的第一层可以表示共享同一主机的target，然后第二层可以表示共享同一机架的所有主机，最后第三层可以表示同一机箱中的所有机架。这种拓扑结构有效地表示分层故障域，然后用于避免将冗余数据放置在可能发生相关故障的target上。pool map是完全版本化的，实际上是为pool map的每次修改分配了一个唯一的序列，特别是对于故障节点的移除。

一个pool shard是单个target上预先分配的持久化内存空间，也可以是单个target上预先分配的持久化内存空间与单个target上预先分配的NVMe存储空间的结合。它的空间容量是固定的，当空间满的时候，如果继续写入，就会报错。当前空间使用情况可以随时查询，并且上报存储在pool shard中任何数据类型所使用的总字节数。

当target发生故障并从pool map中排除时，对应的数据冗余会自动在线恢复。这个过程被称为数据重构（rebuild）。在pool的持久化内存中，数据重构进度会定期记录在特殊日志中，以应对级联故障。当有新的target被添加到pool中，pool中的数据会自动地迁移到新的target中，目的是让pool的已用空间均匀的分布在所有target上。这个过程被称为空间再平衡（space rebalancing），并且也使用专用的持久日志来支持中断和重新启动。

pool仅可供经过身份验证和授权的应用程序访问。可以支持多种安全框架，从NFSv4访问控制列表到基于第三方的身份验证（如Kerberos）。安全措施是在连接到pool时实施的，成功连接到池后，会将连接上下文返回给应用程序进程。

如前所述，一个pool中存储着很多不同的持久化元数据，比如：pool map、身份验证和授权信息、用户属性、属性以及rebuild日志。因此，pool的元数据会存储在故障域级别非常高的几个存储节点上，并且采用的是副本容错机制。比如，对于拥有数十万个存储节点的超大型配置而言，在这些节点中，仅有极小一部分节点运行pool metadata service。另外，在存储节点数量有限的情况下，DAOS能够依靠一种共识算法来达成一致意见，从而在出现故障时保证数据的一致性，并避免出现“脑裂”现象。

要访问pool，用户进程应连接到该pool并通过安全检查。一旦用户进程被授权，用户进程与pool的连接信息会与该用户进程相关联的所有应用进程中的任何一个共享，主要是通过`local2global`和`global2local`函数。这种连接机制有助于在数据中心运行大规模分布式作业时避免元数据请求风暴。当发出连接请求的原始进程与pool断开连接时，pool连接将被撤销。

## 4.2. DAOS Container
container在pool中代表着一个对象地址空间，每个container都有唯一的UUID标识。与pool一样，container可以存储用户属性信息。

![containers](https://raw.githubusercontent.com/henglgh/articles/main/static/images/containers.png)

为了访问container，一个应用首先要与pool建立连接，然后再打开container。如果该应用被授权访问container，该应用会获取一个container句柄。该句柄中包含授予该应用中任何一个进程访问当前container和container内容的能力。打开container的进程可以与该进程相关联的其他任何一个进程共享这个container句柄。

container中的object在数据分布和冗余方面可能具有不同的模式。动态或静态条带化、副本或纠删码是定义object模式所需的一些参数。`object class`是定义一组object的共同的模型属性参数。在整个pool中，可能存在多个object class，不同的object class有各自唯一的标识，每一个object class与特性的模式绑定。可以在任何时候，针对可配置的模式，定义新的object class。但是一旦创建，模式就无法修改。为了方便使用，默认情况下，在创建pool的时候，常用的一些object class会被预先定义。(參考`daos_obj_class.h`文件)
```c
// 模式
enum daos_obj_schema {
  DAOS_OS_SINGLE,		/**< Single stripe object */
  DAOS_OS_STRIPED,	/**< Fix striped object */
  DAOS_OS_DYN_STRIPED,	/**< Dynamically striped object */
  DAOS_OS_DYN_CHUNKED,	/**< Dynamically chunked object */
};

// object class列表
struct daos_oclass_list {
  /** Actual list of class IDs */
  daos_oclass_id_t	*cl_cids;
  /** Attributes of each listed class, optional */
  struct daos_oclass_attr	*cl_cattrs;
};

/** Object class attributes */
struct daos_oclass_attr {
  /** reserved: object placement schema, used by placement algorithm */
  enum daos_obj_schema		 ca_schema;
  /** Resilience method, replication or erasure code */
  ........
};

```

通常，在一个container内部有成百上千个object，每一个object都有一个128位的地址标识。其中高32为是被保留给DAOS用于编码内部元数据，比如object class。其余96位由用户管理，并且在container内是唯一性的。
```c
/**
 * ID of an object, 128 bits
 * The high 32-bit of daos_obj_id_t::hi are reserved for DAOS, the rest is
 * provided by the user and assumed to be unique inside a container.
 *
 * See daos_obj.h for more details
 * It is put here because it's almost used by everyone.
 */
typedef struct {
	uint64_t	lo;
	uint64_t	hi;
} daos_obj_id_t;
```
DAOS API中提供了每个container的64位可扩展object ID分配器。应用程序要存储的object ID是完整的128位地址，该地址仅供单次使用，并且只能与单个object模式相关联。(有待理解？)

container是事务和版本控制的基本单元。所有的object操作都被DAOS隐式的打上时间戳标签（`epoch`）。DAOS事务API允许将多个object更新操作合并到单个原子事务中，并基于epoch排序实现多版本并发控制。所有带版本的更新可能会定期被聚合，以实现回收重叠写入所占用的空间和降低元数据的复杂性的目的。快照是一个永久引用，可以放置在特定的时期以防止聚合。

container 元数据(list of snapshots, container open handles, object class, user attributes, properties, and others)被存储在持久化内存中，并由专门的container metadata service维护。container metadata service可以采用和父级pool metadata service相同的engine副本策略，也可以用自己的engine副本策略，可以通过在创建container时候指定。

和pool一样，想要访问container，也必须要先获取container handle。同样，需要先打开container并通过安全检测。container handle也可以通过`local2global`和`global2local`函数共享给其他相关连的应用进程使用。

## 4.3. DAOS Object
为了避免传统存储系统遇到的扩展和开销问题，DAOS object的设计非常简单。除了类型和模式之外，没有再提供其他默认的object元数据。也就意味着DAOS系统不需要去维护类似时间、大小、权限之类元数据信息。为了达到高可用和水平可扩展，DAOS提供多种object模式，比如：单个object、条带化object等等，而且在未来，object模式可以由用户自定义扩展。object的layout是在object被打开时，由算法根据object的标识和pool map生成的。在网络传输和存储object数据期间，通过使用校验和保护object数据来确保端到端的完整性。

DAOS object可以使用不同的DAOS API访问：
- `Multi-level key-array API`：是最原生的，具有本地特性的object接口。在key-array中，key被分成了distribution key(dkey)和attribute key(akey)。dkey和akey的长度和类型都是可变的。同一dkey下的所有entries都保证位于同一target上。
- `Key-value API`：是最简单的接口。其中value的长度也是可变的。这种接口主要应用于传统的put、get、remove、list操作。
- `Array API`：提供了一个元素大小固定的一维数组。这种接口主要应用于任意范围的数据的read、write、punch操作。（`punch`：直译是“打孔”，但是在DAOS中是指用于删除或截断object中的一定范围的数据。不同于delete操作，punch更强调对​object内部局部数据的精确操作，体现其细粒度特性）。

&nbsp;
&nbsp;
# 5. DAOS 事务模型
DAOS API支持分布式事务，允许将针对属于同一container的objects的多个操作组合成单个原子性、一致性、隔离性和持久性（ACID）事务。分布式一致性是通过基于多版本有序的时间戳的无锁并发控制机制提供的。DAOS事务是可序列化的，并且可以根据需要临时用于数据集的某些部分。

DAOS的版本控制机制允许创建持久化container快照，这些快照提供container在特定时间点的分布式一致视图，可用于构建producer-consumer管道。

## 5.1. Epoch and Timestamp
每个DAOS I/O操作都被打上了时间戳标签，这个时间戳标签被称之为`epoch`。每个epoch是一个64位的整数，它集成了逻辑时钟和物理时钟。DAOS API可以将epoch转化成传统的POSIX时间。

## 5.2. Container 快照
DAOS快照是非常轻量级的，而且当快照被创建的时候就会被打上带有创建时间新的的epoch标签。在container中，可以在任何时间对container内容做快照。一旦快照创建成功，快照在被显式销毁之前一直保持可读状态。container的内容可以回滚到任何一个特定的快照。

## 5.3. 分布式事务
与POSIX不同，DAOS API没有强加任何最坏情况下并发控制机制来解决冲突的I/O操作。相反，单个I/O操作被标记为不同的epoch，并按照epoch顺序应用，而不考虑执行顺序。这种机制为不产生冲突的I/O工作负载的数据模型和应用程序提供最大的可扩展性和性能。最典型的例子是，使批量的MPI-IO操作、POSIX文件读写以及HDF5数据集读写。

对于数据模型中需要冲突序列化的部分，DAOS提供基于多版本并发控制的分布式可序列化事务。最典型的例子是，不同的用户进程修改同一个dkey/akey键值对的值时，非常需要事务来处理。在同一事务上下文中提交的所有的I/O操作都将使用相同的时间戳。DAOS事务机制会自动检测传统的`read/write、write/read、write/write`冲突，并且会中断提交发生冲突的事务。失败的事务将会被用户或者应该程序重新发起。

在初始实现中，事务API不支持读取自己未提交的更改。换句话说，在同一事务上下文中执行的后续操作无法看到事务性object或 key-value的修改。事务API支持所有object类型，并且可以与event和scheduler接口结合使用。

下面是一个事务最典型的流程：
```c
daos_handle_t th = DAOS_TX_NONE;
int           rc;

/* allocate transaction */
rc = daos_tx_open(dfs->coh, &th, 0, NULL);
if (rc)
    ...

restart:
    /* execute operations under the same transaction */
    rc = daos_obj_fetch(..., th);
    ...
    rc = daos_obj_update(..., th);
    ...
    if (rc) {
        rc = daos_tx_abort(th, NULL);
        /* either goto restart or exit */
    }

    rc = daos_tx_commit(th, NULL);
    if (rc) {
        if (rc == -DER_TX_RESTART) {
            /* conflict with another transaction, try again */
            rc = daos_tx_restart(th, NULL);
            goto restart;
        }
        ...
    }

/* free up all the resources allocated for the transaction */
rc = daos_tx_close(th, NULL);
```
`daos_tx_open`是一个本地操作，它将为事务创建一个上下文。所有的非修改性操作（比如fetch、list）由远程engine服务，而所有的修改性操作（比如update、punch）是缓存在客户端。

当提交的时候，所有操作都被打包到一个复合远程过程调用（RPC）中，然后该RPC被发送给leader engine负责处理此事务。leader engine将更改应用到所有的存储节点。如果与另一个事务发生冲突，`daos_tx_commit`将返回带有`-DER_TX_RESTART`的错误信息，在调用`daos_tx_restart`后，客户端应重新执行整个事务。错误冲突可能会发生，但应该是例外而不是常态。

在任何时候，都可以调用`daos_tx_abort`来取消事务。一旦事务完成或者被取消，分配给该事务的所有资源在调用`daos_tx_close`后应该被释放，同时当前事务句柄应该变成无效。

&nbsp;
&nbsp;
# 6. DAOS 数据一致性模型
DAOS在内部使用校验和来发现静默数据损坏。虽然系统中的每个组件（网络层、存储设备）可能提供针对静默数据损坏的保护，但DAOS提供端到端的数据完整性以更好地保护用户数据。如果检测到静默数据损坏，DAOS将尝试使用数据冗余机制（复制或纠删码）恢复损坏的数据。

## 6.1. 端到端的数据一致性
简单来说，DAOS客户端为将要发送给DAOS服务端的数据计算出校验和，然后将数据和校验和都发送给DAOS服务端，随后DAOS服务端会存储校验和。当下次DAOS客户端从服务端读取这部分数据时，DAOS服务端会将校验和同时发送给DAOS客户端，然后DAOS客户端根据读取到的数据重新计算新的校验和，并与从DAOS服务端检索到的校验和对比，如果相同，表示数据一致。另外，由于被保护的数据类型不同，以上方法也稍微不同，但基本思路一样。

## 6.2. Keys和Value Objects
因为DAOS是一个key/value存储，所以keys和values的数据都是受保护的，然而方法略微不同。对于两种不同的value类型，即single value和arry，方法也略有不同。

### 6.2.1. Keys
在一次更新和获取操作时，DAOS客户端会为用作分布键和属性键的数据计算校验和，并将其通过远程过程调用（RPC）中发送给DAOS服务端。DAOS服务端将会根据校验和验证key。当DAOS服务端枚举到该key时，DAOS服务端会为该key计算校验和并和key数据打包，通过RPC消息发送个DAOS客户端。DAOS客户端将会验证收到的key。

注意：关于key的校验和并不是存储在DAOS服务端。

### 6.2.2. Values
在一个更新操作时，DAOS客户端将会为value的数据计算校验和并通过RPC消息发送给DAOS服务端。DAOS服务端接收到数据时，如果DAOS服务端开启了验证功能，会根据数据重新计算新的校验和，然后与客户端发送过来的校验和对比。如果不一致，说明数据不一致，DAOS服务端将会给DAOS客户端返回一个错误，提示DAOS客户端应该重新执行更新操作。无论DAOS服务端有没有开启验证功能，校验和都会存在DAOS服务端。（校验和的管理和存储主要在VOS层）

在一次获取操作时，DAOS服务端会将已经存储的校验和和数据发送给DAOS客户端，DAOS客户端将根据返回来的数据重建计算校验和并与返回的校验和对比。如果不一致，说明数据损坏，DAOS客户端将从其他副本中获取没有损坏的数据。

然而对于两种类型的value而言，上述方法略微不同。

**Single Value**

`Single Value`是一个原子性的value，也就是说写和读都是一整个value。DAOS纠删码功能会将Single Value切割成多个分片分布到多个存储节点上。不管是一整个value还是每一个分片，一整个value或者每一个分片都有各自的校验和，然后发送并存储在DAOS服务端。

注意：对于single value或者分片value，都有可能出现校验和的大小比single value或者分片value大。所以，如果应用需要使用很多single value的话，推荐使用Array类型的value。

**Array Values**

与Single Value不同，Array Values允许针对一个数组的任何一个部分进行更新和获取操作。除此之外，对数组的更新操作是版本化的。所以一次获取操作，可以是由数组的不同部分不同版本构成的数据。数组中每一个版本化的部分称之为`extents(区段)`。以下是2个简单的extents示例：

![array_example_1](https://raw.githubusercontent.com/henglgh/articles/main/static/images/array_example_1.png)

上图左侧描述关于single extent的更新和获取操作：蓝色线表示更新extent范围（2-13）段的数据，橘黄色线表示读取extent范围（2-6）段的数据。先执行数据更新操作，然后执行读取数据操作。图的右侧表示更新和读取操作的数据版本都是1。

![array_example_2](https://raw.githubusercontent.com/henglgh/articles/main/static/images/array_example_2.png)

上图左侧描述关于moulti extents的更新和获取操作。

数组类型的这种特性要求在创建校验和时采用更加复杂的方法。DAOS采用分块的方法（chunking），即：将extent拆分成固定大小的chunks，然后对每个chunk计算校验和。其中每个extent的起始划分都是相对于整个数组起始点偏移（称为绝对位移对齐），而不是每个I/O(或者说是每个extent)，如下图所示：

![array_with_chunks](https://raw.githubusercontent.com/henglgh/articles/main/static/images/array_with_chunks.png)

如上图左侧所示，整个数组划分成`0-3 4-7 8-11 12-15`四个extent，每个extent的大小是4（chunksize）。首先第一个I/O（2-6）extent的更新操作，按照绝对位移对齐规则，2-6段拆分成2-3和4-6两个chunk。从2-6的拆分可以看到，即便该I/O的更新范围起始点是从2开始，但是拆分成chunk的起始点依然是按照整个数组的起始点计算的。

## 6.3. 校验和计算方法
校验和的计算最终是通过调用`isa-l`和`isa-l_crypto`两个库实现的。但是原始的这些库对于DAOS而言是非常抽象的，所以DAOS自己封装一套计算校验和的接口，通过该接口实现调用isa-l和isa-l_crypto两个库。

## 6.4. 性能影响
校验和的计算可能消耗大量的CPU资源并影响系统性能。为了减轻对性能的影响，应选择具有硬件加速的校验和类型。例如，CRC32C 被最新的英特尔 CPU 所支持，并且许多（操作）通过单指令多数据（SIMD）得到加速。

&nbsp;
&nbsp;
# 7. DAOS 数据清洗(scrub)
DAOS系统会在后台运行一个扫描任务（当存储服务处于空闲的时候，目的是降低对性能的影响）。该任务会扫描VOS树，使用校验和对VOS中已经存储的数据进行验证，如果出现数据损坏应该采取相应的措施：比如数据重构。这个过程就是数据清洗。主要流程如下：
## 7.1. High Level Design
- 每个pool的用户态进程将迭代所有的containers。如果开启了checksums和scrubber，然后将迭代VOS树。如果某个recod值没有被标记为已损坏，那么将扫描这个record。
- 读取数据。
- 计算数据的校验和。
- 与已经存储的校验和对比。

## 7.2. Silent Data Corruption
当检测到数据损坏，应采用以下措施：
- 将record标记为损坏。
- 使用DAOS RAS通知系统发起一个事件。
- 校验和错误信息计数加1。
- 如果达到错误信息计数的阈值，将触发rebuild/drain操作。

## 7.3. scrub属性参数
- `Pool Scrubber Mode (scrub)`：scrubber的工作模式，参数的值为`off、lazy、timed`。在container的配置中，可以禁用scrub，但无法更改scrub工作模式。
- `Pool Scrubber Frequency (scrub_freq)`：scrubber的工作频率。该参数只有参数`scrub`设置为timed才有效。
- `Threshold (scrub_thresh)`：pool target被evict时，校验和错误计数上限。当设置为0是，表示禁止自动执行evict操作。

&nbsp;
&nbsp;
# 8. DAOS 故障模型
DAOS依赖于大规模分布式单端口存储。因此，每个target实际上都是一个单点故障。DAOS通过在不同故障域的target之间提供冗余来实现数据和元数据的可用性和持久性。DAOS内部的pool和container的元数据通过一种强大的共识算法进行复制。DAOS的objects通过在内部透明地利用 DAOS分布式事务机制进行安全复制或纠删编码。

## 8.1. 分等级的故障域
故障域是由一组共享相同故障点的服务器组成，因此，同一故障域的服务器很可能会一起发生故障。DAOS假定故障域是分层的且不重叠。DAOS使用外部数据库生成pool map，该外部数据库提供实际的层次结构和故障域成员关系。

pool元数据在来自不同高级故障域的多个节点上进行复制以实现高可用性，而object数据可以根据所设置的oclass在可变数量的故障域上进行复制或纠删编码。

## 8.2. 故障检测
DAOS engines在DAOS系统中通过一种名为SWIM的基于闲聊（gossip-based）的协议进行监控，该协议可提供准确、高效且可扩展的故障检测。每个DAOS target所连接的存储通过定期的本地健康评估进行监控。每当向DAOS sever返回本地存储I/O错误时，将自动调用内部健康检查程序。如果结果为消极的，则该target将被标记为有故障，并且对该target的进一步I/Os将被拒绝并重新路由。

## 8.3. 故障隔离
一旦检测到故障target或engine（实际上是一组targets），就必须将其从pool map中排除。这个过程可以由管理员触发，也可以自动触发。排除故障target后，新版本的pool map会立即推送到所有的存储target。此时，pool进入降级模式，在这种情况下访问数据时系统可能需要更多额外的操作。（比如，从纠删码中重建数据）因此，DAOS客户端和存储节点会不断重试RPC，直到他们从新的pool map中找到一个可替代的target，或者是RPC超时。此时，与被排除的target的所有未完成通信都将被中止，并且在该target被明确重新整合之前（可能仅在维护操作之后），不应再向该target发送任何消息。

pool service会及时将pool map的更改通知所有存储targets。但对于DAOS客户端节点而言并非如此，DAOS客户端只有在每次与任何一个engine通信时，才会被“懒散地”告知当前客户端已知的pool map已经无效了。为此，客户端在每次RPC中都包含自己最后已知的pool map版本，而服务端则以当前版本的pool map进行回复。因此，当DAOS客户端遇到RPC超时情况时，它会定期的与其他DAOS target通信，以确保其知道的pool map是最新的。客户端最终会被告知故障target已经被排除，并且pool进入降级模式了。

这种机制保证了全局节点的逐出，并确保所有节点最终对所有target的活跃状态有相同的视图。

## 8.4. 故障恢复
从pool map中排除故障target后，每个target会自动启动数据重建过程以恢复数据冗余。首先，每个target会创建一个受故障target影响的本地object列表。这是通过扫描由底层存储层维护的本地object表来完成的。然后，对于每个受影响的object，确定object分片的位置，并为整个历史记录（即快照）恢复object的冗余数据。一旦所有受影响的object都已重建，pool map将第二次更新以将故障的target状态报告为"failed out"。这标志者针对该特定故障的数据重建过程结束了，并退出降级模式。此时，pool已从故障中完全恢复，客户端节点现在可以从重建的object分片进行读取。

在此重建过程中，应用程序可以同时继续访问并更新objects。


&nbsp;
&nbsp;
# 9. DAOS 安全模型
DAOS采用灵活的安全模型，将身份验证与授权分离。在设计上，它对I/O路径的影响最小。

在网络（这里指的是`fabric network`）传输过程中，DAOS没有为I/O传输提供任何传输安全保障。在部署DAOS的时候，管理员负责fabric network的安全配置。

DAOS在两个方面实现自己的安全层。在用户级别，客户端只能读取和修改已经被授权访问权限的pool和container。在系统和管理级别，只有经过授权的组件才能访问DAOS管理网络。

## 9.1. 身份认证
根据调用者是访问DAOS客户端资源还是DAOS管理网络，存在不同的身份验证方式。组件证书在这两种方法中都起着关键作用。因此，在生产系统中绝不应该禁用证书。

### 9.1.1. Client  Library
客户端库（即：libdaos）是一个不受信任的组件。因此客户端所有的`daos`命令都是不受信任的，因为`daos`命令是使用了`libdaos`库。但是运行在每个客户端节点上的DAOS agent（`daos_agent`）进程是一个受信任的进程，该进程会对每一个用户进程进行身份认证。

daos_agent检测与进程关联的用户，并使用agent组件证书对用户凭证进行签名。agent将已签名的凭证包返回给客户端，以便未来在整个DAOS系统的RPC调用中使用。在接收到客户端RPC后，服务端在继续处理请求的操作之前会验证签名。受信任的daos_agent的加密签名对于服务端进程确认用户身份时是至关重要。

DAOS安全模型旨在为客户端进程支持不同的身份验证方法。目前，仅支持AUTH_SYS认证方式。

### 9.1.2. DAOS 管理网
DAOS管理组件是通过gRPC协议进行网络通信的。

每个受信任的DAOS组件（daos_server、daos_agent和dmg管理工具）都通过系统管理员为该组件生成的证书进行身份验证。所有组件证书必须使用相同的根证书生成，并分发到相应的DAOS节点。

DAOS组件通过使用各自的组件证书在相互认证的TLS上通过gRPC在DAOS管理网络上相互识别。DAOS验证证书链以及证书中的CommonName（CN），以对组件的身份进行身份验证。

admin组件证书是dmg管理工具唯一的身份验证和授权机制。借助admin证书的私钥和dmg可执行文件，用户可以对DAOS系统拥有完全的管理访问权限。

## 9.2. 授权
授权客户端对资源的访问是通过Access Control List (ACL)控制的。在DAOS管理网络上的授权是通过在设置DAOS系统时生成的证书上的设置来实现的。

### 9.2.1. 组件证书
对DAOS管理网RPC的访问是通过每个管理组件证书中设置的CN来控制的。给定的管理网RPC只能由使用正确证书连接的组件调用。

### 9.2.2. 访问控制列表（ACL）
客户端对诸如pool和container等资源的访问由DAOS访问控制列表（ACL）控制。这些ACLs部分源自NFSv4访问控制列表，并针对分布式系统的独特需求进行了调整。

客户端可以请求对资源的只读或读写访问权限。如果资源的ACL对这些请求并未授权访问权限，客户端将无法与资源建立连接。一旦连接后，他们对该资源的句柄会授予特定操作的权限。

与POSIX系统中的打开文件描述符类似，句柄的权限仅在其存在期间持续有效。当前，句柄无法被撤销。

DAOS访问控制列表（ACL）由零个或多个访问控制项（ACE）组成。这些ACE是规则，用于向请求访问资源的用户授予或拒绝权限。

**Access Control Entries**

在DAOS工具的输入和输出中，ACE使用由冒号分隔的字符串定义，格式如下：`TYPE:FLAGS:PRINCIPAL:PERMISSIONS`。其中每个字段的内容都是区分大小写的。
- `TYPE`：目前只支持`A(Allow)`这种类型，并且必须要填写。`A`：允许使用给定的权限访问特定的主体。
- `FLAGS`：表示应该将`PRINCIPAL`解释为什么。目前只支持`G(Group)`这种标志。而且是可选的。`G`：表示将`PRINCIPAL`解释为一个group。
- `PRINCIPAL`：即主体或者身份。以`name@domain`格式指定。其中，如果`name`是本地的UNIX用户或者用户组的话，应省略`domain`。目前DAOS中也只支持本地用户或用户组的这种方式，不支持远程的。另外有三种特殊的`PRINCIPAL`：`OWNER@, GROUP@, EVERYONE@`，这三种主体分别对应`User, Group, Other`。在使用时，必须使用大写字母，而且不带domain。对于`GROUP@`而言，还需要添加`G`标志。
- `PERMISSIONS`：定义访问资源的权限。

  |权限|pool解释|container解释|
  |:---|:---|:---|
  |r (Read)|类似权限`t`|读取container数据和属性|
  |w (Write)|类似权限`c + d`|写入container数据和属性|
  |c (Create)|创建container|N/A|
  |d (Delete)|删除container|删除当前container|
  |t (Get-Prop)|connect/query|获取container参数|
  |T (Set-Prop)|N/A|设置/更改container参数|
  |a (Get-ACL)|N/A|获取container ACL|
  |A (Set-ACL)|N/A|设置/更改container ACL|
  |o (Set-Owner)|N/A|设置/更改container的拥有者或者用户组|

为了让一个用户/用户组可以与某个资源建立连接，主体的权限必须要包含拥有具有读权限的权限（比如，`r`和`t`）。当一个只有写权限的用户访问一个要求具有读和写权限的资源时，该请求会被拒绝的。

当前，虽然只能设置`Allow`类型来允许主体访问资源。然而，可以通过为特定用户创建一个没有权限的“允许”条目来拒绝该用户的访问。但是这种方法不适应与用户组，因为用户组的权限时强制的。

以下是几个例子：
- `A::daos_user@:rw`：允许名为daos_user的UNIX用户拥有读写访问权限。
- `A:G:project_users@:tc`：允许UNIX组project_users中的任何人访问pool的内容并创建container。
- `A::OWNER@:rwdtTaAo`：允许拥有该container的UNIX用户拥有完全控制权。
- `A:G:GROUP@:rwdtT`：允许拥有该container的UNIX组读取和写入数据、删除container以及操作container属性。
- `A::EVERYONE@:r`：允许未被其他规则涵盖的任何用户拥有只读访问权限。
- `A::daos_user@:`：拒绝名为daos_user的UNIX用户对资源的任何访问权限。

**优先级顺序**

ACEs将按照Owner-User，Named users，Owner-Group and named groups，Everyone的顺序匹配。一般来说，执行将基于第一个匹配项，忽略优先级较低的条目。

如果用户是资源的所有者，并且存在一个OWNER@条目，他们将仅接收所有者权限。他们不会接收命名用户/组条目中的任何权限，即使他们与其他条目匹配。

如果用户不是所有者，或者没有OWNER@条目，但存在针对其用户身份的访问控制项（ACE），则他们将仅获得其用户身份的权限。他们不会收到其任何组的权限，即使这些组条目具有比用户条目更广泛的权限。预计用户最多匹配一个用户条目。

如果未找到匹配的用户条目，但条目与用户的一个或多个组匹配，则执行将基于所有匹配组的权限联合，包括所有者组GROUP@。

如果未找到匹配的组，则将使用EVERYONE@项的权限（如果存在）。

默认情况下，如果用户在访问控制列表中不匹配任何访问控制项，则访问将被拒绝。

**ACL 文件**

ACL文件是一个非常简单的文本文件，每行有一个访问控制项（ACE）。可以通过在该行上使用`#`作为注释。
```bash
# ACL for my container
# Owner can't touch data - just do admin-type things
A::OWNER@:dtTaAo
# My project's users can generate and access data
A:G:my_great_project@:rw
# Bob can use the data to generate a report
A::bob@:r
```
注意，其中ACE之间是没有先后顺序的。

**限制**

DAOS ACL内部数据结构中ACE列表的最大大小为64KiB。ACL大小可以按照公式计算每个ACE大小而得到。每个ACE的基本大小是256字节，如果ACE的主体不是特殊的主体，那么主体的字符串长度+1。如果ACE的总大小不是64字节对齐的，则向上舍入到最近的64字节边界。