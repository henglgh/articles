---
title: Lustre集群部署-基于ldiskfs的单机集群
date: 2021-07-01T16:27:17+0800
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

下文以kmod方式安装lustre步骤。

## 4.1. 服务端
### 4.1.1. 启动和关闭相应的YUM源
```bash
dnf config-manager --enable appstream baseos extras epel
dnf config-manager --enable lustre-server-2.15.4 e2fsprogs-1.47.0.wc5
dnf config-manager --disable lustre-client-2.15.4
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
由此可以得知，`Lustre 2.15.4`依赖`kernel 4.18.0-513.9.1.el8`、`e2fsprogs 1.47.0-wc5`。

### 4.1.3. 安装e2fsprogs
```bash
dnf install e2fsprogs-1.47.0 e2fsprogs-libs-1.47.0
```

### 4.1.4. 安装kernel
ldiskfs是ext4的变体，它修改了kernel层的代码，因此需要安装修改之后的kernel。
```bash
dnf install kernel-4.18.0-513.9.1.el8_lustre kernel-core-4.18.0-513.9.1.el8_lustre kernel-modules-4.18.0-513.9.1.el8_lustre
```

### 4.1.5. 安装lustre server
```bash
dnf install kmod-lustre kmod-lustre-osd-ldiskfs
```

## 4.2. 客户端
### 4.2.1. 启动和关闭相应的YUM源
```bash
dnf config-manager --enable appstream baseos extras epel
dnf config-manager --disable lustre-server-2.15.4 e2fsprogs-1.47.0.wc5
dnf config-manager --enable lustre-client-2.15.4
dnf clean all && dnf makecache
```

### 4.2.2. 安装lustre client
```bash
dnf install kmod-lustre-client lustre-client
```

&nbsp;
&nbsp;
# 5. 服务端部署
## 5.1. 加载lustre内核模块
```
modprobe -v lustre
```

## 5.2. 配置网络
lustre集群内部通过LNet网络通信，LNet支持InfiniBand and IP networks。本案例采用TCP模式。

### 5.2.1. 初始化配置lnet
```bash
lnetctl lnet configure
```
- 默认情况下`lnetctl lnet configure`会加载第一个up状态的网卡，所以一般情况下不需要再配置net。
- 可以使用`lnetctl net show`命令列出所有的net配置信息，如果没有符合要求的net信息，需要按照下面步骤添加。

### 5.2.2. 添加tcp
```bash
lnetctl net add --net tcp0 --if enp0s8
```
- 如果`lnetctl lnet configure`已经将添加了tcp0，使用`lnetctl net del`删除tcp0，然后用`lnetctl net add`重新添加。
- `tcp0`可以理解为一个子网，原则上tcp后面的数字可以任意写。如果定义成`tcp0`，那么集群中所有的服务以及客户端都应该设置成同一子网，即`tcp0`。

### 5.2.3. 查看添加的tcp
```bash
lnetctl net show --net tcp0
```

### 5.2.4. 保存到配置文件
```bash
lnetctl net show --net tcp0 >> /etc/lnet.conf
```

### 5.2.5. 开机自启动lnet服务
```bash
systemctl enable lnet
```

## 5.3. 部署MGS服务
### 5.3.1. 创建mgt
```bash
mkfs.lustre --mgs --backfstype=ldiskfs --reformat /dev/sdb
```

### 5.3.2. 启动mgs服务
```bash
mkdir -p /lustre/mgt
mount -t lustre -U 95d74a36-996f-403a-84b4-1912bec0143b /lustre/mgt -v
```
- `95d74a36-996f-403a-84b4-1912bec0143b`是`/dev/sdb`的uuid，可以通过`blkid`命令查询。建议采用`uuid`，因为磁盘盘符会改变。
- 原则上挂载点的名字可以任意取名，建议和mgt名字保持一致。

## 5.4. 部署MDS服务
### 5.4.1. 创建mdt
```bash
mkfs.lustre --mdt \
--fsname fs00 \
--index 0 \
--mgsnode=192.168.3.11@tcp0 \
--backfstype=ldiskfs \
--reformat /dev/sdc
```
如果磁盘空间容量比较大，可以添加参数`--mkfsoptions="-E nodiscard"`，加快格式化过程。

### 5.4.2. 启动mds服务
```bash
mkdir -p /lustre/mdt/mdt0
mount -t lustre -U 6feb0516-e2b1-4075-8b37-de94bb65c93b /lustre/mdt/mdt0 -v
```

## 5.5. 部署OSS服务
### 5.5.1. 创建ost
```bash
mkfs.lustre --ost \
--fsname fs00 \
--index 0 \
--mgsnode=192.168.3.11@tcp0 \
--backfstype=ldiskfs \
--reformat /dev/sdd
```

### 5.5.2. 启动oss服务
```bash
mkdir -p /lustre/ost/ost0
mount -t lustre -U 930e22ba-969c-4f95-820a-d7f521b47b0d /lustre/ost/ost0 -v
```

# 6. 客户端部署
lustre客户端软件不能和服务端软件安装在同一台机器上，因为lustre服务端软件已经包含了客户端软件所有的文件。所以，非必要，可以直接在服务端挂载lustre文件系统，而无需再另外一台机器上安装客户端软件。

## 6.1. 加载lustre内核模块
```bash
modprobe -v lustre
```

## 6.2. 配置网络
lustre集群内部通过LNet网络通信，LNet支持InfiniBand and IP networks。本案例采用TCP模式。

### 6.2.1. 初始化配置lnet
```bash
lnetctl lnet configure
```
- 默认情况下`lnetctl lnet configure`会加载第一个up状态的网卡，所以一般情况下不需要再配置net。
- 可以使用`lnetctl net show`命令列出所有的net配置信息，如果没有符合要求的net信息，需要按照下面步骤添加。

### 6.2.2. 添加tcp
```bash
lnetctl net add --net tcp0 --if enp0s8
```
- 如果`lnetctl lnet configure`已经将添加了tcp0，使用`lnetctl net del`删除tcp0，然后用`lnetctl net add`重新添加。
- `tcp0`可以理解为一个子网，原则上tcp后面的数字可以任意写。如果定义成`tcp0`，那么集群中所有的服务以及客户端都应该设置成同一子网，即`tcp0`。

### 6.2.3. 查看添加的tcp
```bash
lnetctl net show --net tcp0
```

### 6.2.4. 保存到配置文件
```bash
lnetctl net show --net tcp0 >> /etc/lnet.conf
```

### 6.2.5. 开机自启动lnet服务
```bash
systemctl enable lnet
```

## 6.3. 挂载文件系统
```bash
mkdir -p /mnt/fs00
mount -t lustre 192.168.3.11@tcp0:/fs00 /mnt/fs00 -v
```

&nbsp;
&nbsp;
# 7. 参考资料
- [https://wiki.lustre.org/Category:Lustre_Systems_Administration](https://wiki.lustre.org/Category:Lustre_Systems_Administration)