# 1. Hugo Theme - Article
专用于个人博客网页主题，没有花里胡哨的功能，简约至上！

## 1.1. 特点
- 支持亮/暗主题
- 支持全局搜索（只允许搜索文章标题）
- 支持侧边显示文章目录结构
- 适配PC、平板、手机等各种屏幕尺寸
- 不支持mermaid
- 不支持shortcodes

## 1.2. 截图
### 1.2.1. 主页
![主页](https://raw.githubusercontent.com/henglgh/hugo-theme-article/main/images/home.png)

### 1.2.2. 归档页
![归档页](https://raw.githubusercontent.com/henglgh/hugo-theme-article/main/images/list.png)

### 1.2.3. 归档列表页
![归档列表页](https://raw.githubusercontent.com/henglgh/hugo-theme-article/main/images/archive.png)

### 1.2.4. 文章页
![文章页](https://raw.githubusercontent.com/henglgh/hugo-theme-article/main/images/single.png)

### 1.2.5. 搜索页
![搜索页](https://raw.githubusercontent.com/henglgh/hugo-theme-article/main/images/search.png)

### 1.2.6. 移动端适配
![手机](https://raw.githubusercontent.com/henglgh/hugo-theme-article/main/images/moblie.png)


## 1.3. 安装
clone自己的项目到本地并切换到项目的根目录，比如有一个blog项目：
```bash
cd blog
```
在blog项目中创建名为themes的目录
```bash
mkdir themes
```
切换到themes目录下后将主题代码仓库执clone到themes目录下
```bash
git clone https://github.com/henglgh/hugo-theme-article.git
```
在`content/posts`目录（content目录下可以任意创建子目录，不一定是posts）下添加内容文件，文件内容模板如下：
```md
---
title: 测试文件
date: 2024-12-09T14:49:41+0800
description: "这是一个测试文件"
tags: [test]
---


# 1. 概述
欢迎使用article主题！
```


最后一步，也是非常重要的一步：修改你的项目根目录下的config.toml文件（此处，是修改blog根目录下的config.toml文件），并添加一下内容：
```bash
theme="hugo-theme-article"
```
其中`hugo-theme-article`就是主题的目录名字（不是路径，只是目录的名字！），两者一定要相同。

最后执行`hugo server`运行，如果不出意外的话，应该能看到正常的渲染结果。

## 1.4. 配置
```toml
baseURL = 'https://henglgh.github.io/hugo-theme-article'
languageCode = 'en-us'
timeZone = "Asia/Shanghai"
title = "阿根"
copyright = "© 阿根"

[module]
  [module.hugoVersion]
    extended = false
    min = "0.116.0"

[params]
  mode="toggle"
  useCDN=false
  [[params.social]]
    name = "GitHub"
    icon = "github"
    url = "https://github.com/henglgh/hugo-theme-article"

[outputs]
  home = ["HTML", "JSON"]

[menus]
  [[menu.main]]
    name = "Archive"
    url = "/tags"
    weight = 1

[markup]
  [markup.goldmark]
    [markup.goldmark.extensions]
      [markup.goldmark.extensions.passthrough]
        enable = true
  [markup.highlight]
    noClasses = false
    tabWidth = 2
  [markup.tableOfContents]
    startLevel = 1
    endLevel = 6

[pagination]
  disablePagination = true
```

### 1.4.1. 配置说明
- `baseURL`：githubpage主页的url。一定要注意最后有没有多一个`/`，因为多一个或者少一个`/`，对于hugo解析路径可能会出错。
- `title`：网页的名字。
- `params`：自定义hugo参数。
  - `params.social`：配置社交平台，icon是从feather.js中直接获取的，目前只试了github平台，其他平台没有尝试。
- `menus`：配置菜单项
  - `name`：可以随便配置
  - `url`：一定是hugo生成的pulic目录下的目录名，`/`其中就是代表pulic。
- `markup`：配置markdown解析器，建议非必要不要修改了。
- `pagination`：配置分页，此处分页功能被禁用。

建议可以完全采用这个配置，根据需要修改`baseURL、title、params`，其他参数非常不建议修改！
