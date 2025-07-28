---
title: DAOS系统架构-Control Plane
date: 2025-06-11T10:25:00+0800
description: "本文介绍DAOS中Control Plane的模块化设计思想。"
tags: [daos]
---

> daos:           2.6.0

# 1. 概述
`Control Plane`也称为`daos_server`。负责实例化和管理daos_engine。`src/control/server`目录是实现daos_server的内部功能，而`src/control/cmd/daos_server`目录是实现daos_server的应用端功能。

&nbsp;
&nbsp;
# 2. I/O Engine实例
daos_engine是从daos_server派生而来的，并主要处理DAOS用户空间的I/O。`instance.go`提供了`EngineInstance`的抽象和方法。

&nbsp;
&nbsp;
# 3. I/O Engine Harness
DAOS I/O Engine进程由DAOS Server管理和监控，并且在逻辑上作为I/O Engine harness的成员。`harness.go`提供了`EngineHarness`抽象和相关方法。

&nbsp;
&nbsp;
# 4. Communications
DAOS Server实现了gRPC协议，以便于客户端gRPC应用程序进行通信，并通过Unix域套接字与DAOS I/O Engine进行交互。

DAOS Server会加载多个gRPC server modules，当前包含的modules有security和management。

DAOS Server实例（daos_server）将打开一个gRPC通道，用来监听来自控制平面的客户端应用以及其他DAOS Server实例的请求。

`server.go`主要包含常规的启动活动：gRPC server的建立和RPCs的注册。

## 4.1. Control API
`src/control/lib/control`目录提供了一个基于RPC的API，用于控制平面的客户端应用与DAOS Server进程之间的通信。

## 4.2. Protobuf Definitions
protocol buffer的定义可以在`src/proto`目录中找到。

## 4.3. Control Service
`src/proto/ctl/ctl.proto`文件中定义了control service，gRPC server会注册control service来处理来自management tool的请求。

control service RPCs将会在一个或多个daos_server进程上并发处理。当接收到control service RPCs时，相关句柄会被触发，这些句柄通常最终会调用native-C storage或者网络方面的库。比如ipmctl, spdk或者hardware。

类似广播的命令通常是由management tool发出的，这是一个gRPC客户端，它使用control API与daos_server进程进行通信的。这些命令通常不会触发dRPCs，主要是执行类型硬件配置之类的功能。

control service RPC句柄相关的代码在`src/control/server/ctl_*.go`文件中，特定protobuf的unwrapping/wrapping相关的代码在`src/control/server/ctl_*_rpc.go`文件中。

## 4.4. Management Service
控制平面实现了一个management service，并将它作为DAOS Server的一部分，主要负责将operations分发到系统中。

有一些dmg命令会触发向daos_server进程（leader节点的）发送management service请求。

有时候请求将会通过dRPC通道转发到数据平面，然后由数据平面的management service进行处理。

control service RPCs相关代码在`src/control/server/mgmt_*.go`文件中。

## 4.5. Server-to-Server fan-out
一些control service RPC句柄可以通过gRPC触发对多个远程控制(harness)的fan-out操作。为了发送fan-out请求，会使用control API客户端。

一个典型的例子就是`dmg system stop`命令，其服务端的句柄就是ctl_system.go文件中的`SystemStop`，它会向远程控制发出请求。在system.go的`SystemStop`客户端调用中展示了如何使用control API客户端发出fan-out请求。

## 4.6. 系统命令处理
System commands会使用fan-out。并向所选中的ranks发送RPCs，以执行停止、启动、以及格式化等操作。

## 4.7. 存储命令处理
与Storage相关的RPCs，其处理句柄被定义在`ctl_storage*.go`中，并将操作封装在`src/control/server/storage`子目录下的scm和bdev中。

&nbsp;
&nbsp;
# 5. Bootstrapping
当启动一个控制平面的实例时，我们会查找超级快，以确定该实例是否作为MS（management service） replica启动。daos_server.yml的access_points参数（仅在格式化期间使用）用于确定实例是否为一个MS replica。

当启动的实例被视为一个MS replica时，他将执行bootstrap和starts。如果DAOS系统中只有一个relica，那么已经执行了bootstrap的实例所在的节点就是MS leader。如果有多个副本，将在后台选举，最终选择出一个领导者。

当启动的实例没有被视为一个MS replica时，该实例所在的节点会调用control API客户端上的`Join`，这回触发向MS leader发送一个gRPC请求，该请求中包含了将要加入的实例的control address。

运行在MS leader节点上的gRPC server将处理该join请求，并分配一个rank，该rank会被记录在MS membership中。该rank会在Join的响应中返回，并通过dRPC传达给数据平面。

&nbsp;
&nbsp;
# 6. 存储管理
对 NVMe SSD设备的操作执行是使用go-spdk来执行的，以便可以使用SPDK框架来发出命令。

对SCM持久化内存模块的操作是使用go-ipmctl来执行的，以便可以通过ipmctl来发出命令。

与Storage RPC相关的服务端侧的代码，包含在`src/control/server/ctl_storage*.go`文件中。

## 6.1. 存储格式化
在启动DAOS数据平面之前，需要对存储进行格式化。
![storage_format_detail](https://raw.githubusercontent.com/henglgh/articles/main/static/images/storage_format_detail.png)

如果存储没有被格式化，daos_server将在启动时暂停，等待存储被格式化。

存储格式化操作仅在第一次启动DAOS系统时才需要。格式化包含：SCM格式化和NVMe格式化。

**SCM格式化**

格式化SCM涉及在非易失性内存设备上创建ext4文件系统。挂载SCM会使用DAX扩展进行主动挂载，从而实现无传统块存储限制的直接访问。

SCM设备命名空间的格式化和挂载操作，按照配置文件中以`scm_`为前缀的参数进行。

**NVMe格式化**
NVMe格式化操作是指对存储介质的进行重置，这将移除blobstores并从SSD控制器命名空间删除任何文件系统的签名。

NVMe格式化将会对配置文件中bdev_list参数所执行的，class为nvme的设备进行格式化操作。

为了把NVMe标识为被DAOS数据平面使用的，控制平面将生成一个daos_nvme.conf文件供SPDK使用，该文件将作为格式化的最后一个阶段，写入到`scm_mount`参数指定的挂载位置。