# Ocean

[English](README.md) | 中文

Ocean 是面向 AI 智能体、对话和工具的桌面工作空间。其插件式运行时连接模型服务、开发工具以及可选的浏览器或计算机控制功能。

## 开发者预览

Ocean 正在积极开发中，API 和功能可能变化。运行前请阅读[安全说明](SAFETY.zh.md)；本地构建成功不等于通过安全审计或完成签名公开发布。

## 开始使用

请使用此仓库：[Ryltsevmg/Ocean](https://github.com/Ryltsevmg/Ocean)。准备公开发布期间，访问可能受限。不要将上游安装程序或未经验证的 npm 包作为 Ocean 的安装方式。

源码环境设置与本地 Web/Desktop 命令请参阅[开发指南](docs/development.zh.md)。环境要求和命令定义维护在 [package.json](package.json) 中。测试新版本前请备份已有配置文件。

## 文档

- [用户指南](docs/user/index.zh.md)
- [架构](docs/architecture.zh.md)
- [贡献指南](CONTRIBUTING.zh.md)
- [安全](SAFETY.zh.md)
- [品牌指南](docs/brand-guidelines.zh.md)

此配置发布后，[GitHub Actions](.github/workflows/) 中的验证工作流会在 pull request 和推送到 main 时运行。Linux 打包仍需手动触发。目前打包生成未签名的产物，并非自动更新通道。

## 反馈

根据仓库访问权限，通过 [Ocean issues](https://github.com/Ryltsevmg/Ocean/issues) 报告可复现的问题，或通过 [Ocean 支持](mailto:support@oceanharness.com) 联系我们；[Telegram 支持机器人](https://t.me/oceanchatsupportbot)仍作为附加渠道。不要在公开 issue 中发布令牌、私密会话日志或个人数据。

## 许可证与致谢

[MIT](LICENSE)。源码来源、保留的版权声明和依赖条款记录于[第三方声明](THIRD_PARTY_NOTICES.md)。
