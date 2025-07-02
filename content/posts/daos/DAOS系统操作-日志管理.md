---
title: DAOS系统操作-日志管理
date: 2025-07-01T09:37:39+0800
description: "本文详细介绍如何开启、关闭以及管理DAOS系统日志。"
tags: [daos]
---

# 1. 概述
DAOS的日志功能是在DEBUG模块基础之上构建的，覆盖三个领域：`GURT(通用)、CaRT、DAOS`，不仅可以控制全局的日志开启和关闭，也可以更细粒度的控制DAOS系统中某个基础组件的某种操作流的日志开启和关闭，后者必须要开启DEBUG级别的日志等级才可以。

## 1.1. DEBUG（GURT）
DEBUG是整个日志管理系统的基础模块，也是通用模块。所以，DEBUG相关的所有定义都是在GURT模块种。DEBUG模块的设计思想：使用`D_FOREACH_GURT_FAC`宏来控制需要调试的组件，使用`D_FOREACH_GURT_DB`宏来控制需要调试的操作流。

D_FOREACH_GURT_FAC的定义如下：
```c
#define D_FOREACH_GURT_FAC(ACTION, arg)                           \
  ACTION(misc, misc, arg)  /* misc debug messages */              \
  ACTION(mem,  mem,  arg)  /* memory debug messages */            \
  ACTION(swim, swim, arg)  /* swim debug messages (move ?) */     \
  ACTION(fi,   fi,   arg)  /* fault injection debug messages */   \
  ACTION(telem, telem, arg)  /* telemetry debug messages */
```
D_FOREACH_GURT_DB的定义如下：
```c
#define D_FOREACH_GURT_DB(ACTION, arg)          \
  /** Set all debug bits */                     \
  ACTION(DB_ALL,   all,   all,   0, arg)        \
  /** Stream for uncategorized messages */      \
  ACTION(DB_ANY,   any,   any,   0, arg)        \
  /** Extremely verbose debug stream */         \
  ACTION(DB_TRACE, trace, trace, 0, arg)        \
  /** Memory operations */                      \
  ACTION(DB_MEM,   mem,   mem,   0, arg)        \
  /** Network operations */                     \
  ACTION(DB_NET,   net,   net,   0, arg)        \
  /** I/O operations */                         \
  ACTION(DB_IO,    io,    io,    0, arg)        \
  /** Test debug stream */                      \
  ACTION(DB_TEST,  test,  test,  0, arg)
```

DEBUG对外提供D_DEBUG接口，以便在整个DAOS中使用，相关定义如下：
```c
#define D_DEBUG(flag, fmt, ...)                 \
  _D_DEBUG(_D_LOG_NOCHECK, flag, fmt, ##__VA_ARGS__)
```

除了D_DEBUG接口之外，提供了基于D_DEBUG接口衍生出来的D_INFO、D_WARN、D_ERROR等接口，相关定义如下：
```c
#define D_INFO(fmt, ...)	D_DEBUG(DLOG_INFO, fmt, ## __VA_ARGS__)
#define D_NOTE(fmt, ...)	D_DEBUG(DLOG_NOTE, fmt, ## __VA_ARGS__)
#define D_WARN(fmt, ...)	D_DEBUG(DLOG_WARN, fmt, ## __VA_ARGS__)
#define D_ERROR(fmt, ...)	D_DEBUG(DLOG_ERR, fmt, ## __VA_ARGS__)
#define D_ALERT(fmt, ...)	D_DEBUG(DLOG_ALERT, fmt, ## __VA_ARGS__)
#define D_CRIT(fmt, ...)	D_DEBUG(DLOG_CRIT, fmt, ## __VA_ARGS__)
#define D_FATAL(fmt, ...)	D_DEBUG(DLOG_EMERG, fmt, ## __VA_ARGS__)
#define D_EMIT(fmt, ...)	D_DEBUG(DLOG_EMIT, fmt, ## __VA_ARGS__)
```

## 1.2. CaRT
CaRT模块同样也提供了`CRT_FOREACH_LOG_FAC`宏来控制需要调试的组件，但是没有提供针对操作流控制的宏。

## 1.3. DAOS
DAOS模块提供的`DAOS_FOREACH_LOG_FAC`宏使用需要调试的组件范围更广。同样也提供了`DAOS_FOREACH_DB`宏来控制需要调试的操作流。


&nbsp;
&nbsp;
# 2. 使用方法
## 2.1. 环境变量
DAOS提供了一系列环境变量来设置日志，使用时，只需要在每个engine的env_vars参数下添加环境变量和对应的值即可。主要涉及到的系统环境变量如下：
- `D_LOG_MASK`: 设置全局日志级别。日志等级包括：DEBUG, DBUG, INFO, NOTE, WARN, ERROR, ERR, CRIT, ALRT, FATAL, EMRG, EMIT。在使用D_LOG_MASK设置全局日志级别的同时，可以指定某个组件的日志级别。比如：`D_LOG_MASK=DEBUG,MEM=ERR`,表示MEM组件的日志级别为ERR，其他组件的日志级别为DEBUG。
- `DD_SUBSYS`：控制需要日志调试的DAOS基础组件。如之前分析所说，组件被分为3大类：DAOS组件、通用组件、CaRT组件。默认情况下，所有组件都被开启，即：`DD_SUBSYS=all`。如果需要同时调试多个组件，组件间用逗号隔开。比如：`DD_SUBSYS=rpc,bulk`。
  - `DAOS组件`：daos, array, kv, common, tree, vos, client, server, rdb, rsvc, pool, container, object, placement, rebuild, mgmt, bio, tests, dfs, duns, drpc, security, dtx, dfuse, il, csum, stack
  - `通用组件`：misc, mem, swim, fi, telem
  - `CaRT组件`：crt, rpc, bulk, corpc, grp, lm, hg, external, st, iv, ctl
- `DD_MASK`：控制操作流日志的开启和关闭。如之前分析所说，操作流日志分2大类：DAOS操作流和通用操作流。默认情况下，所有的操作流日志都被开启，即：`DD_MASK=all`。如果需要开启多个操作流日志，操作流之间用逗号隔开，比如：DD_MASK=io,mem。DD_MASK只对DEBUG级别的日志才有效。
  - DAOS操作流：md, pl, mgmt, epc, df, rebuild, sec, csum, group_defaul, group_metadata, group_metadata_only
  - 通用操作流：any, trace, mem, net, io, test

例如：查看元数据操作流的日志调试信息
```yaml
  env_vars:
  - D_LOG_MASK=DEBUG
  - DD_SUBSYS=all
  - DD_MASK=group_metadata
```

## 2.2. 命令行参数
在配置文件中配置环境变量后需要重启daos_server才能生效。DAOS提供了`dmg server set-logmasks`命令动态调整日志。该命令接受4个参数：`--host-list, --masks, --streams, --subsystems`，其中后面三个参数将会依次覆盖daos_server.yaml文件中每个engine配置项中log_mask参数的值、env_vars参数中环境变量DD_MASK和DD_SUBSYS的值。如果该命令不带任何参数，将使用配置文件中的值。

例如：开启debug模式，并使能所有组件所有操作流日志。
```bash
dmg server set-logmasks -m DEBUG -d all -s all
```
上数命令等同于以下配置：
```yaml
engines:
- log_mask: DEBUG
  env_vars:
  - DD_SUBSYS=all
  - DD_MASK=all
```

&nbsp;
&nbsp;
# 3. 参考资料
- [https://docs.daos.io/v2.6/admin/troubleshooting/#debugging-system](https://docs.daos.io/v2.6/admin/troubleshooting/#debugging-system)
- [https://docs.daos.io/v2.6/admin/administration/#system-logging](https://docs.daos.io/v2.6/admin/administration/#system-logging)