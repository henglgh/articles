---
title: ceph集群部署(cmd单机模式)
date: 2024-12-09T14:45:55+0800
description: "本文详细介绍如何使用ceph原生命令部署一个完整的ceph集群。"
tags: [ceph]
---


# 1. 前言
本文详细介绍如何使用ceph原生命令部署一个完整的ceph集群。系统环境如下：
```bash
ceph:           17.2.7
linux os:       almalinux 8.9
```

&nbsp;
&nbsp;
# 2. 准备
## 2.1. 集群规划
```bash
service         host ip           host name
mon.a           192.168.3.12      quincy
mon.b           192.168.3.12      quincy
mon.c           192.168.3.12      quincy
mgr.a           192.168.3.12      quincy
mgr.b           192.168.3.12      quincy
mgr.c           192.168.3.12      quincy
mds.a           192.168.3.12      quincy
mds.b           192.168.3.12      quincy
mds.c           192.168.3.12      quincy
rgw.a           192.168.3.12      quincy
rgw.b           192.168.3.12      quincy
rgw.c           192.168.3.12      quincy
osd.0           192.168.3.12      quincy
osd.1           192.168.3.12      quincy
osd.2           192.168.3.12      quincy
```

&nbsp;
## 2.2. 更换almalinux yum源
```bash
sed -e 's|^mirrorlist=|#mirrorlist=|g' \
       -e 's|^# baseurl=https://repo.almalinux.org/almalinux/$releasever|baseurl=https://mirrors.nju.edu.cn/almalinux-vault/8.9|g' \
       -e 's|^# baseurl=https://repo.almalinux.org/vault/$releasever|baseurl=https://mirrors.nju.edu.cn/almalinux-vault/8.9|g' \
       -i.bak /etc/yum.repos.d/almalinux*.repo
```

&nbsp;
## 2.3. 设置ceph yum源
```bash
[ceph]
name=Ceph packages for $basearch
baseurl=https://mirror.nju.edu.cn/ceph/rpm-17.2.7/el8/$basearch
enabled=1
priority=2
gpgcheck=0

[ceph-noarch]
name=Ceph noarch packages
baseurl=https://mirror.nju.edu.cn/ceph/rpm-17.2.7/el8/noarch
enabled=1
priority=2
gpgcheck=0

[ceph-source]
name=Ceph source packages
baseurl=https://mirror.nju.edu.cn/ceph/rpm-17.2.7/el8/SRPMS
enabled=0
priority=2
gpgcheck=0
```
默认情况下gpgcheck=1，表示安装rpm包时要进行签名验证，需要安装ceph签名。这里问了省事，直接关闭gpgcheck。

&nbsp;
## 2.4. 设置epel源
### 2.4.1. 安装epel源
有些ceph依赖的rpm在almalinux上没有，需要安装epel源。
```
wget https://dl.fedoraproject.org/pub/epel/8/Everything/x86_64/Packages/e/epel-release-8-20.el8.noarch.rpm
rpm -i epel-release-8-20.el8.noarch.rpm
```
### 2.4.2. 配置epel源
```bash
[epel]
name=Extra Packages for Enterprise Linux 8 - $basearch
# It is much more secure to use the metalink, but if you wish to use a local mirror
# place its address here.
#baseurl=https://download.example/pub/epel/8/Everything/$basearch
metalink=https://mirrors.fedoraproject.org/metalink?repo=epel-8&arch=$basearch&infra=$infra&content=$contentdir
enabled=1
gpgcheck=0
priority=3
countme=1
```

&nbsp;
## 2.5. 更新
```bash
dnf makecache
```

&nbsp;
## 2.6. 安装依赖
```bash
dnf install gperftools-libs liboath python3-asyncssh \
	python3-cachetools python3-certifi python3-defusedxml \
	python3-google-auth python3-isodate python3-kubernetes \
	python3-msgpack python3-natsort python3-pkgconfig \
	python3-repoze-lru python3-routes  python3-rsa \
	python3-websocket-client python3-xmlsec thrift \
	python3-influxdb python3-saml
```

&nbsp;
## 2.7. 安装ceph
```bash
dnf install ceph ceph-mon ceph-mgr ceph-osd ceph-mds radosgw
```

&nbsp;
&nbsp;
# 3. 集群部署
## 3.1. 创建mon
### 3.1.1. 创建mon data
```bash
mkdir -p /var/lib/ceph/mon/mon.a
mkdir -p /var/lib/ceph/mon/mon.b
mkdir -p /var/lib/ceph/mon/mon.c
```

### 3.1.2. 创建mon key
```bash
ceph-authtool /etc/ceph/keyring --create-keyring --gen-key -n mon.  --cap mon 'allow *'
```
测试发现，在创建mon key的时候，mon name必须是`mon.`，不能是具体的`mon.a`这种形式，也不能单独为每个mon创建key。

### 3.1.3. 创建client.admin key
```bash
ceph-authtool  /etc/ceph/keyring --gen-key -n client.admin \
	--cap mon 'allow *' \
	--cap osd 'allow *' \
	--cap mds 'allow *' \
	--cap mgr 'allow *'
```
因为我将所有的key全部写入到同一个文件中：`/etc/ceph/keyring`，所以只在第一次创建mon key的时候，才使用`--create-keyring`参数，这个参数会新建一个keyring文件，不管这个文件之前有没有。所以在创建client.admin key的时候，就不再使用`--create-keyring`参数。后续创建其他key的过程也同样不在使用`--create-keyring`参数。

### 3.1.4. 创建monmap
```bash
monmaptool --create --clobber  --fsid `uuidgen` /etc/ceph/monmap
monmaptool  --addv a [v1:192.168.3.12:50000,v2:192.168.3.12:50001] /etc/ceph/monmap
monmaptool  --addv b [v1:192.168.3.12:50002,v2:192.168.3.12:50003] /etc/ceph/monmap
monmaptool  --addv c [v1:192.168.3.12:50004,v2:192.168.3.12:50005] /etc/ceph/monmap
```
测试发现，`ceph -s`命令在17.2.7版本上不支持mon v2版本。因此在添加monmap时，必须使用`--addv`参数，并指定具体版本。最好不要直接使用`--add`参数，因为这个参数默认使用v2版本。所以切忌不要使用下面方式添加monmap：
```bash
monmaptool --add a 192.168.3.12:50000 /etc/ceph/monmap
monmaptool --add b 192.168.3.12:50001 /etc/ceph/monmap
monmaptool --add c 192.168.3.12:50002 /etc/ceph/monmap
```
monmap创建好之后，可以使用`monmaptool --print /etc/ceph/monmap`命令来monmap内容。内容如下：
```bash
epoch 0
fsid 206b1b45-60c1-48f5-b8e1-f9f30c5340c0
last_changed 2024-08-29T13:53:32.906954+0800
created 2024-08-29T13:53:32.906954+0800
min_mon_release 15 (octopus)
election_strategy: 1
0: [v1:192.168.3.12:50000/0,v2:192.168.3.12:50001/0] mon.a
1: [v1:192.168.3.12:50002/0,v2:192.168.3.12:50003/0] mon.b
2: [v1:192.168.3.12:50004/0,v2:192.168.3.12:50005/0] mon.c
```

### 3.1.5. 配置ceph.conf
新建`/etc/ceph/ceph.conf`，并追加一下内容：
```bash
[global]
  fsid = 206b1b45-60c1-48f5-b8e1-f9f30c5340c0
  mon host = [v1:192.168.3.12:50000,v2:192.168.3.12:50001] [v1:192.168.3.12:50002,v2:192.168.3.12:50003] [v1:192.168.3.12:50004,v2:192.168.3.12:50005]
  auth cluster required = cephx
  auth service required = cephx
  auth client required = cephx
  auth allow insecure global id reclaim = false

[mon.a]
  host = quincy
  mon data = /var/lib/ceph/mon/mon.a

[mon.b]
  host = quincy
  mon data = /var/lib/ceph/mon/mon.b

[mon.c]
  host = quincy
  mon data = /var/lib/ceph/mon/mon.c
```
上述`global`配置中`mon host`的值必须和`monmaptool  --addv`中匹配。
上述`mon.a`配置中`host`的值是mon服务所在的真实节点的host name。
上述` mon data`是mon data目录，这个参数必须要添加，因为在后面初始化mon data的时候，如果不指定mon data路径，默认会使用`/var/lib/ceph/mon/<cluster>-<id>`。

### 3.1.6. 初始化mon data
```bash
ceph-mon --mkfs -i a --monmap=/etc/ceph/monmap --keyring=/etc/ceph/keyring
ceph-mon --mkfs -i b --monmap=/etc/ceph/monmap --keyring=/etc/ceph/keyring
ceph-mon --mkfs -i c --monmap=/etc/ceph/monmap --keyring=/etc/ceph/keyring
```
测试发现，上述命令第一次执行会显示错误信息，原因是因为mon data目录权限问题，修改权限后再次执行就不会显示错误信息。但是，如果没有修改权限，也没有再次执行，mon data目录下也会有内容产生，而且和第二次执行后生成的内容是一致的。后面在初始化osd data时候，也是如此。

### 3.1.7. 修改mon data归属
```bash
chown -R ceph:ceph /var/lib/ceph/mon
```

### 3.1.8. 启动mon
```bash
systemctl start ceph-mon@a.service
systemctl enable ceph-mon@a.service

systemctl start ceph-mon@b.service
systemctl enable ceph-mon@b.service

systemctl start ceph-mon@c.service
systemctl enable ceph-mon@c.service
```
至此，如果mon正常启动，`ceph -s`命令可以正常执行并有结果输出。如果`ceph -s`命令没有输出结果或者卡住了，一定是部署失败了。可以在ceph.conf文件中`global`配置项添加`debug ms = 1`打开客户端调试功能查看问题。

&nbsp;
## 3.2. 创建mgr
### 3.2.1. 创建mgr data
```bash
mkdir -p /var/lib/ceph/mgr/mgr.a
mkdir -p /var/lib/ceph/mgr/mgr.b
mkdir -p /var/lib/ceph/mgr/mgr.c
```

### 3.2.2. 配置ceph.conf
```bash
[mgr.a]
  host = quincy
  mgr pool = false
  mgr data =/var/lib/ceph/mgr/mgr.a

[mgr.b]
  host = quincy
  mgr pool = false
  mgr data = /var/lib/ceph/mgr/mgr.b

[mgr.c]
  host = quincy
  mgr pool = false
  mgr data = /var/lib/ceph/mgr/mgr.c
```
上述`mgr pool`默认值为true，表示在启动mgr服务时，会自动创建一个名为`.mgr.pool`，在ceph 14.2.22版本中没有这个功能，其他版本可以执行`ceph config ls | grep mgr_pool`查看是否有这个配置项。

### 3.2.3. 创建mgr key
```bash
ceph-authtool  /etc/ceph/keyring --gen-key -n mgr.a \
	--cap mon 'allow profile mgr' \
	--cap mds 'allow *' \
	--cap osd 'allow *'
ceph-authtool  /etc/ceph/keyring --gen-key -n mgr.b \
	--cap mon 'allow profile mgr' \
	--cap mds 'allow *' \
	--cap osd 'allow *'
ceph-authtool  /etc/ceph/keyring --gen-key -n mgr.c \
	--cap mon 'allow profile mgr' \
	--cap mds 'allow *' \
	--cap osd 'allow *'
```

### 3.2.4. 导入mgr key到ceph rados对象中
```bash
ceph auth import -i /etc/ceph/keyring
```
导入key到ceph rados对象中的目的是为了执行`ceph auth ls`命令能够直接查看到。测试发现，在使用`ceph-authtool`工具创建key的时候，只有mon和client这两种类型的key能够自动添加到ceph rados对象中，其他类型的key需要手动导入。

### 3.2.5. 添加mgr key到mgr data
```bash
ceph auth export mgr.a > /var/lib/ceph/mgr/mgr.a/keyring
ceph auth export mgr.b > /var/lib/ceph/mgr/mgr.b/keyring
ceph auth export mgr.c > /var/lib/ceph/mgr/mgr.c/keyring
```

### 3.2.6. 修改mgr data归属
```bash
chown -R ceph:ceph /var/lib/ceph/mgr
```

### 3.2.7. 启动mgr
```bash
systemctl start ceph-mgr@a.service
systemctl enable ceph-mgr@a.service

systemctl start ceph-mgr@b.service
systemctl enable ceph-mgr@b.service

systemctl start ceph-mgr@c.service
systemctl enable ceph-mgr@c.service
```

&nbsp;
## 3.3. 创建osd
### 3.3.1. 创建osd data
```bash
mkdir -p /var/lib/ceph/osd/osd.0
mkdir -p /var/lib/ceph/osd/osd.1
mkdir -p /var/lib/ceph/osd/osd.2
```

### 3.3.2. 添加device
#### 3.3.2.1. bluestore模式
**添加block device**
```bash
#5GB
dd if=/dev/zero of=/var/lib/ceph/dev/dev00 bs=1M count=5120
dd if=/dev/zero of=/var/lib/ceph/dev/dev02 bs=1M count=5120
dd if=/dev/zero of=/var/lib/ceph/dev/dev04 bs=1M count=5120
```

**添加block db device**
```bash
#2GB
dd if=/dev/zero of=/var/lib/ceph/dev/dev01 bs=1M count=2048
dd if=/dev/zero of=/var/lib/ceph/dev/dev03 bs=1M count=2048
dd if=/dev/zero of=/var/lib/ceph/dev/dev05 bs=1M count=2048
```

#### 3.3.2.2. filestore模式
**添加data device**
```bash
#5GB
dd if=/dev/zero of=/var/lib/ceph/dev/dev00 bs=1M count=5120
dd if=/dev/zero of=/var/lib/ceph/dev/dev02 bs=1M count=5120
dd if=/dev/zero of=/var/lib/ceph/dev/dev04 bs=1M count=5120
```

**映射虚拟块设备**
```bash
losetup -f /var/lib/ceph/dev/dev00
losetup -f /var/lib/ceph/dev/dev02
losetup -f /var/lib/ceph/dev/dev04
```

**格式化虚拟块设备**
```bash
mkfs.xfs /dev/loop0
mkfs.xfs /dev/loop1
mkfs.xfs /dev/loop2
```

**挂载虚拟块设备**
```bash
mount /dev/loop0 /var/lib/ceph/osd/osd.0
mount /dev/loop1 /var/lib/ceph/osd/osd.1
mount /dev/loop2 /var/lib/ceph/osd/osd.2
```

**添加journal device**
```bash
#2GB
dd if=/dev/zero of=/var/lib/ceph/dev/dev01 bs=1M count=2048
dd if=/dev/zero of=/var/lib/ceph/dev/dev03 bs=1M count=2048
dd if=/dev/zero of=/var/lib/ceph/dev/dev05 bs=1M count=2048
```

**创建journal软链接**
```bash
ln -s /var/lib/ceph/dev/dev01 /var/lib/ceph/osd/osd.0/journal
ln -s /var/lib/ceph/dev/dev03 /var/lib/ceph/osd/osd.1/journal
ln -s /var/lib/ceph/dev/dev05 /var/lib/ceph/osd/osd.2/journal
```

### 3.3.3. 修改dev目录归属
```bash
chown -R ceph:ceph /var/lib/ceph/dev
```

### 3.3.4. 配置osd
#### 3.3.4.1. bluestore模式
```bash
[osd.0]
  host = quincy
  osd objectstore = bluestore
  osd data = /var/lib/ceph/osd/osd.0
  bluestore block path = /var/lib/ceph/dev/dev00
  bluestore block create = true
  bluestore block db path = /var/lib/ceph/dev/dev01
  bluestore block db create = true

[osd.1]
  host = quincy
  osd objectstore = bluestore
  osd data = /var/lib/ceph/osd/osd.1
  bluestore block path = /var/lib/ceph/dev/dev02
  bluestore block create = true
  bluestore block db path = /var/lib/ceph/dev/dev03
  bluestore block db create = true

[osd.2]
  host = quincy
  osd objectstore = bluestore
  osd data = /var/lib/ceph/osd/osd.2
  bluestore block path = /var/lib/ceph/dev/dev04
  bluestore block create = true
  bluestore block db path = /var/lib/ceph/dev/dev05
  bluestore block db create = true
```

#### 3.3.4.2. filestore模式
```bash
[osd.0]
  host = quincy
  osd objectstore = filestore
  osd data = /var/lib/ceph/osd/osd.0
  osd journal = /var/lib/ceph/osd/osd.0/journal

[osd.1]
  host = quincy
  osd objectstore = filestore
  osd data =/var/lib/ceph/osd/osd.1
  osd journal = /var/lib/ceph/osd/osd.1/journal

[osd.2]
  host = quincy
  osd objectstore = filestore
  osd data =/var/lib/ceph/osd/osd.2
  osd journal = /var/lib/ceph/osd/osd.2/journal
```

### 3.3.5. 创建osd key
```bash
ceph-authtool  /etc/ceph/keyring --gen-key -n osd.0 \
	--cap mon 'allow profile osd' \
	--cap mgr 'allow profile osd' \
	--cap osd 'allow *'
ceph-authtool  /etc/ceph/keyring --gen-key -n osd.1 \
	--cap mon 'allow profile osd' \
	--cap mgr 'allow profile osd' \
	--cap osd 'allow *'
ceph-authtool  /etc/ceph/keyring --gen-key -n osd.2 \
	--cap mon 'allow profile osd' \
	--cap mgr 'allow profile osd' \
	--cap osd 'allow *'
```

### 3.3.6. 导入osd key到ceph rados对象中
```bash
ceph auth import -i /etc/ceph/keyring
```

### 3.3.7. 添加osd key到osd data
```bash
ceph auth export osd.0 > /var/lib/ceph/osd/osd.0/keyring
ceph auth export osd.1 > /var/lib/ceph/osd/osd.1/keyring
ceph auth export osd.2 > /var/lib/ceph/osd/osd.2/keyring
```

### 3.3.8. 添加osd key json到osd data
```bash
echo "{\"cephx_secret\": \"`ceph auth get-key osd.0`\"}" > /var/lib/ceph/osd/osd.0/keyring.json
echo "{\"cephx_secret\": \"`ceph auth get-key osd.1`\"}" > /var/lib/ceph/osd/osd.1/keyring.json
echo "{\"cephx_secret\": \"`ceph auth get-key osd.2`\"}" > /var/lib/ceph/osd/osd.2/keyring.json
```

### 3.3.9. 创建osd并初始化osd data
```bash
uuid=`uuidgen`
ceph osd new $uuid 0 -i  /var/lib/ceph/osd/osd.0/keyring.json
ceph-osd -i 0 --mkfs --osd-uuid $uuid --keyring /etc/ceph/keyring

uuid=`uuidgen`
ceph osd new $uuid 1 -i  /var/lib/ceph/osd/osd.1/keyring.json
ceph-osd -i 1 --mkfs --osd-uuid $uuid --keyring /etc/ceph/keyring

uuid=`uuidgen`
ceph osd new $uuid 2 -i  /var/lib/ceph/osd/osd.2/keyring.json
ceph-osd -i 2 --mkfs --osd-uuid $uuid --keyring /etc/ceph/keyring
```

### 3.3.10. 修改osd data归属
```bash
chown -R ceph:ceph /var/lib/ceph/osd
```

### 3.3.11. 启动服务
```bash
systemctl start ceph-osd@0.service
systemctl enable ceph-osd@0.service

systemctl start ceph-osd@1.service
systemctl enable ceph-osd@1.service

systemctl start ceph-osd@2.service
systemctl enable ceph-osd@2.service
```
上述使用`systemctl start ceph-osd@0.service`方式启动osd服务时会失败，原因是`/usr/lib/systemd/system/ceph-osd@.service`文件会先执行`/usr/lib/ceph/ceph-osd-prestart.sh`脚本，在这个脚本中需要将`data="/var/lib/ceph/osd/${cluster:-ceph}-$id"`修改成实际osd目录`data="/var/lib/ceph/osd/osd.$id"`。

&nbsp;
## 3.4. 创建mds
### 3.4.1. 创建mds data
```bash
mkdir -p /var/lib/ceph/mds/mds.a
mkdir -p /var/lib/ceph/mds/mds.b
mkdir -p /var/lib/ceph/mds/mds.c
```

### 3.4.2. 配置ceph.conf
```bash
[mds.a]
  host = quincy
  mds data =/var/lib/ceph/mds/mds.a

[mds.b]
  host = quincy
  mds data =/var/lib/ceph/mds/mds.b

[mds.c]
  host = quincy
  mds data =/var/lib/ceph/mds/mds.c
```

### 3.4.3. 创建mds key
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

### 3.4.4. 导入mds key到ceph rados对象中
```bash
ceph auth import -i /etc/ceph/keyring
```

### 3.4.5. 添加mds key到mds data
```bash
ceph auth export mds.a > /var/lib/ceph/mds/mds.a/keyring
ceph auth export mds.b > /var/lib/ceph/mds/mds.b/keyring
ceph auth export mds.c > /var/lib/ceph/mds/mds.c/keyring
```

### 3.4.6. 修改mds data归属
```bash
chown -R ceph:ceph /var/lib/ceph/mds
```

### 3.4.7. 启动mds
```bash
systemctl start ceph-mds@a.service
systemctl enable ceph-mds@a.service
```
默认情况下使用`ceph -s`命令无法显示出mds服务，需要创建fs才能用`ceph -s`显示出来。

&nbsp;
## 3.5. 创建rgw
### 3.5.1. 创建rgw data
```bash
mkdir -p /var/lib/ceph/rgw/rgw.a
mkdir -p /var/lib/ceph/rgw/rgw.b
mkdir -p /var/lib/ceph/rgw/rgw.c
```

### 3.5.2. 配置rgw
```bash
[client.rgw.a]
  rgw frontends = "civetweb port=192.168.3.12:50006"
  rgw data =/var/lib/ceph/rgw/rgw.a

[client.rgw.b]
  rgw frontends = "civetweb port=192.168.3.12:50007"
  rgw data =/var/lib/ceph/rgw/rgw.b

[client.rgw.c]
  rgw frontends = "civetweb port=192.168.3.12:50008"
  rgw data =/var/lib/ceph/rgw/rgw.c
```
上述`port=192.168.3.12:50007`表示只启动tcp4端口监听。如果设置成`port=50007`，表示同时启动tcp4和tcp6端口监听。
### 3.5.3. 创建rgw key
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
测试发现，rgw的name必须是以`client.`为前缀。因为ceph中没有`rgw`这个类别，类别只有`auth, mon, osd, mds, mgr, client`这几种。

### 3.5.4. 导入rgw key到ceph rados对象中
```bash
ceph auth import -i /etc/ceph/keyring
```

### 3.5.5. 添加rgw key到rgw data
```bash
ceph auth export client.rgw.a > /var/lib/ceph/rgw/rgw.a/keyring
ceph auth export client.rgw.b > /var/lib/ceph/rgw/rgw.b/keyring
ceph auth export client.rgw.c > /var/lib/ceph/rgw/rgw.c/keyring
```

### 3.5.6. 修改rgw data归属
```bash
chown -R ceph:ceph /var/lib/ceph/rgw
```

### 3.5.7. 启动rgw
```bash
systemctl start ceph-radosgw@rgw.a.service
systemctl enable ceph-radosgw@rgw.a.service

systemctl start ceph-radosgw@rgw.b.service
systemctl enable ceph-radosgw@rgw.b.service

systemctl start ceph-radosgw@rgw.b.service
systemctl enable ceph-radosgw@rgw.b.service
```
默认情况下，启动rgw服务后，会自动创建与rgw服务相关的pool。

&nbsp;
&nbsp;
# 4. 参考资料
- [Ceph官方手动部署文档](https://docs.ceph.com/en/latest/install/index_manual/)