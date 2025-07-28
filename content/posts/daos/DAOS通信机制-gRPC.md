---
title: DAOS通信机制-gRPC
date: 2025-06-18T15:28:11+0800
description: "本文介绍DAOS通信机制中的gRPC模块设计思想。"
tags: [daos]
---

# 概述
gRPC是由Google开发的远程过程调用框架，基于HTTP/2协议和Protobuf序列化技术构建，旨在为分布式系统提供高效、跨平台的通信解决方案。其核心设计思想是让服务间通信像调用本地方法一样简单，同时具备强大的扩展性和性能优势。

gRPC的发展源于Google内部的Stubby框架，2015年对外开源后，迅速成为微服务架构中主流的通信框架之一，目前由CNCF（云原生计算基金会）托管。

gRPC在DAOS中被应用于控制平面（管理平面）客户端与服务端之间的网络通信，主要是处理集群配置、节点管理这些控制流操作。比如创建存储池、格式化节点之类的命令，都是通过gRPC来完成的。

# gRPC框架
与许多RPC系统一样，gRPC基于定义服务的思想，指定远程调用的方法及其参数和函数返回类型。服务端实现此接口并运行gRPC服务来处理客户端调用。在通信过程中，客户端通过stub代理调用服务端定义的方法，请求数据被序列化为Protobuf二进制格式。基于HTTP/2协议传输至服务端，服务端解析请求并调用对应处理逻辑。响应数据序列化后返回客户端，客户端反序列化得到结果。

![gRPC框架](https://raw.githubusercontent.com/henglgh/articles/main/static/images/gRPC.png)


# gRPC代码实现
## protobuf的定义
gRPC最重要的一点是使用Protocol Buffers作为接口描述语言，通过.proto文件定义服务接口和消息结构，通过protoc编译器生成各种语言的客户端/服务端代码，确保服务端和客户端使用一致的接口规范。Protobuf协议的优点在于将数据序列化为紧凑的二进制格式，相比JSON/XML体积更小、解析更快。

在DAOS中，控制平面所有的protobuf定义文件都保存在`src/proto/ctl`目录下。然后通过gRPC插件`protoc-gen-go`编译出go语言版本的gRPC接口文件（eg：`ctl_grpc.pb.go、ctl.pb.go`）。

`src/proto/ctl/ctl.proto`文件中定义了一个gRPC control service，在该service中定义了控制平面用到的所有的方法：StorageScan、StorageFormat、NetworkScan、SmdQuery等等。
```proto
service CtlSvc {
  // Retrieve details of nonvolatile storage on server, including health info
  rpc StorageScan(StorageScanReq) returns(StorageScanResp) {};
  // Format nonvolatile storage devices for use with DAOS
  rpc StorageFormat(StorageFormatReq) returns(StorageFormatResp) {};
  // Rebind SSD from kernel and bind instead to user-space for use with DAOS
  rpc StorageNvmeRebind(NvmeRebindReq) returns(NvmeRebindResp) {};
  // Add newly inserted SSD to DAOS engine config
  rpc StorageNvmeAddDevice(NvmeAddDeviceReq) returns(NvmeAddDeviceResp) {};
  .....
}
```

上面每个函数中的参数以及函数返回值都是message类型，具体定义在相应的.proto文件中。比如StorageScanReq和StorageScanResp定义都在`src/proto/ctl/storage.proto`文件中。
```proto
message StorageScanReq {
	ScanNvmeReq nvme = 1;
	ScanScmReq scm = 2;
}

message StorageScanResp {
	ScanNvmeResp nvme = 1;
	ScanScmResp scm = 2;
	MemInfo mem_info = 3;
}
```

`protoc-gen-go`插件会将上述.proto文件编译成go语言的代码文件，并生成相应的结构体和函数。编译后的文件存放路径也是在.proto文件指定的。

## go语言实现
在DAOS中，可以在`src/control/common/proto/ctl`路径下找到编译后的文件。比如：`ctl_grpc.pb.go`和`ctl.pb.go`。`ctl_grpc.pb.go`文件中定义了gRPC客户端和服务端接口和数据结构：
```go
type CtlSvcClient interface {
  StorageScan(ctx context.Context, in *StorageScanReq, opts ...grpc.CallOption) (*StorageScanResp, error)
  ......
}

type CtlSvcServer interface {
  StorageScan(context.Context, *StorageScanReq) (*StorageScanResp, error)
}
......
```
所有接口中方法的参数以和返回值都是.proto文件中定义的message类型。对象的go语言实现在相应的.go文件中。比如：StorageScanReq的实现在`src/control/common/proto/ctl/storage.pb.go`文件中：
```go
type StorageScanReq struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Nvme *ScanNvmeReq `protobuf:"bytes,1,opt,name=nvme,proto3" json:"nvme,omitempty"`
	Scm  *ScanScmReq  `protobuf:"bytes,2,opt,name=scm,proto3" json:"scm,omitempty"`
}
```
