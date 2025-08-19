---
title: Lustre系统架构-QoS
date: 2021-07-06T16:27:14+0800
description: "本文介绍Lustre 2.15.4的Qos功能和使用方法。"
tags: [lustre]
---

> lustre版本：2.15.4

# 1. 简介
QoS（Quality of Service）服务质量。

```bash
[root@node0 ~]# dd if=/dev/zero of=/mnt/fs00-3.242/ddtets1 bs=1M count=1024
1024+0 records in
1024+0 records out
1073741824 bytes (1.1 GB, 1.0 GiB) copied, 11.0249 s, 97.4 MB/s
```

```bash
lctl set_param -P ost.OSS.ost_io.nrs_policies="tbf nid"
```

```bash
[root@node1 ~]# lctl get_param ost.OSS.ost_io.nrs_policies
ost.OSS.ost_io.nrs_policies=

regular_requests:
  - name: fifo
    state: started
    fallback: yes
    queued: 0                   
    active: 0                   

  - name: crrn
    state: stopped
    fallback: no
    queued: 0                   
    active: 0                   

  - name: orr
    state: stopped
    fallback: no
    queued: 0                   
    active: 0                   

  - name: trr
    state: stopped
    fallback: no
    queued: 0                   
    active: 0                   

  - name: tbf nid
    state: started
    fallback: no
    queued: 0                   
    active: 0                   

  - name: delay
    state: stopped
    fallback: no
    queued: 0                   
    active: 0                   

high_priority_requests:
  - name: fifo
    state: started
    fallback: yes
    queued: 0                   
    active: 0                   

  - name: crrn
    state: stopped
    fallback: no
    queued: 0                   
    active: 0                   

  - name: orr
    state: stopped
    fallback: no
    queued: 0                   
    active: 0                   

  - name: trr
    state: stopped
    fallback: no
    queued: 0                   
    active: 0                   

  - name: tbf nid
    state: started
    fallback: no
    queued: 0                   
    active: 0                   

  - name: delay
    state: stopped
    fallback: no
    queued: 0                   
    active: 0 
```

```bash
[root@node1 ~]# lctl get_param ost.OSS.ost_io.nrs_tbf_rule
ost.OSS.ost_io.nrs_tbf_rule=
regular_requests:
CPT 0:
client_247 {192.168.3.247@tcp} 10, ref 0
default {*} 10000, ref 0
CPT 1:
client_247 {192.168.3.247@tcp} 10, ref 0
default {*} 10000, ref 0
high_priority_requests:
CPT 0:
client_247 {192.168.3.247@tcp} 10, ref 0
default {*} 10000, ref 0
CPT 1:
client_247 {192.168.3.247@tcp} 10, ref 0
default {*} 10000, ref 0
```


```bash
[root@node0 ~]# dd if=/dev/zero of=/mnt/fs00-3.242/ddtets2 bs=1M count=1024
1024+0 records in
1024+0 records out
1073741824 bytes (1.1 GB, 1.0 GiB) copied, 50.9477 s, 21.1 MB/s
```