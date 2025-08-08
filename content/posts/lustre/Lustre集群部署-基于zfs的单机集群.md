---
title: Lustre集群部署-基于zfs的单机集群
date: 2024-12-09T16:27:16+0800
description: "本文详细介绍如何在almalinux8.9上部署基于zfs的lustre单机集群。"
tags: [lustre]
---

# 1. 前言
本文详细介绍如何在almalinux8.9上部署基于zfs的lustre单机集群。系统环境如下：
```bash
lustre:         2.15.4
zfs:            2.1.11
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
dnf install kmod-zfs libzfs5 libzpool5 zfs
dnf install kmod-lustre kmod-lustre-osd-zfs lustre lustre-osd-zfs-mount lustre-iokit lustre-resource-agents
```

### 4.1.2. 加载zfs和lustre内核模块
```
modprobe -v zfs
modprobe -v lustre
```

### 4.1.3. 配置网络
lustre集群内部通过LNet网络通信，LNet支持InfiniBand and IP networks。本案例采用TCP模式。

#### 4.1.3.1. 初始化配置lnet
```bash
lnetctl lnet configure
```
- 默认情况下`lnetctl lnet configure`会加载第一个up状态的网卡，所以一般情况下不需要再配置net。
- 可以使用`lnetctl net show`命令列出所有的net配置信息，如果没有符合要求的net信息，需要按照下面步骤添加。

#### 4.1.3.2. 添加tcp
```bash
lnetctl net add --net tcp0 --if enp0s8
```
- 如果`lnetctl lnet configure`已经将添加了tcp0，使用`lnetctl net del`删除tcp0，然后用`lnetctl net add`重新添加。
- `tcp0`可以理解为一个子网，原则上tcp后面的数字可以任意写。如果定义成`tcp0`，那么集群中所有的服务以及客户端都应该设置成同一子网，即`tcp0`。

#### 4.1.3.3. 查看添加的tcp
```bash
lnetctl net show --net tcp0
```

#### 4.1.3.4. 保存到配置文件
```bash
lnetctl net show --net tcp0 >> /etc/lnet.conf
```

#### 4.1.3.5. 开机自启动lnet服务
```bash
systemctl enable lnet
```

### 4.1.4. 部署MGS服务
#### 4.1.4.1. 创建mgtpool
```bash
zpool create -f -O canmount=off -o cachefile=none mgtpool /dev/sdb
```
使用`zpool`创建pool池可以同时绑定多个磁盘，并采用raid0模式来存储数据。如果需要对pool扩容，必须使用`zpool add`添加磁盘到指定的pool中。

#### 4.1.4.2. 创建mgt
```bash
mkfs.lustre --mgs --backfstype=zfs --reformat mgtpool/mgt
```
`mgtpool/mgt`是`mgtpool`的一个逻辑卷，逻辑卷的数量和容量都是可以通过`zfs`命令控制。

#### 4.1.4.3. 启动mgs服务
```bash
mkdir -p /lustre/mgt/mgt
mount -t lustre mgtpool/mgt /lustre/mgt/mgt -v
```
原则上挂载点的名字可以任意取名，建议和mgt名字保持一致。如果忘记mgt的名字。可以通过`zfs list`命令查找。

### 4.1.5. 部署MDS服务
#### 4.1.5.1. 创建mdtpool
```bash
zpool create -f -O canmount=off -o cachefile=none mdtpool /dev/sdc
```

#### 4.1.5.2. 创建mdt
```bash
mkfs.lustre --mdt \
--fsname fs00 \
--index 0 \
--mgsnode=192.168.3.11@tcp \
--backfstype=zfs \
--reformat mdtpool/mdt0
```
`mdtpool/mdt0`是`mdspool`的一个逻辑卷，使用`mount`挂载一个逻辑卷，表示启动一个mds服务。  
如果想要在同一个节点上启动多个mds，则需要在`mdtpool`中再申请一个逻辑卷，此时`--reformat`参数可以省略，`--index`必须递增。  
一个mds可以同时管理多个逻辑卷，只需要在`--reformat`参数后同时指定多个逻辑卷。

#### 4.1.5.3. 启动mds服务
```bash
mkdir -p /lustre/mdt/mdt0
mount -t lustre mdtpool/mdt0 /lustre/mdt/mdt0 -v
```

### 4.1.6. 部署OSS服务
#### 4.1.6.1. 创建ostpool
```bash
zpool create -f -O canmount=off -o cachefile=none ostpool /dev/sdd
```

#### 4.1.6.2. 创建ost
```bash
mkfs.lustre --ost \
--fsname fs00 \
--index 0 \
--mgsnode=192.168.3.11@tcp \
--backfstype=zfs \
--reformat ostpool/ost0
```

#### 4.1.6.3. 启动oss服务
```bash
mkdir -p /lustre/ost/ost0
mount -t lustre ostpool/ost0 /lustre/ost/ost0 -v
```

## 4.2. 客户端
lustre客户端软件不能和服务端软件安装在同一台机器上，因为lustre服务端软件已经包含了客户端软件所有的文件。所以，非必要，可以直接在服务端挂载lustre文件系统，而无需再另外一台机器上安装客户端软件。

### 4.2.1. 安装客户端软件
```bash
dnf install kmod-lustre-client lustre-client lustre-iokit
```

### 4.2.2. 加载lustre内核模块
```bash
modprobe -v lustre
```

### 4.2.3. 配置网络
lustre集群内部通过LNet网络通信，LNet支持InfiniBand and IP networks。本案例采用TCP模式。

#### 4.2.3.1. 初始化配置lnet
```bash
lnetctl lnet configure
```
- 默认情况下`lnetctl lnet configure`会加载第一个up状态的网卡，所以一般情况下不需要再配置net。
- 可以使用`lnetctl net show`命令列出所有的net配置信息，如果没有符合要求的net信息，需要按照下面步骤添加。

#### 4.2.3.2. 添加tcp
```bash
lnetctl net add --net tcp0 --if enp0s8
```
- 如果`lnetctl lnet configure`已经将添加了tcp0，使用`lnetctl net del`删除tcp0，然后用`lnetctl net add`重新添加。
- `tcp0`可以理解为一个子网，原则上tcp后面的数字可以任意写。如果定义成`tcp0`，那么集群中所有的服务以及客户端都应该设置成同一子网，即`tcp0`。

#### 4.2.3.3. 查看添加的tcp
```bash
lnetctl net show --net tcp0
```

#### 4.2.3.4. 保存到配置文件
```bash
lnetctl net show --net tcp0 >> /etc/lnet.conf
```

#### 4.2.3.5. 开机自启动lnet服务
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
# 5. 集群卸载
## 5.1. 服务端
### 5.1.1. 关闭所有的服务
```bash
umount mdtpool/mdt0
umount ostpool/ost0
umount mgtpool/mgt
```
### 5.1.2. 删除所有的逻辑卷
```bash
zfs destroy mgtpool/mgt
zfs destroy mdtpool/mdt0
zfs destroy ostpool/ost0
```
### 5.1.3. 删除所有的pool
```bash
zpool destroy mgtpool
zpool destroy mdtpool
zpool destroy ostpool
```

&nbsp;
&nbsp;
# 6. 参考资料
- [https://wiki.lustre.org/Category:Lustre_Systems_Administration](https://wiki.lustre.org/Category:Lustre_Systems_Administration)