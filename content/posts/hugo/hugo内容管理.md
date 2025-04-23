# 1. 构建选项
构建选项有助于定义 Hugo 在构建站点时必须如何处理给定的页面。

构建选项存储在名为 build 的保留 front matter 对象中，具有以下默认值：

`content/example/index.md`：
```md
+++
[build]
  list = 'always'
  publishResources = true
  render = 'always'
+++
```

**list**

何时将页面包含在页面集合中。指定以下选项之一：
- `always`：将页面包含在所有页面集合中。例如，site.RegularPages、.Pages等。这是默认值。
- `local`：将页面包含在本地页面集合中。例如，.RegularPages、.Pages等。使用此选项可创建完全可导航但无头的内容部分。
- `never`：不要将页面包含在任何页面集合中。

**publishResources**

适应于页面捆绑，确定是否发布关联的页面资源。指定以下选项之一：
- `true`：始终发布资源。这是默认值。
- `false`：仅在模板中调用资源的 Permalink、RelPermalink 或 Publish 方法时发布资源。

**render**

何时呈现页面。指定以下选项之一：
- `always`：始终将页面呈现到磁盘。这是默认值。
- `link`：不将页面呈现到磁盘，但分配 Permalink 和 RelPermalink 值。
- `never`：从不将页面呈现到磁盘，并将其从所有页面集合中排除。

> 任何页面，无论其构建选项如何，都将对 .Page.GetPage 或 .Site.GetPage 方法可用。

## 1.1. 示例 – Headless page
```bash
content/
├── headless/
│   ├── a.jpg
│   ├── b.jpg
│   └── index.md  <-- leaf bundle
└── _index.md     <-- home page
```
在 front matter 中设置构建选项`content/headless/index.md`：
```md
+++
title = 'Headless page'
[build]
  list = 'never'
  publishResources = false
  render = 'never'
+++
```
要在主页上包含内容和图像：

`layouts/_default/home.html`
```html
{{ with .Site.GetPage "/headless" }}
  {{ .Content }}
  {{ range .Resources.ByType "image" }}
    <img src="{{ .RelPermalink }}" width="{{ .Width }}" height="{{ .Height }}" alt="">
  {{ end }}
{{ end }}
```
已发布的网站将具有以下结构：
```bash
public/
├── headless/
│   ├── a.jpg
│   └── b.jpg
└── index.html
```
在上面的示例中，请注意：
- Hugo 没有发布该页面的 HTML 文件。
- 尽管在 front matter 中将 publishResources 设置为 false，但 Hugo 还是发布了页面资源，因为我们在每个资源上调用了 RelPermalink 方法。这是预期行为。

## 1.2. 示例 - headless section
创建一个未发布的部分，其内容和资源可以包含在其他页面中。
```bash
content/
├── headless/
│   ├── note-1/
│   │   ├── a.jpg
│   │   ├── b.jpg
│   │   └── index.md  <-- leaf bundle
│   ├── note-2/
│   │   ├── c.jpg
│   │   ├── d.jpg
│   │   └── index.md  <-- leaf bundle
│   └── _index.md     <-- branch bundle
└── _index.md         <-- home page
```

在 front matter 中设置构建选项，使用 cascade 关键字将值“级联”到后代页面。

`content/headless/_index.md`：
```md
+++
title = 'Headless section'
[[cascade]]
  [cascade.build]
    list = 'local'
    publishResources = false
    render = 'never'
+++
```
在上面的 front matter 中，请注意，我们已将 list 设置为 local 以将子页面包含在本地页面集合中。

要在主页上包含内容和图像：

`layouts/_default/home.html`：
```html
{{ with .Site.GetPage "/headless" }}
  {{ range .Pages }}
    {{ .Content }}
    {{ range .Resources.ByType "image" }}
      <img src="{{ .RelPermalink }}" width="{{ .Width }}" height="{{ .Height }}" alt="">
    {{ end }}
  {{ end }}
{{ end }}
```

已发布的网站将具有以下结构：
```bash
public/
├── headless/
│   ├── note-1/
│   │   ├── a.jpg
│   │   └── b.jpg
│   └── note-2/
│       ├── c.jpg
│       └── d.jpg
└── index.html
```
在上面的示例中，请注意：
- Hugo 没有发布该页面的 HTML 文件。
- 尽管在 front matter 中将 publishResources 设置为 false，但 Hugo 还是发布了页面资源，因为我们在每个资源上调用了 RelPermalink 方法。这是预期行为。

## 1.3. 示例 – list without publishing
发布章节页面而不发布子页面。例如，要创建词汇表：
```bash
content/
├── glossary/
│   ├── _index.md
│   ├── bar.md
│   ├── baz.md
│   └── foo.md
└── _index.md
```
在 front matter 中设置构建选项，使用 cascade 关键字将值“级联”到后代页面。

`content/glossary/_index.md`：
```md
+++
title = 'Glossary'
[build]
  render = 'always'
[[cascade]]
  [cascade.build]
    list = 'local'
    publishResources = false
    render = 'never'
+++
```
要呈现词汇表：

`layouts/glossary/list.html`：
```html
<dl>
  {{ range .Pages }}
    <dt>{{ .Title }}</dt>
    <dd>{{ .Content }}</dd>
  {{ end }}
</dl>
```
已发布的网站将具有以下结构：
```bash
public/
├── glossary/
│   └── index.html
└── index.html
```

## 1.4. 示例 – publish without listing
发布部分的子页面，而不发布部分页面本身。
```bash
content/
├── books/
│   ├── _index.md
│   ├── book-1.md
│   └── book-2.md
└── _index.md
```
在 front matter 中设置构建选项：

`content/books/_index.md`：
```bash
+++
title = 'Books'
[build]
  list = 'never'
  render = 'never'
+++
```
已发布的网站将具有以下结构：
```bash
public/
├── books/
│   ├── book-1/
│   │   └── index.html
│   └── book-2/
│       └── index.html
└── index.html
```

## 1.5. 示例 – conditionally hide section
请考虑以下示例。文档站点有一个贡献者团队，可以访问 20 个自定义短代码。每个短代码都带有多个参数，并且需要文档供贡献者在使用它们时参考。

不要为短代码提供外部文档，而是在构建生产站点时隐藏的 “internal” 部分。

```bash
content/
├── internal/
│   ├── shortcodes/
│   │   ├── _index.md
│   │   ├── shortcode-1.md
│   │   └── shortcode-2.md
│   └── _index.md
├── reference/
│   ├── _index.md
│   ├── reference-1.md
│   └── reference-2.md
├── tutorials/
│   ├── _index.md
│   ├── tutorial-1.md
│   └── tutorial-2.md
└── _index.md
```
在 front matter 中设置构建选项，使用 cascade 关键字将值“级联”到后代页面，并使用 target 关键字定位生产环境。在 `content/internal/_index.md` 文件中设置以下内容：
```md
title = 'Internal'
[[cascade]]
  [cascade.build]
    list = 'never'
    render = 'never'
  [cascade.target]
    environment = 'production'
```
生产站点将具有以下结构：
```bash
public/
├── reference/
│   ├── reference-1/
│   │   └── index.html
│   ├── reference-2/
│   │   └── index.html
│   └── index.html
├── tutorials/
│   ├── tutorial-1/
│   │   └── index.html
│   ├── tutorial-2/
│   │   └── index.html
│   └── index.html
└── index.html
```