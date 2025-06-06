---
title: Hugo内容管理-评论
date: 2025-03-31T16:03:00+0800
description: "本文全面介绍Hugo评论的用法。"
tags: [hugo]
---

# 1. 评论
Hugo 附带了一个内部 Disqus 模板，但这并不是唯一适用于您的 New Hugo 网站的评论系统

Hugo 附带对 Disqus 的支持，Disqus 是一种第三方服务，通过 JavaScript 为网站提供评论和社区功能。

您的主题可能已经支持 Disqus，但如果没有，可以通过 Hugo 内置的 Disqus 部分轻松添加到您的模板中。

## 1.1. 添加 Disqus
Hugo 附带了将 Disqus 加载到模板中所需的所有代码。在将 Disqus 添加到您的网站之前，您需要设置一个帐户。

### 1.1.1. 配置 Disqus
Disqus 评论要求你在网站的配置文件`hugo.toml`中设置一个值，如下所示：
```toml
[services]
  [services.disqus]
    shortname = 'your-disqus-shortname'
```
对于许多网站来说，这已经足够了。但是，您还可以选择在单个内容文件的 front matter 中设置以下内容：
- disqus_identifier
- disqus_title
- disqus_url

### 1.1.2. 渲染 Hugo 内置的 Disqus 部分模板
Disqus 有自己的内部模板可用，要渲染它，请在您希望评论出现的地方添加以下代码：
```html
{{ template "_internal/disqus.html" . }}
```

## 1.2. 可选的评论系统
**商业评论系统**
- Emote
- Graph Comment
- Hyvor Talk
- IntenseDebate
- ReplyBox

**开源的评论系统**
- Cactus Comments
- Comentario
- Comma
- Commento
- Discourse
- Giscus
- Isso
- Remark42
- Staticman
- Talkyard
- Utterances