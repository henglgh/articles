---
title: DAOS系统架构-Placement
date: 2025-06-03T16:24:00+0800
description: "本文详细介绍DAOS中关于对象的placement map的设计思想"
tags: [daos]
---

> daos:           2.6.0

# 1. 概述
DAOS使用pool map来创建一系列placement maps，这些maps被用于计算对象布局的算法中。该算法是基于一致性哈希算法，使用对象的ID、对象的概要、以及其中一个placement map来生成对象的布局。DAOS使用一种模块化方法，允许不同的对象使用不同的placement map来获得应用程序所需的性能特征。

&nbsp;
&nbsp;
# 2. Pool Map
在DAOS中，pool map被组织为一种树形结构，维护着与该pool相关联的各组件之间的关系结构。其中组件类型基本包括：root node rank target。另外树的每个层级都被视为一个容灾域，最后一层是target级别的容灾域。


**pool component types**
```c
typedef enum pool_comp_type {
	PO_COMP_TP_TARGET = 0,   /** reserved, hard-coded */
	PO_COMP_TP_RANK   = 1,   /** reserved, hard-coded */
	PO_COMP_TP_NODE   = 2,   /** reserved, hard-coded */
	PO_COMP_TP_MIN    = 3,   /** first user-defined domain */
	PO_COMP_TP_FAULT  = 3,   /** user-defined fault domain (if not node) */
	PO_COMP_TP_PERF   = 200, /** user-defined performance domain (optional) */
	PO_COMP_TP_MAX    = 254, /** last user-defined domain */
	PO_COMP_TP_ROOT   = 255,
	PO_COMP_TP_END    = 256,
} pool_comp_type_t;
```

**pool map**
```c
struct pool_map {
	/** Current version of pool map */
	uint32_t		 po_version;
	/** # domain layers */
	unsigned int		 po_domain_layers;
	/**
	 * Tree root of all components.
	 * NB: All components must be stored in contiguous buffer.
	 */
	struct pool_domain	*po_tree;
	......
}
```

**pool domain**
```c
struct pool_domain {
	/** embedded component for myself */
	struct pool_component	 do_comp;
	/** # all targets within this domain */
	unsigned int		 do_target_nr;
	/**
	 * child domains within current domain, it is NULL for the last
	 * level domain.
	 */
	struct pool_domain	*do_children;
	/**
	 * all targets within this domain
	 * for the last level domain, it points to the first direct targets
	 * for the intermediate domain, it points to the first indirect targets
	 */
	struct pool_target	*do_targets;
};
```

&nbsp;
&nbsp;
# 3. Placement Map
placement map本质上是一个抽象的，经过排列过的pool map。它不一定包含pool map的所有细节信息。相反，它只保留了相关组件关系，该组件关系用于分发对象分片以满足应用程序的弹性和性能要求。

![pool_and_placement_map](https://raw.githubusercontent.com/henglgh/articles/main/static/images/pool_and_placement_map.png)

一个placement map不会去维护相关联的pool map中的组件状态和组件特征的副本，仅仅是引用pool map的组件。所以，每次DAOS根据一个placement map计算出某个对象的分布时，它还需要从pool map中检查相关联组件的状态和属性。这为间接内存访问增加了一个额外的步骤，但是当一个DAOS存储池有很多placement map而只有一个pool map时，这可以显著减少缓存污染和内存消耗。

如上图所示，一个存储池可以具有多个不同类型的placement map，因为不同的应用程序可能具有不同的容错和性能要求。此外，同一个placement map可以有很多实例，以便可以通过“负载解聚”技术来加速数据的重建和再平衡过程。

DAOS目前使用包括2种placement map算法：Jump Consistent Hashing algorithm和Ring Consistent Hashing algorithm。

```c
/** types of placement maps */
typedef enum {
	PL_TYPE_UNKNOWN,
	/** only support ring map for the time being */
	PL_TYPE_RING,
	/**Prototype placement map*/
	PL_TYPE_JUMP_MAP,
	/** reserved */
	PL_TYPE_PETALS,
} pl_map_type_t;
```

## 3.1. Jump Placement Map
Jump Placement Map是DAOS中默认的placement map。它使用跳跃一致性哈希算法（Jump Consistent Hashing algorithm）在不同容错域之间伪随机分布对象。这会将他们分布到尽可能远的远离彼此的容错域中，以避免当某个故障事件影响整个容错域的情况下发生的数据丢失的出现。另外，当系统的物理配置发送变化时，它可以让系统之间地数据迁移变得更加有效。

## 3.2. Ring Placement Map
Ring Placement Map是在开发DAOS时原先使用的placement map。它使用了一个环形内存结构，将targets以某种模式放置到环上。这样，对于给定的环上的任何一个随机位置，该位置以及其邻居在物理上将位于不用的容错域中。这使得计算放置位置的速度非常快，同时也使得动态修改变得非常困难。目前DAOS中不再使用它了，因为它不支持DAOS所需的几种较新的API方法，特别是针对DAOS server的reintegration, drain, and addition方法。