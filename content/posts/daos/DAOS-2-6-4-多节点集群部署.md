---
title: "DAOS 2.6.4：多节点集群部署"
date: 2024-12-09T16:48:45+0800
description: "本文详细介绍如何在almalinux 8.9上部署DAOS.2.6.4多节点集群（基于Metadata-on-SSD架构）。"
tags: [daos]
---

# 1. 前言

![daos-2.6.x-support](https://i-blog.csdnimg.cn/img_convert/8e032317b1c642af81e3645218ad1b66.png)

上图是 DAOS 2.6.x 版本软硬件适配说明：DAOS 目前只在 `X86_64` 架构上做了开发和测试，其他 CPU 架构上的情况目前还未知。目前支持的操作系统是 `EL8` 系列、`EL9` 系列以及 `SLES/Leap` 系列。另外，从 `2.6.0` 开始，DAOS 开始支持 `Metadata-on-SSD`，即支持非持久化内存设备。

本文将详细介绍如何在 `almalinux 8.9` 上部署 DAOS 多机集群，配置方式采用 Metadata-on-SSD 模式，DAOS 版本为 `2.6.4`。

> 多机集群和单机集群部署方式区别不大，就是在多个机器上单独部署 DAOS 组件。每台机器的配置文件都是独立的配置，配置文件只和本机相关。

# 2. 硬件要求

DAOS 在架构设计上与硬件资源高度绑定，其目的之一就是尽可能的发挥硬件的所有性能，以此来达到高性能特点。因此在部署集群之前有必要了解清楚 DAOS 对硬件有哪些苛刻的要求。

## 2.1. 处理器要求

DAOS 要求 CPU 处理器是 `64` 位的，并且主要是在 `X86_64` 平台上开发。因为 DAOS 的软件以及其依赖的第三方库（比如 SPDK、DPDK 能够从分利用英特尔的某些技术）。

DAOS 没有在其他架构平台上进行开发和测试，比如 ARM 架构。但是目前社区有人在 ARM 架构上成功运行了 DAOS 客户端。未来，DOAS 有没有计划适配 ARM 架构，目前还未知。

## 2.2. 网络要求

为了获得更好的性能，DAOS 建议使用支持 RDMA 的网卡。DAOS 的数据平面依赖 `libfabric` 库，并且对于 `Ethernet/tcp` 和 `InfiniBand/verbs` 协议的网卡都支持。

DAOS 可以在同一个 server 上启动多个 engine，每个 engine 只能绑定到不同的网卡，engine 与 engine 之间不能共享同一网卡。DAOS 客户端也是如此，可以在同一个机器上启动多个客户端进程，但每个进程也只能和不同的网卡进行绑定。

## 2.3. 存储设备要求

DAOS 使用 2 类存储设备：一类是内存级别的`内存设备`，用于存储 DAOS 系统内部组件的元数据信息。一开始 DAOS 是基于 Intel Optane 持久化内存设备开发的，后来从 2.6.0 开始支持`普通的内存设备`。另外一类用于存储用户写入的海量数据的`SSD设备`。官方并不支持非 NVMe 的 SSD（例如 SATA SSD）作为后端存储设备。DAOS 是为了利用下一代非易失性内存（NVM）技术（特别是 NVMe SSD 和 SCM/PMem）而从头设计的。其 I/O 路径重度依赖 SPDK，而 SPDK 主要针对 NVMe 协议设备进行用户态、轮询模式、零拷贝的高性能访问。SATA SSD 无法通过 SPDK 高效驱动，因此不在 DAOS 的支持范围内。测试环境可以通过配置，并利用 Linux AIO 来模拟 NVMe IO 来实现支持非 NVME 设备（包含：`普通文件`和`内核块设备`）。但是这些并不是真实的 NVME，并且 AIO 是慢速路径，无法发挥 DAOS 的优势。所以技术上可以配置（有限支持），但功能上不推荐、性能上不可接受，因此不算“支持”。

## 2.4. CPU 亲和性

现代英特尔平台通常采用双路处理器（即两个 CPU），通过 UPI 连接。UPI 是一种高速互连技术，用于连接多个 CPU 芯片，但它的带宽有限，成为潜在瓶颈。另外每个 PCIe 通道（lane）天然地与某个 CPU 关联。也就是说，某些 PCIe 设备（比如 NVMe SSD、网卡）物理上更靠近某个 CPU。尽管这些设备可以被所有 CPU 访问，但访问“非本地”设备时会经过 UPI，这样就会导致延迟更高、带宽更低。因此，为了最大化性能，在多 CPU 环境中，应避免跨 CPU 访问资源。在部署 engine 时，应尽量选则物理上都和同一个 CPU 连接的硬件设备。

# 3. 集群规划

```bash
Component                         component type        Host ip
--------------------------------------------------------------------------------------------------
[admin]                           admin                 [192.168.3.10]
[server0, server1, server2]       server                [192.168.3.10, 192.168.3.11, 192.168.3.12]
[client]                          client                [192.168.3.10]
```

集群中有 3 个节点，每个节点上都会同时部署 server 组件，admin 和 client 组件只在 `192.168.3.10` 节点上部署。

# 4. 系统设置

> 集群中所有节点都需要执行下面操作。

## 4.1. 配置 DAOS yum 源

在`/etc/yum.repos.d/`目录下创建`daos.repo`文件，并添加以下内容：

```bash
[daos-2.6.4]
name=DAOS v2.6.4 Packages Packages
baseurl=https://packages.daos.io/v2.6.4/EL8/packages/x86_64/
enabled=1
#gpgcheck=1
gpgcheck=0
protect=1
#gpgkey=https://packages.daos.io/RPM-GPG-KEY-2023
```

## 4.2. 防火墙设置

```bash
systemctl stop firewalld.service
systemctl disable firewalld.service
```

## 4.3. 关闭 selinux

编辑并修改`/etc/selinux/config`文件，修改`SELINUX`的值

```bash
SELINUX=disabled
```

## 4.4. 开启 IOMMU 支持

DAOS 底层使用 SPDK 管理 nvme 设备，SPDK 通过 UIO（User-space I/O）或 VFIO（Virtual Function I/O）机制让用户态程序绕过内核直接控制硬件。开启 IOMMU 后，硬件设备的 DMA 操作会被 IOMMU 隔离，确保设备只能访问被显式映射的内存区域，避免越界访问或安全漏洞。另外，SPDK 可通过 VFIO 接口安全地配置 IOMMU 页表，将设备的 DMA 限制在程序自身的内存空间内，此时内核允许普通用户（通过 capabilities 授权）执行设备操作，无需全程 root 权限。

IOMMU 的开启需要同时在 BIOS 和 linux 内核中开启。以下是 Interl CPU 为例，如何在 linux 内核中开启 IOMMU 支持。

### 4.4.1. 编辑 grub 配置文件

编辑`/etc/default/grub`文件，修改`GRUB_CMDLINE_LINUX`参数，添加`intel_iommu=on`，重启生效。

```bash
GRUB_CMDLINE_LINUX="crashkernel=auto resume=/dev/mapper/almalinux-swap rd.lvm.lv=almalinux/root rd.lvm.lv=almalinux/swap rhgb quiet intel_iommu=on"
```

### 4.4.2. 重新生成 grub.cfg 文件：

```bash
grub2-mkconfig --output=/boot/grub2/grub.cfg
```

### 4.4.3. 验证 IOMMU 开启状态

重启机器后，可以通过查看内核日志中关于`IOMMU`的日志信息，比如：

```bash
13494:Jun 28 13:45:30 node0 kernel: pci 0000:e0:08.0: Adding to iommu group 118
13495:Jun 28 13:45:30 node0 kernel: pci 0000:e0:08.1: Adding to iommu group 119
13496:Jun 28 13:45:30 node0 kernel: pci 0000:e1:00.0: Adding to iommu group 120
```

或者，执行`ls /sys/kernel/iommu_groups/`命令查看 IOMMU 分组（VFIO 绑定设备时需要）：

```bash
ls /sys/kernel/iommu_groups/
-----------------------------
0   100  103  106  109  111  114  117  12   122  14  17  2   22  25  28  30  33  36  39  41  44  47  5   52  55  58  60  63  66  69  71  74  77  8   82  85  88  90  93  96  99
1   101  104  107  11   112  115  118  120  123  15  18  20  23  26  29  31  34  37  4   42  45  48  50  53  56  59  61  64  67  7   72  75  78  80  83  86  89  91  94  97
10  102  105  108  110  113  116  119  121  13   16  19  21  24  27  3   32  35  38  40  43  46  49  51  54  57  6   62  65  68  70  73  76  79  81  84  87  9   92  95  98
```

以上两种结果都能证明 IOMMU 已开启。

## 4.5. 重启机器

```bash
reboot
```

# 5. 集群部署

## 5.1. DAOS Admin 部署

> admin 部署只需要在 `192.168.3.10` 节点上操作，其他节点如果需要，也可以重复此操作。

daos_admin 不是服务组件，而是 DAOS 的应用程序。比如`dmg`工具。所以，在使用 dmg 命令之前，必须要先部署 daos_admin。另外，`dmg`命令是和 DAOS leader server 通信的，所以，在使用 dmg 命令之前，必须确保 daos_server 已经启动。

### 5.1.1. 安装软件

```bash
dnf install daos-admin
```

### 5.1.2. 配置 daos_control.yml

编辑`/etc/daos/daos_control.yml`文件。

```bash
name: daos_server
port: 10001
hostlist:
  - 192.168.3.10
  - 192.168.3.11
  - 192.168.3.12
transport_config:
  allow_insecure: true
```

- `name`：必须和 server 配置一致。
- `hostlist`：必须和 server 配置一致。

## 5.2. DAOS Server 部署

> 集群中所有 `server` 节点都需要执行以下所有操作。

### 5.2.1. 安装软件

```bash
dnf install daos-server
```

### 5.2.2. 初始化目录结构

```bash
mkdir -p /mnt/daos/scm/0
mkdir -p /mnt/daos/meta/control
chown -R daos_server:daos_server /mnt/daos/
mkdir -p /var/run/daos_server
chown -R daos_server:daos_server /var/run/daos_server
```

### 5.2.3. 添加磁盘（可选）

本文采用使用本地文件模拟 nvme 的方式，因此需要提前创建好指定大小的文件。实际部署中，nvme 设备应该已经准备好，可以忽略这一步。

```bash
dd if=/dev/zero of=/var/tmp/daos-bdev bs=1M count=16384
```

### 5.2.4. 网卡设置

DAOS 网络是通过调用 libfabric 实现网络通信，libfabric 支持很多协议：Ethernet/tcp、InfiniBand/verbs 等。如果需要高性能的网络，需要安装 MLNX_OFED 驱动并使用驱动版本所支持的高性能网卡。目前 DAOS 只支持 MLNX_OFED 驱动。如果不需要高性能网络或者仅仅是为了测试，可以直接使用 Ethernet/tcp 协议（本文默认采用这种方式），不需要安装 MLNX_OFED 驱动。MLNX_OFED 驱动下载链接为：[https://network.nvidia.com/products/infiniband-drivers/linux/mlnx_ofed/](https://network.nvidia.com/products/infiniband-drivers/linux/mlnx_ofed/)。驱动安装过程很简单，直接执行压缩包中的`mlnxofedinstall`脚本即可。

### 5.2.5. 配置 daos_server.yml

编辑`/etc/daos/daos_server.yml`文件。

```bash
name: daos_server
access_points:
  - 192.168.3.10
  - 192.168.3.11
  - 192.168.3.12
provider: ofi+tcp;ofi_rxm

control_log_mask: INFO
control_log_file: /tmp/daos_server.log
control_metadata:
  path: /mnt/daos/meta/control

socket_dir: /var/run/daos_server

telemetry_port: 9191

transport_config:
   allow_insecure: true
# 仅用于测试需要
disable_vmd: true
# 仅用于测试需要
system_ram_reserved: 1

engines:
  -
    targets: 1
    first_core: 0
    nr_xs_helpers: 0
    fabric_iface: enp0s8
    fabric_iface_port: 31416
    log_mask: INFO
    log_file: /tmp/daos_engine.log

    env_vars:
      - FI_SOCKETS_MAX_CONN_RETRY=1
      - FI_SOCKETS_CONN_TIMEOUT=2000
      - DAOS_SCHED_UNIT_RUNTIME_MAX=0

    storage:
      -
        class: ram
        scm_mount: /mnt/daos/scm/0
        scm_size: 4
      -
        class: file
        bdev_list:
          - /var/tmp/daos-bdev
        bdev_size: 16
        bdev_roles:
          - meta
          - wal
          - data
```

以上配置效果为：将在 node0 上启动一个 server，该 server 将启动一个 engine，该 engine 将挂载 1 个 scm 和 1 个 nvme。scm 将占用 4G 的系统内存，nvme 是本地的文件模拟出来的设备，大小为 16G。

- `access_points`: 列出集群所有的服务节点，`这也是和单机集群唯一处不一样的地方。`
- `provider`：配置网卡，可以使用`daos_server network scan`命令查找。
- `control_metadata`：用于存储控制平面的元数据信息。本文使用本地目录来存储，因为控制平面的元数据不是很大。
- `engines`: 存储引擎，DAOS 数据平面。1 个 engine 对应 1 个物理 cpu。默认是等于 NUMA 节点数。
- `targets`：I/O service threads。负责管理 scm 和 bdev。1 个 target 对应 1 个物理 cpu core。targets 的值应该是 bdev 的整数倍。
- `nr_xs_helpers`：I/O offloading threads。也可以说是 targets 的辅助线程，用来分担主 I/O service 任务。1 个 helper thread 对应 1 个物理 cpu core。nr_xs_helpers 与 targets 的比例关系：nr_xs_helpers = targets / 4。
- `env_vars`：配置 DAOS 系统环境变量，所有的环境变量可以在[https://docs.daos.io/v2.6/admin/env_variables/](https://docs.daos.io/v2.6/admin/env_variables/)中查找。
- `scm`：storage-class memory，用来存 DAOS 内部组件的元数据。
- `scm_class`：dcpm 和 ram。dcpm 需要用 Optane device，ram 直接使用内存。
- `bdev`：用来存用户写入的数据。
- `bdev_class`：file、nvme、kdev。file 用来模拟 nvme ssd，nvme 直接使用 nvme ssd，kdev 使用 kernel block device（/dev/sd\*等）。
- `bdev_roles`：bdev 的用途：meta、wal、data。meta 用来存元数据，wal 用来存 wal 数据，data 用来存数据。只有 MD-on-SSD 时候才需要配置 bdev_roles。

> Metadata-on-SSD 模式下必须要配置`control_metadata`和`bdev_roles`

### 5.2.6. 启动服务

```bash
systemctl start daos_server.service
systemctl enable daos_server.service
```

- 启动 daos_server 可能会失败，多数情况下是内存不够分配，可以调大内存，测试发现，对于 1 个 engine 和 1 个 target 的配置，至少需要 9G 内存。

### 5.2.7. 存储格式化

```bash
dmg storage format -l <ip addr>
---------------------------------
dmg storage format -l 192.168.3.10
```

- dmg 是 daos-admin 中的命令行工具，上述命令需要配置 daos_control.yml 之后才能使用。上述命令执行后，DAOS server 将会启动 engine 进程，并挂载 scm。
- 启动 engine 可能会失败，可能是 CPU 核数不够，测试发现，对于 1 个 engine 和 1 个 target 的配置，至少需要 2+2=4 的 cpus，其中有 2 个是 DAOS 预留的，代码写死了。
- 启动 engine 时提示初始化 SPDK 环境失败，是因为 daos_server.service 默认是使用 daos_server 用户运行，并且虚拟机并不支持 IOMMU 功能，在这种情况下，可以修改`/usr/lib/systemd/system/daos_server.service`，将用户改成 root，强制使用 root 用户启动。

## 5.3. DAOS Client 部署

> client 部署只需要在 `192.168.3.10` 节点上操作，其他节点如果需要，也可以重复此操作。

### 5.3.1. 安装软件

```bash
dnf install daos-client
```

### 5.3.2. 初始化目录结构

```bash
mkdir -p /var/run/daos_agent
chown -R daos_agent:daos_agent /var/run/daos_agent
```

### 5.3.3. 网卡配置

网卡配置要求和 server 网卡配置要求一致，此处不再赘述，可以参考 server 部分的网卡配置。

### 5.3.4. 配置 daos_agent.yml

编辑`/etc/daos/daos_agent.yml`文件。

```bash
name: daos_server
access_points:
  - 192.168.3.10
  - 192.168.3.11
  - 192.168.3.12
port: 10001

transport_config:
  allow_insecure: true

runtime_dir: /var/run/daos_agent
log_file: /tmp/daos_agent.log

fabric_ifaces:
  -
    numa_node: 0
    devices:
      - iface: enp0s8
```

- `name`：必须和 server 配置一致。
- `access_points`：必须和 server 配置一致。

需要注意`fabric_ifaces`参数，默认情况下，如果不配置，daos_agent 会自动检测有效的网卡。如果配置了，如果是 verbs provider（InfiniBand），还需要提供 interfaces domain，domain 可以通过`ibdev2netdev`命令查询，比如：

```bash
$ ibdev2netdev
------------------------------------
mlx5_0 port 1 ==> enp94s0f0np0 (Down)
mlx5_1 port 1 ==> enp94s0f1np1 (Up)
```

对应的 fabric_ifaces 配置如下：

```bash
fabric_ifaces:
  -
    numa_node: 0
    devices:
      - iface: enp94s0f1np1
      - domain: mlx5_1
```

### 5.3.5. 启动服务

```bash
systemctl start daos_agent.service
systemctl enable daos_agent.service
```

# 6. 参考资料

- [https://docs.daos.io/v2.6/release/release_notes/#general-support](https://docs.daos.io/v2.6/release/release_notes/#general-support)
- [https://docs.daos.io/v2.6/admin/hardware](https://docs.daos.io/v2.6/admin/hardware/)
- [https://docs.daos.io/v2.6/admin/deployment/](https://docs.daos.io/v2.6/admin/deployment/)
