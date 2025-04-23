---
title: lustre源码编译(zfs模式)
date: 2024-12-09T16:27:14+0800
description: "本文详细介绍如何编译后端存储类型为zfs的lustre源码，并制作离线rpm安装包。"
tags: [lustre]
---


# 1. 前言
本文详细介绍如何编译后端存储类型为zfs的lustre源码，并制作离线rpm安装包。系统环境如下：
```bash
lustre:         2.15.4
zfs:            2.1.11
linux os:       almalinux 8.9
linux kernel:   4.18.0-513.5.1.el8_9.x86_64
```

&nbsp;
&nbsp;
# 2. 准备
## 2.1. 配置软件仓库源
### 2.1.1. 更换almalinux软件仓库源
```bash
sed -e 's|^mirrorlist=|#mirrorlist=|g' \
    -e 's|^# baseurl=https://repo.almalinux.org/almalinux/$releasever|baseurl=https://mirrors.nju.edu.cn/almalinux-vault/8.9|g' \
    -e 's|^# baseurl=https://repo.almalinux.org/vault/$releasever|baseurl=https://mirrors.nju.edu.cn/almalinux-vault/8.9|g' \
    -i.bak /etc/yum.repos.d/almalinux*.repo
```

### 2.1.2. 启用必要的软件仓库
```bash
dnf config-manager --enable appstream baseos extras powertools ha
```

### 2.1.3. 生成元数据缓存
```bash
dnf makecache
```

&nbsp;
&nbsp;
# 3. 编译zfs
lustre 2.15.4发布日志中建议zfs版本为2.1.11或者更高版本，因此需要自己编译zfs。openzfs提供了关于zfs详细文档，详细内容参考[https://openzfs.github.io/openzfs-docs](https://openzfs.github.io/openzfs-docs)。

## 3.1. 安装依赖
### 3.1.1. 安装kernel包
```bash
dnf install kernel-abi-stablelists-4.18.0-513.5.1.el8_9.x86_64 kernel-devel-4.18.0-513.5.1.el8_9.x86_64 kernel-headers-4.18.0-513.5.1.el8_9.x86_64 kernel-rpm-macros
```
注：kernel-devel和kernel-abi-stablelists必须要和内核版本一致

### 3.1.2. 安装其他包
```bash
dnf install autoconf automake elfutils-libelf-devel gcc git libaio-devel libattr-devel libblkid-devel libcurl-devel libffi-devel libtirpc-devel libtool libuuid-devel make ncompress openssl-devel python3-cffi python3-packaging python36 python36-devel rpm-build systemd-devel zlib-devel
```

&nbsp;
## 3.2. 编译
### 3.2.1. 获取源码
```bash
git clone -b 2.1.11 --depth=1 https://github.com/openzfs/zfs.git zfs-2.1.11
```

### 3.2.2. 生成configure文件
```bash
bash autogen.sh
```

### 3.2.3. 配置编译选项
```bash
./configure --with-spec=redhat
```

### 3.2.4. 编译rpms包
```bash
make rpms -j4
```

&nbsp;
&nbsp;
# 4. 编译lustre
## 4.1. 安装依赖
### 4.1.1. 安装内核包
```bash
dnf install kernel-abi-stablelists-4.18.0-513.5.1.el8_9.x86_64 kernel-devel-4.18.0-513.5.1.el8_9.x86_64 kernel-headers-4.18.0-513.5.1.el8_9.x86_64 kernel-rpm-macros
```
kernel-devel和kernel-abi-stablelists必须要和内核版本一致

### 4.1.2. 安装其他包
```bash
dnf install bison device-mapper-devel elfutils-devel elfutils-libelf-devel expect flex gcc gcc-c++ git glib2-devel keyutils-libs-devel krb5-devel ksh libattr-devel libblkid-devel libmount-devel libnl3-devel libselinux-devel libtool libuuid-devel libyaml-devel make ncurses-devel net-snmp-devel newt-devel numactl-devel patchutils pciutils-devel perl-ExtUtils-Embed pesign python36-devel rpm-build systemd-devel tcl tcl-devel tk tk-devel xmlto yum-utils zlib-devel
```

### 4.1.3. 安装zfs
```bash
dnf install kmod-zfs kmod-zfs-devel libzfs5 libzfs5-devel libzpool5 zfs
```
使用dnf安装zfs时需要先做zfs离线yum源。

### 4.1.4. 安装第三方IB驱动（可选）
如果要开启lustre的RDMA功能，系统需要有IB网卡设备驱动程序相关的devel包。一般情况下，系统内核提供了IB网卡驱动程序，需要自己安装devel包。如果不安装，lustre默认会关闭RDMA功能。然而，实际生产上都需要安装和IB网卡匹配的第三方驱动。大多数情况下都是安装英伟达的IB网卡驱动。

**下载IB网卡驱动**
```bash
https://network.nvidia.com/products/infiniband-drivers/linux/mlnx_ofed
```
- 建议下载后缀`.tgz`的压缩包，方便解压。
- 下载之前到对应的驱动版本的`Release Notes`查看支持的网卡类型和内核版本。

**解压并安装驱动**
```bash
tar -zxvf MLNX_OFED_LINUX-5.8-5.1.1.2-rhel8.9-x86_64.tgz
cd MLNX_OFED_LINUX-5.8-5.1.1.2-rhel8.9-x86_64
./mlnxofedinstall --force
```
安装过程中，如果内核和mlnxofed要求的不匹配，mlnxofed会重新编译内核，过程很漫长。

&nbsp;
## 4.2. 编译server
### 4.2.1. 获取源码
```bash
git clone -b 2.15.4 --depth=1  git://git.whamcloud.com/fs/lustre-release.git lustre-2.15.4
```

### 4.2.2. 生成configure文件
```bash
bash autogen.sh
```

### 4.2.3. 配置编译server选项
```bash
./configure --enable-server --disable-ldiskfs --with-o2ib=/usr/src/ofa_kernel/default
```
如果需要支持IB网络，需要添加`--with-o2ib=/usr/src/ofa_kernel/default`。

### 4.2.4. 编译rpm包
```bash
make rpms -j4
```

&nbsp;
## 4.3. 编译client
### 4.3.1. 清除编译配置
```bash
make clean
```

### 4.3.2. 配置编译client选项
```bash
./configure --disable-server --enable-client --disable-ldiskfs --with-o2ib=/usr/src/ofa_kernel/default
```

### 4.3.3. 编译rpm包
```bash
make rpms -j4
```

&nbsp;
&nbsp;
# 5. 参考资料
- [https://wiki.lustre.org/Compiling_Lustre](https://wiki.lustre.org/Compiling_Lustre)
- [https://wiki.whamcloud.com/display/PUB/Building+Lustre+from+Source](https://wiki.whamcloud.com/display/PUB/Building+Lustre+from+Source)
- [https://openzfs.github.io/openzfs-docs](https://openzfs.github.io/openzfs-docs)