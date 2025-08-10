---
title: pacemaker集群部署
date: 2021-07-02T16:27:19+0800
description: "本文详细介绍如何在almalinux8.9上联网部署pacemaker集群。"
tags: [lustre]
---

# 1. 前言
本文详细介绍如何在almalinux8.9上联网部署pacemaker集群。系统环境如下：
```bash
pacemaker:      2.0.5
linux os:       almalinux 8.9
linux kernel:   4.18.0-513.5.1.el8_9.x86_64
```

&nbsp;
&nbsp;
# 2. 集群规划
```bash
pacemaker server   192.168.3.11 192.168.3.12
corosync server    192.168.3.11 192.168.3.12
```

&nbsp;
&nbsp;
# 3. 前期准备
该部分需要在集群的每个节点上都要执行。

## 3.1. 软件安装
```bash
dnf install pacemaker corosync pcs psmisc fence-agents-ipmilan
```

## 3.2. 启动pcsd服务
```bash
systemctl start pcsd.service
```

## 3.3. 设置服务开机自启
```bash
systemctl enable pcsd.service
systemctl enable pacemaker.service
systemctl enable corosync.service
```

## 3.4. 设置用户密码
在安装pacemaker相关软件时，会自动创建一个名为`hacluster`而且没有密码的用户，但是在使用pcs相关命令时，需要提供hacluster的密码，因此需要为hacluster设置密码。
```bash
passwd hacluster
```

&nbsp;
&nbsp;
# 4. 集群部署
## 4.1. 用户授权
```bash
pcs host auth node0 node1
```

## 4.2. 创建集群
```bash
pcs cluster setup mycluster node0 node1
```
`mycluster`是集群的名字。

## 4.3. 启动集群
```bash
pcs cluster start --all
```
启动集群时会同时启动集群中所有的pacemaker.service和corosync.service，可以通过systemctl查看服务状态。

## 4.4. 查看集群状态
```bash
pcs status
```

&nbsp;
&nbsp;
# 5. 集群配置
## 5.1. 设置stonith-enabled
fencing在集群中起到保护数据的作用，它是通过两种途径：切断电源和禁止访问共享存储。默认情况下Fencing功能是启用的,如果需要关闭，行以下命令：
```bash
pcs property set stonith-enabled=false
```

## 5.2. 设置resource-stickiness
在大多数情况下，当pacemaker集群中某个节点恢复正常，应阻止资源迁移到该节点上。资源迁移需要耗费大量时间。尤其是针对于非常复杂的服务。因此有必要阻止健康资源在集群节点中移动。pacemaker提供了resource-stickiness属性用来设置资源与节点的粘合度。数值越高，粘合度就越高，该资源就不会自动迁移到其他节点上。
```bash
pcs resource defaults resource-stickiness=100
```

## 5.3. 设置no_quorum_policy
`no_quorum_policy`属性用于定义当集群出现脑裂并且无法仲裁时，pacemaker集群应该如何运作。对于两节点的pacemaker而言，应该设置为ignore，表示集群继续正常运行。对于大于两节点的集群，应该设置为stop。
```bash
pcs property set no-quorum-policy=stop
```

&nbsp;
&nbsp;
# 6. 参考资料
- [https://clusterlabs.org/pacemaker/doc](https://clusterlabs.org/pacemaker/doc/deprecated/en-US/Pacemaker/2.0/html/Clusters_from_Scratch/index.html)