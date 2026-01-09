---
title: "[Lustre] nodemap的介绍与使用"
date: 2021-07-06T10:27:14+0800
description: "本文介绍Lustre 2.15.4的nodemap功能和使用方法。"
tags: [lustre]
---

# 1. 简介

nodemap 功能支持不同主机上的用户 UID 和 GID 映射到 MGS 服务所在的主机系统上，也就是将所有客户端中所有的用户全部映射到 lustre 系统中。当不同主机之间存在多个相同 UID 和 GID 的用户时，通过映射，可以保证每个用户只能访问自己的文件。

将客户端上的用户映射到 MGS 服务所在的主机上时，映射后 UID 和 GID 在 MGS 节点上可以存在也可以不存在。如果不存在，在 MGS 节点上看到的文件属性信息将以映射后的 UID 和 GID 呈现。

当开启 nodemap 功能时，只有加入了 nodemap 中的客户端并且该客户端中做了 UID 和 GID 映射的用户才能访问 lustre 文件系统，该客户端中的其他未做 UID 和 GID 映射的用户是没有权限访问 lustre 文件系统。对于 root 这种特权的用户，必须要开启当前 nodemap 的 admin 和 trusted 属性，才有权限访问文件系统。默认情况下 admin 和 trusted 属性值是 0，也就是 root 用户没有权限访问 lustre 文件系统。

nodemap 功能相关的设置只能在 MGS 服务所在的节点上操作。nodemap 功能必须通过`lctl nodemap_activate 1`命令开启。如果在 nodemap 功能生效期间对 nodemap 做修改，修改不会立即生效，需要等 10s。如果想要立即生效，可以重新挂载客户端即可。

# 2. 实战

为了所有的操作都能正常执行，lustre 文件系统要求提供一个特殊的 nodemap，该 nodemap 必须覆盖所有的服务节点，同时该 nodemap 必须要开启 admin 和 trusted 属性。

## 2.1. 服务端

### 2.1.1. 添加 nodemap

```bash
lctl nodemap_add serversmap
```

### 2.1.2. 添加 NID

```bash
lctl nodemap_add_range --name serversmap --range 192.168.3.[11-13]@tcp
```

### 2.1.3. 修改属性

```bash
lctl nodemap_modify --name serversmap --property admin --value 1
lctl nodemap_modify --name serversmap --property trusted --value 1
```

## 2.2. 客户端

### 2.2.1. 添加 nodemap

```bash
lctl nodemap_add clientsmap
```

### 2.2.2. 添加 NID

```bash
lctl nodemap_add_range --name clientsmap --range 192.168.3.242@tcp
```

### 2.2.3. 添加 idmap

```bash
lctl nodemap_add_idmap --name clientsmap --idtype uid --idmap 1000:1001
lctl nodemap_add_idmap --name clientsmap --idtype gid --idmap 1000:1001
```

## 2.3. 激活 nodemap

```bash
lctl nodemap_activate 1
```

# 3. 操作

## 3.1. nodemap 相关操作

### 3.1.1. 查看所有的 nodemap

```bash
lctl nodemap_info
```

### 3.1.2. 查看 nodemap 所有属性

```bash
lctl get_param nodemap.clientsmap.*
```

`clientsmap`是 nodemap 的名字。

### 3.1.3. 删除 nodemap

```bash
lctl nodemap_del clientsmap
```

`clientsmap`是 nodemap 的名字。

### 3.1.4. 向 nodemap 中添加 NID

```bash
lctl nodemap_add_range --name clientsmap --range 192.168.3.243@tcp
```

`clientsmap`是 nodemap 的名字。
