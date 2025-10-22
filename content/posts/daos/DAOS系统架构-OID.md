---
title: DAOS系统架构-OID
date: 2025-10-22T09:00:00+0800
description: "本文详细介绍DAOS.2.6.0中object id的设计思想"
tags: [daos]
---

# 1. 概述
`object id`（下文简称：`oid`）在任何分布式存储系统中都是非常重要的。在DAOS中理清oid的数据结构，诞生时间点以及用法对了解管理object的逻辑起到事半功倍的作用。

&nbsp;
&nbsp;
# 2. 数据结构
![oid](https://raw.githubusercontent.com/henglgh/articles/main/static/images/oid.png)

上图所示的是DAOS 6.2.0版本中oid的结构示意图，oid的结构由high和low两部分以`high.low`形式拼接而成，比如`937030206059708418.0`。oid总长度是128位，高64位是high，低64位置low。

high部分的高32位是系统使用的，低32位是high计数使用。high的高32位又被分成8、8、16三部分，分别用来编码`type`、`class`和`meta`。

type是用来区分object的类型，默认是`DAOS_OT_MULTI_HASHED`。该类型主要是用来创建目录对象，它是一种多层级key-value数据结构，用来存储目录子项的元数据。除此之外，常见的还有`DAOS_OT_ARRAY_BYTE`。该类型是用来创建文件对象，它是一种key-array类型的数据，用来存储写入文件中的真实数据。type所有的类型定义在`daos_otype_t`枚举中，此处不再列出。

class是用来定义object的冗余方式，如果没有设置，默认会使用父目录的冗余方式。class所有的类型定义在`daos_obj_redun`枚举中，常见的副本冗余类型有：`OC_RP_2G1`、`OC_RP_2GX`等，纠删码冗余类型有：`OC_EC_2P1G1`、`OC_EC_2P1GX`等。除此之外，DAOS还支持无冗余方式，也就是分片模式，常见的类型有：`OC_S1`、`OC_SX`等。

meta，代码注释中说用来存储对象的元数据信息。但是在生成oid的过程中，用到的只有冗余组的数量`nr_grp`。正常情况下，nr_grp是从class中解析出来的。比如，如果设置class是OC_RP_2G1，nr_grp就是1。非正常情况下需要将解析出来的数值做进一步分析，看是否符合容灾域数量等等，具体的处理逻辑在`daos_oclass_fit_max`和`dc_set_oclass`中。

抛去high高32位后，剩下的32位是真正用来计数的。在DAOS 2.6.0版本中，每新建一个对象，oid.hi都会自动加1（有前提条件），当自加之后的数值超过`0xffffffff`时，代码中会重置oid.hi为`0`。这也就意味着如果只考虑oid.hi，而不考虑oid.lo的话，同一个container内（也可以理解为同一个命名空间内）最多只能创建`0xffffffff`个相同类型相同冗余方式的对象。这样的数量肯定是无法支撑海量数据的，因此oid.lo就起到非常重要的作用。

实际上，oid.hi的低32位和oid.lo的全部64位一起决定了一个object的唯一标识的计数。当oid.lo相同时，代码会将oid.hi的低32位加1。如果加1之后的数值超过`0xffffffff`，代码会将oid.hi的低32位重置为`0`，同时重新生成oid.lo。oid.lo的生成的处理逻辑在`daos_cont_alloc_oids`函数中（此处未进一步分析oid.lo是怎么产生的）。默认情况下，oid.lo的值就是container（container本质上就是一个object）的lo的值。所以，在这种设计模式下，同一个container内可容纳高达`0xffffffff * 0xffffffffffffffff`个对象，对象数量直接以数量级增长。

```bash
[root@node220 daosfs]# ls
hosts  hosts2  hosts3
[root@node220 daosfs]#
[root@node220 daosfs]# daos container list-objects test test1
281483566645248.0
281483566645249.0
937030206059708418.0
937030206059708419.0
937030206059708420.0
[root@node220 daosfs]#
```
上面是一个测试环境中的案例，其中文件hosts、hosts2、hosts3对应的object id分别是937030206059708418.0、937030206059708419.0、937030206059708420.0。不难发现，oid.hi的最后2位依次从18递增到20，而oid.lo的数值都是0（也就是container的lo值），这也验证了我们之前说的。

&nbsp;
&nbsp;
# 3. oid的使用
在DAOS中oid是通过`oid_gen`函数生成的，该函数是作为dfs层的接口函数使用。在dfs层生成的oid会被DAOS层的dc object直接复用，从始至终，oid不会再其他任何地方产生。比如说，在新建目录时，dfs层的create_dir函数会调用oid_gen生成一个新的oid，然后将该oid作为daos_obj_open的参数传入，由此便进入DAOS层，DAOS层最终会调用dc_obj_open函数构造出一个新的dc object，新的dc object的oid是存储在其内部成员`cob_md`中的，cob_md是daos_obj_md类型的数据结构。在dc_obj_open函数中，会调用dc_obj_fetch_md函数将dfs层传入的oid作为参数与新的dc object的oid进行绑定。