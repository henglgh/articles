---
title: DAOS源码编译
date: 2024-12-09T16:48:47+0800
description: "本文详细介绍如何在almalinux8.9上编译daos.2.0.0源码。"
tags: [daos]
---

# 1. 前言
本文详细介绍如何在almalinux8.9上编译daos.2.0.0源码。系统环境如下：
```bash
daos:           2.0.0
linux os:       almalinux 8.9
linux kernel:   4.18.0-513.5.1.el8_9.x86_64
```
之所以选择2.0.0版本，是因为daos从2.0.0开始是一个全新的架构设计，与1.x版本是不兼容的。其次为了方便研究daos源码，当然是版本越早，功能越少，代码逻辑更清晰。

&nbsp;
&nbsp;
# 2. yum源配置
## 2.1. 配置daos yum源
```bash
[daos-2.0.0]
name=DAOS v2.0.0 Packages Packages
baseurl=https://packages.daos.io/v2.0.0/CentOS8/packages/x86_64/
enabled=1
#gpgcheck=1
gpgcheck=0
protect=1
#gpgkey=https://packages.daos.io/RPM-GPG-KEY-2023
```

## 2.2. 配置epel yum源
```bash
[epel]
name=Extra Packages for Enterprise Linux 8 - $basearch
baseurl=https://mirrors.aliyun.com/epel/8/Everything/$basearch
enabled=1
priority=3
gpgcheck=0
countme=1
```

## 2.3. 生成缓存
```bash
dnf make cache
```

&nbsp;
&nbsp;
# 3. 源码获取
```bash
git clone --recurse-submodules --depth=1 -b v2.0.0 https://github.com/daos-stack/daos.git
cd daos
```
- 测试发现，编译daos时，必须要通过git clone方式获取源码，通过下载zip包的方式，编译时会失败。因为在daos的编译配置文件中，会检查git仓库是否存在，如果不存在，则编译会失败。
- 可以通过`git config --global  url."https://gh-proxy.com/".insteadOf https://`方式来配置github镜像源。

&nbsp;
&nbsp;
# 4. 安装依赖
## 4.1. 安装编译环境的依赖包
```bash
./utils/scripts/install-el8.sh
```
高版本的daos还需要执行其他脚本，具体参考官网文档中对应的`build from cratch`专题。

## 4.2. 安装daos的依赖包（可选）
```bash
dnf install hdf5-devel
dnf builddep ./utils/rpms/daos.spec
```
测试发现时，如果采用官方文档的编译方式，也就是不提前安装daos的依赖包，而是选择使用`--build-deps=yes`来控制在编译的过程中拉取第三方依赖包的源码，放入build/extra/release/目录下，然后去编译依赖。但是这种方式不会编译出依赖包的rpm包，只会编译出可执行文件和库文件。如果要编译出daos的rpm包，就需要这些依赖包的rpm包，所以建议提直接安装好这些依赖包，而不是选择自己去编译，毕竟这些依赖包也是直接从daos repo中获取的，daos已经给你编译好了，直接拿来用不好吗？

&nbsp;
&nbsp;
# 5. 编译
## 5.1. 编译daos
```bash
scons install --jobs 4  --config=force --build-deps=no
```
上述命令是编译daos的可执行文件和库文件，而且不需要编译第三方依赖。这些编译出来的文件最终会放在./intsall目录下。

## 5.2. 编译daos rpms
```bash
scons rpms --jobs 4  --config=force --build-deps=no
```
上述命令是编译daos的rpm包，而且不需要编译第三方依赖的rpm包。这些编译出来的rpm包最终会放在./utils/rpms/_topdir目录下。

## 5.3. 编译指定模块
目前daos只支持server、client、test模块。默认情况下，daos会编译所有模块，如果想要编译指定模块，可以使用`scons install 模块类型`的方式。下面是编译server模块的例子：
```bash
scons install server --jobs 4  --config=force --build-deps=no
```

&nbsp;
&nbsp;
# 6. 参考资料
- [https://docs.daos.io/v2.0/QSG/build_from_scratch](https://docs.daos.io/v2.0/QSG/build_from_scratch/)
- [https://docs.daos.io/v2.0/dev/development](https://docs.daos.io/v2.0/dev/development/)
