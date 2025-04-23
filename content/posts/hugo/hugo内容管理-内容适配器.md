# 内容适配器
创建内容适配器以在构建站点时动态添加内容。该功能是从v0.126.0开始引入的。

## 概述
内容适配器是在构建站点时动态创建页面的模板。例如，使用内容适配器从远程数据源（如 JSON、TOML、YAML 或 XML）创建页面。

与驻留在 layouts 目录中的模板不同，内容适配器驻留在 content 目录中，每种语言的每个目录不超过一个。当内容适配器创建页面时，页面的逻辑路径将相对于内容适配器。

```bash
content/
├── articles/
│   ├── _index.md
│   ├── article-1.md
│   └── article-2.md
├── books/
│   ├── _content.gotmpl  <-- content adapter
│   └── _index.md
└── films/
    ├── _content.gotmpl  <-- content adapter
    └── _index.md
```

每个内容适配器都命名为 _content.gotmpl，并使用与 layouts 目录中的 templates 相同的语法。您可以使用内容适配器中的任何模板函数，以及下面描述的方法。

## 方法
在内容适配器中使用这些方法。

### AddPage
向网站添加页面。

`content/books/_content.gotmpl`：

```bash
{{ $content := dict
  "mediaType" "text/markdown"
  "value" "The _Hunchback of Notre Dame_ was written by Victor Hugo."
}}
{{ $page := dict
  "content" $content
  "kind" "page"
  "path" "the-hunchback-of-notre-dame"
  "title" "The Hunchback of Notre Dame"
}}
{{ .AddPage $page }}
```

### AddResource
将页面资源添加到站点。

`content/books/_content.gotmpl`：

```bash
{{ with resources.Get "images/a.jpg" }}
  {{ $content := dict
    "mediaType" .MediaType.Type
    "value" .
  }}
  {{ $resource := dict
    "content" $content
    "path" "the-hunchback-of-notre-dame/cover.jpg"
  }}
  {{ $.AddResource $resource }}
{{ end }}
```

然后，使用如下内容检索新页面资源：

`layouts/_default/single.html`：

```bash
{{ with .Resources.Get "cover.jpg" }}
  <img src="{{ .RelPermalink }}" width="{{ .Width }}" height="{{ .Height }}" alt="">
{{ end }}
```

### Site
返回将向其添加页面的 Site。

`content/books/_content.gotmpl`：

```bash
{{ .Site.Title }}
```

> 请注意，从内容适配器调用时，返回的 Site 并未完全构建;如果您尝试调用依赖于页面的方法，例如 .Site.Pages 时，您将收到一条错误消息，指出“在站点完全初始化之前无法调用此方法”。

### Store
返回一个持久的 “scratch pad” 来存储和作数据。此主要用例是在设置 EnableAllLanguages 时在执行之间传输值。

`content/books/_content.gotmpl`：

```bash
{{ .Store.Set "key" "value" }}
{{ .Store.Get "key" }}
```

### EnableAllLanguages
默认情况下，Hugo 执行 _content.gotmpl 文件定义的语言的内容适配器。使用此方法可激活所有语言的内容适配器。

`content/books/_content.gotmpl`：

```bash
{{ .EnableAllLanguages }}
{{ $content := dict
  "mediaType" "text/markdown"
  "value" "The _Hunchback of Notre Dame_ was written by Victor Hugo."
}}
{{ $page := dict
  "content" $content
  "kind" "page"
  "path" "the-hunchback-of-notre-dame"
  "title" "The Hunchback of Notre Dame"
}}
{{ .AddPage $page }}
```

## Page 映射
设置传递给 AddPage 方法的映射中的任何 front matter 字段，不包括markup。不要设置markup字段，而是指定 content.mediaType，如下所述。

下表描述了最常传递给 AddPage 方法的字段。
|Key|Description|Required|
|---|---|---|
|content.mediaType|内容媒体类型。默认值为 text/markdown。有关示例，请参阅 内容格式 。||
|content.value|值为字符串类型||
|dates.date|页面创建日期，值为time.Time类型的||
|dates.expiryDate|页面到期日期，值为time.Time类型的||
|dates.lastmod|页面上次修改日期，值为time.Time类型的||
|dates.publishDate|页面发布日期，值为time.Time类型的||
|params|内容媒体类型。页面参数的映射。||
|path|内容媒体类型。页面相对于内容适配器的逻辑路径。不要包含前导斜杠或文件扩展名。|✔️|
|title|内容媒体类型。默认值为 text/markdown。有关示例，请参阅 内容格式 。|页面标题。|

> 虽然 path 是唯一的必填字段，但我们建议同时设置 title。设置path时，Hugo 将给定的字符串转换为逻辑路径。例如，将 path 设置为 A B C 会生成 /section/a-b-c 的逻辑路径。

## Resource 映射
使用以下字段构造传递给 AddResource 方法的映射。
|Key|Description|Required|
|---|---|---|
|content.mediaType|内容媒体类型。|✔️|
|content.value|值为字符串或者是resource|✔️|
|name|资源名称。||
|params|资源参数的映射。||
|path|资源相对于内容适配器的逻辑路径。不要包含前导斜杠。|✔️|
|title|资源标题。||

> 如果 content.value 是字符串，Hugo 会创建一个新资源。如果 content.value 是资源，则 Hugo 从现有资源中获取该值。
> 
> 设置path时，Hugo 将给定的字符串转换为逻辑路径。例如，将 path 设置为 A B C/cover.jpg 会生成 /section/a-b-c/cover.jpg 的逻辑路径。

## 示例
从远程数据创建页面，其中每个页面代表一篇书评。

创建内容结构。
```bash
content/
└── books/
    ├── _content.gotmpl  <-- content adapter
    └── _index.md
```

检查远程数据以确定如何将键值对映射到 front matter 字段。
```bash
https://gohugo.io/shared/examples/data/books.json
```

创建内容适配器。

`content/books/_content.gotmpl`：

```bash
{{/* Get remote data. */}}
{{ $data := dict }}
{{ $url := "https://gohugo.io/shared/examples/data/books.json" }}
{{ with try (resources.GetRemote $url) }}
  {{ with .Err }}
    {{ errorf "Unable to get remote resource %s: %s" $url . }}
  {{ else with .Value }}
    {{ $data = . | transform.Unmarshal }}
  {{ else }}
    {{ errorf "Unable to get remote resource %s" $url }}
  {{ end }}
{{ end }}

{{/* Add pages and page resources. */}}
{{ range $data }}

  {{/* Add page. */}}
  {{ $content := dict "mediaType" "text/markdown" "value" .summary }}
  {{ $dates := dict "date" (time.AsTime .date) }}
  {{ $params := dict "author" .author "isbn" .isbn "rating" .rating "tags" .tags }}
  {{ $page := dict
    "content" $content
    "dates" $dates
    "kind" "page"
    "params" $params
    "path" .title
    "title" .title
  }}
  {{ $.AddPage $page }}

  {{/* Add page resource. */}}
  {{ $item := . }}
  {{ with $url := $item.cover }}
    {{ with try (resources.GetRemote $url) }}
      {{ with .Err }}
        {{ errorf "Unable to get remote resource %s: %s" $url . }}
      {{ else with .Value }}
        {{ $content := dict "mediaType" .MediaType.Type "value" .Content }}
        {{ $params := dict "alt" $item.title }}
        {{ $resource := dict
          "content" $content
          "params" $params
          "path" (printf "%s/cover.%s" $item.title .MediaType.SubType)
        }}
        {{ $.AddResource $resource }}
      {{ else }}
        {{ errorf "Unable to get remote resource %s" $url }}
      {{ end }}
    {{ end }}
  {{ end }}

{{ end }}
```

创建单个模板以呈现每个书评。

`layouts/books/single.html`：

```bash
{{ define "main" }}
  <h1>{{ .Title }}</h1>

  {{ with .Resources.GetMatch "cover.*" }}
    <img src="{{ .RelPermalink }}" width="{{ .Width }}" height="{{ .Height }}" alt="{{ .Params.alt }}">
  {{ end }}

  <p>Author: {{ .Params.author }}</p>

  <p>
    ISBN: {{ .Params.isbn }}<br>
    Rating: {{ .Params.rating }}<br>
    Review date: {{ .Date | time.Format ":date_long" }}
  </p>

  {{ with .GetTerms "tags" }}
    <p>Tags:</p>
    <ul>
      {{ range . }}
        <li><a href="{{ .RelPermalink }}">{{ .LinkTitle }}</a></li>
      {{ end }}
    </ul>
  {{ end }}

  {{ .Content }}
{{ end }}
```

## 多语言站点
使用多语言站点，您可以：
- 如上所述，使用 EnableAllLanguages 方法为所有语言创建一个内容适配器。
- 创建每种语言唯一的内容适配器。请参阅下面的示例。

### 按文件名进行翻译
`hogo.toml`的配置如下：

```toml
[languages]
  [languages.de]
    weight = 2
  [languages.en]
    weight = 1
```

在内容适配器的文件名中包含语言指示符。

```bash
content/
└── books/
    ├── _content.de.gotmpl
    ├── _content.en.gotmpl
    ├── _index.de.md
    └── _index.en.md
```

### 按内容目录划分的翻译
`hogo.toml`的配置如下：

```toml
[languages]
  [languages.de]
    contentDir = 'content/de'
    weight = 2
  [languages.en]
    contentDir = 'content/en'
    weight = 1
```

在每个目录中创建单个内容适配器：
```bash
content/
├── de/
│   └── books/
│       ├── _content.gotmpl
│       └── _index.md
└── en/
    └── books/
        ├── _content.gotmpl
        └── _index.md
```

## 页面冲突
当两个或多个页面具有相同的发布路径时，它们会发生冲突。由于并发性，已发布页面的内容是不确定的。请考虑以下示例：

```bash
content/
└── books/
    ├── _content.gotmpl  <-- content adapter
    ├── _index.md
    └── the-hunchback-of-notre-dame.md
```

如果内容适配器还创建 books/the-hunchback-of-notre-dame，则已发布页面的内容是不确定的。您无法定义处理顺序。

要检测页面冲突，请在构建站点时使用 --printPathWarnings 标志。