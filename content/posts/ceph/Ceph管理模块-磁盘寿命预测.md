---
title: Ceph管理模块-磁盘寿命预测
date: 2021-05-12T14:49:16+0800
description: "本文详细介绍如何开启ceph磁盘预测功能，以及如何使用磁盘预测功能"
tags: [ceph]
---


# 1. 概述
Ceph能够对磁盘设备运行状况指标进行监控。比如，SATA驱动器实现了SMART的标准，此标准提供了有关设备使用情形和运行状况的众多内部指标（像开机小时数、电源循环次数、不可恢复的读取错误数等）。其他诸如SAS和NVMe这样的设备类型也提供了一组类似的指标。所有的这些指标均能够被Ceph借助smartctl工具进行收集。

Ceph可以通过分析收集的运行状况指标来预测驱动器的预期寿命和设备故障，主要是利用diskprediction模块。diskprediction模块支持2种模式：cloud模式和local模式。cloud模式准确率达到95%，local模式准确率达到70%。

在cloud模式下，磁盘的运行状态信息是从Ceph集群收集的，并通过Internet发送到基于云的DiskPrediction服务器。DiskPrediction服务器对数据进行分析，并提供Ceph集群的性能和磁盘健康状态的分析和预测结果。

local模式不需要任何外部服务器进行数据分析和输出结果。在local模式下，diskprediction模块使用内部预测器模块进行磁盘预测服务，然后将磁盘预测结果返回给Ceph系统。

&nbsp;
&nbsp;

# 2. 部署
## 2.1. 安装smartctl
```bash
apt install smartmontools
```
smartctl版本必须要大于7.0。

## 2.2. 安装diskprediction模块
```bash
apt install ceph-mgr-diskprediction-local
```

## 2.3. 启动磁盘监控
```bash
ceph device monitoring on
```

## 2.4. 启动磁盘预测模块
```bash
ceph mgr module enable diskprediction_local
```

## 2.5. 设置磁盘预测模式
```bash
ceph config set global device_failure_prediction_mode local
```

## 2.6. 磁盘预测结果
默认情况下，一旦磁盘预测功能打开后，ceph会启动一个后台进程，每隔24小时抓取磁盘smartctl信息，并使用这些信息进行磁盘预测。可以通过`ceph device ls`命令查看磁盘预测结果。
```bash
bad:      <2w
warning:  >=2w and <=6w
good:     >6w
```