---
title: DAOS通信机制-dRPC
date: 2025-07-02T16:46:40+0800
description: "本文介绍DAOS.2.6.0通信机制中的dRPC模块设计思想。"
tags: [daos]
---

> daos:           2.6.0

# 1. 概述
dRPC（DAOS Remote Procedure Call）在DAOS中特指由DAOS开发的远程调用框架，而不是由STORJ研发的dRPC框架。`dRPC主要用于控制平面与数据平面的通信。`

DAOS实现的dRPC框架与gRPC框架基本上相同，都是依赖Protobuf序列化协议来定义所有的消息结构，唯一不同在于dRPC是基于Socket套接字来进行通信的，而gRPC基于HTTP/2协议进行通信。

dRPC的具体函数调用被封装在dRPC module中，在使用时，需要在daos_server启动中注册dRPC module。

&nbsp;
&nbsp;
# 2. dRPC代码实现
## 2.1. protobuf的定义
在DAOS中，dRPC通信机制中的所有消息结构都是在`src/proto/drpc.proto`文件中定义的。然后通过gRPC插件`protoc-gen-go`编译出go语言版本的dRPC接口文件，存放在`src/control/drpc/`目录下。

drpc.proto文件很简单，主要定义了`Call`和`Response`两个消息结构。相关定义如下：
```proto
// Status represents the valid values for a response status.
message Call {
  int32 module = 1; // ID of the module to process the call.
  int32 method = 2; // ID of the method to be executed.
  int64 sequence = 3; // Sequence number for matching a response to this call.
  bytes body = 4; // Input payload to be used by the method.
}
......

// Response describes the result of a dRPC call.
message Response {
	int64 sequence = 1; // Sequence number of the Call that triggered this response.
	Status status = 2; // High-level status of the RPC. If SUCCESS, method-specific status may be included in the body.
	bytes body = 3; // Output payload produced by the method.
}
```

&nbsp;
## 2.2. go语言实现
### 2.2.1. dRPC client
dRPC client代码实现在`src/control/drpc/drpc_client.go`文件中。`NewClientConnection`是创建dRPC client入口函数。

**基本流程**

创建一个客户端连接
```go
conn := drpc.NewClientConnection("/var/run/my_socket.sock")
```

连接dRPC server
```go
err := conn.Connect()
```

发送消息
```go
call := drpc.Call{}
// Set up the Call with module, method, and body
resp, err := drpc.SendMsg(call)
```

### 2.2.2. dRPC server
dRPC server代码实在`src/control/drpc/drpc_server.go`文件中。`NewDomainSocketServer`是创建dRPC server入口函数。dRPC server在处理请求时，是通过调用相应的dRPC module去处理的。为了实现该目的，dRPC server在初始化过程中会注册各种各样的dRPC modules。dRPC modules的相关定义在`src/control/drpc/modules.go`文件中。

**基本流程**

创建一个dRPC server
```go
drpcServer, err := drpc.NewDomainSocketServer(log, "/var/run/my_socket.sock", 0600)
```

注册dRPC modules
```go
drpcServer.RegisterRPCModule(&MyExampleModule{})
drpcServer.RegisterRPCModule(&AnotherExampleModule{})
```

启动dRPC server
```go
err = drpc.Start()
```

&nbsp;
&nbsp;
# 3. 参考资料
[https://github.com/daos-stack/daos/blob/v2.6.0/src/control/drpc/README.md](https://github.com/daos-stack/daos/blob/v2.6.0/src/control/drpc/README.md)