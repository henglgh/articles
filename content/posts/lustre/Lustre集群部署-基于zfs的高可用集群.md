---
title: Lustre集群部署-基于zfs的高可用集群
date: 2021-07-01T10:27:16+0800
description: "本文详细介绍如何在almalinux8.9上部署基于zfs的lustre主备模式的高可用集群。"
tags: [lustre]
---

# 1. 前言
本文详细介绍如何在almalinux8.9上部署基于zfs的lustre主备模式的高可用集群。系统环境如下：
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
lustre主备模式的集群详细部署文档可以参照[Lustre集群部署-基于zfs的多机集群]({{< ref "Lustre集群部署-基于zfs的多机集群.md" >}})，本文将不再介绍。

&nbsp;
&nbsp;
# 4. pacemaker集群部署
Lustre本身没有自动容灾机制，需要借助第三方集群管理工具pacemaker来实现高可用。pacemaker集群部署文档可以参照[pacemaker集群部署]({{< ref "pacemaker集群部署.md" >}})，本文将不再介绍。

&nbsp;
&nbsp;
# 5. 高可用集群部署
## 5.1. 安装resource agent
### 5.1.1. 安装zfs resource agent
```
wget https://github.com/ClusterLabs/resource-agents/blob/main/heartbeat/ZFS
cp ZFS /usr/lib/ocf/resource.d/heartbeat/
```
可以通过`pcs resource agents ocf:heartbeat:ZFS`查看zfs resource agent是否已经安装。如果输出中有ZFS，说明已经安装。或者执行`pcs resource list ocf:heartbeat:ZFS`也可以查看。

### 5.1.2. 安装lustre resource agent
```bash
dnf install lustre-resource-agents
```
可以通过`pcs resource agents ocf:lustre:Lustre`查看lustre resource agent是否已经安装。


## 5.2. 创建resourse
### 5.2.1. 创建mgtpool资源
```bash
pcs resource create \
  mgtpool \
  ocf:heartbeat:ZFS \
  pool="mgtpool"
```

### 5.2.2. 创建mgt资源
```bash
pcs resource create \
  mgt \
  ocf:lustre:Lustre \
  target="mgtpool/mgt" \
  mountpoint="/lustre/mgt/mgt"
```

### 5.2.3. 创建mdtpool资源
```bash
pcs resource create \
  mdtpool \
  ocf:heartbeat:ZFS \
  pool="mdtpool"
```

### 5.2.4. 创建mdt0资源
```bash
pcs resource create \
  mdt0 \
  ocf:lustre:Lustre \
  target="mdtpool/mdt0" \
  mountpoint="/lustre/mdt/mdt0"
```

### 5.2.5. 创建ostpool资源
```bash
pcs resource create \
  ostpool \
  ocf:heartbeat:ZFS \
  pool="ostpool"
```

### 5.2.6. 创建ost0资源
```bash
pcs resource create \
  ost0 \
  ocf:lustre:Lustre \
  target="ostpool/ost0" \
  mountpoint="/lustre/ost/ost0"
```

## 5.3. 配置resourse规则
以下各项规则根据需要配置。

### 5.3.1. 添加location规则
```bash
pcs constraint location mgtpool prefers node1=INFINITY node2=INFINITY
pcs constraint location mdtpool prefers node1=INFINITY node2=INFINITY
pcs constraint location ostpool prefers node1=INFINITY node2=INFINITY
```
以上配置的location规则表示：
- mgt资源、mdtpool资源、ostpool资源在node1和node2之间随机选择（pacmaker默认是随机选择节点）。
- `INFINITY`表示正无穷，意味着一定会选择该节点，`-INFINITY`表示负无穷，意味着一定不会选择该节点。
- 数值相等时是随机选择，数值不相等时，优先选择数值大的节点。

### 5.3.2. 添加colocation规则
```bash
pcs constraint colocation add mgt with mgtpool INFINITY
pcs constraint colocation add mdt0 with mdt0pool INFINITY
pcs constraint colocation add ost0 with ost0pool INFINITY
pcs constraint colocation add mdt0 with mgt INFINITY
```
上述配置的colocation规则表示：
- mgt mgtpool资源必须在同一个节点上启动，其他类推。
- mdt0和mgt资源必须在同一个节点上启动。
- 如果想要让mgt mdt0资源绝对不能在同一个节点上启动，只要将`INFINITY`变成`-INFINITY`。

### 5.3.3. 添加ordering规则
```bash
pcs constraint order \
  set mgtpool mgt sequential=true require-all=true action=start \
  set ostpool ost0 sequential=true require-all=false action=start \
  set mdtpool mdt0 sequential=true require-all=false action=start
```
上述配置的ordering规则表示：
- mgtpool mgt资源是按照顺序启动并且必须全部成功启动。
- 然后启动ostpool ost0资源，启动顺序是无序且无需全部成功启动。
- 最后启动mdtpool mdt0资源，启动顺序是无序且无需全部成功启动。

该规则是将多组ordering set组合成一个ordering，set之间成为了相互依赖关系。如果想要将set独立，只要单独执行`pcs constraint order set`即可。

## 5.4. 配置fence
当pacemaker无法停掉某个服务时，可以通过fence强制将该服务所在的机器关机，然后将该服务在其他机器上再次启动。

### 5.4.1. 开启stonith-enabled
```bash
pcs property set stonith-enabled=true
```

### 5.4.2. 创建fence0 resource
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
- `fence_ipmilan`为fence agent名字，fence agent的名字可以通过`pcs stonith list`命令查看。- `ip`为ipmi地址，`pcmk_host_list`为ipmi管理的服务器地址。

其余参数都是`fence_ipmilan`所支持的options，可以通过`pcs stonith describe fence_ipmilan`命令查看`fence_ipmilan`所有的options。

### 5.4.3. 创建fence1 resource
```bash
pcs stonith create \
  fence1 \
  fence_ipmilan \
  ip="192.168.19.64" \
  username="admin" \
  password="admin" \
  pcmk_host_list = "node1"
  pcmk_host_check = "static-list"
```

# 6. 参考资料
- [https://wiki.lustre.org/Category:Lustre_Systems_Administration](https://wiki.lustre.org/Category:Lustre_Systems_Administration)