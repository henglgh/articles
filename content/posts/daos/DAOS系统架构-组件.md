---
title: DAOS 系统架构-组件
date: 2025-04-03T16:03:00+0800
description: "本文详细介绍DAOS组件。"
tags: [daos]
---


# 1. DAOS 系统组件

![system_architecture](../images/system_architecture.png)

如上如所示，一个完整的DAOS系统是由管理节点组件、客户端节点组件、服务端节点组件以及网络通信组件四个部分组成。管理节点组件通过管理网络通道（蓝色）对DAOS服务管理和监控。客户端节点组件通过数据网络通道（红色）与服务端节点组件通信实现数据读取和写入。服务端节点组件是整个DAOS系统的核心组件，用于集群数据的管理。

## 1.1. 服务端节点组件
在服务端，每个节点是由`daos_server`和`daos_engine`两类组件构建，它们是运行在服务端节点上的守护进程。daos_server是DAOS`控制平面`的组件，负责解析配置文件，启动和监控多个daos_engine组件。daos_engine是DAOS`数据平面`的组件，是一个多线程进程，是由daos_server启动的。每个daos_server可以启动一个或多个daos_engine（通过配置daos_server.yml实现）。daos_engine负责处理元数据和I/O请求（通过CART网络通信中间件和调用PMDK和SPDK库直接访问本地NVMe设备）。PMDK用于直接访问存储级别的内存设备（SCM：storage-class memory）。SPDK用于直接访问NVMe SSD。

```bash
● daos_server.service - DAOS Server
   Loaded: loaded (/usr/lib/systemd/system/daos_server.service; disabled; vendor preset: disabled)
   Active: active (running) since Thu 2025-04-10 19:07:50 CST; 18h ago
 Main PID: 67250 (daos_server)
    Tasks: 52 (limit: 1644956)
   Memory: 100.2G
   CGroup: /system.slice/daos_server.service
           ├─67250 /usr/bin/daos_server start
           └─74592 /usr/bin/daos_engine -t 12 -x 2 -g daosfs00 -d /var/lib/daos/daos_server -T 4 -n /var/lib/daos/daos_control/engine0/daos_nvme.conf -I 0 -r 13312 -H 2 -s /var/lib/daos/daos_scm/0
```

## 1.2. 客户端节点组件
DAOS客户端与服务端通信主要通过DAOS Library（libdaos）。libdaos是专门为用户应用和IO中间件存储数据到DAOS container中而设计的。libdaos允许应用通过该接口与daos_engine进行通信，用来管理container和以不同的方式访问object。DAOS在libdaos之上又封装了一个libdfs库。libdfs库模拟了POSIX语义来支持文件系统应用程序。

另外，在DAOS客户端组件中，还提供了DAOS agent。它通过dRPC与libdaos通信来对应用程序进程身份验证。DAOS agent可以支持不同的身份验证框架，并使用Unix域套接字与客户端库进行通信。它还可以通过gRPC与每个DAOS server进行通信，以便向libdaos提供DAOS系统成员信息并支持pool list操作。

```bash
● daos_agent.service - DAOS Agent
   Loaded: loaded (/usr/lib/systemd/system/daos_agent.service; disabled; vendor preset: disabled)
   Active: active (running) since Tue 2025-04-08 13:17:29 CST; 3 days ago
 Main PID: 1467814 (daos_agent)
    Tasks: 27 (limit: 1644967)
   Memory: 26.2M
   CGroup: /system.slice/daos_agent.service
           └─1467814 /usr/bin/daos_agent
```

## 1.3. 管理节点组件
管理节点组件提供了系统管理工具（dmg）和管理API。dmg是在管理API之上设计的一个命令行工具，系统用管理员可以通过dmg命令管理和监控DAOS集群。管理API是专门为第三方存储管理框架设计的，第三方管理框架可以通过调用该API来监控DAOS集群。无论是dmg还是API，最终都是通过gRPC与daos_server组件通信。
```bash
root@node2 ~]# dmg --help
Usage:
  dmg [OPTIONS] <command>

dmg (DAOS Management) is a tool for connecting to DAOS servers
for the purpose of issuing administrative commands to the cluster. dmg is
provided as a means for allowing administrators to securely discover and
administer DAOS components such as storage allocations, network configuration,
and access control settings, along with system wide operations.

Application Options:
      --allow-proxy   Allow proxy configuration via environment
  -i, --insecure      Have dmg attempt to connect without certificates
  -d, --debug         Enable debug output
      --log-file=     Log command output to the specified file
  -j, --json          Enable JSON output
  -J, --json-logging  Enable JSON-formatted log output
  -o, --config-path=  Client config file path

Help Options:
  -h, --help          Show this help message

Available commands:
  check           Check system health
  config          Perform tasks related to configuration of hardware on remote servers (aliases: cfg)
  container       Perform tasks related to DAOS containers (aliases: cont)
  network         Perform tasks related to network devices attached to remote servers (aliases: net)
  pool            Perform tasks related to DAOS pools
  server          Perform tasks related to remote servers (aliases: srv)
  server-version  Print server version
  storage         Perform tasks related to storage attached to remote servers (aliases: sto)
  support         Perform debug tasks to help support team (aliases: supp)
  system          Perform distributed tasks related to DAOS system (aliases: sys)
  telemetry       Perform telemetry operations (aliases: telem)
  version         Print dmg version
```

## 1.4. 网络通信组件
在整个DAOS系统中，DAOS使用了3类通信渠道：`gRPC、dRPC和CART。`

`gRPC`为DAOS管理提供了一个双向安全通道，通常使用out-of-band TCP/IP网络，用于管理通信。它依赖TLS/SSL来对administrator和server进行身份验证。

`dRPC`是一种基于Unix域套接字构建的通信通道，用于进程间通信。主要用应用于DAOS agent与DAOS libdaos应用进程的身份认证，DAOS server与DAOS engine之间的协议序列化。

`CART`是用户空间的函数库，主要用于客户端与服务端的数据传输。通常采用低延时高带宽的网络，比如RDMA。CART是在Mercury和libfabric上构建的。CART库用于libdaos和daos_engine实例之间的所有通信。