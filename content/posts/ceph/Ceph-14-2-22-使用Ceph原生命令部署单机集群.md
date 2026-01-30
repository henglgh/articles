---
title: "[Ceph 14.2.22] 使用Ceph原生命令部署单机集群"
date: 2021-05-02T14:45:55+0800
description: "本文将介绍如何在 ubuntu 18.04 中使用 ceph 原生命令部署一个完整的 ceph 集群，ceph 版本为 14.2.22。"
tags: [ceph]
---

# 1. 前言

![os-recommend](https://img2024.cnblogs.com/blog/3757792/202601/3757792-20260117141136600-1186123787.png)

上表中是 Ceph 官方文档给出的 Ceph 14 版本的系统和内核推荐，其中在 centos 7、ubuntu 14.04、ubuntu 16.04、ubuntu 18.04 上都做了完整的测试。本文将介绍如何在 `ubuntu 18.04` 中使用 ceph 原生命令部署一个完整的 ceph 集群，ceph 版本为 `14.2.22`。

# 2. 环境配置

## 2.1. 关闭防火墙

```
systemctl stop ufw.service
systemctl disable ufw.service
```

## 2.2. 设置 ceph apt 源

为了加快下载速度，此处使用阿里云开源镜像站：

```bash
echo "deb [trusted=yes] https://mirrors.aliyun.com/ceph/debian-nautilus/ $(lsb_release -sc) main" > /etc/apt/sources.list.d/ceph.list
```

`trusted=yes` 表示临时禁用 GPG 验证，从而避免必须添加 ceph release.asc 密钥。

## 2.3. 更新

```bash
apt clean && apt update
```

# 3. 基础集群部署

<a id="基础集群规划"></a>

## 3.1. 基础集群规划

```ini
node name   node ip        component name
-------------------------------------------------
node0       192.168.3.10   [mon.a, mon.b, mon.c,
                            mgr.a, mgr.b, mgr.c,
                            osd.0, osd.1, osd.2]
```

上述集群中只有 node0 一个节点，该节点上会部署 3 个 mon 服务，3 个 mgr 服务，3 个 osd 服务。

## 3.2. 安装 ceph

```bash
apt install ceph ceph-mon ceph-mgr ceph-osd ceph-mds radosgw
```

## 3.3. 创建 client.admin key

在 Ceph 的 cephx 认证体系中，client.admin 是一个预定义的特殊用户，拥有对整个集群的完全访问权限，它可以执行几乎所有管理操作。没有 client.admin，你就没有一个默认的“root”账户来管理集群。换句话说，client.admin 是部署和运维的操作入口。

几乎所有 Ceph 命令行工具（如 ceph, rados, rbd, cephfs 等）在未指定用户时，默认尝试加载 client.admin 的密钥。ceph 14.2.22 中不会自动创建 client.admin key，必须手动创建。测试发现 client.admin key 必须在初始化 mon 之前就创建好，否则后续不好导入到 mon 的 auth 库中，导致 ceph 所有命令都无法使用。

```bash
ceph-authtool  /etc/ceph/keyring --create-keyring --gen-key -n client.admin \
  --cap mon 'allow *' \
  --cap osd 'allow *' \
  --cap mds 'allow *' \
  --cap mgr 'allow *'
```

除了 client.admin key 外，ceph 14.2.22 中会自动创建以下 bootstrap 系列的 key：

```bash
client.bootstrap-mds
  key: AQD7BW9p5/zTBRAApwYsv603jzAqC2HVZRulgw==
  caps: [mon] allow profile bootstrap-mds
client.bootstrap-mgr
  key: AQD7BW9pyyPUBRAAD+InmsW8kdJD7RaO9P64Fg==
  caps: [mon] allow profile bootstrap-mgr
client.bootstrap-osd
  key: AQD7BW9prkfUBRAAOQDCSLcQJv7KyuE7Shzscw==
  caps: [mon] allow profile bootstrap-osd
client.bootstrap-rbd
  key: AQD7BW9pHm/UBRAACRWOnAmiy2l64lIWDGIwgA==
  caps: [mon] allow profile bootstrap-rbd
client.bootstrap-rbd-mirror
  key: AQD7BW9po5LUBRAAQSyL0ES1DRxW9X0QdknyDQ==
  caps: [mon] allow profile bootstrap-rbd-mirror
client.bootstrap-rgw
  key: AQD7BW9pE7XUBRAAmG9hElRA2jb1ChRZ/gVkNQ==
  caps: [mon] allow profile bootstrap-rgw
```

## 3.4. 创建 mon

在部署集群时，必须先部署 mon，mon 是 Ceph 集群的大脑，责维护集群的全局状态信息，负责分发其他组件的通信密钥。所有其他组件在启动和加入集群时，必须与 mon 建立通信。只有 mon 就绪并形成 quorum 后，其他组件服务才能正确加入并协同工作。因此，在部署时必须优先创建 mon。

### 3.4.1. 创建 mon data

```bash
mkdir -p /var/lib/ceph/mon/mon.a
mkdir -p /var/lib/ceph/mon/mon.b
mkdir -p /var/lib/ceph/mon/mon.c
```

### 3.4.2. 创建 mon key

Ceph 通信机制中使用基于密钥的身份验证机制，mon 之间的通信也是如此。mon key 是整个集群信任体系的起点。如果没有预先生成 mon key，mon 将无法完成认证，也就无法形成初始 quorum，导致集群无法启动。虽然 Ceph 其他组件的密钥通常是由 mon 动态分发，但是 mon 自己的密钥不能从自己获取，必须在启动前静态生成。

```bash
ceph-authtool /etc/ceph/keyring --gen-key -n mon.  --cap mon 'allow *'
```

因为我将所有的 key 全部写入到同一个文件中：`/etc/ceph/keyring`，所以只在第一次创建 client.admin key 的时候，才使用 `--create-keyring` 参数，这个参数会新建一个 keyring 文件，不管这个文件之前有没有。所以在创建 mon key 的时候，就不再使用 `--create-keyring` 参数。后续创建其他组件 key 的过程也同样不在使用 `--create-keyring` 参数。

测试发现，在创建 mon key 的时候，mon name 必须是 `mon.`，不能是具体的 `mon.a` 这种形式，也不能单独为每个 mon 创建 key。

### 3.4.3. 创建 monmap

```bash
monmaptool --create --clobber  --fsid `uuidgen` /etc/ceph/monmap
monmaptool --add a 192.168.3.10:50000 /etc/ceph/monmap
monmaptool --add b 192.168.3.10:50001 /etc/ceph/monmap
monmaptool --add c 192.168.3.10:50002 /etc/ceph/monmap
```

monmap 创建好之后，可以使用 `monmaptool --print /etc/ceph/monmap` 命令来输出 monmap 内容。内容如下：

```bash
monmaptool: monmap file /etc/ceph/monmap
epoch 0
fsid a72e2d6e-a4b1-4543-a589-e1533607ee55
last_changed 2026-01-26 06:19:20.316869
created 2026-01-26 06:19:20.316869
min_mon_release 0 (unknown)
0: v2:192.168.3.10:50000/0 mon.a
1: v2:192.168.3.10:50001/0 mon.b
2: v2:192.168.3.10:50002/0 mon.c
```

### 3.4.4. 配置 mon

新建 `/etc/ceph/ceph.conf`，添加以下内容：

```ini
[global]
  fsid = a72e2d6e-a4b1-4543-a589-e1533607ee55
  mon host = [v2:192.168.3.10:50000] [v2:192.168.3.10:50001] [v2:192.168.3.10:50002]
  auth cluster required = cephx
  auth service required = cephx
  auth client required = cephx
  auth allow insecure global id reclaim = false

[mon.a]
  mon data = /var/lib/ceph/mon/mon.a

[mon.b]
  mon data = /var/lib/ceph/mon/mon.b

[mon.c]
  mon data = /var/lib/ceph/mon/mon.c
```

- 上述 `global` 配置中 `mon host` 的值必须和 `monmaptool  --add` 中匹配。
- 上述 `mon data` 是 mon data 目录，这个参数必须要添加，因为在后面初始化 mon data 的时候，如果不指定 mon data 路径，默认会使用 `/var/lib/ceph/mon/<cluster>-<id>`。

### 3.4.5. 初始化 mon data

```bash
ceph-mon --mkfs -i a --monmap=/etc/ceph/monmap --keyring=/etc/ceph/keyring
ceph-mon --mkfs -i b --monmap=/etc/ceph/monmap --keyring=/etc/ceph/keyring
ceph-mon --mkfs -i c --monmap=/etc/ceph/monmap --keyring=/etc/ceph/keyring
```

### 3.4.6. 修改 mon data 归属

```bash
chown -R ceph:ceph /var/lib/ceph/mon
```

### 3.4.7. 启动 mon

```bash
systemctl start ceph-mon@a.service
systemctl enable ceph-mon@a.service

systemctl start ceph-mon@b.service
systemctl enable ceph-mon@b.service

systemctl start ceph-mon@c.service
systemctl enable ceph-mon@c.service
```

至此，如果 mon 正常启动，`ceph -s` 命令可以正常执行并有结果输出。

```bash
ceph -s
---------
  cluster:
    id:     a72e2d6e-a4b1-4543-a589-e1533607ee55
    health: HEALTH_OK

  services:
    mon: 3 daemons, quorum a,b,c (age 6m)
    mgr: no daemons active
    osd: 0 osds: 0 up, 0 in

  data:
    pools:   0 pools, 0 pgs
    objects: 0 objects, 0 B
    usage:   0 B used, 0 B / 0 B avail
    pgs:
```

结果显示，当前集群中有 3 个 mon 服务，并且状态都是正常的。如果 `ceph -s` 命令没有输出结果或者卡住了，一定是部署失败了。可以在 ceph.conf 文件中 `global` 配置项添加 `debug ms = 1` 打开客户端调试功能查看问题。

## 3.5. 创建 mgr

### 3.5.1. 创建 mgr data

```bash
mkdir -p /var/lib/ceph/mgr/mgr.a
mkdir -p /var/lib/ceph/mgr/mgr.b
mkdir -p /var/lib/ceph/mgr/mgr.c
```

### 3.5.2. 配置 mgr

修改 `/etc/ceph/ceph.conf` 文件，添加以下内容：

```ini
[mgr.a]
  mgr data =/var/lib/ceph/mgr/mgr.a

[mgr.b]
  mgr data = /var/lib/ceph/mgr/mgr.b

[mgr.c]
  mgr data = /var/lib/ceph/mgr/mgr.c
```

### 3.5.3. 创建 mgr key

```bash
ceph-authtool /etc/ceph/keyring --gen-key -n mgr.a \
  --cap mon 'allow profile mgr' \
  --cap mds 'allow *' \
  --cap osd 'allow *'
ceph-authtool /etc/ceph/keyring --gen-key -n mgr.b \
  --cap mon 'allow profile mgr' \
  --cap mds 'allow *' \
  --cap osd 'allow *'
ceph-authtool /etc/ceph/keyring --gen-key -n mgr.c \
  --cap mon 'allow profile mgr' \
  --cap mds 'allow *' \
  --cap osd 'allow *'
```

### 3.5.4. 导入 mgr key 到 auth 库中

```bash
ceph auth add mgr.a -i /etc/ceph/keyring
ceph auth add mgr.b -i /etc/ceph/keyring
ceph auth add mgr.c -i /etc/ceph/keyring
```

导入 key 到 auth 库中的目的是为了执行 `ceph auth ls` 命令能够直接查看到。测试发现，在使用 `ceph-authtool` 工具创建 key 的时候，只有 mon 和 client 这两种类型的 key 能够自动添加到 ceph rados 对象中，其他类型的 key 需要手动导入。

### 3.5.5. 添加 mgr key 到 mgr data

```bash
ceph auth export mgr.a > /var/lib/ceph/mgr/mgr.a/keyring
ceph auth export mgr.b > /var/lib/ceph/mgr/mgr.b/keyring
ceph auth export mgr.c > /var/lib/ceph/mgr/mgr.c/keyring
```

### 3.5.6. 修改 mgr data 目录的归属

```bash
chown -R ceph:ceph /var/lib/ceph/mgr
```

### 3.5.7. 启动 mgr

```bash
systemctl start ceph-mgr@a.service
systemctl enable ceph-mgr@a.service

systemctl start ceph-mgr@b.service
systemctl enable ceph-mgr@b.service

systemctl start ceph-mgr@c.service
systemctl enable ceph-mgr@c.service
```

至此，mgr 服务已经完成部署，如果一切正常，使用 `ceph -s` 命令查看集群状态，可以看到 mgr 服务的信息。

```bash
ceph -s
---------
  cluster:
    id:     a72e2d6e-a4b1-4543-a589-e1533607ee55
    health: HEALTH_OK

  services:
    mon: 3 daemons, quorum a,b,c (age 7m)
    mgr: a(active, since 5s), standbys: b, c
    osd: 0 osds: 0 up, 0 in

  data:
    pools:   0 pools, 0 pgs
    objects: 0 objects, 0 B
    usage:   0 B used, 0 B / 0 B avail
    pgs:
```

结果显示，当前集群新增了 3 个 mgr 服务，主 mgr 服务是 mgr.a，备 mgr 服务是 mgr.c mgr.b，所有 mgr 服务状态都是正常的。

## 3.6. 创建 osd

> Ceph 支持 2 种存储引擎：`filestore` 和 `bluestore`。filestore 是一个过时的技术，在后续版本中逐渐被 Ceph 弃用，filestore 已经没有任何研究价值，因此本文默认以 `bluestore` 为准。

### 3.6.1. 创建 osd data

```bash
mkdir -p /var/lib/ceph/osd/osd.0
mkdir -p /var/lib/ceph/osd/osd.1
mkdir -p /var/lib/ceph/osd/osd.2
```

### 3.6.2. 挂载 osd data 为 tmpfs

```bash
mount -t tmpfs tmpfs /var/lib/ceph/osd/osd.0
mount -t tmpfs tmpfs /var/lib/ceph/osd/osd.1
mount -t tmpfs tmpfs /var/lib/ceph/osd/osd.2
```

### 3.6.3. 修改 osd block dev 归属

```bash
chown -R ceph:ceph /dev/sdb
chown -R ceph:ceph /dev/sdc
chown -R ceph:ceph /dev/sdd
```

### 3.6.4. 创建 osd block

```bash
ln -snf /dev/sdb /var/lib/ceph/osd/osd.0/block
ln -snf /dev/sdc /var/lib/ceph/osd/osd.1/block
ln -snf /dev/sdd /var/lib/ceph/osd/osd.2/block
```

### 3.6.5. 配置 osd

修改 `/etc/ceph/ceph.conf` 文件，添加以下内容：

```ini
[osd.0]
  osd objectstore = bluestore
  osd data = /var/lib/ceph/osd/osd.0
  crush_location = root=default host=virtual-node0

[osd.1]
  osd objectstore = bluestore
  osd data = /var/lib/ceph/osd/osd.1
  crush_location = root=default host=virtual-node1

[osd.2]
  osd objectstore = bluestore
  osd data = /var/lib/ceph/osd/osd.2
  crush_location = root=default host=virtual-node2
```

`crush_location` 是更改 osd 的 crush 位置，ceph 默认最小容灾域级别是 `host`，因为当前是在一台物理机上部署的，为了后续成功创建副本 pool，此时有必要更改。当然也可以在创建 pool 之前新建一个 crush rule 来自定义 crush 规则。

### 3.6.6. 创建 osd key

```bash
ceph-authtool /etc/ceph/keyring --gen-key -n osd.0 \
  --cap mon 'allow profile osd' \
  --cap mgr 'allow profile osd' \
  --cap osd 'allow *'
ceph-authtool /etc/ceph/keyring --gen-key -n osd.1 \
  --cap mon 'allow profile osd' \
  --cap mgr 'allow profile osd' \
  --cap osd 'allow *'
ceph-authtool /etc/ceph/keyring --gen-key -n osd.2 \
  --cap mon 'allow profile osd' \
  --cap mgr 'allow profile osd' \
  --cap osd 'allow *'
```

### 3.6.7. 导入 osd key 到 auth 库中

```bash
ceph auth add osd.0 -i /etc/ceph/keyring
ceph auth add osd.1 -i /etc/ceph/keyring
ceph auth add osd.2 -i /etc/ceph/keyring
```

### 3.6.8. 添加 osd key 到 osd data

```bash
ceph auth export osd.0 > /var/lib/ceph/osd/osd.0/keyring
ceph auth export osd.1 > /var/lib/ceph/osd/osd.1/keyring
ceph auth export osd.2 > /var/lib/ceph/osd/osd.2/keyring
```

### 3.6.9. 添加 osd key json 到 osd data

```bash
echo "{\"cephx_secret\": \"`ceph auth get-key osd.0`\"}" > /var/lib/ceph/osd/osd.0/keyring.json
echo "{\"cephx_secret\": \"`ceph auth get-key osd.1`\"}" > /var/lib/ceph/osd/osd.1/keyring.json
echo "{\"cephx_secret\": \"`ceph auth get-key osd.2`\"}" > /var/lib/ceph/osd/osd.2/keyring.json
```

### 3.6.10. 创建 osd 并初始化 osd data

```bash
uuid=`uuidgen`
ceph osd new $uuid 0 -i  /var/lib/ceph/osd/osd.0/keyring.json
ceph-osd -i 0 --mkfs --osd-uuid $uuid --keyring /var/lib/ceph/osd/osd.0/keyring

uuid=`uuidgen`
ceph osd new $uuid 1 -i  /var/lib/ceph/osd/osd.1/keyring.json
ceph-osd -i 1 --mkfs --osd-uuid $uuid --keyring /var/lib/ceph/osd/osd.1/keyring

uuid=`uuidgen`
ceph osd new $uuid 2 -i  /var/lib/ceph/osd/osd.2/keyring.json
ceph-osd -i 2 --mkfs --osd-uuid $uuid --keyring /var/lib/ceph/osd/osd.2/keyring
```

### 3.6.11. 修改 osd data 归属

```bash
chown -R ceph:ceph /var/lib/ceph/osd
```

### 3.6.12. 启动服务

```bash
systemctl start ceph-osd@0.service
systemctl enable ceph-osd@0.service

systemctl start ceph-osd@1.service
systemctl enable ceph-osd@1.service

systemctl start ceph-osd@2.service
systemctl enable ceph-osd@2.service
```

上述使用 `systemctl start ceph-osd@0.service` 方式启动 osd 服务时会失败，原因是 `/usr/lib/systemd/system/ceph-osd@.service` 文件会先执行 `/usr/lib/ceph/ceph-osd-prestart.sh` 脚本，在这个脚本中需要将 `data="/var/lib/ceph/osd/${cluster:-ceph}-$id"` 修改成实际 osd 目录 `data="/var/lib/ceph/osd/osd.$id"`。

> 以上创建 OSD 的所有过程都可以使用 `ceph-volume create` 这条命令一步完成，这条命令实际上也是一步步执行上面过程，之所以不使用 ceph-volume 工具，主要原因是 osd data 目录没法自定义。ceph-volume 已经将 osd data 目录写死成 `/var/lib/ceph/osd/${cluster:-ceph}-$id`。

<a id="基础集群状态"></a>

到此，一个简单的 Ceph 集群已经部署完成，使用`ceph -s`查看集群状态如下：

```bash
ceph -s
---------
  cluster:
    id:     a72e2d6e-a4b1-4543-a589-e1533607ee55
    health: HEALTH_OK

  services:
    mon: 3 daemons, quorum a,b,c (age 11m)
    mgr: a(active, since 4m), standbys: b, c
    osd: 3 osds: 3 up (since 7s), 3 in (since 7s)

  data:
    pools:   0 pools, 0 pgs
    objects: 0 objects, 0 B
    usage:   3.0 GiB used, 12 GiB / 15 GiB avail
    pgs:
```

结果显示，当前集群状态中新增了 3 个 osd 信息，而且所有的 osd 状态都正常。

# 4. 文件存储部署

## 4.1. 文件存储集群规划

```ini
node name   node ip        component name
-------------------------------------------------
node0       192.168.3.10   [mon.a, mon.b, mon.c,
                            mgr.a, mgr.b, mgr.c,
                            mds.a, mds.b, mds.c,
                            osd.0, osd.1, osd.2]
```

上述集群规划是在前文 [基础集群规划](#基础集群规划) 的基础上增加了 3 个 mds 服务。

## 4.2. 创建 mds

### 4.2.1. 创建 mds data

```bash
mkdir -p /var/lib/ceph/mds/mds.a
mkdir -p /var/lib/ceph/mds/mds.b
mkdir -p /var/lib/ceph/mds/mds.c
```

### 4.2.2. 配置 mds

修改 `/etc/ceph/ceph.conf` 文件，添加以下内容：

```ini
[mds.a]
  mds data =/var/lib/ceph/mds/mds.a

[mds.b]
  mds data =/var/lib/ceph/mds/mds.b

[mds.c]
  mds data =/var/lib/ceph/mds/mds.c
```

### 4.2.3. 创建 mds key

```bash
ceph-authtool  /etc/ceph/keyring --gen-key -n mds.a \
  --cap mon 'allow profile mds' \
  --cap osd 'allow *' \
  --cap mds 'allow' \
  --cap mgr 'allow profile mds'
ceph-authtool  /etc/ceph/keyring --gen-key -n mds.b \
  --cap mon 'allow profile mds' \
  --cap osd 'allow *' \
  --cap mds 'allow' \
  --cap mgr 'allow profile mds'
ceph-authtool  /etc/ceph/keyring --gen-key -n mds.c \
  --cap mon 'allow profile mds' \
  --cap osd 'allow *' \
  --cap mds 'allow' \
  --cap mgr 'allow profile mds'
```

### 4.2.4. 导入 mds key 到 auth 库中

```bash
ceph auth add mds.a -i /etc/ceph/keyring
ceph auth add mds.b -i /etc/ceph/keyring
ceph auth add mds.c -i /etc/ceph/keyring
```

### 4.2.5. 添加 mds key 到 mds data

```bash
ceph auth export mds.a > /var/lib/ceph/mds/mds.a/keyring
ceph auth export mds.b > /var/lib/ceph/mds/mds.b/keyring
ceph auth export mds.c > /var/lib/ceph/mds/mds.c/keyring
```

### 4.2.6. 修改 mds data 归属

```bash
chown -R ceph:ceph /var/lib/ceph/mds
```

### 4.2.7. 启动 mds

```bash
systemctl start ceph-mds@a.service
systemctl enable ceph-mds@a.service

systemctl start ceph-mds@b.service
systemctl enable ceph-mds@b.service

systemctl start ceph-mds@c.service
systemctl enable ceph-mds@c.service
```

> mds 服务正常启动后，不会在 ceph -s 结果中立即显示。必须要成功创建一个文件系统后，才会在 ceph -s 结果中显示出来。

## 4.3. 创建存储池

ceph 的文件系统在架构设计上将文件的数据和文件的元数据分开存储，因此需要创建 2 个存储池：data pool 和 metadata pool。data pool 用于存储文件的数据，matadata pool 用于存储文件的元数据。

### 4.3.1. 创建 data pool

```bash
ceph osd pool create cephfs_data 1 1
```

上述命令将创建一个名为 `cephfs_data` 的存储池，其中 `1 1` 分别表示 pg 和 pgp 的数量，因为是测试，所以都设置为 1。

### 4.3.2. 创建 metadata pool

```bash
ceph osd pool create cephfs_metadata 1 1
```

上述命令将创建一个名为 `cephfs_metadata` 的存储池，其中 `1 1` 分别表示 pg 和 pgp 的数量，因为是测试，所以都设置为 1。

## 4.4. 创建文件系统

```bash
ceph fs new cephfs cephfs_metadata cephfs_data
```

上述命令将会创建一个名为 `cephfs` 的文件系统（也可以理解成文件系统的一个命名空间），元数据池一定要写在数据池之前。创建好的文件系统可以通过 `ceph fs ls` 命令查看。

再次查看集群状态：

```bash
ceph -s
---------
  cluster:
    id:     a72e2d6e-a4b1-4543-a589-e1533607ee55
    health: HEALTH_OK

  services:
    mon: 3 daemons, quorum a,b,c (age 105m)
    mgr: a(active, since 99m), standbys: b, c
    mds: cephfs:1 {0=a=up:active} 2 up:standby
    osd: 3 osds: 3 up (since 44m), 3 in (since 84m)

  data:
    pools:   2 pools, 2 pgs
    objects: 22 objects, 2.2 KiB
    usage:   3.0 GiB used, 12 GiB / 15 GiB avail
    pgs:     2 active+clean
```

结果显示，相对于 [基础集群状态](#基础集群状态) 而言，文件系统存储集群的状态中新增了 3 个 mds 服务，新增了 2 个 pool。

## 4.5. 使用文件系统

文件系统使用的方式比较单一：在需要使用 Ceph 文件存储系统的客户端上挂载 cephfs 到挂载目录，然后向操作普通目录一样读写文件。Linux 挂载 Ceph 文件系统有 2 种方式：内核态和用户态。本文采用用户态方式（ceph-fuse）挂载。

### 4.5.1. 挂载文件系统

实际上应该在客户端节点上来挂载 cephfs。本文为了测试，就直接复用集群节点。

在 node0 节点上执行以下命令：

```bash
ceph-fuse -m 192.168.3.10 /mnt/cephfs
```

上述命令默认是以 client.admin 用户来挂载的，也可以通过 `-n` 参数来指定使用 Ceph 哪个用户来挂载。但无论是使用谁，必须要确保客户端节点的/etc/ceph 目录下有 ceph 的 config 和 keyring 文件，否则无法与 mon 建立连接。

至此，就可以在 /mnt/cephfs 目录下正常读写文件。

# 5. 对象存储部署

## 5.1. 对象存储集群规划

```ini
node name   node ip        component name
-------------------------------------------------
node0       192.168.3.10   [mon.a, mon.b, mon.c,
                            mgr.a, mgr.b, mgr.c,
                            rgw.a, rgw.b, rgw.c,
                            osd.0, osd.1, osd.2]
```

上述集群规划是在前文 [基础集群规划](#基础集群规划) 的基础上增加了 3 个 rgw 服务。

## 5.2. 创建 rgw

### 5.2.1. 创建 rgw data

```bash
mkdir -p /var/lib/ceph/rgw/rgw.a
mkdir -p /var/lib/ceph/rgw/rgw.b
mkdir -p /var/lib/ceph/rgw/rgw.c
```

### 5.2.2. 配置 rgw

**配置 admin_socket**

在 ceph 14 版本中，可以使用 `ceph daemon` 命令来查看运行中的 ceph 服务的所有配置，比如 `ceph daemon osd.0 show`。该命令能自动查找本地 `/var/run/ceph/` 目录下的相匹配的 socket 进程，虽然 rgw 服务的 socket 进程文件也在该目录下，但是 ceph daemon 命令无法自动识别，每次使用时必须要手动指定 rgw socket 文件完整路径。为了避免这种情况，可以在配置文件中直接指定，然后可以不用手动指定 rgw socket 文件路径就可以使用了。

修改 `/etc/ceph/ceph.conf` 文件，添加以下内容：

```ini
[client.rgw.a]
  admin_socket = /var/run/ceph/ceph-client.rgw.a.asok
  rgw data =/var/lib/ceph/rgw/rgw.a

[client.rgw.b]
  admin_socket = /var/run/ceph/ceph-client.rgw.b.asok
  rgw data =/var/lib/ceph/rgw/rgw.b

[client.rgw.c]
  admin_socket = /var/run/ceph/ceph-client.rgw.c.asok
  rgw data =/var/lib/ceph/rgw/rgw.c
```

**配置 rgw_frontends**

在 Ceph 14 版本中，rgw 支持 2 种 HTTP 前端来提供对象存储 web 服务，分别是 `civetweb` 和 `beast`。CivetWeb 是一个轻量级的嵌入式 Web 服务器，功能相对简单，性能在高并发场景下不如 Beast。Beast 是基于 Boost.Beast 库的新一代 HTTP 前端，旨在替代 CivetWeb。Beast 提供更完善的 TLS/SSL 支持，支持更高的并发性能和更低的延迟，更适合生产环境。默认情况下 Ceph 14.2.22 中的 rgw 采用 beast 作为 web 服务，端口为 7480。如果有需要，可以通过修改 `/etc/ceph/ceph.conf` 文件来指定 rgw 使用哪种 web 服务，此处以 `civetweb` 为案例：

```ini
[client.rgw.a]
  rgw frontends = "civetweb port=7480"

[client.rgw.b]
  rgw frontends = "civetweb port=7481"

[client.rgw.c]
  rgw frontends = "civetweb port=7482"
```

因为是在一个节点上部署多个 rgw，所以必须要让多个 rgw web 使用不同的端口。

### 5.2.3. 创建 rgw key

```bash
ceph-authtool  /etc/ceph/keyring --gen-key -n client.rgw.a \
  --cap mon 'allow rw' \
  --cap osd 'allow rwx' \
  --cap mgr 'allow rw'
ceph-authtool  /etc/ceph/keyring --gen-key -n client.rgw.b \
  --cap mon 'allow rw' \
  --cap osd 'allow rwx' \
  --cap mgr 'allow rw'
ceph-authtool  /etc/ceph/keyring --gen-key -n client.rgw.c \
  --cap mon 'allow rw' \
  --cap osd 'allow rwx' \
  --cap mgr 'allow rw'
```

测试发现，rgw 的 name 必须是以 `client.` 为前缀。因为 ceph 中没有 `rgw` 这个类别，类别只有 `auth, mon, osd, mds, mgr, client` 这几种。

### 5.2.4. 导入 rgw key 到 auth 库中

```bash
ceph auth add client.rgw.a -i /etc/ceph/keyring
ceph auth add client.rgw.b -i /etc/ceph/keyring
ceph auth add client.rgw.c -i /etc/ceph/keyring
```

### 5.2.5. 添加 rgw key 到 rgw data

```bash
ceph auth export client.rgw.a > /var/lib/ceph/rgw/rgw.a/keyring
ceph auth export client.rgw.b > /var/lib/ceph/rgw/rgw.b/keyring
ceph auth export client.rgw.c > /var/lib/ceph/rgw/rgw.c/keyring
```

### 5.2.6. 修改 rgw data 归属

```bash
chown -R ceph:ceph /var/lib/ceph/rgw
```

### 5.2.7. 启动 rgw

```bash
systemctl start ceph-radosgw@rgw.a.service
systemctl enable ceph-radosgw@rgw.a.service

systemctl start ceph-radosgw@rgw.b.service
systemctl enable ceph-radosgw@rgw.b.service

systemctl start ceph-radosgw@rgw.c.service
systemctl enable ceph-radosgw@rgw.c.service
```

默认情况下，启动 rgw 服务后，会自动创建与 rgw 服务相关的 pool。再次查看集群状态：

```bash
ceph -s
---------
  cluster:
    id:     a72e2d6e-a4b1-4543-a589-e1533607ee55
    health: HEALTH_OK

  services:
    mon: 3 daemons, quorum a,b,c (age 16m)
    mgr: a(active, since 8m), standbys: b, c
    osd: 3 osds: 3 up (since 4m), 3 in (since 4m)
    rgw: 3 daemons active (a, b, c)

  task status:

  data:
    pools:   4 pools, 128 pgs
    objects: 187 objects, 1.2 KiB
    usage:   3.0 GiB used, 12 GiB / 15 GiB avail
    pgs:     128 active+clean
```

结果显示，相对于 [基础集群状态](#基础集群状态) 而言，对象存储集群的状态中新增了 3 个 rgw 服务，3 个 rgw 的状态都是正常的。除此之外，还新增了 4 个 pool。

### 5.2.8. 测试访问

```bash
curl http://192.168.3.10:7480
------------------------
<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <0wner>
    <ID>anonymous</ID>
    <DisplayName></DisplayName>
  </0wner>
    <Buckets></Buckets>
</ListALLMyBucketsResult>
```

上述结果表示访问 rgw web 服务时，可以正常收到回应，也就说明对象存储集群 web 服务可以正常对外提供服务。

## 5.3. 使用对象存储

Ceph 的对象存储在架构上设计区别于文件系统和块存储，其目的为海量、非结构化、高持久性、跨网络共享的数据而生。它不能像文件系统一样直接在本地挂载使用，因为它放弃了目录树和随机读写能力，采用扁平化方式来存储对象，以达到无限扩展性和简单性。“本地直接访问”违背对象存储的设计哲学：它的价值在于分布式、持久化、低成本地存储海量非结构化数据，而不是提供低延迟本地 I/O。

另外，HTTP 是无状态协议，rgw 实例可以水平扩展，请求可被任意节点处理。HTTP 的请求-响应模型天然适合这种“一次传完”的模式。其次，AWS S3 定义了对象存储的事实标准，几乎所有的对象存储客户端都支持 S3 协议，因此 Cpeh rgw 实现了 S3 接口，其目的就是为了无缝融入现有生态。

所以 Ceph 对象存储的使用应该要遵循 S3 协议。

### 5.3.1. 创建 s3 用户

```bash
radosgw-admin user create --uid=s3user --display-name=s3user --access-key s3user123 --secret s3user123
```

上述命令将会创建名为 s3user 的对象存储用户。其中 `--uid` 的值是用户名，`--display-name` 的值是对外显示的用户名。`--access-key` 和 `--secret` 参数用于设置 key，这两个参数不是必须的。

### 5.3.2. 访问对象存储

有很多对象存储客户端工具，比如 s3cmd、s3browser。s3browser 是最常用的 windows 工具，本文也将以 s3browser 为案例。

**添加 s3 用户**

![adduser](https://img2024.cnblogs.com/blog/3757792/202601/3757792-20260125153348954-1950584652.png)

- `display name`：s3browser 工具中显示的用户名，随便写，不一定要和上述创建的用户名一样！
- `account type`：必须要选则 s3 compatible storage！
- `rest endpot`：rgw 对外提供 web 服务的地址，一般是主 rgw 的 ip 地址和端口号，端口号不能缺少！
- `access key id` 和 `secret access key`一定要和上述创建用户时的一一对应。

**添加 bucket**

![addbucket](https://img2024.cnblogs.com/blog/3757792/202601/3757792-20260125153353845-648105144.png)

bucket 名字随便写，没有规范和要求。

**上传文件**

![upfile](https://img2024.cnblogs.com/blog/3757792/202601/3757792-20260125153356548-1070392758.png)

如果上述都没有任何问题，那就表示当前对象存储集群正常，客户端与存储集群连接正常，客户端可以正常读写文件。

# 6. 块存储部署

## 6.1. 创建 rbd pool

```bash
ceph osd pool create rbd_pool 1 1
```

上述命令将创建一个名为 `rbd_pool` 的存储池，其中`1 1`分别是 pg 和 pgp 的数量，因为是测试集群，所以都设置为 1。可以通过 `ceph osd pool ls detail` 命令查看存储池的详细信息。

## 6.2. 创建 rbd image

```bash
rbd create --pool rbd_pool --image image1 --size 1024 --image-format 2 --image-feature layering
```

上述命令将在名为 `rbd_pool` 的存储池中划出 1024 字节大小的存储空间来创建为名 `image1` 的 rbd image。可以使用 `rbd ls rbd_pool` 命令来查看 rbd_pool 中已经创建了哪些 rbd image。

## 6.3. 使用 rbd image

rbd image 最普通的使用场景是在客户端节点上将 image 映射成内核块设备，这样就可以像使用磁盘一样来使用 rbd image。

### 6.3.1. 映射 rbd image 到系统块设备

实际上应该在客户端节点上来映射 rbd image。本文为了测试，就直接复用集群节点。

在 node0 节点上执行以下命令：

```bash
rbd map --pool rbd_pool --image image1
```

可以通过 `rbd showmapped` 命令来查看 rbd image 被映射成的内核块设备的名字是什么。

```bash
rbd showmapped
----------------
id     pool        namespace     image      snap     device
0      rbd_pool                  image1     -        /dev/rbd0
```

从结果显示 rbd_pool 数据池中的镜像 image1 已经被映射到成一个名为 `rbd0` 的内核块设备。

### 6.3.2. 格式化 rbd 块设备

在 node0 节点上执行以下命令：

```bash
mkfs.ext4 -m0 /dev/rbd0
```

### 6.3.3. 挂载 rbd 块设备

在 node0 节点上执行以下命令：

```bash
mount /dev/rbd0 /mnt/rbd
```

其中`/mnt/rbd`是挂载路径。至此，就可以在 /mnt/rbd 目录下正常读写文件。

# 7. 参考资料

- [https://docs.ceph.com/en/nautilus/start/os-recommendations](https://docs.ceph.com/en/nautilus/start/os-recommendations/)
- [https://docs.ceph.com/en/nautilus/install](https://docs.ceph.com/en/nautilus/install)
