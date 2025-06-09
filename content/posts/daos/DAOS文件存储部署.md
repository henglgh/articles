---
title: DAOS文件存储部署
date: 2024-12-09T16:48:46+0800
description: "本文详细介绍如何部署daos文件存储系统。"
tags: [daos]
---

# 1. 前言
本文详细介绍如何部署daos文件存储系统。系统环境如下：
```bash
daos:           2.0.0
linux os:       almalinux 8.9
linux kernel:   4.18.0-513.5.1.el8_9.x86_64
```
- 之所以选择2.0.0版本，是因为daos从2.0.0开始是一个全新的架构设计，与1.x版本是不兼容的。其次为了方便研究daos源码，当然是版本越早，功能越少，代码逻辑更清晰。
- 本文默认已提前部署好daos集群，如果没有部署，参考[daos集群部署多机模式]({{< ref "daos集群部署多机模式.md" >}})。

&nbsp;
&nbsp;
# 2. 文件存储部署
## 2.1. 创建pool
```bash
dmg pool create -z 5GB test
```
## 2.2. 创建container
```bash
daos container create test test --type=POSIX --oclass=RP_2GX --properties rd_fac:1
```
这里重点讲解`--oclass`和`--properties`参数。
- `oclass`：设置object容错模式（RP和EC）。此处`RP_2GX`中RP表示副本模式，2表示2个副本，G表示对象分片，X表示分片个数为最大，也就是等于所有可用的target数量。当然X也可以换成具体的数字，比如RP_2G2。
- `rd_fac`：设置object的容灾域模式。目前daos只支持engine级别的容灾域。`rd_fac:1`表示允许1个engine出现故障。

rd_fac会影响oclass中object分片选择的target范围。当oclass设置以GX为结尾的模式时，rd_fac也会影响object分片的最大分片数量。

下面是另外一套集群中的配置信息  
daos system配置信息：
```bash
connected to DAOS system:
	name: daos_server
	fabric provider: ofi+tcp;ofi_rxm
	rank URIs:
		rank[0]: ofi+tcp;ofi_rxm://192.168.3.11:31316
		rank[1]: ofi+tcp;ofi_rxm://192.168.3.12:31316
		rank[2]: ofi+tcp;ofi_rxm://192.168.3.13:31316
```
pool的配置信息：
```bash
Pool ddf007ff-63e5-40e0-9a24-0057fb277599, ntarget=18, disabled=0, leader=1, version=1, state=Ready
Pool health info:
- Rebuild idle, 0 objs, 0 recs
Pool space info:
- Target(VOS) count:18
- Storage tier 0 (SCM):
  Total size: 728 GB
  Free: 688 GB, min:38 GB, max:38 GB, mean:38 GB
- Storage tier 1 (NVMe):
  Total size: 52 TB
  Free: 52 TB, min:2.9 TB, max:2.9 TB, mean:2.9 TB
```
container配置信息：
```bash
  Container UUID              : e7d81524-f777-482b-b585-c1481b18d230                        
  Container Label             : test                                                        
  Container Type              : POSIX                                                       
  Pool UUID                   : ddf007ff-63e5-40e0-9a24-0057fb277599                        
  Container redundancy factor : 1                                                           
  Number of open handles      : 2                                                           
  Latest open time            : 0x1b403cd19be40005 (2024-11-21 18:54:29.280923648 +0800 CST)
  Latest close/modify time    : 0x1b403cd329900003 (2024-11-21 18:54:29.697912832 +0800 CST)
  Number of snapshots         : 0                                                           
  Object Class                : RP_2GX                                                      
  Dir Object Class            : RP_2GX                                                      
  File Object Class           : RP_2GX                                                      
  Chunk Size                  : 1.0 MiB 
```
配置中显示，当前test容器的object容灾域模式为1，object容错模式为RP_2GX，分片数量为最大值。下面是某个object的布局信息：
```json
{
  "response": {
    "oid": "2251834173423617.0",
    "version": 0,
    "class": "RP_2G8",
    "shards": [
      {
        "replicas": [
          {
            "rank": 1,
            "target": 2
          },
          {
            "rank": 2,
            "target": 3
          }
        ]
      },
      {
        "replicas": [
          {
            "rank": 0,
            "target": 3
          },
          {
            "rank": 1,
            "target": 3
          }
        ]
      },
      {
        "replicas": [
          {
            "rank": 0,
            "target": 0
          },
          {
            "rank": 2,
            "target": 4
          }
        ]
      },
      {
        "replicas": [
          {
            "rank": 0,
            "target": 4
          },
          {
            "rank": 1,
            "target": 0
          }
        ]
      },
      {
        "replicas": [
          {
            "rank": 2,
            "target": 0
          },
          {
            "rank": 1,
            "target": 4
          }
        ]
      },
      {
        "replicas": [
          {
            "rank": 0,
            "target": 1
          },
          {
            "rank": 2,
            "target": 2
          }
        ]
      },
      {
        "replicas": [
          {
            "rank": 1,
            "target": 1
          },
          {
            "rank": 2,
            "target": 5
          }
        ]
      },
      {
        "replicas": [
          {
            "rank": 0,
            "target": 2
          },
          {
            "rank": 1,
            "target": 5
          }
        ]
      }
    ]
  },
  "error": null,
  "status": 0
}
```
可以看到，该object的容错模式被daos自动设置为RP_2G8。object shard总数为8，每个shard都有2个副本，每个副本会随机的从rank[0-2]中任选2个。这里之所以被设置为G8，是因为在配置文件中每个rank（在这里即engine）被分别配置4个target用来存储数据。2个rank也就是8个object。

&nbsp;
&nbsp;
# 3. 使用文件存储
## 3.1. 挂载文件系统
```bash
dfuse -m /mnt/daosfs.3.11 --pool=test --container=test
```
## 3.2. 写入文件
```bash
echo "hello world" > /mnt/daosfs.3.11/test.txt
```

&nbsp;
&nbsp;
# 4. 参考资料
- [https://docs.daos.io/v2.0/user/filesystem](https://docs.daos.io/v2.0/user/filesystem/)
- [https://github.com/daos-stack/daos/tree/v2.0.0/src/object](https://github.com/daos-stack/daos/tree/v2.0.0/src/object)