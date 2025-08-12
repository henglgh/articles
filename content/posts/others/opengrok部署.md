---
title: opengrok部署
date: 2021-03-01T10:45:15+0800
description: "本文介绍如何在ubuntu 20.04.6下部署opengrok 1.13.1。"
tags: [others]
---

# 1. 前言
本文介绍如何在ubuntu 20.04.6下部署opengrok 1.13.1，系统环境如下：
```ini
opengrok = "1.13.1"
tomcat = "10.1.18"
uctags = "6.1.0"
linux = "ubuntu server 20.04.6"
```

&nbsp;
&nbsp;
# 2. 准备
## 2.1. 配置java环境
opengrok和tomcat是一个基于java的应用，需要安装jre和jdk。opengrok 1.13.1要求java版本大于11。
```bash
apt install openjdk-11-jdk openjdk-11-jre
```

## 2.2. 下载opengrok
```bash
https://github.com/OpenGrok/OpenGrok/releases
```

## 2.3. 下载tomcat
```bash
https://tomcat.apache.org/
```
tomcat官网提供了已经编译好的可执行程序和源码，建议直接下载编译好的。编译好的分类中又包含`core` `Full documentation` `Deployer` `Embedded`，直接从core分类中下载对应系统坂本即可。

## 2.4. 下载uctags
```bash
https://github.com/universal-ctags
```
ctgas github官网提供了2种仓库：`universal-ctags`和`ctags-nightly-build`，其中universal-ctags是ctags源码，ctags-nightly-build是ctags以编译好的。为了部署方便，建议下载ctags-nightly-build。

&nbsp;
&nbsp;
# 3. 部署
## 3.1. 构建opengrok目录
```bash
mkdir /opengrok/{src,data,dist,etc,log}
```

## 3.2. 解压opengrok到dist目录
```bash
tar -C /opengrok/dist --strip-components=1 -xzf opengrok-1.13.1.tar.gz
```

## 3.3. 配置opengrok log
### 3.3.1. 拷贝log配置文件
```bash
cp /opengrok/dist/doc/logging.properties /opengrok/etc
```

### 3.3.2. 修改log配置
```bash
java.util.logging.FileHandler.pattern = /opengrok/log/opengrok%g.%u.log
```

## 3.4. 配置web application
### 3.4.1. 拷贝opengrok war文件到tomcat目录下**
```bash
cp /opengrok/dist/lib/source.war /apache-tomcat-10.1.18/webapps/opengrok.war
```

### 3.4.2. 启动tomcat
```bash
cd /apache-tomcat-10.1.18/bin
./startup.sh
```
当启动tomcat时，tomcat会自动检测war文件，然后解压war文件，并运行解压后war文件中的web文件。客户端可以通过`http://localhost:8080/opengrok`访问。

### 3.4.3. 修改web文件
tomcat会从web文件中解析`CONFIGURATION`参数的值，该参数的值是opengrok的configuration.xml文件路径。默认情况下是`/opengrok/etc/configuration.xml`，需要根据实际情况修改。
```xml
    <display-name>OpenGrok</display-name>
    <description>A wicked fast source browser</description>
    <context-param>
        <description>Full path to the configuration file where OpenGrok can read its configuration</description>
        <param-name>CONFIGURATION</param-name>
        <param-value>/opengrok/etc/configuration.xml</param-value>
    </context-param>
    <listener>
        <listener-class>org.opengrok.web.WebappListener</listener-class>
    </listener>
```

## 3.5. 配置indexer
### 3.5.1. 添加代码到src目录中
添加代码有很多方式，可以直接解压源码压缩包，也可以使用git拉取，本案例中使用git方式。
```bash
git clone https://github.com/OpenGrok/OpenGrok
```

### 3.5.2. 创建索引
```bash
java \
    -Djava.util.logging.config.file=/opengrok/etc/logging.properties \
    -jar /opengrok/dist/lib/opengrok.jar \
    -c /uctags-2024.01.24-linux-x86_64/bin/ctags \
    -s /opengrok/src -d /opengrok/data -H -P -S -G \
    -W /opengrok/etc/configuration.xml -U http://localhost:8080/opengrok
```
`/uctags-2024.01.24-linux-x86_64/bin/ctags`是ctags路径，`http://localhost:8080/opengrok`是tomcat应用服务地址。创建索引的过程时间可能比较久，和添加代码的量有关。

为了加快创建索引，可以做进一步修改，关闭识别git等选项。
```bash
java \
    -Djava.util.logging.config.file=/opengrok/etc/logging.properties \
    -jar /opengrok/dist/lib/opengrok.jar \
    -c /opengrok/uctags-2024.01.24-linux-x86_64/bin/ctags \
    -s /opengrok/src -d /opengrok/data -P -S \
    -W /opengrok/etc/configuration.xml -U http://localhost:8080/opengrok \
    --ignoreHistoryCacheFailures \
    --disableRepository git \
    --historyBased off \
    --progress
```

- 如果想要再添加源码或者删除源码时，只需要再次执行上面创建索引的命令即可，它会自动从`/opengrok/etc/configuration.xml`中添加或者删除相关源码信息。

成功部署后，再次访问`http://localhost:8080/opengrok`便可以显示出opengrok界面。

&nbsp;
&nbsp;
# 4. 参考资料
- [https://github.com/oracle/opengrok/wiki/How-to-setup-OpenGrok](https://github.com/oracle/opengrok/wiki/How-to-setup-OpenGrok)