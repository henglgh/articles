
# 1. Linux
在 Linux 上安装 Hugo。

## 1.1. 版本
Hugo 提供三种版本：标准版、扩展版和扩展/部署版。虽然标准版提供了核心功能，但扩展版和扩展/部署版提供了高级功能。

| 功能 | 扩展版 | 扩展/部署版 |
| --- | --- | --- |
| 在处理图像时编码为 WebP 格式。任何版本都可以解码 WebP 图像。 | ✔️ | ✔️ |
| 使用嵌入的 LibSass 转译器将 Sass 转译为 CSS。任何版本都可以使用 Dart Sass 转译器。 | ✔️ | ✔️ |
| 将网站直接部署到 Google Cloud Storage 存储桶、AWS S3 存储桶或 Azure 存储容器。详见详情。 | ❌ | ✔️ |

除非你的特定部署需求需要扩展/部署版，否则我们推荐扩展版。

## 1.2. 前提条件
虽然在某些情况下不是必需的，但 Git、Go 和 Dart Sass 在使用 Hugo 时通常会被用到。

Git 用于：
- 从源代码构建 Hugo
- 使用 Hugo 模块功能
- 将主题作为 Git 子模块安装
- 从本地 Git 仓库获取提交信息
- 使用 CloudCannon、Cloudflare Pages、GitHub Pages、GitLab Pages 和 Netlify 等服务托管网站

Go 用于：
- 从源代码构建 Hugo
- 使用 Hugo 模块功能

Dart Sass 用于在使用 Sass 语言的最新功能时将 Sass 转译为 CSS。

请参考相关文档获取安装说明：
- Git
- Go
- Dart Sass

## 1.3. 预构建二进制文件
预构建二进制文件适用于多种操作系统和架构。访问最新发布页面，向下滚动到“Assets”部分。
1. 下载所需版本、操作系统和架构的存档文件
2. 解压存档文件
3. 将可执行文件移动到所需目录
4. 将该目录添加到 PATH 环境变量
5. 确保你对该文件有 _执行_ 权限

如果你需要帮助设置文件权限或修改 PATH 环境变量，请参考你的操作系统文档。

如果你没有看到所需版本、操作系统和架构的预构建二进制文件，请使用以下方法之一安装 Hugo。

## 1.4. 包管理器

### 1.4.1. Snap

Snap 是一个免费开源的 Linux 包管理器。适用于大多数发行版，snap 包安装简单，并且会自动更新。

Hugo snap 包是严格受限的。严格受限的 snap 包在完全隔离的环境中运行，访问级别最低，始终被认为是安全的。你创建和构建的网站必须位于你的主目录中，或在可移动存储设备上。

要安装 Hugo 的扩展版：
```bash
sudo snap install hugo
```

要启用或撤销对可移动存储设备的访问权限：
```bash
sudo snap connect hugo:removable-media
sudo snap disconnect hugo:removable-media
```

要启用或撤销对 SSH 密钥的访问权限，请执行以下作：
```bash
sudo snap connect hugo:ssh-keys
sudo snap disconnect hugo:ssh-keys
```

### 1.4.2. Homebrew
Homebrew 是适用于 macOS 和 Linux 的免费开源包管理器。要安装 Hugo 的扩展版本：
```bash
brew install hugo
```

## 1.5. 软件包库
大多数 Linux 发行版都为常用安装的应用程序维护一个存储库。
> 软件包存储库中可用的 Hugo 版本因 Linux 发行版和发行版而异，在某些情况下不会是最新版本。如果您的软件包存储库未提供所需的版本，请使用其他安装方法之一。

### 1.5.1. Alpine Linux
要在 Alpine Linux 上安装 Hugo 的扩展版本：
```bash
doas apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community hugo
```
### 1.5.2. Arch Linux
Linux 的 Arch Linux 发行版的衍生产品包括 EndeavourOS、Garuda Linux、Manjaro 等。要安装 Hugo 的扩展版本：
```bash
sudo pacman -S hugo
```

### 1.5.3. Debian
Linux 的 Debian 发行版的衍生产品包括 elementary OS、KDE neon、Linux Lite、Linux Mint、MX Linux、Pop!_OS、Ubuntu、Zorin OS 等。要安装 Hugo 的扩展版本：
```bash
sudo apt install hugo
```

### 1.5.4. Exherbo
要在 Exherbo 上安装 Hugo 的扩展版本：
- 将此行添加到 /etc/paludis/options.conf 中：
  ```bash
  www-apps/hugo extended
  ```
- 使用 Paludis 包管理器进行安装：
  ```bash
  cave resolve -x repository/heirecka
  cave resolve -x hugo
  ```
### 1.5.5. Fedora
Linux 的 Fedora 发行版的衍生产品包括 CentOS、Red Hat Enterprise Linux 等。要安装 Hugo 的扩展版本：
```bash
sudo dnf install hugo
```

### 1.5.6. Gentoo
Linux 的 Gentoo 发行版的衍生产品包括 Calculate Linux、Funtoo 等。要安装 Hugo 的扩展版本：
- 在 /etc/portage/package.use/hugo 中指定extended的 USE 标志：
  ```bash
  www-apps/hugo extended
  ```
- 使用 Portage 包管理器进行构建：
  ```bash
  sudo emerge www-apps/hugo
  ```

### 1.5.7. NixOS
Linux 的 NixOS 发行版在其软件包仓库中包含了 Hugo。要安装 Hugo 的扩展版本：
```bash
nix-env -iA nixos.hugo
```

### 1.5.8. openSUSE
Linux 的 openSUSE 发行版的衍生产品包括 GeckoLinux、Linux Karmada 等。要安装 Hugo 的扩展版本：
```bash
sudo zypper install hugo
```

### 1.5.9. Solus
Linux 的 Solus 发行版在其软件包存储库中包含 Hugo。要安装 Hugo 的扩展版本：
```bash
sudo eopkg install hugo
```

### 1.5.10. Void Linux
要在 Void Linux 上安装 Hugo 的扩展版本：
```bash
sudo xbps-install -S hugo
```

## 1.6. 从源代码构建 Hugo
要从源代码构建扩展或扩展/部署版本，您必须：
- 安装 Git.
- 安装 Go 版本 1.23.0 或更高版本
- 安装 C 编译器，GCC 或 Clang
- 按照 Go 文档中的说明更新 PATH 环境变量

> 安装目录由 GOPATH 和 GOBIN 环境变量控制。如果设置GOBIN，则二进制文件将安装到该目录。如果设置GOPATH，则二进制文件将安装到 GOPATH 列表中第一个目录的 bin 子目录中。否则，二进制文件将安装到默认 GOPATH 的 bin 子目录（$HOME/go 或 %USERPROFILE%\go）。

要构建标准版，请执行以下作：
```bash
go install github.com/gohugoio/hugo@latest
```
要构建扩展版本：
```bash
CGO_ENABLED=1 go install -tags extended github.com/gohugoio/hugo@latest
```
要构建扩展/部署版本，请执行以下作：
```bash
CGO_ENABLED=1 go install -tags extended,withdeploy github.com/gohugoio/hugo@latest
```
