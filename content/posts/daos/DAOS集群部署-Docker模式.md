---
title: DAOS集群部署-Docker模式
date: 2025-6-24T13:24:58+0800
description: "本文详细介绍如何在almalinux8.9上使用docker部署DAOS.2.6.0单机集群（基于Metadata-on-SSD架构）。"
tags: [daos]
---


# 1. 前言
本文详细介绍如何在almalinux8.9上部署DAOS.2.6.0单机集群，配置方式采用Metadata-on-SSD模式。系统环境如下：
```bash
daos:           2.6.0
linux os:       almalinux 8.9
linux kernel:   4.18.0-513.5.1.el8_9.x86_64
```
DAOS从2.0.0开始是一个全新的架构设计，与1.x版本是不兼容的。另外，从2.6.0开始，DAOS开始支持Metadata-on-SSD，即支持非Intel Optane设备。

&nbsp;
&nbsp;
# 2. 集群规划
```bash
Component       Host ip           Host name
--------------------------------------------
daos_server     192.168.3.13      node0
```

&nbsp;
&nbsp;
# 3. 安装docker
## 3.1. 添加docker yum源
编辑`/etc/yum.repos.d/docker-ce.repo`文件
```bash
[docker-ce-stable]
name=Docker CE Stable - $basearch
baseurl=https://mirror.nju.edu.cn/docker-ce/linux/centos/$releasever/$basearch/stable
enabled=1
gpgcheck=1
gpgkey=https://mirror.nju.edu.cn/docker-ce/linux/centos/gpg
```

## 3.2. 安装docker
```bash
dnf clean all && dnf makecache

dnf install --allowerasing docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## 3.3. 启动docker
```bash
systemctl start docker.service
```

&nbsp;
&nbsp;
# 4. 拉取almalinux镜像
## 4.1. 设置docker hub镜像源
编辑`/etc/docker/daemon.json`文件
```bash
{
  "registry-mirrors": ["https://1ms.run"]
}
```

## 4.2. 拉取almalinux 8.9 init镜像
init镜像可以执行systemctl命令,省略了很多麻烦。
```bash
docker pull almalinux/8-init:8.9
```
如果成功拉取，执行`docker images`命令可以看到almalinux 8.9 init的docker image已经被加载：
```bash
REPOSITORY      TAG       IMAGE ID       CREATED         SIZE
almalinux/8-init   8.9       2f7f31164cc6   14 months ago   186MB
```

&nbsp;
&nbsp;
# 5. 制作daos-base镜像
## 5.1. 创建目录结构
```bash
mkdir -p /root/daos/daos-base/el8
```
## 5.2. 创建.env文件并添加内容
添加并编辑`/root/daos/.env`文件。
```bash
# Linux image配置
LINUX_DISTRO="el8"
LINUX_IMAGE_NAME="almalinux/8-init"
LINUX_IMAGE_TAG="8.9"

# DAOS image build配置
DAOS_DOCKER_IMAGE_NSP="daos"
DAOS_DOCKER_IMAGE_TAG="2.6.0"
DAOS_HUGEPAGES_NBR=4096
DAOS_IFACE_NAME="enp0s8"
DAOS_IFACE_IP="192.168.3.13"
```

## 5.3. 创建Dockerfile并添加内容
添加并编辑`/root/daos_docker/daos-base/el8/Dockerfile`文件。
```bash
# Pull base image
ARG	LINUX_IMAGE_NAME=""
ARG	LINUX_IMAGE_TAG=""
FROM	$LINUX_IMAGE_NAME:$LINUX_IMAGE_TAG

# Yum repo config
COPY yum.repos.d/* /etc/yum.repos.d/

# Install packages
RUN dnf clean all &&                                                                         \
    dnf makecache &&                                                                         \
    echo "[INFO] Installing base packages" &&                                                \
    dnf install -y dnf-plugins-core &&                                                       \
    dnf config-manager --save --setopt=assumeyes=True &&                                     \
    dnf install vim &&                                                                       \
    dnf install procps-ng &&                                                                 \
    dnf install iproute &&                                                                   \
    echo "[INFO] Installing DAOS" &&                                                         \
    dnf install daos daos-admin daos-server daos-client &&                                   \
    dnf clean all &&                                                                         \
    echo "[INFO] Enable some services" &&                                                    \
    systemctl enable dbus.service

ENTRYPOINT [ "/sbin/init" ]
```
上述`COPY yum.repos.d/* /etc/yum.repos.d/`指令，需要提前将`yum.repos.d`目录拷贝到宿主机`Dockerfile`同级目录下。yum.repos.d目录是提前做好的almalinux daos epel的国内镜像源。


## 5.4. 创建docker-compose.yml并添加内容
添加并编辑`/root/daos_docker/docker-compose.yml`文件。
```yaml
services:
  daos_base:
    image: "${DAOS_DOCKER_IMAGE_NSP}/daos-base-${LINUX_DISTRO}:${DAOS_DOCKER_IMAGE_TAG}"
    build:
      context: "daos-base/el8"
      args:
        - "LINUX_IMAGE_NAME=${LINUX_IMAGE_NAME}"
        - "LINUX_IMAGE_TAG=${LINUX_IMAGE_TAG}"
    privileged: true
    cgroup: host
    volumes:
      - type: bind
        read_only: true
        source: /sys/fs/cgroup
        target: /sys/fs/cgroup
      - type: tmpfs
        target: /run
```

## 5.5. 开始构建
```bash
docker-compose build daos_base
```

构建完成之后，使用`docker images`命令可以看到daos_base镜像已经加载了。
```bash
REPOSITORY           TAG       IMAGE ID       CREATED          SIZE                                                 
daos/daos-base-el8   2.6.0     7f90c7ca6c25   11 seconds ago   191MB
almalinux/8-init     8.9       2f7f31164cc6   14 months ago    186MB
```

## 5.6. 保存镜像（可以跳过）
如果需要在多台机器上部署DAOS集群，那么就需要将上述构建的daos base镜像导出到本地，然后在其他机器上加载该镜像即可。
```bash
docker save -o daos-base-image-2.6.0.tar daos/daos-base-el8:2.6.0
```
其他机器上只需要加载daos-base镜像，不需要加载almalinux镜像。加载镜像的命令如下：
```bash
docker load -i daos-base-image-2.6.0.tar
```

&nbsp;
&nbsp;
# 6. 启动daos-server容器
## 6.1. 编辑docker-compose.yml并添加内容
```yaml
  daos_server:
    image: "${DAOS_DOCKER_IMAGE_NSP}/daos-base-${LINUX_DISTRO}:${DAOS_DOCKER_IMAGE_TAG}"
    container_name: daos-server
    hostname: daos-server
    privileged: true
    cgroup: host
    network_mode: host
    extra_hosts:
      - "daos-server:${DAOS_IFACE_IP}"
    volumes:
      - type: bind
        read_only: true
        source: /sys/fs/cgroup
        target: /sys/fs/cgroup
      - type: bind
        read_only: false
        source: /dev/hugepages
        target: /dev/hugepages
      - type: bind
        read_only: false
        source: /sys/kernel/mm/hugepages
        target: /sys/kernel/mm/hugepages
      - type: bind
        read_only: false
        source: /lib/modules
        target: /lib/modules
      - type: bind
        read_only: false
        source: /sys/devices/system/node
        target: /sys/devices/system/node
      - type: tmpfs
        target: /run
```
- `image`：指定依赖的镜像名，必须和daos_base中保持一致，目的是不需要重新在制作新的的镜像，因此上面配置也将build移除了。
- `network_mode`：指定容器的网络模式，根据DAOS官网所说，目前只支持host模式，因此这里只能填写`host`。

## 6.2. 创建并启动daos_server容器
```bash
docker compose up -d daos_server
```
执行`docker ps -a`命令查看daos-server容器是否正常运行
```bash
CONTAINER ID   IMAGE                      COMMAND        CREATED          STATUS                      PORTS     NAMES
17f0876cfeb3   daos/daos-base-el8:2.6.0   "/sbin/init"   30 minutes ago   Up 30 minutes                         daos-server
```
结果显示，`STATUS:Up 17 seconds`，daos-server容器已经正常启动。

&nbsp;
&nbsp;
# 7. 集群部署
单机集群部署可以参考[DAOS集群部署-单机模式]({{< ref "DAOS集群部署-单机模式.md" >}})。
