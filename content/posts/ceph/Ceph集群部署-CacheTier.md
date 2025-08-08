---
title: Ceph集群部署-CacheTier
date: 2021-05-06T14:48:33+0800
description: "本文介绍如何部署ceph分层存储，并使用ceph分层存储功能。"
tags: [ceph]
---


# 1. 前言
本文介绍如何部署ceph分层存储功能，并使用ceph分层存储功能。系统环境如下：
```bash
ceph:           14.2.22
linux os:       ubuntu 18.04
```
本文默认已经提前部署ceph集群，如果没有部署，请参考[Ceph集群部署-deploy多机模式]({{< ref "Ceph集群部署-deploy多机模式.md" >}})。

&nbsp;
&nbsp;
# 2. 分层存储部署
### 2.1. 创建分层结构
将数据存储池和缓存池建立分层结构
```bash
ceph osd tier add fs_data cache_pool
```

设置分层存储模式
```bash
ceph osd tier cache-mode cache_pool writeback
```

将客户端请求重定向到缓存池
```bash
ceph osd tier set-overlay fs_data cache_pool
```
`fs_data` 和 `cache_pool`是两个副本池，副本数默认，PG数量都是为1。
&nbsp;

### 2.2. 缓存池参数配置
配置缓存池使用的目标查找算法
```bash
ceph osd pool set cache_pool hit_set_type bloom
```

配置缓存池使用的数据命中集合个数
```bash
ceph osd pool set cache_pool hit_set_count 1
```

配置缓存池使用的数据命中集合存在时间
```bash
ceph osd pool set cache_pool hit_set_period 3600
```

配置数据promote到缓存池时需要遍历数据命中集合个数
```bash
ceph osd pool set cache_pool min_read_recency_for_promote 1
```
```bash
ceph osd pool set cache_pool min_write_recency_for_promote 1
```
如果设置为0，表示始终都做promote。如果设置为1，表示遍历当前hit set。设置的个数要介于0到hitset总个数之间。

配置缓存池中能够存储object的最大数量
```bash
ceph osd pool set cache_pool target_max_objects 1000
```

配置存储池低速flush数据到数据存储池时被修改的数据容量占比
```bash
ceph osd pool set cache_pool cache_target_dirty_ratio 0.4
```

配置存储池高速flush数据到数据存储池时被修改的数据容量占比
```bash
ceph osd pool set cache_pool cache_target_dirty_high_ratio 0.6
```

配置存储池高速evict数据时被已经使用的数据容量占比
```bash
ceph osd pool set cache_pool cache_target_full_ratio 0.8
```

配置缓存池flush数据到数据存储池之前object在缓存池中存在的时间
```bash
ceph osd pool set cache_pool cache_min_flush_age 10
```

配置缓存池evict数据之前object在缓存池中存在的时间
```bash
ceph osd pool set cache_pool cache_min_evict_age 15
```

&nbsp;
### 2.3. 注意事项
以上所有参数都要配置，尤其是`hit set`的配置。hit set在计算flush/evict比例、object promote流程中扮演者很重要角色。

上述设置缓存池总容量时，既可以通过`target_max_objects`设置，也可以通过`target_max_bytes`设置；可以同时设置这两个参数，可以以只设置其中一个。如果设置target_max_objects，将根据object数量去计算占比。如果设置target_max_bytes，将根据数据使用字节数计算占比。如果同时设置，将分别计算占比，然后对比选择出最大占比。

默认情况下，单次处理单个PG中的object数量为10；生产环境发现这种情况下，flush和evict的速度会比较慢，导致缓存池会一直处于full状态，进而导致很多OSD只读不能写，出现slowops；可以根据实际操作调整缓存池OSD的参数：`osd_pool_default_cache _max_evict_check_size`；比如：`ceph tell osd.* injectargs --osd_pool_default_cache_max_evict_check_size 100`。
