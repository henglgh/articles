---
title: Lustre系统架构-LNet
date: 2021-07-07T10:27:14+0800
description: "本文介绍Lustre 2.15.4的LNet功能和使用方法。"
tags: [lustre]
---

> lustre版本：2.15.4

# 1. 简介
LNet(Lustre networking feature)是lustre集群之间网络通信机制。它支持很多网络通信类型，比如：RDMA、InfiniBand以及IP网络等。

Lustre network stack由两部分组成：LNet module和LND(Lustre network driver)。通常情况下客户端和服务端必须在同一网段内，如果不在同一网段内，需要配置路由。

在LNet中，每个节点至少有1个NID(network identifier)。NID由网卡IP和LNet label组成，比如192.168.1.2@tcp0。LNet label通常由网络通信类型和序号组成，比如tcp0。通常情况下序号表示子网的编号。

&nbsp;
&nbsp;
# 2. 配置
配置LNet不是必须，默认情况下当执行`lctl network up`启动LNet时，LNet会使用第一个有效的TCP/IP网卡，只有使用Infiniband或者多网卡的情况下才要求必须配置LNet。