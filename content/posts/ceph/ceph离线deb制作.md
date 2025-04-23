---
title: ceph离线deb包制作
date: 2024-12-09T14:50:06+0800
description: "本文介绍如何制作ceph deb包，并构建ceph本地apt源，实现离线安装ceph。"
tags: [ceph]
---


# 1. 前言
本文介绍如何构建ceph本地apt源，以方便离线安装ceph。系统环境如下：
```bash
ceph:           14.2.22
linux os:       ubuntu 18.04
```
&nbsp;
&nbsp;
# 2. 构建本地apt源
## 2.1. 制作deb
### 2.1.1. 获取源码
本文采用从阿里云镜像源上直接下载[https://mirrors.aliyun.com/ceph/debian-nautilus/pool/main/c/ceph/ceph_14.2.22.orig.tar.gz]()，而不是从Github上拉代码。ceph源码包中包含了ceph整个项目的源码（包括使用的第三方源码），所以不用担心源码缺失问题，并且可以直接通过国内开源镜像站去下载，不用担心下载慢的问题。

### 2.1.2. 生成deb
```bash
dpkg-buildpackage --build=binary -us -ui -uc -nc -j4
```
ceph官网提供制作deb包方法，经过测试发现会有问题。如果直接执行dpkg-buildpackage，会出现签证问题，导致制作失败。此处应该禁用签证，并开启多线程。

&nbsp;
## 2.2. 构建本地deb仓库
### 2.2.1. 创建本地deb仓库目录
```bash
mkdir -p /opt/ceph.14.2.22/
```

### 2.2.2. 将所有deb包放到本地仓库中
```bash
mv *.deb /opt/ceph.14.2.22/
```

### 2.2.3. 生成Packages文件
```bash
cd /opt/
dpkg-scanpackages ceph.14.2.22/ | gzip -9c > ceph.14.2.22/Packages.gz
```
默认情况下没有`dpkg-scanpackages`工具，需要执行`apt install dpkg-dev`提前安装好。

最终/opt/ceph.14.2.22/的目录结构如下：
```bash
.
├── Packages.gz
├── ceph_14.2.22-1_amd64.deb
├── ceph-base_14.2.22-1_amd64.deb
├── ceph-base-dbg_14.2.22-1_amd64.deb
├── ceph-common_14.2.22-1_amd64.deb
├── ceph-common-dbg_14.2.22-1_amd64.deb
├── cephfs-shell_14.2.22-1_all.deb
├── ceph-fuse_14.2.22-1_amd64.deb
└── ceph-fuse-dbg_14.2.22-1_amd64.deb
```

&nbsp;
## 2.3. 添加本地源
添加本地源有2种方式：`http`和`file`。file方式只能在本地访问，http方式可以在整个内网都可以访问。

### 2.3.1. file形式
创建ceph.list文件，并将该文件添加到 `/etc/apt/source.list.d/` 下，并添加以下内容。
```bash
echo "deb [trusted=yes] file:/opt/ceph.14.2.22/ ./" > /etc/apt/sources.list.d/ceph.list
```
ubuntu默认情况下不支持没有签名认证的软件，因此必须要添加`[trusted=yes]`

### 2.3.2. http形式
创建ceph.list文件，并将该文件添加到 `/etc/apt/source.list.d/` 下，并添加以下内容。
```bash
echo "deb [trusted=yes] http://192.168.3.10/ceph ./bionic main" > /etc/apt/sources.list.d/ceph.list
```

**安装Apache服务**
```bash
apt install apache2
```
安装完apache2之后，http服务会自动启动。

**添加软连接**
```bash
ln -s /opt/ceph.14.2.22 /var/www/html/ceph
```
通过以上设置，便可以访问 `http://192.168.3.10/ceph`获取到本地的ceph的deb包。

### 2.3.3. 更新仓库
```bash
apt update
```
至此，可以通过`apt install`方式安装离线ceph deb。