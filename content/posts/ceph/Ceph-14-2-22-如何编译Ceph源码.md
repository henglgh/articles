---
title: "Ceph 14.2.22：如何编译Ceph源码"
date: 2021-05-07T14:49:41+0800
description: "本文介绍如何在 ubuntu 18.04 中编译 Ceph 源码和制作 Ceph 安装包，ceph 版本为 14.2.22。"
tags: [ceph]
---

# 1. 前言

本文介绍如何在 `ubuntu 18.04` 中编译 Ceph 源码和制作 Ceph 安装包，ceph 版本为`14.2.22`。

# 2. 环境准备

## 2.1. 设置 pypi 镜像源

安装 Ceph 依赖的脚本会安装 pypi 库，默认 url 下载很慢，需要设置 pypi 库镜像源。创建 ~/.pip/pip.conf 文件，并追加以下内容。

```ini
[global]
index-url = https://mirrors.aliyun.com/pypi/simple/

[install]
trusted-host=mirrors.aliyun.com
```

## 2.2. 安装依赖

```bash
./install-deps.sh
```

编译源码过程中会遇到很多函数用到 zstd 库，默认情况下 ubuntu18.04 只安装了 libzstd1，但没有用，需要安装 libzstd1-dev。

```bash
apt install libzstd1-dev
```

# 3. 编译 Ceph

## 3.1. 获取源码

本文直接从阿里云镜像源下载名为 [ceph_14.2.22.orig.tar.gz](https://mirrors.aliyun.com/ceph/debian-nautilus/pool/main/c/ceph/ceph_14.2.22.orig.tar.gz) 的源码包。`ceph_14.2.22.orig.tar.gz` 是官方编译之后打包生成的包，里面包含了编译整个项目的所有源码（包括使用的第三方源码），所以不用担心源码缺失问题。

## 3.2. 开启 debug 模式（可选）

如果想要调试 Ceph 源码，需要设置编译源码模式为 debug 模式，默认编译模式为 release 模式，该模式是不能调试源码。修改 ceph/CMakeList 文件，在 `set(VERSION 14.2.22)` 后追加以下内容。

```makefile
set(CMAKE_BUILD_TYPE "Debug")
set(CMAKE_CXX_FLAGS_DEBUG "-O0 -Wall -g")
set(CMAKE_CXX_FLAGS "-O0 -Wall -g")
set(CMAKE_C_FLAGS "-O0 -Wall -g ")
```

## 3.3. 环境检测与 build 目录构建

直接执行 do_cmake 脚本，该脚本会进行一系列检测，包括源码是不是完整，依赖是不是都安装了等等。如果出现问题，构建出的 build 目录是不完整的，最直接的影响是无法生成 makefile 文件，导致无法编译。

```bash
./do_cmake.sh
```

## 3.4. 编译

使用 make 编译必须要到 ceph/build 目录下执行，ceph 源码可以单独编译某一个模块，也可以全部编译。使用 make 可以指定多线程编译，提高编译速度，但要合理分配线程数，建议使用 4 线程编译即可。

```bash
make all -j4
```

上述命令是采用 4 线程编译 Ceph 所有模块，如果想单独编译某个模块，只需要指定模块名即可。例如，单独编译 osd 模块：

```bash
make ceph-osd -j4
```

源码编译会生成很多库文件和二进制文件，分别放在 ceph/build/lib 和 ceph/build/bin 目录下。

# 4. 制作 Ceph 安装包

## 4.1. 安装 deb 包构建工具

```bash
apt install debhelper
```

## 4.2. 制作 deb 包

```bash
dpkg-buildpackage --build=binary -us -ui -uc -nc -j4
```

上述命令会先执行编译过程，编译完成后会对编译出的文件进行打包，生成 deb 包。其中参数说明如下：

- `--build=binary`：指定只构建二进制包。
- `-us -ui -uc -nc`：禁用签名和校验，不生成 source 包。
- `-j4`：使用 4 线程编译。

# 5. 制作本地 Ceph apt 源

## 5.1. 构建本地仓库

### 5.1.1. 创建仓库目录

```bash
mkdir -p /opt/ceph.14.2.22/
```

### 5.1.2. 将所有 deb 包放到本地仓库中

```bash
mv *.deb /opt/ceph.14.2.22/
```

### 5.1.3. 生成 Packages 文件

```bash
cd /opt/
dpkg-scanpackages ceph.14.2.22/ | gzip -9c > ceph.14.2.22/Packages.gz
```

默认情况下没有 `dpkg-scanpackages` 工具，需要执行 `apt install dpkg-dev` 提前安装好。

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

## 5.2. 添加本地源

添加本地源有 2 种方式：`http` 和 `file`。file 方式只能在本地访问，http 方式可以在整个内网都可以访问。

### 5.2.1. file 形式

创建 ceph.list 文件，并将该文件添加到 `/etc/apt/source.list.d/` 下，并添加以下内容。

```bash
echo "deb [trusted=yes] file:/opt/ceph.14.2.22/ ./" > /etc/apt/sources.list.d/ceph.list
```

ubuntu 默认情况下不支持没有签名认证的软件，因此必须要添加 `[trusted=yes]`。

### 5.2.2. http 形式

创建 ceph.list 文件，并将该文件添加到 `/etc/apt/source.list.d/` 下，并添加以下内容。

```bash
echo "deb [trusted=yes] http://192.168.3.10/ceph ./bionic main" > /etc/apt/sources.list.d/ceph.list
```

http 的方式需要依赖 web 服务(apache2、nginx 等)，因此需要安装并配置 web 服务，才可以 http 形式访问。比如 apache2 服务的配置如下：

```bash
ln -s /opt/ceph.14.2.22 /var/www/html/ceph
```

# 6. 参考资料

- [https://docs.ceph.com/en/nautilus/install/build-ceph/](https://docs.ceph.com/en/nautilus/install/build-ceph)
