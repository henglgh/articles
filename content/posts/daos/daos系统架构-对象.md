---
title: DAOS 系统架构-对象
date: 2025-04-25T09:00:00+0800
description: "本文详细介绍DAOS对象的设计思想"
tags: [daos]
---

# DAOS 对象
DAOS对象负责存储用户的数据，它由对象ID标识，该对象ID在其所属的DAOS容器中是唯一的。对象可以分布在存储池中的任意target上，以实现性能和弹性。下图有助于理解DAOS对象在存储层次结构中的位置。

![](/static/images/daos_object_layout.png)

从上图可以看到DAOS对象分为两类：`byte Array类型`的和`KV类型`的。byte Array类型的对象没有key，而这种对象主要用来存储真实的用户数据。KV这种结构的对象，做常见的是用来存储属性。

对象模块实现了对象I/O堆栈。为了避免传统存储堆栈常见的扩展问题和开销，DAOS对象特意设计的非常简单。除了对象类型和对象类之外，没有其他默认的对象元数据。这意味着系统不会再维护像访问时间、大小、所有者或者权限这些昂贵的属性，也不会跟踪对象的openers。

## KV存储
每个DAOS对象都是一个具有本地特性的Key-Value存储结构。其中key又分为两种：`dkey (distribution key)`和`akey (attribute key)`。同一dkey下的akeys和values都被存储再同一个target上。DAOS系统为dkey和akey提供了一个枚举类型结构，在该结构中定义了不同类型的key。

另外，value也分为两种：`single value（可以理解为变量）`和`array value（可以理解为数组）`。对于single value而言，通常在执行更新操作时，其数值直接被替换。对于array value而言，通常可以获取或更人任意范围内的数值。

## 对象类型
对象类型主要用来定义key的类型，然后在极少数情况下也用来定义value的类型。它允许DAOS存储引擎可以对底层存储进行优化并为key枚举提供特定排序的保证。`daos_otype_t`结构是一个枚举结构，它定义了DAOS目前支持的所有对象类型，默认值是`DAOS_OT_MULTI_HASHED`。`DAOS_OT_MULTI_ORDERED`既可以是dkey，也可以是akey，是不具有任何类型的，并且可以在akey下存储单值或者数组值。

最简单的KV类型的对象结构就是一个单值。

byte Array类型的对象需要存储在整数类型的dkeys中。

举个例子来说一下DAOS对象，出于模拟目的，假设要存储某块用户写入的数据是一个有10元素的数组。chunk size是3。那么这个数组会按照chuk大小被分成4份,每一份都将写入一个byte Array类型的对象中。所以最终会存在4个byte Array对象。另外还需要创建一个key-arry类型的对象，用来记录byte Array对象的元数据。具体设计如下：

KV类型的对象结构如下：
```text
DKey: 0
Single Value: 3 uint64_t
       [0] = magic value (0xdaca55a9daca55a9)
       [1] = array cell size
       [2] = array chunk size
```
上面整体是一个KV对象，是key-array类型的，用来存储byte Array对象的元数据。

byte Array类型的对象如下：
```text
DKey: 1
Array records: 0, 1, 2 <------这是一个array对象
DKey: 2
Array records: 3, 4, 5 <------这是一个array对象
DKey: 3
Array records: 6, 7, 8 
DKey: 4
Array records: 9
```

## 对象的类
DAOS对象的类是描述对象的分发和对象的保护方法。对象的类是由类ID（8位比特）和一个16位的编码组成。类ID定义了数据保护策略（比如2副本或者8+2的就删码，通过daos_obj_redun结构可以看到）。16位的编码是通过对冗余组（也成为分片）的数量进行编码而来的，dkeys分布在这些组中。

DAOS API为最常见的对象的类提供了预先定义的标识。例如：`OC_S1`表示对象没有任何数据保护策略，只有1个分片（也就是自身完整的数据），并且只分布在1个target上的。同理，`OC_S2`表示有2个分片，分别分布在2个target上，`OC_SX`表示对象的分片数量与存储池中所有的可用的target数量相同，并且所有分片分布在不同的target上。`OC_RP_2G1`表示对象有1个分片，每个分片都有2个副本，最终都分布在1个target上。`OC_RP_5GX`表对象的分片数量与target数量相同，每个分片有5个副本。`OC_EC_2P1G1`表示数据块有2个，校验快有1个，对象只有一个分片。更多关于对象的类的预定义可以参考`daos_obj_class.h`文件。

### 对象的类的命名规则
DAOS对象支持两种数据保护方式：副本（RP）和纠删码（EC）。一个复制的分片集合或者同属于一个奇偶校验组的数据块和校验块的集合被称为冗余组。一个对象可以被分块到多个冗余组中，这些冗余组分布在多个存储目标中，目的是为了实现更高的I/O并发性，从而获得更好的性能和更大的容量。在同一冗余组中，存储分片的target一定是从不同的故障域中选择的，默认的故障域是`engine`，也可以设置为其他的故障域（只要支持），比如：`node`或者`rack`。

DAOS源码中有100多个预定义的对象的类，这些类的命名规则如下：
- `OC`：Object Class。
- `RP`：Replication。下划线后面的数字为副本数。例如：OC_RP_2GX中的2表示2个副本。
- `EC`：Erasure Code。字母P前面的数字表示数据分片数，P后面的数字表示校验分片数。例如：OC_EC_4P2G1表示EC(4+2)。
- `G`：Redundancy Group。一个冗余组可以是一组分片副本，也可以是一组EC。G后面的数字表示冗余组的数量，`X`表示对象应该分布在所有的engine中。
- 如果命名中没有RP或者EC，则表示没有数据保护策略，此时对象的类的名字后缀是`S{n}`，S后面的数字表示对象的分片数量。

### 最大布局和限制
在DAOS中有一些以`SX`或者`GX`作为后缀的对象的类，例如：`OC_SX`、`OC_RP_2GX`。X表示最大，SX/GX表示对象应该放置在存储池中可能的最大数量的target上。

需要注意的是，DAOS会在生成对象ID的函数`daos_obj_generate_oid`中，将分片或者冗余组的实际数量编码在对象的ID中。这意味着，即使存储池的大小可以通过添加更多的targets来水平扩容，已经存在的对象无法重新分发到新增加的target上。


### 对象ID和对象的类的选择
如前面所说，对象的类的ID和冗余组数被编码在对象的ID中。通过`daos_obj_generate_oid()`函数，用户可以为特定的对象的类生成一个对象ID。DAOS使用此编码信息来生成对象的布局。

用户可以在生成OID时手动选择对象的类。但是，不建议普通用手动选择对象的类，而应该仅仅由懂得如何权衡取舍的高级用户操作。对大多数用户来说，应该让DAOS自动选择对象的类：用户会将对象的类的值设置为OC_UNKNOWN，并传递给daos_obj_generate_oid函数，然后DAOS会根据正在访问的容器属性（例如冗余因子RF，容灾单元数量domain_nr以及正在访问的对象的类型）来自己选择对象的类。

下面详细说明DAOS在自动选择模式下（没有提供默认值，也没有提供暗示说明（hints））如何决策一个对象的类：
- RF：0
  - Array、Byte Array、Flat KV类型的对象：OC_SX
  - no feats类型的对象：OC_S1
- RF：1
  - Array、Byte Array类型的对象：
    - domain_nr >= 10：OC_EC_8P1GX
    - domain_nr >= 6：OC_EC_4P1GX
    - 其他情况：OC_EC_2P1GX
  - Flat KV类型的对象：OC_RP_2GX
  - no feats类型的对象：OC_RP_2G1
- RF：2
  - Array、Byte Array类型的对象：
    - domain_nr >= 10：OC_EC_8P2GX
    - domain_nr >= 6：OC_EC_4P2GX
    - 其他情况：OC_EC_2P2GX
  - Flat KV类型的对象：OC_RP_3GX
  - no feats类型的对象：OC_RP_3G1
- RF：3
  - Array、Byte Array、Flat KV类型的对象：OC_RP_4GX
  - no  feats类型的对象：OC_RP_4G1
- RF：4
  - Array、Byte Array、Flat KV类型的对象：OC_RP_6GX
  - no feats类型的对象：OC_RP_6G1

除此之外，生成OID的API为用户提供了一种可选的机制：用户可以向DAOS库提供一个对象类的提示（hints），然后DAOS会根据这个提示来控制应该选择哪种冗余方法，应该用哪种规模的冗余组，而无需再指定oclass了。这个提示将会覆盖自动选择模式下的特定的设置。例如，用户可以为一个Array类型的对象设置一个关于副本容错方式的提示，然后DAOS会选择一个合适的副本类型的对象的类，而不是默认的EC类型的对象的类。

请注意，`提示是用来控制自动选择的`。

用户可以使用以下任何一个`冗余策略`提示：
- `DAOS_OCH_RDD_DEF`：默认值，会使用RF属性。
- `DAOS_OCH_RDD_NO`：没有冗余。
- `DAOS_OCH_RDD_RP`：副本方式的冗余。
- `DAOS_OCH_RDD_EC`：纠删码方式的冗余。

也可以使用以下任何一个`分片策略`提示：
- `DAOS_OCH_SHD_DEF`：默认值，使用1个group,也就是只有1个分片。
- `DAOS_OCH_SHD_TINY`：<= 4个group。
- `DAOS_OCH_SHD_REG`：max(128,25% * target_nr)
- `DAOS_OCH_SHD_HI`：max(256, 50% * target_nr)
- `DAOS_OCH_SHD_EXT`：max(1024, 80% * target_nr)
- `DAOS_OCH_SHD_MAX`：100%


## 数据保护方法
DAOS支持两种数据保护方法：副本（RP）和纠删码（EC）。此外，校验和（checksum）也可以应用在这两种方法中，以确保端到端的数据完整性。如果通过校验和发现静默数据损坏，则数据保护方法可以用来恢复数据。

### 副本
副本冗余策略可以确保对象数据的高可用性，因为当任何一个副本存在时，对象都可以访问。

在DAOS中，在权衡性能和延迟的条件下，服务端侧的服务都是采用副本冗余策略，来确保DAOS服务具有更强的一致性。



### 纠删码


### 校验和