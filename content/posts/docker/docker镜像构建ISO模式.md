---
title: docker镜像构建(基于ISO)
date: 2025-01-03T17:21:40+0800
description: "本文详细介绍如何基于kylin v10 ISO文件构建出docker image。"
tags: [docker]
---


# 1. 前言
本文详细介绍如何基于kylin v10 ISO文件构建出docker image。系统环境如下：
```bash
dockder:        20.10.7
linux os:       kylinv 10 (GFB)
linux kernel:   4.19.90-52.23.v2207.gfb01.ky10.aarch64
```

&nbsp;
&nbsp;
# 2. 构建yum离线源
## 2.1. 挂载ISO文件
```bash
mount Kylin-Server-V10-GFB-Release-030-ARM64.iso /media
```

&nbsp;
## 2.2. 添加离线repo文件
在`/etc/yum.repos.d/`下创建`kylin-local.repo`，并添加如下内容
```bash
[kylin-local]
name = Kylin Local
baseurl = file:///media/
gpgcheck = 0
enabled = 1
```

&nbsp;
## 2.3. 生成元数据缓存
```bash
dnf clean all && dnf makecache
```
&nbsp;
&nbsp;
# 3. 构建系统环境
## 3.1. 创建系统安装目录
```bash
mkdir -p /opt/kylin-minimal
```

&nbsp;
## 3.2. 安装最小系统
```bash
dnf groupinstall "Minimal" --installroot /opt/kylin-minimal
```

&nbsp;
## 3.3. 验证系统环境
执行`chroot /opt/kylin-minimal`命令进入最小系统的根目录，执行`ll`命令查看目录结构。
```bash
[root@node0 /]# ll
total 16
lrwxrwxrwx  1 root root    7 Apr  2  2021 bin -> usr/bin
dr-xr-xr-x  7 root root 4096 Jan  3 08:58 boot
drwxr-xr-x  2 root root   42 Jan  3 08:57 dev
drwxr-xr-x 88 root root 8192 Jan  3 08:58 etc
drwxr-xr-x  2 root root    6 Apr  2  2021 home
lrwxrwxrwx  1 root root    7 Apr  2  2021 lib -> usr/lib
lrwxrwxrwx  1 root root    9 Apr  2  2021 lib64 -> usr/lib64
drwxr-xr-x  2 root root    6 Apr  2  2021 media
drwxr-xr-x  2 root root    6 Apr  2  2021 mnt
drwxr-xr-x  2 root root    6 Apr  2  2021 opt
dr-xr-xr-x  2 root root    6 Apr  2  2021 proc
dr-xr-x---  2 root root  140 Jan  3 08:59 root
drwxr-xr-x 16 root root  281 Jan  3 08:56 run
lrwxrwxrwx  1 root root    8 Apr  2  2021 sbin -> usr/sbin
drwxr-xr-x  2 root root    6 Apr  2  2021 srv
dr-xr-xr-x  2 root root    6 Apr  2  2021 sys
drwxrwxrwt  2 root root    6 Jan  3 08:58 tmp
drwxr-xr-x 12 root root  192 Jan  3 08:55 usr
drwxr-xr-x 19 root root  332 Jan  3 08:56 var
```
如果显示以上目录结构，则说明最小系统环境安装成功。

&nbsp;
&nbsp;
# 4. 构建docker镜像
## 4.1. 打包系统安装目录
```bash
tar -C /opt/kylin-minimal -cvpf /opt/kylin-minimal.tar .
```

&nbsp;
## 4.2. 创建镜像
```bash
cat /opt/kylin-minimal.tar | docker import - kylin-minimal:v10
```
根据官方文档介绍，从零构建镜像只有2种方式：`FROM scratch`和`using tar`。`FROM scratch`是构建一个空白的镜像，没有任何内容。而`using tar`是基于tar包构建的镜像。上述命令是从kylin-minimal tar包构建docker镜像。镜像名称为`kylin-minimal`，标签为`v10`。

&nbsp;
## 4.3. 查看镜像
```bash
docker images ls -a
--------------------
REPOSITORY          TAG       IMAGE ID       CREATED      SIZE
kylin-minimal       v10       4746e82d9656   1 days ago   2.0GB
```

&nbsp;
&nbsp;
# 5. 参考资料
- [https://docs.docker.com/build/building/base-images/](https://docs.docker.com/build/building/base-images/)