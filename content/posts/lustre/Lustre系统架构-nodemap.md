---
title: Lustre系统架构-nodemap
date: 2021-07-06T10:27:14+0800
description: "本文介绍Lustre 2.15.4的nodemap功能和使用方法。"
tags: [lustre]
---

> lustre版本：2.15.4

# 1. 简介
HSM（Hierarchical Storage Management）是一种分层存储管理方案。在这种分层存储管理方案中，lustre文件系统与其他文件系统绑定，lustre文件系统充当高速缓存层，其他文件系统充当低速存储层。

在使用上，客户端挂载lustre文件系统并将文件写入到lustre文件系统中，lustre文件系统可以将文件同步到其他文件系统中（目前lustre只能手动flush文件到其他文件系统，无法自动），所有的文件元数据信息由lustre文件系统管理，即便是文件已经从高速缓存层文件系统flush到低速存储层文件系统中。

当客户端读写修改文件时，如果高速缓存层文件系统中文件数据已经不存在，会触发HSM从低速存储层文件系统中拷贝数据到高速缓存层文件系统中。这个过程是由lustre agent完成。agent是运行在客户端的进程，负责高速缓存层文件系统和低速存储层文件系统之间的数据迁移。

&nbsp;
&nbsp;
# 2. 实战
## 2.1. 服务端
### 2.1.1. 启动hsm功能
启动hsm功能，需要在mgs服务所在的节点执行，并且所有mds服务的`hsm_control`参数都必须设置为`enabled`。
```bash
lctl set_param mdt.fs00-MDT0000.hsm_control=enabled
```

## 2.2. 客户端
### 2.2.1. 启动agent
启动agent进程需要在客户端执行，一旦启动成功，进程会在后台运行。
```bash
lhsmtool_posix --daemon --hsm-root /mnt/fs01-3.11/ --archive=1 /mnt/fs00-3.11/
```
`/mnt/fs01-3.11/`是低速存储层文件系统在客户端挂载的目录，`/mnt/fs00-3.11/`是高速缓存层文件系统在客户端挂载的目录。

`--archive=1`是低速存储层文件系统在高速缓存层文件系统中的id，默认值是1。在HSM中，高速缓存层文件系统可以同时绑定多个低速存储层文件系统，必须为每一个低速存储层文件系统分配不同的id。id的范围只能在1-32之间。

### 2.2.2. 文件归档
```bash
lfs hsm_archive --archive=1 /mnt/fs00-3.11/test
-----------------------------------------------
lhsmtool_posix[26717]: copytool fs=fs00 archive#=1 item_count=1
lhsmtool_posix[26717]: waiting for message from kernel
lhsmtool_posix[26719]: [0x200000401:0x4:0x0] action ARCHIVE reclen 72, cookie=0x659d1265
lhsmtool_posix[26719]: processing file 'test'
lhsmtool_posix[26719]: archiving '/mnt/fs00-3.11//.lustre/fid/0x200000401:0x4:0x0' to '/mnt/fs01-3.11//0004/0000/0401/0000/0002/0000/0x200000401:0x4:0x0_tmp'
lhsmtool_posix[26719]: saving stripe info of '/mnt/fs00-3.11//.lustre/fid/0x200000401:0x4:0x0' in /mnt/fs01-3.11//0004/0000/0401/0000/0002/0000/0x200000401:0x4:0x0_tmp.lov
lhsmtool_posix[26719]: start copy of 216 bytes from '/mnt/fs00-3.11//.lustre/fid/0x200000401:0x4:0x0' to '/mnt/fs01-3.11//0004/0000/0401/0000/0002/0000/0x200000401:0x4:0x0_tmp'
lhsmtool_posix[26719]: copied 216 bytes in 0.005957 seconds
lhsmtool_posix[26719]: data archiving for '/mnt/fs00-3.11//.lustre/fid/0x200000401:0x4:0x0' to '/mnt/fs01-3.11//0004/0000/0401/0000/0002/0000/0x200000401:0x4:0x0_tmp' done
lhsmtool_posix[26719]: attr file for '/mnt/fs00-3.11//.lustre/fid/0x200000401:0x4:0x0' saved to archive '/mnt/fs01-3.11//0004/0000/0401/0000/0002/0000/0x200000401:0x4:0x0_tmp'
lhsmtool_posix[26719]: fsetxattr of 'trusted.hsm' on '/mnt/fs01-3.11//0004/0000/0401/0000/0002/0000/0x200000401:0x4:0x0_tmp' rc=0 (Success)
lhsmtool_posix[26719]: fsetxattr of 'trusted.link' on '/mnt/fs01-3.11//0004/0000/0401/0000/0002/0000/0x200000401:0x4:0x0_tmp' rc=0 (Success)
lhsmtool_posix[26719]: fsetxattr of 'trusted.lov' on '/mnt/fs01-3.11//0004/0000/0401/0000/0002/0000/0x200000401:0x4:0x0_tmp' rc=0 (Success)
lhsmtool_posix[26719]: fsetxattr of 'trusted.lma' on '/mnt/fs01-3.11//0004/0000/0401/0000/0002/0000/0x200000401:0x4:0x0_tmp' rc=0 (Success)
lhsmtool_posix[26719]: fsetxattr of 'lustre.lov' on '/mnt/fs01-3.11//0004/0000/0401/0000/0002/0000/0x200000401:0x4:0x0_tmp' rc=0 (Success)
lhsmtool_posix[26719]: xattr file for '/mnt/fs00-3.11//.lustre/fid/0x200000401:0x4:0x0' saved to archive '/mnt/fs01-3.11//0004/0000/0401/0000/0002/0000/0x200000401:0x4:0x0_tmp'
lhsmtool_posix[26719]: symlink '/mnt/fs01-3.11//shadow/test' already pointing to '../0004/0000/0401/0000/0002/0000/0x200000401:0x4:0x0'
lhsmtool_posix[26719]: Action completed, notifying coordinator cookie=0x659d1265, FID=[0x200000401:0x4:0x0], hp_flags=0 err=0
lhsmtool_posix[26719]: llapi_hsm_action_end() on '/mnt/fs00-3.11//.lustre/fid/0x200000401:0x4:0x0' ok (rc=0)
```
`/mnt/fs00-3.11/test`是需要flush的文件，`--archive=1`指定要将缓存层文件flush到哪个低速存储层文件系统。从日志可以看到flush操作并不会删除缓存层文件系统中的文件，只是将文件数据拷贝到低速存储层文件系统中。同时也可以看到被flush的文件在低速缓存层文件系统中是条带的形式存在。比如`/mnt/fs01-3.11/0004/0000/0401/0000/0002/0000/0x200000401:0x4:0x0`。

### 2.2.3. 查看文件状态
```bash
lfs hsm_state /mnt/fs00-3.11/test
---------------------------------
/mnt/fs00-3.11/test: (0x00000009) exists archived, archive_id:1
```
`/mnt/fs00-3.11/test`是缓存层文件系统中的文件。上面结果显示`/mnt/fs00-3.11/test`已经被flush到低速存储层文件系统中。

&nbsp;
&nbsp;
# 3. 操作
## 3.1. 服务端
### 3.1.1. 查看hsm所有参数
```bash
lctl get_param mdt.fs00-MDT0000.hsm.*
-------------------------------------
mdt.fs00-MDT0000.hsm.active_request_timeout=3600
mdt.fs00-MDT0000.hsm.archive_count=0
mdt.fs00-MDT0000.hsm.default_archive_id=1
mdt.fs00-MDT0000.hsm.grace_delay=60
mdt.fs00-MDT0000.hsm.loop_period=10
mdt.fs00-MDT0000.hsm.max_requests=3
mdt.fs00-MDT0000.hsm.remove_archive_on_last_unlink=0
mdt.fs00-MDT0000.hsm.remove_count=0
mdt.fs00-MDT0000.hsm.restore_count=0
mdt.fs00-MDT0000.hsm.agents=
uuid=d19dc2fe-cec4-43a1-8996-c783b3a70e63 archive_id=1 requests=[current:0 ok:10 errors:0]
mdt.fs00-MDT0000.hsm.group_request_mask=RESTORE
mdt.fs00-MDT0000.hsm.other_request_mask=RESTORE
mdt.fs00-MDT0000.hsm.policy=NonBlockingRestore [NoRetryAction]
mdt.fs00-MDT0000.hsm.user_request_mask=RESTORE
```

## 3.2. 客户端
### 3.2.1. 文件归档
```bash
lfs hsm_archive --archive=1 /mnt/fs00-3.11/test
```
`/mnt/fs00-3.11/test`是缓存层文件系统中的文件。

### 3.2.2. 从缓存层释放文件数据
```bash
lfs hsm_release /mnt/fs00-3.11/test
```
`/mnt/fs00-3.11/test`是缓存层文件系统中的文件。

### 3.2.3. 恢复缓存层文件数据
```bash
lfs hsm_restore /mnt/fs00-3.11/test
```
`/mnt/fs00-3.11/test`是缓存层文件系统中的文件。

### 3.2.4. 从存储层删除文件
```bash
lfs hsm_remove /mnt/fs00-3.11/test
```
`/mnt/fs00-3.11/test`是缓存层文件系统中的文件。