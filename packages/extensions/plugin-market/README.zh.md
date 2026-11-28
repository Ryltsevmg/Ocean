---
description: "通过内置目录标签浏览精选 Ocean 插件并管理安装。"
kind: "package-bundle"
---

# @ocean/ocean-plugin-market

[English](README.md) | 中文

## 概述

在 Ocean Web 或 Desktop 中打开「插件 → 目录」，即可查找 Ocean 维护者审核并发布的组合包。选择「安装」可安装并启用所列版本，无需输入来源。「已安装」单独显示当前配置中的软件包，包括未在目录提供的软件包。本包不添加模型工具。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

<a id="use-this-package"></a>
## 使用本包

打开目录或选择「刷新」时会读取公开渠道。成功读取后，新发布条目无需重新构建 Ocean 即可显示。撤下条目会移除其目录卡片，不会卸载已安装的副本。

每张卡片显示已发布软件包的图标和简短说明。**详情**会打开同一身份、状态、简短说明，以及索引中携带的长 Markdown 说明，支持代码块和表格。文档开头的标题会被去掉，因为对话框标题已经显示插件名；未发布长说明、或文档只有该标题的软件包只显示卡片文本，未提供图标的发布版本沿用共用的默认图形。

只有当前提供的版本兼容且未安装时，才可选择**安装**。脚本审批和重启提示由标准安装对话框处理。使用「已安装」管理目录以外的软件包，或通过「添加插件」提供自己的安装来源。

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

Host 入口不执行操作。Client 提供一个 `plugins.tab` 条目，并按软件包名称将审核条目与配置清单关联。共用[插件管理器](../../boot/plugin-manager/README.zh.md)负责网络读取、验证和安装。

如果渠道刷新失败，当前进程保留上一次成功读取的列表，并禁止从该列表安装新插件。成功读取的空列表表示没有已发布条目。失败不会移除任何已安装的软件包。

</details>

<a id="further-exploration"></a>
## 进一步探索

- [插件管理器](../../client/ui-plugin-manager/README.zh.md)：页面标签、安装对话框与权限。
- [Web app](../../bundle/web-app/README.zh.md)：随附的组合与默认目录渠道。
- [侧栏迁移](../../../docs/upgrade-guide/v1.0.0/sidebar-navigation/guide.zh.md)：移除旧的独立市场条目。

<a id="model-experience"></a>
## 模型体验

无，因为目录仅提供浏览器管理控件，不注册模型工具或提示内容。

#### KV Cache 影响

无；本包不组装或发送 provider 请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 目录不扫描 Git 仓库或注册表。只有公开发布渠道中具有已审核归档的条目才会显示。
- 一个主题条目覆盖所有配色：`@local/ocean-theme-picker` 在其自身设置中应用任意内置主题。插件工作区中的逐配色软件包有意不发布，因为为它们各建一张卡片会让同一插件的用途重复二十八次。
- 发布或撤下条目不会更新或修改当前配置中已安装的软件包。
- 已发布归档不会自动升级。
- 长说明是索引携带的文本，而不是对已安装软件包的实时读取：发布时没有长说明的条目即使在安装后也不显示详情段落。索引不提供软件包文件，因此会去掉文档中的相对图片；只有图片的文档不会发布长说明。
- 控件支持英语、俄语和简体中文。条目标题和说明是发布者提供的本地化文本，按当前界面语言显示并回退到英语；切换语言会重新解析可见卡片，无需重新读取渠道。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

修改浏览器模块后，在本目录运行 `node scripts/build-client.mjs`，再运行 `node --test tests/*.test.mjs`。[Web 场景](../../../apps/web/tests/plugin-market.e2e.ts)通过随附的标签页验证发布、安装和撤下流程。

</details>
