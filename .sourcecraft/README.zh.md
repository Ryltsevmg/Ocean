# SourceCraft 发布准备

[English](README.md) | 中文

本参考文档说明尚未启用的 Ocean-Chat CI 模板。`ci.yaml.example` 不会启用工作流。其语法参照现有的 Runne SourceCraft 配置，尚未通过 SourceCraft 实际运行验证。官方工作流参考文档为 https://sourcecraft.dev/portal/docs/ru/sourcecraft/operations/ci-cd/create-workflow。

## 启用检查清单

确认所有者命名空间、私有仓库、运行器架构及可用配额。将模板重命名为 `ci.yaml` 之前先进行评审。在成功运行并确认运行器依赖之前，验证和无签名打包任务均保持手动执行。两个任务必须针对同一不可变提交运行。保留构建日志、产物哈希和正常图形界面启动报告。容器内检查不能证明 Wayland、托盘或桌面启动已就绪。ARM64 需要匹配的运行器和现有的 `package:linux:arm64` 命令；不得将 x64 产物标为 ARM64。

没有任何工作流会发布版本、修改更新源或加载签名密钥。校验和能够检测字节变化，但不是密码学签名。命名空间、签名身份和发布端点仍未配置。远程配置前必须成功完成 SourceCraft CLI（命令行界面）认证；浏览器会话已获授权并不表示 CLI 具有访问权限。

## 签名要求

Linux 目标目前生成无签名归档。在添加签名之前，应先选定发布签名方案、可信公钥分发方式及验证流程。不得自行编造密钥，也不得将校验和视作签名。私钥必须保存在 checkout 之外，只能提供给隔离且受保护的发布运行器；不可信的拉取请求绝不能获得发布凭据。

macOS 需要 macOS 运行器、Developer ID Application 身份、Apple team ID、证书访问权限及公证凭据。现有的 [macOS 模板](../apps/desktop/config/macos-packaging/macos-signing.env.example)列出了支持的输入项。Windows 需要 Windows 运行器、可信代码签名证书、SignTool，以及已配置的密钥容器或令牌。现有的 [Windows 模板](../apps/desktop/config/windows-packaging/windows-signing.env.example)列出了这些输入项。不得将任一平台的私有配置复制到 Git。

启用发布之前，应审查仓库权限、受保护的发布引用、人工审批、产物保留策略、签名验证和预期的 Ocean 更新端点。现有的上游上传命令不构成向 DeepSeek 基础设施发布 Ocean 产物的授权。
