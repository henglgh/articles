# 目录结构
Hugo 的目录结构概述。

每个 Hugo 项目都是一个目录，其中的子目录有助于您网站的内容、结构、行为和表示。

## 站点框架
Hugo 会在您创建新站点时生成一个项目框架。例如，以下命令：
```bash
hugo new site my-site
```
创建此目录结构为：
```bash
my-site/
├── archetypes/
│   └── default.md
├── assets/
├── content/
├── data/
├── i18n/
├── layouts/
├── static/
├── themes/
└── hugo.toml         <-- site configuration
```
根据要求，您可能希望将站点配置组织到子目录中：
```bash
my-site/
├── archetypes/
│   └── default.md
├── assets/
├── config/           <-- site configuration
│   └── _default/
│       └── hugo.toml
├── content/
├── data/
├── i18n/
├── layouts/
├── static/
└── themes/
```
当你构建你的网站时，Hugo 会创建一个 public 目录，通常还会创建一个 resources 目录：
```bash
my-site/
├── archetypes/
│   └── default.md
├── assets/
├── config/       
│   └── _default/
│       └── hugo.toml
├── content/
├── data/
├── i18n/
├── layouts/
├── public/       <-- created when you build your site
├── resources/    <-- created when you build your site
├── static/
└── themes/
```
## 目录
每个子目录都有助于您网站的内容、结构、行为或表示方式。
- `archetypes(原型)`：archetypes 目录包含新内容的模板。
- `assets(资源)`：assets 目录包含通常通过 asset pipeline 传递的全局资源。这包括图像、CSS、Sass、JavaScript 和 TypeScript 等资源。
- `config`：config 目录包含您的站点配置，可能分为多个子目录和文件。对于配置最少的项目或不需要在不同环境中表现不同的项目，在项目根目录中一个名为 hugo.toml 的配置文件就足够了。
- `content`：content目录包含构成网站内容的标记文件（通常为 Markdown）和页面资源。
- `data`：data目录包含数据文件（JSON、TOML、YAML 或 XML），用于增强内容、配置、本地化和导航。
- `i18n`：i18n 目录包含多语言站点的翻译表。
- `layouts`：layouts 目录包含用于将内容、数据和资源转换为完整网站的模板。
- `public`：public 目录包含已发布的网站，这些网站是在您运行 hugo 或 hugo server 命令时生成的。Hugo 根据需要重新创建此目录及其内容。
- `resources`：resources 目录包含来自 Hugo 资源管道的缓存输出，这些输出是在您运行 hugo 或 hugo server 命令时生成的。默认情况下，此缓存目录包括 CSS 和图像。Hugo 根据需要重新创建此目录及其内容。
- `static`：static 目录包含的文件将在您构建站点时复制到 public 目录。例如：favicon.ico、robots.txt 和验证网站所有权的文件。在引入页面包和资源管道之前，static 目录还用于图像、CSS 和 JavaScript。
- `themes`：themes 目录包含一个或多个主题，每个主题都位于其自己的子目录中。

## 联合文件系统
Hugo 创建了一个联合文件系统，允许您将两个或多个目录挂载到同一位置。例如，假设您的主目录在一个目录中包含一个 Hugo 项目，在另一个目录中包含共享内容：
```bash
home/
└── user/
    ├── my-site/            
    │   ├── content/
    │   │   ├── books/
    │   │   │   ├── _index.md
    │   │   │   ├── book-1.md
    │   │   │   └── book-2.md
    │   │   └── _index.md
    │   ├── themes/
    │   │   └── my-theme/
    │   └── hugo.toml
    └── shared-content/     
        └── films/
            ├── _index.md
            ├── film-1.md
            └── film-2.md
```

您可以在使用挂载构建站点时包含共享内容。在您的站点配置中`hugo.toml`:
```toml
[module]
  [[module.mounts]]
    source = 'content'
    target = 'content'
  [[module.mounts]]
    source = '/home/user/shared-content'
    target = 'content'
```
> 将一个目录叠加在另一个目录之上时，必须挂载这两个目录。
> Hugo 不遵循符号链接。如果您需要符号链接提供的功能，请改用 Hugo 的联合文件系统。

挂载后，union 文件系统具有以下结构：
```bash
home/
└── user/
    └── my-site/
        ├── content/
        │   ├── books/
        │   │   ├── _index.md
        │   │   ├── book-1.md
        │   │   └── book-2.md
        │   ├── films/
        │   │   ├── _index.md
        │   │   ├── film-1.md
        │   │   └── film-2.md
        │   └── _index.md
        ├── themes/
        │   └── my-theme/
        └── hugo.toml
```
> 当两个或多个文件具有相同的路径时，优先顺序将遵循挂载的顺序。例如，如果共享内容目录包含 books/book-1.md，则将被忽略，因为项目的 content 目录是先挂载的。

您可以将目录挂载到archetypes、assets、content、data、i18n、layouts和 static。

您还可以使用 Hugo Modules 从 Git 存储库挂载目录。

## 主题框架

```bash
hugo new theme my-theme
```
创建此目录结构（未显示子目录）：
```bash
my-theme/
├── archetypes/
├── assets/
├── content/
├── data/
├── i18n/
├── layouts/
├── static/
├── LICENSE
├── README.md
├── hugo.toml
└── theme.toml
```

使用上述联合文件系统，Hugo 将每个目录挂载到项目中的相应位置。当两个文件具有相同的路径时，项目目录中的文件优先。例如，这允许您将副本放置在项目目录中的相同位置来覆盖主题的模板。

如果您同时使用来自两个或多个主题或模块的组件，并且存在路径冲突，则第一个挂载优先。