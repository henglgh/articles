---
title: kylin安装docker
date: 2025-01-02T16:42:40+0800
description: "本文详细介绍如何在kylin v10上安装dockder。"
tags: [docker]
---


# 1. 前言
本文详细介绍如何在kylin v10上安装dockder。系统环境如下：
```bash
dockder:        20.10.7
linux os:       kylinv 10 (GFB)
linux kernel:   4.19.90-52.23.v2207.gfb01.ky10.aarch64
```

&nbsp;
&nbsp;
# 2. 安装docker
## 2.1. 下载docker二进制包
```bash
wget https://mirror.nju.edu.cn/docker-ce/linux/static/stable/aarch64/docker-20.10.7.tgz
```
此处采用的是从南京大学开源镜像站下载，速度比较快，当然也可以直接从docker官网下载。

&nbsp;
## 2.2. 解压docker二进制包
```bash
tar -zxvf docker-20.10.7.tgz && mv docker/* /usr/local/bin/ && rm -rf docker
```

&nbsp;
## 2.3. 添加service文件
```bash
cat << EOF > /etc/systemd/system/docker.service
[Unit]
Description=Docker Application Container Engine
Documentation=https://docs.docker.com
After=network-online.target docker.socket firewalld.service containerd.service
Wants=network-online.target containerd.service
Requires=docker.socket

[Service]
Type=notify
# the default is not to use systemd for cgroups because the delegate issues still
# exists and systemd currently does not support the cgroup feature set required
# for containers run by docker
ExecStart=/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock
ExecReload=/bin/kill -s HUP $MAINPID
TimeoutStartSec=0
RestartSec=2
Restart=always

# Note that StartLimit* options were moved from "Service" to "Unit" in systemd 229.
# Both the old, and new location are accepted by systemd 229 and up, so using the old location
# to make them work for either version of systemd.
StartLimitBurst=3

# Note that StartLimitInterval was renamed to StartLimitIntervalSec in systemd 230.
# Both the old, and new name are accepted by systemd 230 and up, so using the old name to make
# this option work for either version of systemd.
StartLimitInterval=60s

# Having non-zero Limit*s causes performance problems due to accounting overhead
# in the kernel. We recommend using cgroups to do container-local accounting.
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity

# Comment TasksMax if your systemd version does not support it.
# Only systemd 226 and above support this option.
TasksMax=infinity

# set delegate yes so that systemd does not reset the cgroups of docker containers
Delegate=yes

# kill only the docker process, not all processes in the cgroup
KillMode=process
OOMScoreAdjust=-500

[Install]
WantedBy=multi-user.target
EOF
```

&nbsp;
## 2.4. 添加docker.socket文件
```bash
cat << EOF > /etc/systemd/system/docker.socket
[Unit]
Description=Docker Socket for the API

[Socket]
ListenStream=/var/run/docker.sock
SocketMode=0660
SocketUser=root
SocketGroup=docker

[Install]
WantedBy=sockets.target
EOF
```

&nbsp;
## 2.5. 启动docker engine服务
```bash
systemctl daemon-reload
systemctl enable docker.service
systemctl start docker.service
```

&nbsp;
## 2.6. 验证docker是否安装成功
执行`docker info`命令，如果显示如下信息，则docker安装成功。
```bash
Client:
 Context:    default
 Debug Mode: false

Server:
 Containers: 0
  Running: 0
  Paused: 0
  Stopped: 0
 Images: 1
 Server Version: 20.10.7
 Storage Driver: overlay2
  Backing Filesystem: xfs
  Supports d_type: true
  Native Overlay Diff: true
  userxattr: false
 Logging Driver: json-file
 Cgroup Driver: cgroupfs
 Cgroup Version: 1
 Plugins:
  Volume: local
  Network: bridge host ipvlan macvlan null overlay
  Log: awslogs fluentd gcplogs gelf journald json-file local logentries splunk syslog
 Swarm: inactive
 Runtimes: io.containerd.runc.v2 io.containerd.runtime.v1.linux runc
 Default Runtime: runc
 Init Binary: docker-init
 containerd version: d71fcd7d8303cbf684402823e425e9dd2e99285d
 runc version: b9ee9c6314599f1b4a7f497e1f1f856fe433d3b7
 init version: de40ad0
 Security Options:
  seccomp
   Profile: default
 Kernel Version: 4.19.90-52.23.v2207.gfb01.ky10.aarch64
 Operating System: Kylin Linux Advanced Server V10 (GFB)
 OSType: linux
 Architecture: aarch64
 CPUs: 96
 Total Memory: 126.2GiB
 Name: node0
 ID: 2K52:3OWC:UBNU:KFFJ:3GTW:2V4E:7YKQ:BKZN:H7LW:KLHD:NVZA:JX65
 Docker Root Dir: /var/lib/docker
 Debug Mode: false
 Registry: https://index.docker.io/v1/
 Labels:
 Experimental: false
 Insecure Registries:
  127.0.0.0/8
 Live Restore Enabled: false
 Product License: Community Engine
```

&nbsp;
&nbsp;
# 3. 参考资料
- [https://docs.docker.com/engine/install/binaries/](https://docs.docker.com/engine/install/binaries)
- [https://github.com/docker/packaging/tree/main/pkg/docker-engine/common/systemd](https://github.com/docker/packaging/tree/main/pkg/docker-engine/common/systemd)