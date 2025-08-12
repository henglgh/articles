---
title: IB网络配置-bond
date: 2021-03-03T10:45:15+0800
description: "本文详细介绍在almalinux 8.9上如何设置IB网卡聚合并配置静态ip。"
tags: [others]
---

# 1. 前言
本文详细介绍在almalinux 8.9上如何设置IB网卡聚合并配置静态ip。

&nbsp;
&nbsp;
# 2. 驱动安装
## 2.1. 下载驱动
IB网卡驱动由厂家提供，本文介绍的驱动是英伟达官方发布。在下载驱动前要检查IB网卡型号，并查找支持该型号的驱动。下载地址为：https://network.nvidia.com/products/infiniband-drivers/linux/mlnx_ofed/

## 2.2. 安装驱动
将驱动压缩包解压后，执行`sudo ./mlnxofedinstall`安装驱动。

## 2.3. 启动服务
```bash
/etc/init.d/openibd restart
/etc/init.d/opensmd restart
```

&nbsp;
&nbsp;
# 3. IB网卡测试
## 3.1. 查看ib网卡状态
```bash
ibstat
----------------------------------
CA 'mlx5_0'
	CA type: MT4123
	Number of ports: 1
	Firmware version: 20.39.2048
	Hardware version: 0
	Node GUID: 0xa088c203002cf0e0
	System image GUID: 0xa088c203002cf0e0
	Port 1:
		State: Active
		Physical state: LinkUp
		Rate: 200
		Base lid: 207
		LMC: 0
		SM lid: 1
		Capability mask: 0xa651e848
		Port GUID: 0xa088c203002cf0e0
		Link layer: InfiniBand
CA 'mlx5_1'
	CA type: MT4123
	Number of ports: 1
	Firmware version: 20.39.2048
	Hardware version: 0
	Node GUID: 0xa088c203002d3ef0
	System image GUID: 0xa088c203002d3ef0
	Port 1:
		State: Active
		Physical state: LinkUp
		Rate: 200
		Base lid: 200
		LMC: 0
		SM lid: 1
		Capability mask: 0xa651e848
		Port GUID: 0xa088c203002d3ef0
		Link layer: InfiniBand
```
从以上结果可以看到，检测到2个IB网卡：`mlx5_0`和`mlx5_1`。对于每个网卡的信息中，重点关注`State`、`Link layer` 两个字段。`State: Active`表示该网卡处于正常工作状态，`Link layer: InfiniBand`表示该网卡工作在InfiniBand模式。IB网卡工作模式有两种：Ethernet和InfiniBand。

## 3.2. 连通性测试
使用ibping命令来测试两台机器之间IB网络连通情况。

### 3.2.1. 服务端
```bash
ibping -S -C mlx5_0 -P 1
```
### 3.2.2. 客户端
```bash
ibping -c 10000 -f -C mlx5_0 -L 205
-------------------------------------

--- node3.(none) (Lid 205) ibping statistics ---
10000 packets transmitted, 10000 received, 0% packet loss, time 84 ms
rtt min/avg/max = 0.002/0.008/0.019 ms
```

## 3.3. 带宽测试
### 3.3.1. 服务端
```bash
ib_write_bw -a -d mlx5_0 --report_gbits
-----------------------------------------

************************************
* Waiting for client to connect... *
************************************
---------------------------------------------------------------------------------------
                    RDMA_Write BW Test
 Dual-port       : OFF		Device         : mlx5_0
 Number of qps   : 1		Transport type : IB
 Connection type : RC		Using SRQ      : OFF
 PCIe relax order: ON
 ibv_wr* API     : ON
 CQ Moderation   : 100
 Mtu             : 4096[B]
 Link type       : IB
 Max inline data : 0[B]
 rdma_cm QPs	 : OFF
 Data ex. method : Ethernet
---------------------------------------------------------------------------------------
 local address: LID 0xcd QPN 0x14ed7 PSN 0x6490b0 RKey 0x06c6d4 VAddr 0x007f14513e5000
 remote address: LID 0xcf QPN 0x15e2f PSN 0x93b196 RKey 0x00a8d1 VAddr 0x007fb537d34000
---------------------------------------------------------------------------------------
 #bytes     #iterations    BW peak[Gb/sec]    BW average[Gb/sec]   MsgRate[Mpps]
 8388608    5000             196.80             196.80 		   0.002933
---------------------------------------------------------------------------------------
```

### 3.3.2. 客户端
```bash
ib_write_bw -a -F 10.1.90.3 -d mlx5_0 --report_gbits
-------------------------------------------------------
                    RDMA_Write BW Test
 Dual-port       : OFF		Device         : mlx5_0
 Number of qps   : 1		Transport type : IB
 Connection type : RC		Using SRQ      : OFF
 PCIe relax order: ON
 ibv_wr* API     : ON
 TX depth        : 128
 CQ Moderation   : 100
 Mtu             : 4096[B]
 Link type       : IB
 Max inline data : 0[B]
 rdma_cm QPs	 : OFF
 Data ex. method : Ethernet
---------------------------------------------------------------------------------------
 local address: LID 0xcf QPN 0x15e2f PSN 0x93b196 RKey 0x00a8d1 VAddr 0x007fb537d34000
 remote address: LID 0xcd QPN 0x14ed7 PSN 0x6490b0 RKey 0x06c6d4 VAddr 0x007f14513e5000
---------------------------------------------------------------------------------------
 #bytes     #iterations    BW peak[Gb/sec]    BW average[Gb/sec]   MsgRate[Mpps]
 2          5000           0.086643            0.086198            5.387353
 4          5000             0.17               0.17   		   5.444247
 8          5000             0.35               0.35   		   5.455403
 16         5000             0.70               0.70   		   5.458773
 32         5000             1.40               1.40   		   5.464472
 64         5000             2.82               2.81   		   5.484173
 128        5000             5.63               5.60   		   5.465125
 256        5000             11.23              11.19  		   5.465888
 512        5000             22.38              22.36  		   5.457910
 1024       5000             44.52              44.46  		   5.426791
 2048       5000             88.88              88.77  		   5.418079
 4096       5000             157.04             156.59 		   4.778655
 8192       5000             196.41             196.28 		   2.995013
 16384      5000             196.61             196.57 		   1.499719
 32768      5000             196.71             196.70 		   0.750358
 65536      5000             196.76             196.75 		   0.375268
 131072     5000             196.78             196.77 		   0.187653
 262144     5000             196.79             196.79 		   0.093837
 524288     5000             196.79             196.79 		   0.046918
 1048576    5000             196.80             196.80 		   0.023460
 2097152    5000             196.80             196.80 		   0.011730
 4194304    5000             196.79             196.79 		   0.005865
 8388608    5000             196.80             196.80 		   0.002933
---------------------------------------------------------------------------------------
```

&nbsp;
&nbsp;
# 4. IB网络配置
## 4.1. 查看IB网卡映射
```bash
ibdev2netdev
---------------------------------------------------------------------------------------
mlx5_0 port 1 ==> ib0 (Up)
mlx5_1 port 1 ==> ib1 (Up)
```
以上结果显示，`mlx5_0`和`mlx5_1`两个IB网卡在系统中分别映射成`ib0`和`ib1`两个网卡。在配置IB网卡的ip地址时，实际上是配置`ib0`和`ib1`，而不是`mlx5_0`和`mlx5_1`。

## 4.2. IB网卡bond配置
### 4.2.1. bond0配置
添加/etc/sysconfig/network-scripts/ifcfg-bond0文件，并追加以下内容：
```bash
CONNECTED_MODE=no
TYPE=bond
PROXY_METHOD=none
BROWSER_ONLY=no
BOOTPROTO=none
DEFROUTE=yes
IPV4_FAILURE_FATAL=no
IPV6INIT=yes
IPV6_AUTOCONF=no
IPV6_DEFROUTE=no
IPV6_FAILURE_FATAL=no
NAME=bond0
DEVICE=bond0
ONBOOT=yes
IPADDR=30.1.90.4
NETMASK=255.0.0.0
USERCTL=no
BONDING_MASTER=yes
BONDING_OPTS="mode=1 miimon=100"
```
其中最重要的是`TYPE`、`BONDING_MASTER`两个字段。网上在配置bond时通常将`TYPE`字段设置成bonding，然后再现场配置时，必须要配置成bond才有效。

修改/etc/modprobe.d/ib_ipoib.conf，并追加以下内容：
```bash
alias bond0 bonding
options bond0 miimon=100 mode=1 max_bonds=1
```

### 4.2.2. ib0配置
```bash
CONNECTED_MODE=no
TYPE=InfiniBand
PROXY_METHOD=none
BROWSER_ONLY=no
BOOTPROTO=none
NAME=ib0
DEVICE=ib0
ONBOOT=yes
USERCTL=no
MASTER=bond0
SLAVE=yes
PRIMARY=yes
```

### 4.2.3. ib1配置
```bash
CONNECTED_MODE=no
TYPE=InfiniBand
PROXY_METHOD=none
BROWSER_ONLY=no
BOOTPROTO=none
NAME=ib1
DEVICE=ib1
ONBOOT=yes
USERCTL=no
MASTER=bond0
SLAVE=yes
```

### 4.2.4. 重启网络
```bash
nmcli connection reload
```

### 4.2.5. 查看ip
```bash
ip a
----------
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host 
       valid_lft forever preferred_lft forever
2: eno1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether 34:73:79:be:24:30 brd ff:ff:ff:ff:ff:ff
    altname enp24s0f0
    altname ens64f0
    inet 10.1.90.4/16 brd 10.1.255.255 scope global noprefixroute eno1
       valid_lft forever preferred_lft forever
    inet6 fe80::3673:79ff:febe:2430/64 scope link noprefixroute 
       valid_lft forever preferred_lft forever
3: eno2: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc mq state DOWN group default qlen 1000
    link/ether 34:73:79:be:24:31 brd ff:ff:ff:ff:ff:ff
    altname enp24s0f1
    altname ens64f1
4: ib0: <BROADCAST,MULTICAST,SLAVE,UP,LOWER_UP> mtu 1500 qdisc mq master bond0 state UP group default qlen 256
    link/infiniband 00:00:10:29:fe:80:00:00:00:00:00:00:a0:88:c2:03:00:2c:f0:e0 brd 00:ff:ff:ff:ff:12:40:1b:ff:ff:00:00:00:00:00:00:ff:ff:ff:ff
5: ib1: <BROADCAST,MULTICAST,SLAVE,UP,LOWER_UP> mtu 1500 qdisc mq master bond0 state UP group default qlen 256
    link/infiniband 00:00:10:29:fe:80:00:00:00:00:00:00:a0:88:c2:03:00:2d:3e:f0 brd 00:ff:ff:ff:ff:12:40:1b:ff:ff:00:00:00:00:00:00:ff:ff:ff:ff
6: bond0: <BROADCAST,MULTICAST,MASTER,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default qlen 1000
    link/infiniband 00:00:10:29:fe:80:00:00:00:00:00:00:a0:88:c2:03:00:2d:3e:f0 brd 00:ff:ff:ff:ff:12:40:1b:ff:ff:00:00:00:00:00:00:ff:ff:ff:ff
    inet 30.1.90.4/8 brd 30.255.255.255 scope global noprefixroute bond0
       valid_lft forever preferred_lft forever
```

&nbsp;
&nbsp;
# 5. 参考资料
- [NVIDIA InfiniBand Drivers](https://network.nvidia.com/products/infiniband-drivers/linux/mlnx_ofed/)
- [NVIDIA Documentation Hub](https://docs.nvidia.com/)