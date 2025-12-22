---
title: "[DAOS] 模块化设计介绍"
date: 2025-12-20T09:00:00+0800
description: "本文详细介绍DAOS.2.6.0中模块化层级设计介绍。"
tags: [daos]
---

# 1. 概述
从整体设计上来看，DAOS系统是由客户端、服务端、通信三部分组成。但是从内部设计来看，DAOS系统是由多个模块组成的，每个模块都有自己的功能，负责处理不同的任务。

![modules](https://raw.githubusercontent.com/henglgh/articles/main/static/images/modules.png)

上图中的的右侧展示了DAOS的模块划分，主要划分为：通信模块、持久化存储模块、线程模块、日志模块、通用模块，以及其他模块。

&nbsp;
&nbsp;
# 2. sevice层级设计

![layering](https://raw.githubusercontent.com/henglgh/articles/main/static/images/layering.png)

上图展示的是DAOS service组件的堆栈设计。DAOS内部service组件包括：`management、pool、 container、object 、rebuild以及security`。每个组件都有客户端和服务端之分。有些组件横跨控制平面和数据平面，比如management和security。这类组件的客户端和服务端通常通过`gRPC`进行通信。大部分组件的客户端和服务端是通过`CaRT`进行通信的，比如pool、container、object等。跨组件之间的通信通常是直接调用API函数。位于同一侧不同层级的相同组件之间是通过`dRPC`进行通信，比如位于服务端的，横跨数据平面与控制平面的management组件之间的通信方式。

&nbsp;
&nbsp;
# 3. 代码组织方式
所有的库和service代码都放在`src`目录下，并且对应于专门的目录。每个service的客户端代码和服务端代码是分开存储在单独的文件中。其中，客户端的函数以`dc_`开头，服务端的函数以`ds_`开头。

和rpc相关的协议和RPC内容各式通常定义在rpc.h头文件中。

所有和控制平面的相关的代码都是用go语言实现，并且放在`src/control`目录下。

与DAOS相关的API代码全部放在`src/include`目录下，函数以`daos_`开头。这部分API代码是暴露给应用程序或者终端用户使用的。DAOS内部使用的API代码按照客户端API和服务端API划分，分别放在`src/include/daos`和`src/include/daos_srv`目录下。客户端API函数以`dc_`开头，服务端API函数以`ds_`开头。