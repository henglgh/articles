---
title: DAOS集群部署-多机模式
date: 2024-12-09T16:48:45+0800
description: "本文详细介绍如何在almalinux 8.9上部署DAOS.2.6.0多机集群（基于Metadata-on-SSD架构）。"
tags: [daos]
---

# 1. 前言
本文详细介绍如何在almalinux8.9上部署DAOS.2.6.0多机集群，配置方式采用Metadata-on-SSD模式。系统环境如下：
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
Component       Host ip           Host name
--------------------------------------------
daos_admin      192.168.3.11      node0
daos_server     192.168.3.11      node0
daos_server     192.168.3.12      node1
daos_clinet     192.168.3.13      node2
```

&nbsp;
&nbsp;
# 3. 系统设置
## 3.1. 配置DAOS yum源
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
## 3.2. 防火墙设置
```bash
systemctl stop firewalld.service
systemctl disable firewalld.service
```

&nbsp;
## 3.3. 关闭selinux
编辑并修改`/etc/selinux/config`文件，修改`SELINUX`的值
```bash
SELINUX=disabled
```

&nbsp;
## 3.4. 开启IOMMU支持
DAOS底层使用SPDK管理nvme设备，SPDK通过UIO（User-space I/O）或VFIO（Virtual Function I/O）机制让用户态程序绕过内核直接控制硬件。开启IOMMU后，硬件设备的DMA操作会被IOMMU隔离，确保设备只能访问被显式映射的内存区域，避免越界访问或安全漏洞。另外，SPDK可通过VFIO接口安全地配置IOMMU页表，将设备的DMA限制在程序自身的内存空间内，此时内核允许普通用户（通过capabilities授权）执行设备操作，无需全程root权限。

IOMMU的开启需要同时在BIOS和linux内核中开启。以下是Interl CPU为例，如何在linux内核中开启IOMMU支持。

### 3.4.1. 编辑grub配置文件
编辑`/etc/default/grub`文件，修改`GRUB_CMDLINE_LINUX`参数，添加`intel_iommu=on`，重启生效。
```bash
GRUB_CMDLINE_LINUX="crashkernel=auto resume=/dev/mapper/almalinux-swap rd.lvm.lv=almalinux/root rd.lvm.lv=almalinux/swap rhgb quiet intel_iommu=on"
```

### 3.4.2. 重新生成grub.cfg文件：
```bash
grub2-mkconfig --output=/boot/grub2/grub.cfg
```

### 3.4.3. 验证IOMMU开启状态
重启机器后，可以通过查看内核日志中关于`IOMMU`的日志信息，比如：
```bash
13494:Jun 28 13:45:30 node0 kernel: pci 0000:e0:08.0: Adding to iommu group 118
13495:Jun 28 13:45:30 node0 kernel: pci 0000:e0:08.1: Adding to iommu group 119
13496:Jun 28 13:45:30 node0 kernel: pci 0000:e1:00.0: Adding to iommu group 120
```

或者，执行`ls /sys/kernel/iommu_groups/`命令查看IOMMU分组（VFIO绑定设备时需要）：
```bash
ls /sys/kernel/iommu_groups/
-----------------------------
0   100  103  106  109  111  114  117  12   122  14  17  2   22  25  28  30  33  36  39  41  44  47  5   52  55  58  60  63  66  69  71  74  77  8   82  85  88  90  93  96  99
1   101  104  107  11   112  115  118  120  123  15  18  20  23  26  29  31  34  37  4   42  45  48  50  53  56  59  61  64  67  7   72  75  78  80  83  86  89  91  94  97
10  102  105  108  110  113  116  119  121  13   16  19  21  24  27  3   32  35  38  40  43  46  49  51  54  57  6   62  65  68  70  73  76  79  81  84  87  9   92  95  98
```
以上两种结果都能证明IOMMU已开启。

&nbsp;
## 3.5. 重启机器
```bash
reboot
```

&nbsp;
&nbsp;
# 4. 集群部署
## 4.1. daos_admin部署
### 4.1.1. 安装软件
```bash
dnf install daos-admin
```

### 4.1.2. 配置daos_control.yml
编辑`/etc/daos/daos_control.yml`文件。
```bash
name: daos_server
port: 10001
hostlist: ['node0']
transport_config:
  allow_insecure: true
```
- `name`：必须和server配置一致。
- `hostlist`：必须和server配置一致。

daos_admin不是服务组件，而是DAOS的应用程序。比如`dmg`工具。所以，在使用dmg命令之前，必须要配置daos_control.yml。另外，`dmg`命令是和DAOS leader server通信的，所以，在使用dmg命令之前，必须确保daos_server已经启动。

&nbsp;
&nbsp;
## 4.2. daos_server部署
下文以在node0上部署过程为例，node1的部署过程与node0一样，不再重复描述。

### 4.2.1. 安装软件
```bash
dnf install daos-server
```

### 4.2.2. 初始化目录结构
```bash
mkdir -p /var/log/daos
chown -R daos_server:daos_server /var/log/daos
mkdir -p /var/lib/daos
chown -R daos_server:daos_server /var/lib/daos
mkdir -p /var/run/daos_server
chown -R daos_server:daos_server /var/run/daos_server
mkdir -p /mnt/daos_scm
```

### 4.2.3. 添加磁盘（可选）
本文采用使用本地文件模拟nvme的方式，因此需要提前创建好指定大小的文件。实际部署中，nvme设备应该已经准备好，可以忽略这一步。
```bash
dd if=/dev/zero of=/var/tmp/daos-bdev bs=1M count=16384
```

### 4.2.4. 网卡设置
DAOS网络是通过调用libfabric实现网络通信，libfabric支持很多协议：Ethernet/tcp、InfiniBand/verbs等。如果需要高性能的网络，需要安装MLNX_OFED驱动并使用驱动版本所支持的高性能网卡。目前DAOS只支持MLNX_OFED驱动。如果不需要高性能网络或者仅仅是为了测试，可以直接使用Ethernet/tcp协议（本文默认采用这种方式），不需要安装MLNX_OFED驱动。MLNX_OFED驱动下载链接为：[https://network.nvidia.com/products/infiniband-drivers/linux/mlnx_ofed/](https://network.nvidia.com/products/infiniband-drivers/linux/mlnx_ofed/)。驱动安装过程很简单，直接执行压缩包中的`mlnxofedinstall`脚本即可。

### 4.2.5. 配置daos_server.yml
编辑`/etc/daos/daos_server.yml`文件。
```bash
name: daos_server
access_points: ['node0','node1']
provider: ofi+tcp;ofi_rxm
control_log_mask: INFO
control_log_file: /var/log/daos/daos_server.log
control_metadata:
  path: /var/lib/daos

telemetry_port: 9191

transport_config:
   allow_insecure: true

disable_vmd: true

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
    scm_mount: /mnt/daos_scm
    scm_size: 4
  -
    class: file
    bdev_list: [/var/tmp/daos-bdev]
    bdev_size: 16
    bdev_roles:
      - meta
      - wal
      - data
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
- `bdev_roles`：bdev的用途：meta、wal、data。meta用来存元数据，wal用来存wal数据，data用来存数据。只有MD-on-SSD时候才需要配置bdev_roles。
- `access_points`: 列出集群所有的服务节点，此处是`['node0','node1']`，`这也是和单机集群唯一处不一样的地方。`

如果采用local模式，而非Metadata-on-SSD模式，`control_metadata`和`bdev_roles`的配置不是强制性的。

### 4.2.6. 启动服务
```bash
systemctl start daos_server.service
systemctl enable daos_server.service
```
测试发现，daos_server.service服务默认是使用daos_server运行，在虚拟机上部署的集群总是会启动失败，可能是因为虚拟机并不支持IOMMU。在这种情况下，可以修改`/usr/lib/systemd/system/daos_server.service`，将用户改成root。

### 4.2.7. 存储格式化
```bash
dmg storage format
```
- dmg是daos-admin中的命令行工具，上述命令需要配置daos_control.yml之后才能使用。上述命令执行后，DAOS server将会启动engine进程，并挂载scm。
- 启动engine可能会失败，大概率是内存不够DAOS分配，测试发现，对于1个engine和1个target的配置，至少需要9G内存。


&nbsp;
## 4.3. daos_client部署
### 4.3.1. 安装软件
```bash
dnf install daos-client
```

### 4.3.2. 初始化目录结构
```bash
mkdir -p /var/log/daos
chown -R daos_agent:daos_agent /var/log/daos
mkdir -p /var/run/daos_agent
chown -R daos_agent:daos_agent /var/run/daos_agent
```
### 4.3.3. 网卡配置
网卡配置要求和server网卡配置要求一致，此处不再赘述，可以参考server部分的网卡配置。

### 4.3.4. 配置daos_agent.yml
编辑`/etc/daos/daos_agent.yml`文件。
```bash
name: daos_server
access_points: ['node0','node1']
port: 10001

transport_config:
  allow_insecure: true

log_file: /var/log/daos/daos_agent.log

fabric_ifaces:
-
  numa_node: 0
  devices:
  - iface: enp94s0f1
```
- `name`：必须和server配置一致。
- `access_points`：必须和server配置一致。

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

### 4.3.5. 启动服务
```bash
systemctl start daos_agent.service
systemctl enable daos_agent.service
```

&nbsp;
&nbsp;
# 5. 参考资料
- [https://docs.daos.io/v2.6/admin/deployment/](https://docs.daos.io/v2.6/admin/deployment/)