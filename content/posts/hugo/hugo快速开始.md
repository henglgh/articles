# 1. 快速开始
在几分钟内创建一个 Hugo 站点。

在本教程中，您将：
- 创建站点
- 添加内容
- 配置站点
- 发布站点
  
## 1.1. 先决条件
在开始本教程之前，您必须：
- 安装 Hugo（扩展或扩展/部署版，v0.128.0 或更高版本）
- 安装 Git

## 1.2. 创建站点
### 1.2.1. 命令
> 如果您是 Windows 用户，不要使用命令提示符，不要使用 Windows PowerShell，从 PowerShell 或 Linux 终端（如 WSL 或 Git > Bash）运行这些命令。PowerShell 和 Windows PowerShell 是不同的应用程序。

请确认已安装 Hugo v0.128.0 或更高版本。
```bash
hugo version
```
运行这些命令以创建具有 Ananke 主题的 Hugo 网站。下一节将介绍每个命令。

```bash
hugo new site quickstart
cd quickstart
git init
git submodule add https://github.com/theNewDynamic/gohugo-theme-ananke.git themes/ananke
echo "theme = 'ananke'" >> hugo.toml
hugo server
```
使用在终端中显示的 URL 查看站点。按 Ctrl + C 停止 Hugo 的开发服务。

### 1.2.2. 命令说明
在 quickstart 目录中为您的项目创建目录结构。
```bash
hugo new site quickstart
```
将 current directory 更改为项目的根目录。
```bash
cd quickstart
```
在当前目录中初始化一个空的 Git 存储库。
```bash
git init
```
将 Ananke 主题克隆到 themes 目录中，将其作为 Git 子模块添加到您的项目中。
```bash
git submodule add https://github.com/theNewDynamic/gohugo-theme-ananke.git themes/ananke
```
在站点配置文件中附加一行，指示当前主题。
```bash
echo "theme = 'ananke'" >> hugo.toml
```
启动 Hugo 的开发服务器以查看站点。
```bash
hugo server
```
按 Ctrl + C 停止 Hugo 的开发服务。

## 1.3. 添加内容
向您的网站添加新页面。
```bash
hugo new content content/posts/my-first-post.md
```
Hugo 在 content/posts 目录中创建了该文件。使用编辑器打开文件。
```bash
+++
title = 'My First Post'
date = 2024-01-14T07:07:07+01:00
draft = true
+++
```
请注意，front matter 中的 draft 值为 true。默认情况下，Hugo 在您构建站点时不会发布草稿内容。详细了解草稿、未来和过期内容。

在文章的正文中添加一些 Markdown，但不要更改 draft 值。
```bash
+++
title = 'My First Post'
date = 2024-01-14T07:07:07+01:00
draft = true
+++
## Introduction

This is **bold** text, and this is *emphasized* text.

Visit the [Hugo](https://gohugo.io) website!
```
保存文件，然后启动 Hugo 的开发服务器以查看站点。您可以运行以下任一命令来包含草稿内容。

```bash
hugo server --buildDrafts
hugo server -D
```
在终端中显示的 URL 上查看站点。在继续添加和更改内容时，请保持开发服务器运行。

如果对新内容感到满意，请将 front matter draft 参数设置为 false。

> Hugo 的渲染引擎符合 Markdown 的 CommonMark 规范。CommonMark 组织提供了一个由参考实施提供支持的有用的实时测试工具。

## 1.4. 配置站点
使用编辑器，打开项目根目录中的站点配置文件 （hugo.toml）。
```bash
baseURL = 'https://example.org/'
languageCode = 'en-us'
title = 'My New Hugo Site'
theme = 'ananke'
```
进行以下更改：
- 设置生产站点的 baseURL。此值必须以协议开头，并以斜杠结尾，如上所示。
- 将 languageCode 设置为您的语言和区域。
- 设置生产站点的title。

启动 Hugo 的开发服务器以查看您的更改，请记住包含草稿内容。
```bash
hugo server -D
```

> 大多数主题作者都提供了配置指南和选项。请务必访问主题的存储库或文档站点以了解详细信息。

## 1.5. 发布站点
在此步骤中，您将发布站点，但不会部署它。

当您发布站点时，Hugo 会在项目根目录的 public 目录中创建整个静态站点。这包括 HTML 文件以及图像、CSS 文件和 JavaScript 文件等资源。

发布站点时，您通常不希望包含草稿、未来或过期的内容。命令很简单。
```bash
hugo
```
