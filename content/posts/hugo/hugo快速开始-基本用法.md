---
title: Hugo快速开始-基本用法
date: 2025-03-27T16:03:00+0800
description: "本文全面介绍Hugo的基本命令用法。"
tags: [hugo]
---


# 基本用法
使用命令行界面 （CLI） 执行基本任务。

## 测试安装
安装 Hugo 后，通过运行以下命令来测试您的安装：
```bash
hugo version
```
您应该会看到如下内容：
```bash
hugo v0.123.0-3c8a4713908e48e6523f058ca126710397aa4ed5+extended linux/amd64 BuildDate=2024-02-19T16:32:38Z VendorInfo=gohugoio
```

## 显示可用命令
要查看可用命令和标志的列表，请执行以下作：
```bash
hugo help
```
要获取有关子命令的帮助，请使用 --help 标志。例如：
```bash
hugo server --help
```

## 构建您的网站
要构建您的站点，cd 进入您的项目目录并运行
```bash
hugo
```
hugo 命令构建您的站点，将文件发布到 public 目录。要将站点发布到其他目录，请使用 --destination 标志或在站点配置中设置 publishDir。

> Hugo 在构建您的网站之前不会清除 public 目录。现有文件将被覆盖，但不会被删除。此行为是有意为之，以防止在构建后无意中删除您可能已添加到 public 目录的文件。
> 
> 根据您的需要，您可能希望在每次构建之前手动清除 public 目录的内容。

## 草稿、未来和过期内容
Hugo 允许您在内容的 front matter 中设置 draft、date、publishDate 和 expiryDate。默认情况下，Hugo 在以下情况下不会发布内容：
- draft 值为 true
- date是将来的
- publishDate 是将来的
- expiryDate 是过去的

> Hugo 发布 draft、future 和 expired node 页面的子体。要防止发布这些子体，请使用 cascade front matter 字段将构建选项级联到子体页面。

您可以使用命令行标志覆盖运行 hugo 或 hugo server 时的默认行为：
```bash
hugo --buildDrafts    # or -D
hugo --buildExpired   # or -E
hugo --buildFuture    # or -F
```
尽管您也可以在站点配置中设置这些值，但除非所有内容作者都知道并理解这些设置，否则这可能会导致不需要的结果。

> 如上所述，Hugo 在构建您的网站之前不会清除 public 目录。根据上述四个条件的当前评估，在构建之后，您的 public 目录可能包含来自先前构建的无关文件。一种常见的做法是在每次构建之前手动清除 public 目录的内容，以删除草稿、过期和将来的内容。

## 开发和测试您的网站
要在开发布局或创建内容时查看站点，cd 进入您的项目目录并运行：
```bash
hugo server
```
hugo server 命令使用最小的 HTTP 服务器构建您的网站并提供您的页面。当你运行 hugo server 时，它将显示你本地站点的 URL：
```bash
Web Server is available at http://localhost:1313/
```

当服务器运行时，它会监视您的项目目录，以查找对资源、配置、内容、数据、布局、翻译和静态文件的更改。当检测到更改时，服务器会重建您的站点并使用 LiveReload 刷新您的浏览器。

大多数 Hugo 构建都非常快，除非您直接查看浏览器，否则您可能不会注意到变化。

**LiveReload**

当服务器运行时，Hugo 将 JavaScript 注入生成的 HTML 页面。LiveReload 脚本通过 Web 套接字创建从浏览器到服务器的连接。您无需安装任何软件或浏览器插件，也不需要任何配置。

**自动重定向**

编辑内容时，如果您希望浏览器自动重定向到您上次修改的页面，请运行：
```bash
hugo server --navigateToChanged
```
## 部署站点
>如上所述，Hugo 在构建您的网站之前不会清除 public 目录。在每次构建之前手动清除 public 目录的内容，以删除草稿、过期和将来的内容。

当您准备好部署站点时，请运行：
```bash
hugo
```
这将构建您的站点，并将文件发布到 public 目录。目录结构将如下所示：
```bash
public/
├── categories/
│   ├── index.html
│   └── index.xml  <-- RSS feed for this section
├── posts/
│   ├── my-first-post/
│   │   └── index.html
│   ├── index.html
│   └── index.xml  <-- RSS feed for this section
├── tags/
│   ├── index.html
│   └── index.xml  <-- RSS feed for this section
├── index.html
├── index.xml      <-- RSS feed for the site
└── sitemap.xml
```
在简单的托管环境中，您通常将文件 ftp、rsync 或 scp 连接到虚拟主机的根目录，public 目录的内容同样也许如此。

我们的大多数用户使用 CI/CD 工作流部署他们的站点，其中向他们的 GitHub 或 GitLab 存储库推送会触发构建和部署。受欢迎的提供商包括 AWS Amplify、CloudCannon、Cloudflare Pages、GitHub Pages、GitLab Pages 和 Netlify。