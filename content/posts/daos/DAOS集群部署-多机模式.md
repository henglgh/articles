---
title: DAOS集群部署-多机模式
date: 2024-12-09T16:48:45+0800
description: "本文详细介绍如何在almalinux8.9上部署DAOS.2.6.0多机集群。"
tags: [daos]
---

# 1. 前言
本文详细介绍如何在almalinux8.9上部署DAOS.2.6.0多机集群。系统环境如下：
```bash
daos:           2.6.0
linux os:       almalinux 8.9
linux kernel:   4.18.0-513.5.1.el8_9.x86_64
```
- DAOS从2.0.0开始是一个全新的架构设计，与1.x版本是不兼容的。另外，从2.6.0开始，DAOS开始支持Metadata-on-SSD，即支持非Intel Optane设备。
- 多机集群和单机集群部署方式区别不大，就是在多个机器上单独部署DAOS服务。每台机器的配置文件都是独立的配置，配置文件只和本机相关。

&nbsp;
&nbsp;
# 2. 集群规划
```bash
daos_server        192.168.3.11      node0
daos_server        192.168.3.12      node1
daos_agent         192.168.3.13      node2
```

&nbsp;
&nbsp;
# 3. 系统设置
## 3.1. 防火墙设置
```bash
systemctl stop firewalld.service
systemctl disable firewalld.service
```

&nbsp;
## 3.2. 设置时间同步
almalinux系统设置时间同步，请参考[https://cn.linux-console.net/?p=10653](https://cn.linux-console.net/?p=10653)。本文以node0作为时间同步服务端，其余节点均是node0的时间同步客户端。

&nbsp;
## 3.3. 开启IOMMU支持
为了让daos_server能够以非root用户运行在nvme设备上，硬件必须要支持虚拟化设备访问，也就是BIOS要开启（VT-d）功能，同时linux kernel必须要开启IOMMU支持。

### 3.3.1. 编辑grub配置文件
编辑`/etc/default/grub`文件，修改`GRUB_CMDLINE_LINUX`参数，添加`intel_iommu=on`，重启生效。
```bash
GRUB_CMDLINE_LINUX="crashkernel=auto resume=/dev/mapper/almalinux-swap rd.lvm.lv=almalinux/root rd.lvm.lv=almalinux/swap rhgb quiet intel_iommu=on"
```

### 3.3.2. 重新生成grub.cfg文件：
```bash
grub2-mkconfig --output=/boot/grub2/grub.cfg
```

&nbsp;
## 3.4. 配置DAOS yum源
在`/etc/yum.repos.d/`目录下创建`daos.repo`文件，并添加以下内容：
```bash
[daos-2.6.0]
name=DAOS v2.6.0 Packages Packages
baseurl=https://packages.daos.io/v2.6.0/EL8/packages/x86_64/
enabled=1
#gpgcheck=1
gpgcheck=0
protect=1
#gpgkey=https://packages.daos.io/RPM-GPG-KEY-2023
```

&nbsp;
## 3.5. 重启机器
```bash
reboot
```

&nbsp;
&nbsp;
# 4. 集群部署
## 4.1. 服务端部署
下文以在node0上部署过程为例，node1的部署过程与node0一样，不再重复描述。

### 4.1.1. 安装软件
```bash
dnf install daos-server
```

### 4.1.2. 初始化目录结构
```bash
mkdir -p /var/log/daos
chown -R daos_server:daos_server /var/log/daos
mkdir -p /var/lib/daos/daos_scm
mkdir -p /var/lib/daos/daos_server
mkdir -p /var/lib/daos/daos_control
chown -R daos_server:daos_server /var/lib/daos
```

### 4.1.3. 添加磁盘（可选）
本文采用使用本地文件模拟nvme的方式，因此需要提前创建好指定大小的文件。实际部署中，nvme设备应该已经准备好，可以忽略这一步。
```bash
mkdir -p /var/lib/daos/dev
dd if=/dev/zero of=/var/lib/daos/dev/daos-bdev bs=1M count=16384
chown -R daos_server:daos_server /var/lib/daos/dev
```

### 4.1.4. 网卡设置
DAOS网络是通过调用libfabric实现网络通信，libfabric支持很多协议：Ethernet/tcp、InfiniBand/verbs等。如果需要高性能的网络，需要安装MLNX_OFED驱动并使用驱动版本所支持的高性能网卡。目前DAOS只支持MLNX_OFED驱动。如果不需要高性能网络或者仅仅是为了测试，可以直接使用Ethernet/tcp协议（本文默认采用这种方式），不需要安装MLNX_OFED驱动。MLNX_OFED驱动下载链接为：[https://network.nvidia.com/products/infiniband-drivers/linux/mlnx_ofed/](https://network.nvidia.com/products/infiniband-drivers/linux/mlnx_ofed/)。驱动安装过程很简单，直接执行压缩包中的`mlnxofedinstall`脚本即可。

### 4.1.5. 配置server
```bash
name: daos_server
access_points: ['node0','node1']
provider: ofi+tcp;ofi_rxm
control_log_mask: INFO
control_log_file: /var/log/daos/daos_server.log
control_metadata:
  path: /var/lib/daos

socket_dir: /var/lib/daos/daos_server

telemetry_port: 9191

transport_config:
   allow_insecure: true

enable_vmd: false

engines:
-
  targets: 1
  first_core: 0
  nr_xs_helpers: 0
  fabric_iface: enp0s8
  fabric_iface_port: 31416
  log_mask: INFO
  log_file: /var/log/daos/daos_engine.log

  env_vars:
    - FI_SOCKETS_MAX_CONN_RETRY=1
    - FI_SOCKETS_CONN_TIMEOUT=2000
    - DAOS_SCHED_UNIT_RUNTIME_MAX=0

  # Storage definitions
  storage:
  -
    class: ram
    scm_mount: /var/lib/daos/daos_scm
    scm_size: 4
  -
    class: file
    bdev_list: [/var/lib/daos/dev/daos-bdev]
    bdev_size: 16
```
以上配置效果为：启动一个server（node0），该server将启动一个engine，该engine将挂载1个scm和1个nvme。scm将占用4G的系统内存，nvme是本地的文件模拟出来的设备，大小为16G。
- `provider`：配置网卡，可以使用`daos_server network scan`命令查找。
- `engines`: 存储引擎，DAOS数据平面。1个engine对应1个物理cpu。默认是等于NUMA节点数。
- `targets`：I/O service threads。负责管理scm和bdev。1个target对应1个物理cpu core。targets的值应该是bdev的整数倍。
- `nr_xs_helpers`：I/O offloading threads。也可以说是targets的辅助线程，用来分担主I/O service任务。1个helper thread对应1个物理cpu core。nr_xs_helpers与targets的比例关系：nr_xs_helpers = targets / 4。
- `env_vars`：配置DAOS系统环境变量，所有的环境变量可以在[https://docs.daos.io/v2.6/admin/env_variables/](https://docs.daos.io/v2.6/admin/env_variables/)中查找。
- `scm`：全名：storage-class memory，用来存元数据。
- `scm_class`：dcpm和ram。dcpm需要用Optane device，ram直接使用内存。
- `bdev`：用来存数据。
- `bdev_class`：file、nvme、kdev。file用来模拟nvme ssd，nvme直接使用nvme ssd，kdev使用kernel block device（/dev/sd*等）。
- `access_points`: 列出集群所有的服务节点，此处是`['node0','node1']`，__这也是和单机集群唯一处不一样的地方。__

### 4.1.6. 启动服务
```bash
systemctl start daos_server.service
systemctl enable daos_server.service
```
测试发现，daos_server.service服务默认是使用daos_server运行，在虚拟机上部署的集群总是会启动失败，可能是因为虚拟机并不支持IOMMU。在这种情况下，可以修改`/usr/lib/systemd/system/daos_server.service`，将用户改成root。

### 4.1.7. 存储格式化
```bash
dmg storage format
```
- dmg是daos-client的命令行工具，上述命令需要在客户端执行。上述命令执行后，DAOS server将会启动engine进程，并挂载scm。
- 启动engine可能会失败，大概率是内存不够DAOS分配，测试发现，对于1个engine和1个target的配置，至少需要9G内存。


&nbsp;
## 4.2. 客户端部署
### 4.2.1. 安装软件
```bash
dnf install daos-client
```

### 4.2.2. 初始化目录结构
```bash
mkdir -p /var/log/daos
chown -R daos_agent:daos_agent /var/log/daos
mkdir -p /var/lib/daos/daos_agent
chown -R daos_agent:daos_agent /var/lib/daos
```
### 4.2.3. 网卡配置
网卡配置要求和server网卡配置要求一致，此处不再赘述，可以参考server部分的网卡配置。

### 4.2.4. 配置agent
```bash
name: daos_server
access_points: ['node0','node1']
port: 10001

transport_config:
  allow_insecure: true

runtime_dir: /var/lib/daos/daos_agent
log_file: /var/log/daos/daos_agent.log

fabric_ifaces:
-
  numa_node: 0
  devices:
  - iface: enp94s0f1
```
- `name`：必须和server配置一致。
- `access_points`：必须和server配置一致。
- `runtime_dir`：测试发现，当前版本配置不生效，程序依然会找`/var/run/daos_agent/`目录。

需要注意`fabric_ifaces`参数，默认情况下，如果不配置，daos_agent会自动检测有效的网卡。如果配置了，如果是verbs provider（InfiniBand），还需要提供interfaces domain，domain可以通过`ibdev2netdev`命令查询，比如：
```bash
$ ibdev2netdev 
------------------------------------
mlx5_0 port 1 ==> enp94s0f0np0 (Down)
mlx5_1 port 1 ==> enp94s0f1np1 (Up)
```
对应的fabric_ifaces配置如下：
```bash
fabric_ifaces:
-
  numa_node: 0
  devices:
  - iface: enp94s0f1np1
  - domain: mlx5_1
```

### 4.2.5. 配置control
```bash
name: daos_server
port: 10001
hostlist: ['node0','node1']
transport_config:
  allow_insecure: true
```
- `name`：必须和server配置一致。
- `hostlist`：必须和server配置一致。

### 4.2.6. 启动服务
```bash
systemctl start daos_agent.service
systemctl enable daos_agent.service
```

&nbsp;
&nbsp;
# 5. 参考资料
- [https://docs.daos.io/v2.6/admin/deployment/](https://docs.daos.io/v2.6/admin/deployment/)