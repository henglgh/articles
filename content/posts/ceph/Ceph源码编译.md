---
title: Ceph源码编译
date: 2021-05-07T14:49:41+0800
description: "本文介绍如何编译Ceph源码，并开启debug调试功能。"
tags: [ceph]
---


# 1. 前言
本文介绍如何编译Ceph源码，并开启debug调试功能。系统环境如下：
```bash
ceph:           14.2.22
linux os:       ubuntu 18.04
```

&nbsp;
&nbsp;
# 2. 安装依赖
### 2.1. 设置pypi镜像源
脚本会安装pypi库，默认url下载很慢，需要设置pypi库镜像源。创建 ~/.pip/pip.conf 文件，并追加以下内容。
```bash
[global]
index-url = https://mirrors.aliyun.com/pypi/simple/
[install]
trusted-host=mirrors.aliyun.com
```

### 2.2. 安装基础依赖
```bash
./install-deps.sh
```

### 2.3. 安装其他依赖
编译源码过程中会遇到很多函数用到zstd库，默认情况下ubuntu18.04只安装了libzstd1，但没有用，需要安装 libzstd1-dev。
```bash
apt install libzstd1-dev
```

&nbsp;
&nbsp;
# 3. 编译
### 3.1. 获取源码
本文采用从阿里云镜像源上直接下载[https://mirrors.aliyun.com/ceph/debian-nautilus/pool/main/c/ceph/ceph_14.2.22.orig.tar.gz]()，而不是从Github上拉代码。ceph源码包中包含了ceph整个项目的源码（包括使用的第三方源码），所以不用担心源码缺失问题，并且可以直接通过国内开源镜像站去下载，不用担心下载慢的问题。

### 3.2. 开启debug模式
如果想要调试Ceph源码，需要设置编译源码模式为debug模式，默认编译模式为release模式，该模式是不能调试源码。修改ceph/CMakeList文件，在`set(VERSION 14.2.22)`后追加以下内容。
```bash
set(CMAKE_BUILD_TYPE "Debug")
set(CMAKE_CXX_FLAGS_DEBUG "-O0 -Wall -g")
set(CMAKE_CXX_FLAGS "-O0 -Wall -g")
set(CMAKE_C_FLAGS "-O0 -Wall -g ")
```

### 3.3. 生成build目录
直接执行do_cmake脚本，该脚本会进行一系列检测，包括源码是不是完整，依赖是不是都安装了等等。如果出现问题，构建出的build目录是不完整的，最直接的影响是无法生成makefile文件，导致无法编译。
```bash
./do_cmake.sh
```

### 3.4. 编译
使用make编译必须要到ceph/build目录下执行，ceph源码可以单独编译某一个模块，也可以全部编译。使用make可以指定多线程编译，提高编译速度，但要合理分配线程数，建议使用4线程编译即可。
```bash
#方式1：全部编译
make all -j4
#方式2：单独编译osd某块
make ceph-osd -j4
#查看所有模块
make help
```
源码编译会生成很多库文件和二进制文件，分别放在ceph/build/lib和ceph/build/bin目录下。
