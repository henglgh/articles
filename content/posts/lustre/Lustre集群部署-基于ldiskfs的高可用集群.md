---
title: Lustre集群部署-基于ldiskfs的高可用集群
date: 2024-12-09T16:27:20+0800
description: "本文详细介绍如何在almalinux8.9上部署基于ldiskfs的lustre高可用集群。"
tags: [lustre]
---

# 1. 前言
本文详细介绍如何在almalinux8.9上部署基于ldiskfs的lustre高可用集群。系统环境如下：
```bash
lustre:         2.15.4
pacemaker:      2.0.5
linux os:       almalinux 8.9
linux kernel:   4.18.0-513.5.1.el8_9.x86_64
```

&nbsp;
&nbsp;
# 2. 集群规划
```bash
mgt         192.168.3.11 192.168.3.12
mdt0        192.168.3.11 192.168.3.12
ost0        192.168.3.11 192.168.3.12
client      192.168.3.13
pacemaker   192.168.3.11 192.168.3.12
corosync    192.168.3.11 192.168.3.12
```

&nbsp;
&nbsp;
# 3. lustre集群部署
lustre容灾集群详细部署文档可以参照[Lustre集群部署-基于ldiskfs的多机集群]({{< ref "Lustre集群部署-基于ldiskfs的多机集群.md" >}})，本文将不再介绍。

&nbsp;
&nbsp;
# 4. pacemaker集群部署
Lustre本身没有自动容灾机制，需要借助第三方集群管理工具pacemaker来实现高可用。pacemaker集群部署文档可以参照[pacemaker集群部署]({{< ref "pacemaker集群部署.md" >}})，本文将不再介绍。

&nbsp;
&nbsp;
# 5. 高可用集群部署
## 5.1. 创建resourse
### 5.1.1. 创建mgt资源
```bash
pcs resource create \
    mgt \
    ocf:lustre:Lustre \
    target="/dev/disk/by-uuid/95d74a36-996f-403a-84b4-1912bec0143b" \
    mountpoint="/lustre/mgt"
```

### 5.1.2. 创建mdt0资源
```bash
pcs resource create \
    mdt0 \
    ocf:lustre:Lustre \
    target="/dev/disk/by-uuid/6feb0516-e2b1-4075-8b37-de94bb65c93b" \
    mountpoint="/lustre/mdt/mdt0"
```

### 5.1.3. 创建ost0资源
```bash
pcs resource create \
    ost0 \
    ocf:lustre:Lustre \
    target="/dev/disk/by-uuid/0be78e76-3176-40bc-bc1d-1d34ef23c775" \
    mountpoint="/lustre/ost/ost0"
```

## 5.2. 配置resourse规则
### 5.2.1. 添加location规则
```bash
pcs constraint location mgt prefers node1=INFINITY node2=INFINITY
pcs constraint location mdt0 prefers node1=INFINITY node2=INFINITY
pcs constraint location ost0 prefers node1=INFINITY node2=INFINITY
```
以上配置的location规则表示：
- mgt资源、mdt0资源、ost0资源在node1和node2之间随机选择（pacmaker默认是随机选择节点）。
- `INFINITY`表示正无穷，意味着一定会选择该节点，`-INFINITY`表示负无穷，意味着一定不会选择该节点。
- 数值相等时是随机选择，数值不相等时，优先选择数值大的节点。

### 5.2.2. 添加colocation规则
```bash
pcs constraint colocation add mdt0 with mgt INFINITY
```
上述配置的colocation规则表示：
- mdt0和mgt资源必须在同一个节点上启动。
- 如果想要让mdt0和mgt资源绝对不能在同一个节点上启动，只要将`INFINITY`变成`-INFINITY`。

### 5.2.3. 添加ordering规则
```bash
pcs constraint order \
    set mgt sequential=true require-all=true action=start \
    set ost0 sequential=false require-all=false action=start \
    set mdt0 sequential=false require-all=false action=start
```
上述配置的ordering规则表示：
- 先启动mgt资源，启顺序是有序且必须全部成功启动。
- 然后启动ost0资源，启动顺序是无序且无需全部成功启动。
- 最后启动mdt0资源，启动顺序是无序且无需全部成功启动。

该规则是将多组ordering set组合成一个ordering，set之间成为了相互依赖关系。如果想要将set独立，只要单独执行`pcs constraint order set`即可。

## 5.3. 配置fence
当pacemaker无法停掉某个服务时，可以通过fence强制将该服务所在的机器关机，然后将该服务在其他机器上再次启动。

### 5.3.1. 开启stonith-enabled
```bash
pcs property set stonith-enabled=true
```

### 5.3.2. 创建fence0 resource
```bash
pcs stonith create \
    fence0 \
    fence_ipmilan \
    ip="192.168.19.64" \
    username="admin" \
    password="admin" \
    pcmk_host_list = "node0"
    pcmk_host_check = "static-list"
```
- `fence0`为resource name。
- `fence_ipmilan`为fence agent名字，fence agent的名字可以通过`pcs stonith list`命令查看。
- `ip`为ipmi地址。
- `pcmk_host_list`为ipmi管理的服务器地址。

其余参数都是`fence_ipmilan`所支持的options，可以通过`pcs stonith describe fence_ipmilan`命令查看`fence_ipmilan`所有的options。

### 5.3.3. 创建fence1 resource
```bash
pcs stonith create \
    fence1 \
    fence_ipmilan \
    ip="192.168.19.65" \
    username="admin" \
    password="admin" \
    pcmk_host_list = "node1"
    pcmk_host_check = "static-list"
```

&nbsp;
&nbsp;
# 6. 参考资料
- [https://wiki.lustre.org/Category:Lustre_Systems_Administration](https://wiki.lustre.org/Category:Lustre_Systems_Administration)