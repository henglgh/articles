---
title: Hugo内容管理-原型
date: 2025-03-31T10:03:00+0800
description: "本文全面介绍Hugo原型的用法。"
tags: [hugo]
---


# 1. 原型（Archetypes）
原型是新内容的模板。

## 1.1. 概述
内容文件由 front matter 和 markup 组成。markup通常是 Markdown，但 Hugo 也支持其他内容格式。Front matter 可以是 TOML、YAML 或 JSON。

`hugo new content`命令使用原型作为模板在 content 目录中创建一个新文件。这是默认的原型`archetypes/default.md`：

```toml
+++
date = '{{ .Date }}'
draft = true
title = '{{ replace .File.ContentBaseName `-` ` ` | title }}'
+++
```
创建新内容时，Hugo 会评估原型中的模板行为。例如：
```bash
hugo new content posts/my-first-post.md
```
使用上面显示的默认原型，Hugo 创建以下内容文件`content/posts/my-first-post.md`：
```toml
date = '2023-08-24T11:49:46-07:00'
draft = true
title = 'My First Post'
```
您可以为一个或多个内容类型创建原型。例如，对帖子使用一个原型，对其他所有内容使用默认原型：
```bash
archetypes/
├── default.md
└── posts.md
```

## 1.2. 查找顺序
Hugo 先在项目根目录的archetypes目录中查找原型，然后回退到 themes 或已安装模块中的 archetypes 目录。特定内容类型的原型优先于默认原型。

例如，使用以下命令：
```bash
hugo new content posts/my-first-post.md
```
原型查找顺序为：
1. archetypes/posts.md
2. archetypes/default.md
3. themes/my-theme/archetypes/posts.md
4. themes/my-theme/archetypes/default.md

如果这些都不存在，Hugo 将使用内置的默认原型。

## 1.3. 函数和上下文
您可以在原型中使用任何模板函数。如上所示，默认原型在前面填充标题时使用 replace 函数将连字符替换为空格。

原型接收以下上下文：
- `Date`：（string）当前日期和时间，按照 RFC3339 进行格式设置。
- `File`：（hugolib.fileInfo）返回当前页的文件信息。
- `Type`：（string）从顶级目录名称推断的内容类型，或由传递给 hugo new content 命令的 --kind 标志指定的内容类型。
- `Site`：（page.Site）当前 site 对象。

## 1.4. 日期格式
要以不同的格式插入日期和时间，请使用time.Now功能`archetypes/default.md`：
```toml
+++
date = '{{ time.Now.Format "2006-01-02" }}'
draft = true
title = '{{ replace .File.ContentBaseName `-` ` ` | title }}'
+++
```
## 1.5. 包含内容
虽然通常用作 front matter 模板，但您也可以使用原型来填充内容。

例如，在文档站点中，您可能有一个函数部分（内容类型）。本节中的每个页面都应遵循相同的格式：简要说明、函数签名、示例和注释。我们可以预先填充页面以提醒内容作者使用标准格式。

`archetypes/functions.md`：
```markdown
---
date: '{{ .Date }}'
draft: true
title: '{{ replace .File.ContentBaseName `-` ` ` | title }}'
---

A brief description of what the function does, using simple present tense in the third person singular form. For example:

`someFunction` returns the string `s` repeated `n` times.

## Signature

```text
func someFunction(s string, n int) string 
\```

## Examples

One or more practical examples, each within a fenced code block.

## Notes

Additional information to clarify as needed.
```
尽管您可以在内容正文中包含模板行为，但请记住，Hugo 会在创建内容时对这些进行评估一次。在大多数情况下，将模板行为放在模板中，Hugo 会在您每次构建站点时评估这些行为。

## 1.6. 子叶束（Leaf bundles）
您还可以为子叶束（可以理解为子叶包，它是内容的一个小集合）创建原型。

例如，在摄影网站中，您可能有一个的部分（内容类型）是关于画册的。每个画册都是包含内容和图像的叶子捆绑包。

为 galleries 创建一个原型：
```bash
archetypes/
├── galleries/
│   ├── images/
│   │   └── .gitkeep
│   └── index.md      <-- same format as default.md
└── default.md
```
原型中的子目录必须至少包含一个文件。如果没有文件，Hugo 将在创建新内容时创建子目录。文件名和大小无关紧要。上面的示例包括一个 .gitkeep 文件，这是一个空文件，通常用于在 Git 存储库中保留其他空目录。

要创建新图库：
```bash
hugo new galleries/bryce-canyon
```
这将产生：
```bash
content/
├── galleries/
│   └── bryce-canyon/
│       ├── images/
│       │   └── .gitkeep
│       └── index.md
└── _index.md
```

## 1.7. 指定原型
使用`--kind`命令行标志在创建内容时指定原型。

例如，假设您的网站有两个部分：articles 和 tutorials。为每个内容类型创建一个原型：
```bash
archetypes/
├── articles.md
├── default.md
└── tutorials.md
```
要使用 articles 原型创建文章：
```bash
hugo new content articles/something.md
```
要使用 tutorials 原型创建文章：
```bash
hugo new content --kind tutorials articles/something.md
```