---
title: ceph集群部署(deploy多机模式)
date: 2024-12-09T14:45:15+0800
description: "本文介绍如何使用ceph-deploy工具在ubuntu 18.04系统上部署ceph 14.2.22集群。"
tags: [ceph]
---


# 1. 前言
本文介绍如何使用ceph-deploy工具在ubuntu 18.04系统上部署ceph 14.2.22集群。系统环境如下：
```bash
ceph:           14.2.22
linux os:       ubuntu 18.04
```
&nbsp;
&nbsp;
# 2. 准备
## 2.1. 集群规划
```bash
mon             192.168.3.11      node1
mgr             192.168.3.11      node1
osd.0           192.168.3.11      node1
osd.1           192.168.3.12      node2
osd.2           192.168.3.13      node3
ceph-delpoy     192.168.3.10      node0
```
在ceph集群中，安装了ceph软件的并且部署了一系列ceph集群服务的主机被称之为ceph集群节点，上图中的node0虽然属于管理节点，但它并不属于ceph集群，它没有安装任何ceph软件，也没有部署任何ceph集群服务。

&nbsp;
## 2.2. 新建用户
ceph-deploy部署ceph到不同节点上，是通过ssh方式登录到不同节点上，然后执行一系列指令。默认情况下，ssh需要输入对应的用户名和节点ip。为了方便管理集群中每一个节点，官方建议为ceph集群中每一个节点都创建一个新的相同的用户名。由于ceph-deploy是完全自动化脚本，在部署ceph集群时，是不支持交互式操作。当使用ssh登录到集群中某个节点时，要求输入远程节点的密码，因此必须要设置ssh免密登录。同时ceph-deploy中使用了大量的sudo权限的指令，因此必须要求当前用户免输入密码。

如果想直接将root用户作为ceph集群用户，可以直接忽略此步骤，本文就是使用的root用户，以下创建用户以及用户设置只是一个参考。

### 2.2.1. 创建一个新用户
在集群所有节点（node1-node3）上执行以下命令：
```bash
useradd -d /home/cephtest -m cephtest
passwd cephtest
```
其中`cephtest `为用户名，该命令将会在node1、node2和node3上创建名为cephtest的普通用户，用户密码为cephtest。

### 2.2.2. 获取免密的sudo权限
在集群所有节点（node1-node3）上执行以下命令：
```bash
echo "cephtest ALL = (root) NOPASSWD:ALL" > /etc/sudoers.d/cephtest
chmod 0440 /etc/sudoers.d/cephtest
```
其中`cephtest`为用户名，该命令将使得node1、node2和node3上名为cephtest的普通用户获取免密的root权限。

### 2.2.3. 设置ssh免密登录
**生成ssh key**
在管理节点（node0）上执行`ssh-keygen`，一路回车，不要输入任何东西。

**将ssh key拷贝到所有节点上**
在管理节点（node0）上执行以下命令：
```bash
ssh-copy-id cephtest@192.168.3.11
ssh-copy-id cephtest@192.168.3.12
ssh-copy-id cephtest@192.168.3.13
```
其中`cephtest`为用户名，`192.168.3.11、192.168.3.12、192.168.3.13`为集群节点的ip地址，该命令将ssh key分发到集群所有节点中。

以上2个步骤是设置免密登录，以下的步骤是设置免用户登录。由前述可知，ssh远程登录需要指定用户名和节点ip。当然ceph-deploy可以通过`--username`参数指定用户名。此处建议在`~/.ssh/config`文件中指定用户名，可以避免ceph-deploy部署时要求指定用户。

### 2.2.4. 设置ssh免用户登录
**修改/etc/hosts**
在集群节点（node1-node3）和管理节点（node0）的`/etc/hosts`文件中追以下相同内容：
```bash
192.168.3.11 node1
192.168.3.12 node2
192.168.3.13 node3
```

**修改~/.ssh/config**
在管理节点（node0）上，新建`~/.ssh/config`文件，并添加以下内容：
```bash
Host node1
	Hostname node1
	User cephtest
Host node2
	Hostname node2
	User cephtest
Host node3
	Hostname node3
	User cephtest
```

**修改hostname**
建议统一修改集群节点的主机名，在集群节点之间来回切换时，很容易通过终端主机名查看该主机是哪个节点。
在集群所有节点（node1-node3）上执行以下命令：

```bash
hostname node1
hostname node2
hostname node3
```
其中`node1、node2和node3`是集群节点的hostname。

通过以上步骤，就可以直接用形如`ssh node1`方式直接远程登录集群中其他节点上，而不用输入用户名和密码。

&nbsp;
## 2.3. 设置时间同步
在ceph集群中，osd进程心跳机制，mon进程维护集群map，要求每个主机之间时间同步，否则会影响集群。在ubuntu系统上可以安装ntp服务和ntpdate客户端工具实现时间同步。在集群节点中只需要一个ntp服务，其他集群节点安装ntpdate客户端工具即可。

### 2.3.1. 安装ntp服务
在集群节点（node1）上执行以下命令：
```bash
apt install ntp
```

### 2.3.2. 安装ntpdate客户端
在集群节点（node2-node3）上执行以下命令：
```bash
apt install ntpdate
```
以上将node1作为ntp服务端，node2-node3为ntp客户端，node2-node3通过ntpdate工具实现与node1时间同步。

&nbsp;
## 2.4. 安装ceph-deploy
使用ceph-deploy部署ceph集群，需要下载安装ceph-deploy工具。ubuntu自带ceph-deploy安装包，但该版本不一定支持ceph-14.2.22版本，需要从ceph官方下载ceph14.2.22对应版本的ceph-deploy工具。

### 2.4.1. 配置ceph-14.2.22 软件源
为了加快下载速度，此处使用阿里云开源镜像站，在管理节点（node0）上执行以下命令：
```bash
echo "deb https://mirrors.aliyun.com/ceph/debian-nautilus/ bionic main" > /etc/apt/sources.list.d/ceph.list
```

### 2.4.2. 添加release key
在管理节点（node0）上执行以下命令
```bash
wget -q -O- 'https://mirrors.aliyun.com/ceph/keys/release.asc' | apt-key add -
```

### 2.4.3. 安装ceph-deploy
在管理节点（node0）上执行以下命令：
```bash
apt install ceph-deploy
```

&nbsp;
&nbsp;
# 3. 集群部署
如果之前已经安装了ceph，无论是哪个版本的，请按照集群卸载步骤执行卸载操作。

### 3.1. 创建临时目录
ceph-deploy在部署ceph集群过程中会产生一些日志文件、配置文件以及ceph必备的文件。为了方便管理，建议创建一个临时目录来存放这些文件。
在管理节点（node0）上执行以下命令：
```bash
mkdir cluster
```
上述命令创建一个名为clustre的临时文件夹，之后所有的关于ceph-deploy的操作都必须在`cluster`目录下执行。

### 3.2. 初始化集群
在管理节点（node0）上执行以下命令：
```bash
ceph-deploy new node1
```
其中node1为集群节点的hostname，该命令将初始化集群并将要在node1上创建的mon服务，可以同时指定多个hostname。

### 3.3. 安装ceph软件
在管理节点（node0）上执行以下命令：
```bash
ceph-deploy install node1 node2 node3 \
--repo-url=https://mirrors.aliyun.com/ceph/debian-nautilus \
--gpg-url=https://mirrors.aliyun.com/ceph/keys/release.asc
```
其中`node1 node2和node3`为集群节点。`--repo-url`是ceph软件仓库的地址，`--gpg-url`是ceph软件仓库中key的地址。默认情况下，ceph-deploy安装脚本中指定的是ceph13版本的地址，所以需要重新指定为ceph14版本的地址。上述命令将在node1、node2和node3上安装ceph相关软件，可以同时指定多个hostname。

### 3.4. 创建和初始化mon进程
在管理节点（node0）上执行以下命令：
```bash
ceph-deploy mon create-initial
```
上述命令将会初始化所有的mon进程。

### 3.5. 创建mgr进程
在管理节点（node0）上执行以下命令：
```bash
ceph-deploy mgr create node1
```
上述命令将在node1上创建mgr进程。

### 3.6. 创建osd进程
ceph支持2种存储引擎：`bluestore`和`filestore`。默认情况下，ceph-deploy采用的是bluestore模式。filestore模式下，可以看到数据存在哪个目录下，而bluestore则无法看到。

对于bulestore模式，在管理节点（node0）上执行以下命令：
```bash
ceph-deploy osd create --data /dev/sdb node1
ceph-deploy osd create --data /dev/sdb node2
ceph-deploy osd create --data /dev/sdb node3
```
其中`/dev/sdb`是磁盘设备，`node1、node2和node3`是集群节点的hostname。

对于filestore模式，在管理节点（node0）上执行以下命令：
```bash
ceph-deploy osd create --filestore --journal /dev/sdb1 --data /dev/sdb2 node1
ceph-deploy osd create --filestore --journal /dev/sdb1 --data /dev/sdb2 node2
ceph-deploy osd create --filestore --journal /dev/sdb1 --data /dev/sdb2 node3
```
其中`/dev/sdb1`是磁盘设备sdb的第一个分区，用来充当日志盘。`/dev/sdb2`是磁盘设备sdb的第二个分区，用来充当数据盘。当然，这里是为了测试，节省磁盘使用，所以将一个磁盘一分为二使用，实际生产环境还是用独立的磁盘设备来分别充当日志盘和数据盘。`node1、node2和node3`是集群节点的hostname。

### 3.7. 分发key
ceph通过ceph命令来管理集群，如果想要使用ceph命令，需要将相关的key文件和ceph.conf文件放到指定路径下。
在管理节点（node0）上执行以下命令：
```bash
ceph-deploy admin node1 node2 node3
```
其中`node1、node2和node3`是集群节点hostname，该命令将key文件和ceph.conf文件分发到node1、node2和node3上，可以同时指定多个hostname。

### 3.8. 修改ceph.client.admin.keyring权限
普通用户对`/etc/ceph/ceph.client.admin.keyring`文件没有读权限，在执行ceph相关命令的时候，需要读取该文件中的key值信息，因此需要为该文件添加普通用户读权限。
在集群所有节点（node1-node3）上执行以下命令：
```bash
chmod +r /etc/ceph/ceph.client.admin.keyring
```
### 3.9. 查看集群状态
在上述分发的任意的一个集群节点（node1、node2、node3）上执行`ceph -s`便可以查看到集群的状态信息。

&nbsp;
&nbsp;
# 4. 集群卸载
删除集群很简单，但也容易删除不干净，主要包括：卸载ceph软件、清楚磁盘数据、删除逻辑卷。

### 4.1. 删除ceph软件
在管理节点（node0）上执行以下命令：
```bash
ceph-deploy purge node1 node2 node3
```
其中`node1、node2和node3`是集群节点的hostname，该命令将会删除node1、node2和node3中ceph相关的所有软件，可以同时指定多个hostname。

### 4.2. 删除数据
在管理节点（node0）上执行以下命令：
```bash
ceph-deploy purgedata node1 node2 node3
```
其中`node1、node2和node3`是集群节点的hostname，该命令将会清除node1、node2和node3中ceph所有配置文件和数据文件，可以同时指定多个hostname。

### 4.3. 删除密钥
在管理节点（node0）上执行以下命令：
```bash
ceph-deploy forgetkeys
```

### 4.4. 删除逻辑卷
ceph-deploy在创建osd时，会将每个osd对应的硬盘以逻辑卷的形式挂在到系统中。有时候会遇到，如果不删除osd对应的逻辑卷，下次再部署相同id的osd时，会发现osd对应的逻辑卷已经存在，直接导致osd创建失败，所以有必要删除osd逻辑卷。

**查看osd 逻辑卷**
在部署osd的集群节点上执行以下命令：
```bash
vgdisplay -s | grep ceph
-----------------------------------------------------------------------------------------------------------------------
"ceph-7d7f39a3-f9f1-47ba-88ea-1f9b1c53e7a4" 9.00 GiB  [9.00 GiB  used / 0    free]
"ceph-310bbc06-b539-42aa-a7d6-ed430310f95f" 9.00 GiB  [9.00 GiB  used / 0    free]
"ceph-4258b146-2d7d-4132-985d-63a2148e6d4a" 9.00 GiB  [9.00 GiB  used / 0    free]
```
其中`ceph-7d7f39a3-f9f1-47ba-88ea-1f9b1c53e7a4` 就是vg name。

**删除osd逻辑卷**
在部署osd节点上执行以下命令：
```bash
vgremove ceph-7d7f39a3-f9f1-47ba-88ea-1f9b1c53e7a4
```