---
title: ceph对象存储部署
date: 2024-12-09T14:48:19+0800
description: "本文介绍如何部署ceph对象存储系统，并使用ceph对象存储系统。"
tags: [ceph]
---


# 1. 前言
本文介绍如何部署ceph对象存储系统，并使用ceph对象存储系统。系统环境如下：
```bash
ceph:           14.2.22
linux os:       ubuntu 18.04
```
本文默认已经提前部署ceph集群，如果没有部署，请参考[ceph集群部署deploy多机模式]({{< ref "ceph集群部署deploy多机模式.md" >}})。

&nbsp;
&nbsp;
# 2. 集群规划
```bash
mon             192.168.3.11      node1
mgr             192.168.3.11      node1
rgw             192.168.3.11      node1
osd.0           192.168.3.11      node1
osd.1           192.168.3.12      node2
osd.2           192.168.3.13      node3
ceph-delpoy     192.168.3.10      node0
```
在ceph集群中，安装了ceph软件的并且部署了一系列ceph集群服务的主机被称之为ceph集群节点，上图中的node0虽然属于管理节点，但它并不属于ceph集群，它没有安装任何ceph软件，也没有部署任何ceph集群服务。

&nbsp;
&nbsp;
# 3. 对象存储集群部署
### 3.1. 创建rgw服务
在集群节点(node1)上执行以下命令：
```bash
ceph-deploy --overwrite-conf rgw create node1
```
其中`node1`为集群节点的hostname，该命令将在node1节点上安装rgw服务相关软件。

### 3.2. 配置rgw
默认情况下rgw采用beast作为网络服务，端口为7480。此处修改成使用`civetweb`作为前端服务。
修改集群节点（node1）的`/etc/ceph/ceph.conf`文件：
```bash
[client.rgw.node]
rgw_frontends = "civetweb port=192.168.3.11:7480"
```
其中`client.rgw.node`为rados用户名字，用户类型为rgw，node为rgw的名字，可以通过 `ceph auth ls` 命令获取。

### 3.3. 重启rgw服务
在集群节点(node1)上执行以下命令：
```bash
systemctl restart ceph-radosgw.target
```
### 3.4. 关闭防火墙
在集群节点(node1)上执行以下命令：
```bash
systemctl stop firewalld.service
```
### 3.5. 测试访问
在集群节点(node1)上执行以下命令：
```bash
curl http://node1:7480
-----------------------------------------------------------------------------------------------------------------------
<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
	<0wner>
		<ID>anonymous</ID>
		<DisplayName></DisplayName>
	</0wner>
		<Buckets></Buckets>
</ListALLMyBucketsResult>
```

&nbsp;
# 4. 使用对象存储
### 4.1. 创建s3用户
在集群节点(node1)上执行以下命令：
```bash
radosgw-admin user create --uid=s3user --display-name=s3user
-----------------------------------------------------------------------------------------------------------------------
{
    "user_id": "s3user",
    "display_name": "s3user",
    "email": "",
    "suspended": 0,
    "max_buckets": 1000,
    "subusers": [],
    "keys": [
        {
            "user": "s3user",
            "access_key": "NT9IDJLORAK7OU73JEMA",
            "secret_key": "S6PjcSPICnFUxDpBYH4Elr8cwBwCs11R3ZXMHfhi"
        }
    ],
    "swift_keys": [],
    "caps": [],
    "op_mask": "read, write, delete",
    "default_placement": "",
    "default_storage_class": "",
    "placement_tags": [],
    "bucket_quota": {
        "enabled": false,
        "check_on_raw": false,
        "max_size": -1,
        "max_size_kb": 0,
        "max_objects": -1
    },
    "user_quota": {
        "enabled": false,
        "check_on_raw": false,
        "max_size": -1,
        "max_size_kb": 0,
        "max_objects": -1
    },
    "temp_url_keys": [],
    "type": "rgw",
    "mfa_ids": []
}
```
上述命令中`--uid`的值是用户名，`--display-name`的值是对外显示的用户名。该命令将会创建名为s3user的对象存储用户，并初始化该用户信息，需要记住上面用户的`access_key`和`secret_key`，后面配置s3cmd时需要用到。

### 4.2. 安装s3cmd命令行工具
在集群节点(node1)上执行以下命令：
```bash
apt install s3cmd
```

### 4.3. 配置s3cmd
在集群节点(node1)上执行以下命令：
```bash
s3cmd --configure
-----------------------------------------------------------------------------------------------------------------------
Enter new values or accept defaults in brackets with Enter.
Refer to user manual for detailed description of all options.
Access key and Secret key are your identifiers for Amazon S3. Leave them empty for using the env variables.
Access Key: NT9IDJLORAK7OU73JEMA
Secret Key: S6PjcSPICnFUxDpBYH4Elr8cwBwCs11R3ZXMHfhi
Default Region [US] :
Encryption password is used to protect your files from reading
by unauthorized persons while in transfer to S3 
Encryption password:
Path to GPG program [/usr/bin/gpg]:
When using secure HTTPS protocol all Communication with Amazon S3
servers is protected from 3rd party eavesdropping. This method is
slower than plain HTTP, and can only be proxied with Python 2.7 or newer
Use HTTPS protocol [Yes] : no
On some networks all internet access must go through a HTTP proxy.
Try setting it here if you can't connect to S3 directly
HTTP Proxy server name :
New settings :
Access Key:
Secret Key:
Default Region: US
Encryption password:
Path to GPG program: /usr/bin/gpg
Use HTTPS protocol: False
HTTP Proxy server name:
HTTP Proxy server port: 0
```
s3cmd配置过程需要重点留意`access_key`和`secret_key`，该选项必须和前面创建用户生成的key保持一致。

### 4.4. 修改s3配置文件
s3的配置文件放在`/root/.s3cfg`中，主要修改`host_base`和`host_bucket`，需要配置为rgw服务端的ip地址。
修改集群节点(node1)的`/root/.s3cfg`文件内容：
```bash
gpg_passphrase =
guess_mime_type = True
host_base = 192.168.3.11
host_bucket = 192.168.3.11
human_readable_sizes = False
invalidate_default_index_on_cf = False
invalidate_default_index_root_on_cf = True
invalidate_on_cf = False
```

### 4.5. 创建bucket
在集群节点(node1)上执行以下命令：
```bash
s3cmd mb s3://bucket1
```
其中`bucket1`是桶的名字。

### 4.6. 上传文件
在集群节点(node1)上执行以下命令：
```bash
s3cmd put abc s3://bucket1
```
其中`abc`为本地文件的名字，`bucket1`是对象存储系统中已经存在的桶的名字，该命令将会把abc文件存储到bucket1中。

### 4.7. 查看集群I/O读写状态
在集群节点(node1)上执行以下命令：
```bash
ceph -s
-----------------------------------------------------------------------------------------------------------------------
cluster :
	id:		e7406bb4-35c7-420b-a04a-991510c7f143
	health: HEALTH 0K
services :
	mon: 1 daemons, quorum node (age 51m)
	mgr: node (active, since 60m)
	mds: cephfs:1 {0=node=up:active}
	osd: 3 osds: 3 up (since 58m)， 3 in (since 58m)
data:
	pools:	 2 pools, 2 pgs
	objects: 23 objects, 7.4 KiB
	usage:   3.0 GiB used, 27 GiB / 30 GiB avail
	pgs :	 2 active+clean
io:
	client:	 426 B/s wr, 0 op/s rd, 0 op/s wr
```

### 4.8. 查看存储池使用状况
在集群节点(node1)上执行以下命令：
```bash
ceph df 
-----------------------------------------------------------------------------------------------------------------------
RAW STORAGE:
    CLASS     SIZE       AVAIL      USED        RAW USED     %RAW USED 
    hdd       30 GiB     27 GiB     122 MiB      3.1 MiB         10.40 
    TOTAL     30 GiB     27 GiB     122 MiB      3.1 MiB         10.40 
 
POOLS:
    POOL                          ID     PGS     STORED      OBJECTS     USED        %USED     MAX AVAIL 
    .rgw.root                      1      32     1.2 KiB           4     768 KiB         0       8.5 GiB 
    default.rgw.control            2      32         0 B           8         0 B         0       8.5 GiB 
    default.rgw.meta               3      32       805 B           5     768 KiB         0       8.5 GiB 
    default.rgw.log                4      32         0 B         175         0 B         0       8.5 GiB 
    default.rgw.buckets.index      5      32         0 B           1         0 B         0       8.5 GiB 
    default.rgw.buckets.data       6      32         4 B           1     192 KiB         0       8.5 GiB 
```

### 4.9. 查看池存储中的对象
在集群节点(node1)上执行以下命令：
```bash
rados -p default.rgw.buckets.data ls
-----------------------------------------------------------------------------------------------------------------------
e763329b-e838-4633-8640-6fb8e35161f4.34178.2 abc
```
其中`default.rgw.buckets.data`是对象存储系统中的数据存储池的名字，该池是用来存储具体的文件数据。