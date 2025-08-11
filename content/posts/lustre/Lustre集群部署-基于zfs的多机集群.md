---
title: Lustre集群部署-基于zfs的多机集群
date: 2021-07-01T16:27:17+0800
description: "本文详细介绍如何在almalinux8.9上联网部署基于zfs的lustre主备模式的多机集群。"
tags: [lustre]
---

# 1. 前言
本文详细介绍如何在almalinux8.9上联网部署基于zfs的lustre主备模式的多机集群。系统环境如下：
```bash
lustre:         2.15.4
linux os:       almalinux 8.9
linux kernel:   4.18.0-513.5.1.el8_9.x86_64
```

&nbsp;
&nbsp;
# 2. 集群规划
```bash
mgt      192.168.3.11:192.168.3.12
mdt0     192.168.3.11:192.168.3.12
ost0     192.168.3.11:192.168.3.12
client   192.168.3.13
```

&nbsp;
&nbsp;
# 3. 系统设置
该部分服务端和客户端都需要设置。
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

## 3.3. yum源配置
### 3.3.1. 添加Lustre yum源
在`/etc/yum.repos.d`目录下新增`lustre-online.repo`文件并添加以下内容：
```ini
[lustre-server-2.15.4]
name=Lustre Server v2.15.4 Packages
baseurl=https://downloads.whamcloud.com/public/lustre/lustre-2.15.4/el8.9/server/
enabled=1
gpgcheck=0

[lustre-client-2.15.4]
name=Lustre Client v2.15.4 Packages
baseurl=https://downloads.whamcloud.com/public/lustre/lustre-2.15.4/el8.9/client/
enabled=0
gpgcheck=0

[e2fsprogs-1.47.0.wc5]
name=e2fsprogs v1.47.0.wc5 Packages
baseurl=https://downloads.whamcloud.com/public/e2fsprogs/1.47.0.wc5/el8/
enabled=0
gpgcheck=0
```
Lustre server和Lustre client的yum源不能同时打开，rpm包会产生冲突。所以在服务端和客户端安装软件时，需要按需关闭相应的yum源。

### 3.3.2. 添加epel yum源
在`/etc/yum.repos.d`目录下新增`epel-online.repo`文件并添加以下内容：
```ini
[epel]
name=Extra Packages for Enterprise Linux 8 - $basearch
baseurl=https://mirrors.tuna.tsinghua.edu.cn/epel/8/Everything/$basearch
enabled=1
priority=3
gpgcheck=0
countme=1
```

&nbsp;
&nbsp;
# 4. 安装软件
因为Lustre是内核态文件系统，所有的软件包都需要与编译时的kernel版本匹配。Lustre提供2种安装方式：`dkms`和`kmod`。

`dkms`方式安装后会依据当前kernel版本执行编译操作，编译出针对当前kernel版本的kmod，这种方式的好处在于可以在任何kernel版本上动态编译和安装。但是坏处也很明显，因为需要编译，所以安装起来可能很慢。而`kmod`方式是已经提前编译好的kmod，但这种方式只与当时编译时的kernel版本适配。

Lustre官方rpm仓库只提供了zfs的dkms rpm包，没有提供zfs的kmod rpm包。而关于Lustre的rpm包既有dkms rpm包，也有kmod rpm包。所以如果采用kmod方式安装，则需要自行编译zfs。下文以kmod方式安装zfs和lustre步骤。

## 4.1. 服务端
### 4.1.1. 启动和关闭相应的YUM源
```bash
dnf config-manager --enable appstream baseos extras epel
dnf config-manager --enable lustre-server-2.15.4
dnf config-manager --disable lustre-client-2.15.4 e2fsprogs-1.47.0.wc5
dnf clean all && dnf makecache
```

### 4.1.2. 查看Lustre的依赖版本
Lustre的每个发布版本的源码文件`ChangeLog`中都会说明所发行软件的版本以及依赖的软件版本信息，通过2.15.4的[ChangeLog](https://git.whamcloud.com/?p=fs/lustre-release.git;a=blob;f=lustre/ChangeLog;h=782557e3f587a9897f4bba43f7cb850c7f4f5339;hb=cac870cf4d2bd9905b1b2bbe563defe6d748ac94)文件可以查看到如下版本信息：
```plaintext
* Server primary kernels built and tested during release cycle:
  4.18.0-513.9.1.el8   (RHEL8.9)
* ldiskfs needs an ldiskfs patch series for that kernel, ZFS does not
* Client primary kernels built and tested during release cycle:
  4.18.0-513.9.1.el8   (RHEL8.9)
* Recommended e2fsprogs version: 1.47.0-wc5 or newer
* Recommended ZFS version: 2.1.11
```
由此可以得知，`Lustre 2.15.4`依赖`kernel 4.18.0-513.9.1.el8`、`e2fsprogs 1.47.0-wc5`、`ZFS 2.1.11`。

### 4.1.3. 安装kernel
`kernel 4.18.0-513.9.1.el8`是almalinux 8.9系统默认的内核版本，理论上是不需要再重新安装kernel的，如果因为某些原因导致内核版本不一致，可以通过以下命令重新安装内核。
```bash
dnf install --allowerasing kernel-`uname -r` kernel-modules-`uname -r` kernel-tools-`uname -r` kernel-core-`uname -r`
```

### 4.1.4. 安装zfs
kmod方式安装的zfs需要自行编译源码，openzfs提供了关于zfs详细文档，详细内容参考[https://openzfs.github.io/openzfs-docs](https://openzfs.github.io/openzfs-docs)，本文不再介绍如何编译，并且假设已经提前编译好了，然后执行以下命令安装。
```bash
dnf localinstall kmod-zfs libzfs5 libzpool5 zfs
```

### 4.1.5. 安装lustre
```bash
dnf install kmod-lustre kmod-lustre-osd-zfs lustre lustre-osd-zfs-mount
```

## 4.2. 客户端
### 4.2.1. 启动和关闭相应的YUM源
```bash
dnf config-manager --enable appstream baseos extras epel
dnf config-manager --enable lustre-client-2.15.4
dnf config-manager --disable lustre-server-2.15.4 e2fsprogs-1.47.0.wc5
dnf clean all && dnf makecache
```

### 4.2.2. 安装kernel
`kernel 4.18.0-513.9.1.el8`是almalinux 8.9系统默认的内核版本，理论上是不需要再重新安装kernel的，如果因为某些原因导致内核版本不一致，可以通过以下命令重新安装内核。
```bash
dnf install --allowerasing kernel-`uname -r` kernel-modules-`uname -r` kernel-tools-`uname -r` kernel-core-`uname -r`
```

### 4.2.3. 安装lustre
```bash
dnf install kmod-lustre-client lustre-client
```

&nbsp;
&nbsp;
# 5. 集群部署
## 5.1. 服务端
### 5.1.1. 加载zfs和lustre内核模块
```bash
modprobe -v zfs
modprobe -v lustre
```

### 5.1.2. 配置网络
lustre集群内部通过LNet网络通信，LNet支持InfiniBand and IP networks。本案例采用TCP模式。

#### 5.1.2.1. 初始化配置lnet
```bash
lnetctl lnet configure
```
默认情况下`lnetctl lnet configure`会加载第一个up状态的网卡，所以一般情况下不需要再配置net，可以使用`lnetctl net show`命令列出所有的net配置信息，如果没有符合要求的net信息，需要按照下面步骤添加。

#### 5.1.2.2. 添加tcp
```bash
lnetctl net add --net tcp --if enp0s8
```
如果`lnetctl lnet configure`已经将添加了tcp，使用`lnetctl net del`删除tcp，然后用`lnetctl net add`重新添加。

#### 5.1.2.3. 查看添加的tcp
```bash
lnetctl net show --net tcp
```

#### 5.1.2.4. 保存到配置文件
```bash
lnetctl net show --net tcp >> /etc/lnet.conf
```

#### 5.1.2.5. 开机自启动lnet服务
```bash
systemctl enable lnet
```
注：所有的服务端都需要执行以上操作。

### 5.1.3. 部署MGS服务
#### 5.1.3.1. 创建mgtpool
```bash
zpool create -f -O canmount=off -o multihost=on -o cachefile=none mgtpool /dev/sdb
```
- 容灾模式下使用zpool创建pool时，必须要开启了multihost功能支持。multihost要求为每一个host提供不同的hostid，如果不提供，该命令执行失败。在每一个host上执行`zgenhostid $(hostid)`便可以生成不同的hostid。  
- 使用`zpool`创建pool池可以同时绑定多个磁盘，并采用raid0模式来存储数据。如果需要对pool扩容，必须使用`zpool add`添加磁盘到指定的pool中。

#### 5.1.3.2. 创建mgt
```bash
mkfs.lustre --mgs \
--servicenode=192.168.3.11@tcp \
--servicenode=192.168.3.12@tcp \
--backfstype=zfs \
--reformat mgtpool/mgt
```
`mgtpool/mgt`是`mgtpool`的一个逻辑卷，逻辑卷的数量和容量都是可以通过`zfs`命令控制。  
`servicenode`参数指定当前创建的mgt能够在哪些节点上被使用(容灾)。该参数的数量没有限制。可以将多个`servicenode`参数合并成一个，比如上面的参数可以改写成`--servicenode=192.168.3.11@tcp:192.168.3.12@tcp`。

#### 5.1.3.3. 启动mgs服务
```bash
mkdir -p /lustre/mgt/mgt
mount -t lustre mgtpool/mgt /lustre/mgt/mgt -v
```

### 5.1.4. 部署MDS服务
#### 5.1.4.1. 创建mdtpool
```bash
zpool create -f -O canmount=off -o multihost=on -o cachefile=none mdtpool /dev/sdc
```

#### 5.1.4.2. 创建mdt
```bash
mkfs.lustre --mdt \
--fsname fs00 \
--index 0 \
--mgsnode 192.168.3.11@tcp \
--mgsnode 192.168.3.12@tcp \
--servicenode 192.168.3.11@tcp \
--servicenode 192.168.3.12@tcp \
--backfstype=zfs \
--reformat mdtpool/mdt0
```
- 如果mgs服务有多个，必须要同时指定多个mgsnode，而且第一个mgsnode必须是primary mgs。
- 对于每一个lustre文件系统，mdt index序号必须从0开始，0代表整个文件系统的根目录。
- `mdtpool/mdt0`是`mdtpool`的一个逻辑卷，使用`mount`挂载一个逻辑卷，表示启动一个mds服务。如果想要在同一个节点上启动多个mds，则需要在`mdtpool`中再申请一个逻辑卷，此时`--reformat`参数可以省略，`--index`必须递增。
- 一个mds可以同时管理多个逻辑卷，只需要在`--reformat`参数后同时指定多个逻辑卷。

#### 5.1.4.3. 启动mds服务
```bash
mkdir -p /lustre/mdt/mdt0
mount -t lustre mdtpool/mdt0 /lustre/mdt/mdt0 -v
```

### 5.1.5. 部署OSS服务
#### 5.1.5.1. 创建ostpool
```bash
zpool create -f -O canmount=off -o multihost=on -o cachefile=none ostpool /dev/sdd
```

#### 5.1.5.2. 创建ost
```bash
mkfs.lustre --ost \
--fsname fs00 \
--index 0 \
--mgsnode 192.168.3.11@tcp \
--mgsnode 192.168.3.12@tcp \
--servicenode 192.168.3.11@tcp \
--servicenode 192.168.3.12@tcp \
--backfstype=zfs \
--reformat ostpool/ost0
```

#### 5.1.5.3. 启动oss服务
```bash
mkdir -p /lustre/ost/ost0
mount -t lustre ostpool/ost0 /lustre/ost/ost0 -v
```

&nbsp;
&nbsp;
## 5.2. 客户端
### 5.2.1. 加载lustre内核模块
```bash
modprobe -v lustre
```

### 5.2.2. 配置网络
lustre集群内部通过LNet网络通信，LNet支持InfiniBand and IP networks。本案例采用TCP模式。

#### 5.2.2.1. 初始化配置lnet
```bash
lnetctl lnet configure
```
默认情况下`lnetctl lnet configure`会加载第一个up状态的网卡，所以一般情况下不需要再配置net，可以使用`lnetctl net show`命令列出所有的net配置信息，如果没有符合要求的net信息，需要按照下面步骤添加。

#### 5.2.2.2. 添加tcp
```bash
lnetctl net add --net tcp --if enp0s8
```
如果`lnetctl lnet configure`已经将添加了tcp，使用`lnetctl net del`删除tcp，然后用`lnetctl net add`重新添加。

#### 5.2.2.3. 查看添加的tcp
```bash
lnetctl net show --net tcp
```

#### 5.2.2.4. 保存到配置文件
```bash
lnetctl net show --net tcp >> /etc/lnet.conf
```

#### 5.2.2.5. 开机自启动lnet服务
```bash
systemctl enable lnet
```
注：所有的客户端都需要执行以上操作。

### 5.2.3. 挂载文件系统
```bash
mkdir -p /mnt/fs00
mount -t lustre 192.168.3.11@tcp:192.168.3.12@tcp:/fs00 /mnt/fs00 -v
```

&nbsp;
&nbsp;
# 6. 参考资料
- [https://wiki.lustre.org/Category:Lustre_Systems_Administration](https://wiki.lustre.org/Category:Lustre_Systems_Administration)