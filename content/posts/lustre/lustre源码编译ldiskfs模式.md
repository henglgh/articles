---
title: lustre源码编译(ldiskfs模式)
date: 2024-12-09T16:27:15+0800
description: "本文详细介绍如何编译后端存储类型为ldiskfs的lustre源码，并制作离线rpm安装包。"
tags: [lustre]
---


# 1. 前言
本文详细介绍如何编译后端存储类型为ldiskfs的lustre源码，并制作离线rpm安装包。系统环境如下：
```bash
lustre:         2.15.4
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
# 3. 编译kernel
## 3.1. 安装依赖
### 3.1.1. 安装内核相关包
**查看内核版本**
```bash
uname -r
--------
4.18.0-513.5.1.el8_9.x86_64
```

**安装内核**
```bash
dnf install kernel-headers-4.18.0-513.5.1.el8_9.x86_64 \
    kernel-devel-4.18.0-513.5.1.el8_9.x86_64 \
    kernel-abi-stablelists-4.18.0-513.5.1.el8_9.noarch \
    kernel-rpm-macros
```

### 3.1.2. 安装其他内核编译依赖
```bash
dnf install asciidoc audit-libs-devel binutils-devel \
    bison clang dwarves elfutils-devel flex gcc git \
    java-devel kabi-dw libbabeltrace-devel libbpf-devel \
    libcap-devel libcap-ng-devel libmnl-devel llvm m4 \
    make ncurses-devel newt-devel nss-tools numactl-devel \
    openssl-devel pciutils-devel perl perl-Carp perl-devel \
    perl-generators perl-interpreter pesign python3-devel \
    python3-docutils xmlto xz-devel zlib-devel
```

&nbsp;
## 3.2. 构建编译环境
### 3.2.1. 获取内核源码
```bash
dnf download --source kernel-4.18.0-513.5.1.el8_9.x86_64
rpm -ivh kernel-4.18.0-513.5.1.el8_9.src.rpm
```
`rpm -i`命令会将src.rpm包解压到`/root/rpmbuild`目录下。

### 3.2.2. 修改/root/kernel/rpmbuild/SPECS/kernel.spec
**找到带有`find $RPM_BUILD_ROOT/lib/modules/$KernelVer`的行，在其下面插入以下两行内容**
```bash
cp -a fs/ext4/* $RPM_BUILD_ROOT/lib/modules/$KernelVer/build/fs/ext4
rm -f $RPM_BUILD_ROOT/lib/modules/$KernelVer/build/fs/ext4/ext4-inode-test*
```

**找到带有`empty final patch to facilitate testing of kernel patches`的行，在其下面插入以下两行内容**
```bash
# adds Lustre patches
Patch99995: patch-4.18.0-lustre.patch
```

**找到带有`ApplyOptionalPatch linux-kernel-test.patch`的行，在其下面插入以下两行内容**
```bash
# lustre patch
ApplyOptionalPatch patch-4.18.0-lustre.patch
```

### 3.2.3. 打内核补丁
**从lustre源码中生成内核源码补丁**
```bash
cd /root/lustre-2.15.4/lustre/kernel_patches/series

for patch in $(<"4.18-rhel8.series"); do \
    patch_file="/root/lustre-2.15.4/lustre/kernel_patches/patches/${patch}"; \
    cat "${patch_file}" >> "/root/rpmbuild/SOURCES/patch-4.18.0-lustre.patch"; \
done
```

### 3.2.4. 初始化rpmbuild目录
```bash
rpmbuild -bp --with firmware --with baseonly --without kabichk \
    --without debug --without debuginfo --target=`uname -m` \
    --define "buildid _9" /root/rpmbuild/SPECS/kernel.spec
```
如果需要修改kernel rpm包名字，比如将`kernel-4.18.0-305.3.1.el8`修改成`kernel-4.18.0-513.5.1.el8_9`，需要添加参数`--define "buildid _9"`。

### 3.2.5. 修改/root/rpmbuild/BUILD/kernel-4.18.0-513.5.1.el8_9/linux-4.18.0-513.5.1.el8_9.x86_64/configs/kernel-4.18.0-x86_64.config
**找到带有`# IO Schedulers`的行，在其下面插入以下内容**
```bash
CONFIG_IOSCHED_DEADLINE=y
CONFIG_DEFAULT_IOSCHED="deadline"
```

**将config文件覆盖lustre kernel config文件**
```bash
cp /root/lustre-2.15.4/lustre/kernel_patches/kernel_configs/kernel-4.18.0-4.18-rhel8.9-x86_64.config \
    /root/lustre-2.15.4/lustre/kernel_patches/kernel_configs/kernel-4.18.0-4.18-rhel8.9-x86_64.config.org

cp /root/rpmbuild/BUILD/kernel-4.18.0-513.5.1.el8_9/linux-4.18.0-513.5.1.el8_9.x86_64/configs/kernel-4.18.0-x86_64.config \
    /root/lustre-2.15.4/lustre/kernel_patches/kernel_configs/kernel-4.18.0-4.18-rhel8.9-x86_64.config
```

&nbsp;
## 3.3. 编译
### 3.3.1. 构建kernel rpms
```bash
rpmbuild -bb --noclean --noprep --with firmware --with baseonly \
    --without kabichk --without debug --without debuginfo \
    --target=`uname -m` --define "buildid _9" /root/rpmbuild/SPECS/kernel.spec
```
一定要添加参数`--noclean --noprep`，防止重新执行初始化阶段，重新覆盖已修改的内容。

&nbsp;
&nbsp;
# 4. 编译lustre
## 4.1. 安装依赖
### 4.1.1. 安装打入补丁的内核
```bash
rpm --upgrade --reinstall --install -vh kernel/*.rpm
```
如果是在新的环境上单独编译lustre，还需要安装其他kernel的包。
```bash
dnf install kernel-abi-stablelists-4.18.0-513.5.1.el8_9.noarch kernel-rpm-macros
```

### 4.1.2. 安装其他编译依赖
```bash
dnf install asciidoc audit binutils clang dwarves java-devel kabi-dw \
    libbabeltrace-devel libbpf-devel libcap-devel libcap-ng-devel libmnl-devel \
    llvm perl-generators python3-docutils bison device-mapper-devel elfutils-devel \
    elfutils-libelf-devel expect flex gcc gcc-c++ git glib2 glib2-devel hmaccalc \
    keyutils-libs-devel krb5-devel ksh libattr-devel libblkid-devel libselinux-devel \
    libtool libuuid-devel libyaml-devel lsscsi make ncurses-devel net-snmp-devel \
    net-tools newt-devel numactl-devel parted patchutils pciutils-devel \
    perl-ExtUtils-Embed pesign redhat-rpm-config rpm-build systemd-devel tcl tcl-devel \
    tk tk-devel wget xmlto yum-utils zlib-devel libmount-devel libnl3-devel python3-devel
```

### 4.1.3. 安装第三方IB驱动（可选）
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

### 4.1.4. 安装e2fsprogs
e2fsprogs是lustre高度定制的，必须要从[https://downloads.whamcloud.com/public/e2fsprogs]()
上下载。每个lustre发行版本日志中都有说明依赖哪个版本的e2fsprogs。

**查看lustre依赖的e2fsprogs版本**
```bash
vim /root/lustre-2.15.4/lustre/ChangeLog
```

**下载e2fsprogs**
```bash
e2fsprogs_url="https://downloads.whamcloud.com/public/e2fsprogs/1.47.0.wc5/el8/RPMS/x86_64"
wget $e2fsprogs_url/e2fsprogs-1.47.0.wc5-1.el8.x86_64.rpm
wget $e2fsprogs_url/e2fsprogs-libs-1.47.0-wc5.el8.x86_64
wget $e2fsprogs_url/e2fsprogs-devel-1.47.0-wc5.el8.x86_64
wget $e2fsprogs_url/libss-1.47.0-wc5.el8.x86_64
wget $e2fsprogs_url/libss-devel-1.47.0-wc5.el8.x86_64
wget $e2fsprogs_url/libcom_err-1.47.0-wc5.el8.x86_64
wget $e2fsprogs_url/libcom_err-devel-1.47.0-wc5.el8.x86_64
```

**安装e2fsprogs**
```bash
rpm --upgrade --reinstall --install -vh e2fsprogs/*.rpm
```

&nbsp;
## 4.2. 构建server rpms
### 4.2.1. 配置server
```bash
./configure --enable-server --enable-ldiskfs --with-o2ib=/usr/src/ofa_kernel/default
```
- 如果需要支持IB网络，需要添加`--with-o2ib=/usr/src/ofa_kernel/default`。
- 另外，这里有个坑，安装英伟达的IB驱动时，会卸载opempi-devel包，而这个包在编译lustre test包时必须依赖。而英伟达IB驱动将opemi和openmpi-devel两个包合二为一了。如果强制安装系统提供的openmpi-devel包，就需要强制卸载英伟达IB驱动提供的openmpi的包。这种方法肯定不行，因为英伟达IB驱动提供的openmpi的包可能是定制化，强行卸载可能会影响IB驱动正常运行。建议在执行configure时添加参数`--disable-tests`。

### 4.2.2. 编译
```bash
make rpms -j4
```

&nbsp;
## 4.3. 构建client rpms
构建client rpm包不需要修改内核源码，因此不需重新构建kernel rpm包，系统自带的原生的kernel rpm包即可。

### 4.3.1. 清除编译配置
```bash
make clean
```

### 4.3.2. 配置client
```bash
./configure --disable-server --enable-client --with-o2ib=/usr/src/ofa_kernel/default
```

### 4.3.3. 编译
```bash
make rpms -j4
```

&nbsp;
&nbsp;
# 5. 参考资料
- [https://wiki.lustre.org/Compiling_Lustre](https://wiki.lustre.org/Compiling_Lustre)
- [https://wiki.whamcloud.com/display/PUB/Building+Lustre+from+Source](https://wiki.whamcloud.com/display/PUB/Building+Lustre+from+Source)
