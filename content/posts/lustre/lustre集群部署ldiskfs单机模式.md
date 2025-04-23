---
title: lustre集群部署(ldiskfs单机模式)
date: 2024-12-09T16:27:17+0800
description: "本文详细介绍如何在almalinux8.9上部署基于ldiskfs的lustre单机集群。"
tags: [lustre]
---


# 1. 前言
本文详细介绍如何在almalinux8.9上部署基于ldiskfs的lustre单机集群。系统环境如下：
```bash
lustre:         2.15.4
linux os:       almalinux 8.9
linux kernel:   4.18.0-513.5.1.el8_9.x86_64
```

&nbsp;
&nbsp;
# 2. 集群规划
```bash
mgt        192.168.3.11
mdt0       192.168.3.11
ost0       192.168.3.11
client     192.168.3.12
```

&nbsp;
&nbsp;
# 3. 系统设置
## 3.1. 防火墙设置
### 3.1.1. 关闭防火墙
```bash
systemctl stop firewalld.service
systemctl disable firewalld.service
```

&nbsp;
## 3.2. selinux设置
### 3.2.1. 关闭selinux
```bash
sed -i.org 's|SELINUX=enforcing|SELINUX=disabled|g' /etc/selinux/config
```

### 3.2.2. 重启机器
```bash
reboot
```

### 3.2.3. 检查selinux状态
```bash
getenforce
```
如果输出结果是disabled，表明selinux已经关闭。

&nbsp;
&nbsp;
# 4. 集群部署
## 4.1. 服务端
### 4.1.1. 安装服务端软件
```bash
rpm --upgrade --reinstall --install -vh e2fsprogs/*.rpm
rpm --upgrade --reinstall --install -vh kernel/*.rpm
rpm --upgrade --reinstall --install -vh lustre/server/*.rpm
```

如果已经做了离线yum源，也可以使用`dnf install`和`dnf reinstall`命令安装。
```bash
dnf reinstall e2fsprogs e2fsprogs-libs libcom_err libss
dnf reinstall kernel kernel-modules \
    kernel-modules-extra kernel-headers \
    kernel-core kernel-tools kernel-tools-libs
dnf install kmod-lustre kmod-lustre-osd-ldiskfs \
    lustre lustre-osd-ldiskfs-mount \
    lustre-iokit lustre-resource-agents
```
一定要保证kernel的包是除了lustre之外的最后一个安装，防止定制化的kernel包被其他覆盖。
### 4.1.2. 加载lustre内核模块
```
modprobe -v lustre
```

### 4.1.3. 配置网络
lustre集群内部通过LNet网络通信，LNet支持InfiniBand and IP networks。本案例采用TCP模式。

**初始化配置lnet**
```bash
lnetctl lnet configure
```
- 默认情况下`lnetctl lnet configure`会加载第一个up状态的网卡，所以一般情况下不需要再配置net。
- 可以使用`lnetctl net show`命令列出所有的net配置信息，如果没有符合要求的net信息，需要按照下面步骤添加。

**添加tcp**
```bash
lnetctl net add --net tcp0 --if enp0s8
```
- 如果`lnetctl lnet configure`已经将添加了tcp0，使用`lnetctl net del`删除tcp0，然后用`lnetctl net add`重新添加。
- `tcp0`可以理解为一个子网，原则上tcp后面的数字可以任意写。如果定义成`tcp0`，那么集群中所有的服务以及客户端都应该设置成同一子网，即`tcp0`。

**查看添加的tcp**
```bash
lnetctl net show --net tcp0
```

**保存到配置文件**
```bash
lnetctl net show --net tcp0 >> /etc/lnet.conf
```

**开机自启动lnet服务**
```bash
systemctl enable lnet
```

### 4.1.4. 部署MGS服务
**创建mgt**
```bash
mkfs.lustre --mgs --backfstype=ldiskfs --reformat /dev/sdb
```

**启动mgs服务**
```bash
mkdir -p /lustre/mgt
mount -t lustre -U 95d74a36-996f-403a-84b4-1912bec0143b /lustre/mgt -v
```
- `95d74a36-996f-403a-84b4-1912bec0143b`是`/dev/sdb`的uuid，可以通过`blkid`命令查询。建议采用`uuid`，因为磁盘盘符会改变。
- 原则上挂载点的名字可以任意取名，建议和mgt名字保持一致。

### 4.1.5. 部署MDS服务
**创建mdt**
```bash
mkfs.lustre --mdt \
--fsname fs00 \
--index 0 \
--mgsnode=192.168.3.11@tcp0 \
--backfstype=ldiskfs \
--reformat /dev/sdc
```
如果磁盘空间容量比较大，可以添加参数`--mkfsoptions="-E nodiscard"`，加快格式化过程。

**启动mds服务**
```bash
mkdir -p /lustre/mdt/mdt0
mount -t lustre -U 6feb0516-e2b1-4075-8b37-de94bb65c93b /lustre/mdt/mdt0 -v
```

### 4.1.6. 部署OSS服务
**创建ost**
```bash
mkfs.lustre --ost \
--fsname fs00 \
--index 0 \
--mgsnode=192.168.3.11@tcp0 \
--backfstype=ldiskfs \
--reformat /dev/sdd
```

**启动oss服务**
```bash
mkdir -p /lustre/ost/ost0
mount -t lustre -U 930e22ba-969c-4f95-820a-d7f521b47b0d /lustre/ost/ost0 -v
```

&nbsp;
## 4.2. 客户端
lustre客户端软件不能和服务端软件安装在同一台机器上，因为lustre服务端软件已经包含了客户端软件所有的文件。所以，非必要，可以直接在服务端挂载lustre文件系统，而无需再另外一台机器上安装客户端软件。

### 4.2.1. 安装客户端软件
```bash
rpm --upgrade --reinstall --install -vh lustre/client/*.rpm
```

如果已经做了离线yum源，也可以使用`dnf install`命令安装。
```bash
dnf install kmod-lustre-client lustre-client lustre-iokit
```

### 4.2.2. 加载lustre内核模块
```bash
modprobe -v lustre
```

### 4.2.3. 配置网络
lustre集群内部通过LNet网络通信，LNet支持InfiniBand and IP networks。本案例采用TCP模式。

**初始化配置lnet**
```bash
lnetctl lnet configure
```
- 默认情况下`lnetctl lnet configure`会加载第一个up状态的网卡，所以一般情况下不需要再配置net。
- 可以使用`lnetctl net show`命令列出所有的net配置信息，如果没有符合要求的net信息，需要按照下面步骤添加。

**添加tcp**
```bash
lnetctl net add --net tcp0 --if enp0s8
```
- 如果`lnetctl lnet configure`已经将添加了tcp0，使用`lnetctl net del`删除tcp0，然后用`lnetctl net add`重新添加。
- `tcp0`可以理解为一个子网，原则上tcp后面的数字可以任意写。如果定义成`tcp0`，那么集群中所有的服务以及客户端都应该设置成同一子网，即`tcp0`。

**查看添加的tcp**
```bash
lnetctl net show --net tcp0
```

**保存到配置文件**
```bash
lnetctl net show --net tcp0 >> /etc/lnet.conf
```

**开机自启动lnet服务**
```bash
systemctl enable lnet
```

### 4.2.4. 挂载文件系统
```bash
mkdir -p /mnt/fs00
mount -t lustre 192.168.3.11@tcp0:/fs00 /mnt/fs00 -v
```

&nbsp;
&nbsp;
# 5. 参考资料
- [https://wiki.lustre.org/Category:Lustre_Systems_Administration](https://wiki.lustre.org/Category:Lustre_Systems_Administration)