---
title: DAOS系统架构-Data Plane
date: 2025-06-11T10:25:00+0800
description: "本文介绍DAOS.2.6.0中数据平面（也称daos_engine）的模块化设计思想。"
tags: [daos]
---

> daos:           2.6.0

# 1. 概述
`Data Plane`也称为`daos_engine`（即I/O Engine）。daos_engine是一个多线程进程，每个daos_engine都有一组`target xstream set`，主要负责I/O处理。每组中target xstream set的数量由`dss_tgt_nr`指定。每个target xstream set都包含1个`main xstream`和一组`offload xstream`。offload xstream的数量由`dss_tgt_offload_xs_nr`指定。另外每个daos_engine还有1个`system xstream set`，负责系统级别的任务处理（比如元数据请求处理）。


&nbsp;
&nbsp;
# 2. 模块接口
I/O Engine提供了一种DAOS module接口，该接口允许按照需求加载服务端侧的代码。每个DAOS module实际上都是一个动态库，这些动态库都是由I/O Engine通过dlopen加载的。目前DAOS module有：`object、pool、container、management、vos`，DAOS module与I/O Engine之间的接口被定义在dss_module数据结构中。

每个DAOS module都应该包含以下信息：

- DAOS module的名字
- DAOS module的ID
- 功能掩码
- DAOS module的初始化函数和结束函数

另外，每个DAOS module还可以进行一些可选的配置：

- 在整个堆栈启动并运行后，调用的清理函数
- CART RPC 句柄
- dRPC 句柄

**DAOS module 接口**
```c
struct dss_module {
  /* Name of the module */
  const char    *sm_name;
  /* Module id see enum daos_module_id */
  int    sm_mod_id;
  /* dRPC handlers, for unix socket comm, last entry must be empty */
  struct dss_drpc_handler   *sm_drpc_handlers;
  ......
}
```

**DAOS module 结构定义**
```c
struct dss_module mgmt_module = {
	.sm_name          = "mgmt",
	.sm_mod_id        = DAOS_MGMT_MODULE,
	.sm_ver           = DAOS_MGMT_VERSION,
	.sm_proto_count   = 2,
	.sm_init          = ds_mgmt_init,
	.sm_fini          = ds_mgmt_fini,
	.sm_setup         = ds_mgmt_setup,
	.sm_cleanup       = ds_mgmt_cleanup,
	.sm_proto_fmt     = {&mgmt_proto_fmt_v2, &mgmt_proto_fmt_v3},
	.sm_cli_count     = {MGMT_PROTO_CLI_COUNT, MGMT_PROTO_CLI_COUNT},
	.sm_handlers      = {mgmt_handlers_v2, mgmt_handlers_v3},
	.sm_drpc_handlers = mgmt_drpc_handlers,
};
```

**DAOS module 加载**
```c
dss_module_load(const char *modname) {
  /* load the dynamic library */
  sprintf(name, "lib%s.so", modname);
  handle = dlopen(name, RTLD_LAZY | RTLD_GLOBAL);

  /* lookup the dss_module structure defining the module interface */
  sprintf(name, "%s_module", modname);
  smod = (struct dss_module *)dlsym(handle, name);
  ......
}
```

&nbsp;
&nbsp;
# 3. 线程模型与Argobot集成
I/O Engine是一个使用Argobots进行非阻塞处理的多线程进程。

默认情况下，系统会为每个target创建1个main xstream，0个offload xstream。offload xstream的数量可以通过daos_engine命令行参数进行配置。此外系统还会创建1个额外的xstream，用来处理元数据请求。每个xstream与1个CPU core绑定。main xstream接收来自客户端和其他servers向target发起的请求。另外，一个特殊的ULT会被启动，用来推进网络和NVMe I/O操作。

```c
static int dss_xstreams_init(void) {
  /* start system service XS */
  for (i = 0; i < dss_sys_xs_nr; i++) {
    xs_id = i;
    rc    = dss_start_xs_id(tags, xs_id);
    if (rc)
      D_GOTO(out, rc);
    tags &= ~DAOS_RDB_TAG;
  }

  /* start main IO service XS */
  for (i = 0; i < dss_tgt_nr; i++) {
    xs_id = DSS_MAIN_XS_ID(i);
    rc    = dss_start_xs_id(DAOS_SERVER_TAG, xs_id);
    if (rc)
      D_GOTO(out, rc);
  }

  /* start offload XS if any */
  for (i = 0; i < dss_tgt_nr; i++) {
    int j;

    for (j = 0; j < dss_tgt_offload_xs_nr /
        dss_tgt_nr; j++) {
      xs_id = DSS_MAIN_XS_ID(i) + j + 1;
      rc    = dss_start_xs_id(DAOS_OFF_TAG, xs_id);
      if (rc)
        D_GOTO(out, rc);
    }
  }
}
```



&nbsp;
&nbsp;
# 4. Thread-local Storage（TLS）
每个xstream会分配私有的存储空间，该存储空间可以通过dss_tls_get函数访问。在每个DAOS module注册时，每个DAOS module都可以指定一个module key以及与该key相关联的一个数据结构，该数据结构将会在TSL中被每个xstream分配。dss_module_key_get函数会获取到该数据结构。
```c
static inline void *
daos_module_key_get(struct daos_thread_local_storage *dtls, struct daos_module_key *key)
{
  ...
  return dtls->dtls_values[key->dmk_index];
}
```

&nbsp;
&nbsp;
# 5. Incast Variable集群
DAOS会使用IV(incast variable)在同一个IV命名空间内的servers之间共享values和statuses。其中该命名空间被组织为树形结构。树的根节点被称之为IV leader，而servers既可以是叶子节点也可以是非叶子节点。每个server维护自己的IV cache。在fetch期间，如果local cache中的数据无法满足请求，则会将请求转发到父节点，直到到达根节点。至于update操作，它会先更新local cache，然后转发到父节点，直到到达根节点，根节点在将更改传播到其他servers。IV命名空间是按照pool划分的，当创建pool时便会创建该IV命名空间，并伴随着pool的销毁而销毁。为了使用IV，每个IV用户都需要在IV命名空间下注册自己以获取一个ID，然后在该IV命名空间下使用这个ID对自己的IV值进行fetch或者update操作。

&nbsp;
&nbsp;
# 6. dRPC Server
I/O Engine包含一个dRPC server，该server会监听给定的Unix套接字上的活动。关于dRPC，请参考[dRPC](https://daosio.github.io/docs/drpc.html)。

dRPC server会定期的轮询传入的客户端连接和请求。它可以通过struct drpc_progress_context对象处理多个并发的客户端连接，该结构用于管理struct drpc对象和任何活着的客户端连接。

dRPC server轮询是运行在它自己的User-Level Thread (ULT)中，dRPC socket已经被设置为非阻塞模式，并且轮询的超时时间为0，这使得server可以运行在UTL中而不是它自己的xstream中。这种通道的流量是相对较低的。

```c
static void drpc_listener_run(void *arg) {
	struct drpc_progress_context *ctx;

	D_ASSERT(arg != NULL);
	ctx = (struct drpc_progress_context *)arg;

	D_INFO("Starting dRPC listener\n");
	set_listener_running(true);
	while (is_listener_running()) {
		int rc;

		/* wait a second */
		rc = drpc_progress(ctx, 1000);
		if (rc != DER_SUCCESS && rc != -DER_TIMEDOUT) {
			D_ERROR("dRPC listener progress error: "DF_RC"\n",
				DP_RC(rc));
		}

		ABT_thread_yield();
	}

	D_INFO("Closing down dRPC listener\n");
	drpc_progress_context_close(ctx);
}
```

## 6.1. dRPC Progress
`drpc_progress`表示dRPC server循环的一个迭代，工作流如下：

- 对监听套接字和客户端连接进行轮询。
- 如果在客户端连接上看到了任何活动：
  - 如果由数据传入，则调用drpc_recv来处理传入的数据。
  - 如果客户端已断开连接或连接已中断，则释放struct drpc对象，并从drpc_progress_context中移除。
- 如果在监听套接字上看到了任何活动：
  - 如果有新的连接接入：调用drpc_accept，并在新的struct drpc对象添加到drpc_progress_context中的客户端连接列表里。
  - 如果发生错误了，则向调用者返回`-DER_MISC`。它会引起I/O Engine记录此次错误，但不会打断dRPC server循环。
- 如果未检测到任何活动，则向调用者返回`-DER_TIMEDOUT`。这存粹是为了调试。实际上，I/O Engine会忽略该错误码，因为没有任何活动实际上并不代表发生错误。

## 6.2. dRPC Handler Registration
每个DAOS module都可以为一个或多个dRPC module IDs注册一个句柄函数来实现对dRPC消息的处理。

句柄的注册非常简单。在dss_module中，sm_drpc_handlers是一个struct dss_drpc_handler数组，当该字段设置为NULL是，表示没有注册任何句柄。当I/O Engine加载DAOS module时，他将会自动注册所有的dRPC句柄。

> dRPC module ID与DAOS module ID是不同的。因为根据功能不同，一个DAOS module可能需要注册多个dRPC module ID。

dRPC server使用drpc_hdlr_process_msg来处理传入的消息。此函数会检查传入的消息的dRPC module ID，然后搜索一个句柄，如果找到了就执行该句柄，并返会Drpc_Response。如果没有找到句柄，它将生成其自身的Drpc_Response，以表示该dRPC module ID并没有被注册。