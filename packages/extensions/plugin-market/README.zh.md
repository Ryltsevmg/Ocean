---
description: "通过内置目录标签浏览精选 Ocean 插件并管理安装。"
kind: "package-bundle"
---

# @ocean/ocean-plugin-market

[English](README.md) | 中文

## 概述

在 Ocean Web 或 Desktop 中打开插件页面，即可浏览精选条目并管理当前配置中的插件。可以按名称、说明或软件包名称搜索。打开详情可查看插件的功能与当前状态。目录使用共用安装对话框，不添加模型工具。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

<a id="use-this-package"></a>
## 使用本包

Web app 组合在 Web 与 Desktop 中均包含本包，无需单独安装或外部 checkout。插件页面默认打开排在已安装之前的目录；目录更新时保留用户明确选择的标签。目录不能卸载自身。构建附带的包随 Ocean 构建更新。

如果主机提供确切的安装目标，请使用**安装**。否则选择**从来源安装**，打开共用的添加插件表单，表单会预填软件包名称。可以输入其他软件包名称、Git 地址、归档文件或本地目录。打开表单不会检查或安装软件包。

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

Host 入口不执行操作。Client 提供一个负数顺序的 `plugins.tab` 条目。`src/catalog.js` 列出精选包；`src/view.js` 派生卡片；`src/controller.js` 负责加载与管理操作。标准 Client 打包器输出 `lib/client.js`；`scripts/build-client.mjs` 刷新 Node 测试使用的独立源码生成 bundle。

目录在首次打开时读取清单，并在主机状态变化后刷新；刷新失败时保留已有卡片。配置仍引用但文件缺失的插件，其诊断和可用操作会保留。这些操作使用现有的主机连接与权限。

</details>

<a id="further-exploration"></a>
## 进一步探索

- [插件管理器](../../client/ui-plugin-manager/README.zh.md)：页面标签、安装对话框与权限。
- [Web app](../../bundle/web-app/README.zh.md)：产品随附的组合。
- [侧栏迁移](../../../docs/upgrade-guide/v1.0.0/sidebar-navigation/guide.zh.md)：移除旧的独立市场条目。

<a id="model-experience"></a>
## 模型体验

无，因为目录仅提供浏览器管理控件，不注册模型工具或提示内容。

#### KV Cache 影响

无；本包不组装或发送 provider 请求。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

- 精选条目不代表软件包已公开提供。目录不搜索注册表，也不包含开发环境的安装路径。
- 原生 Codex 和 Claude Code 子智能体、内部组件和单独的主题调色板不显示为独立的目录卡片。
- Git 更新从「已安装」中的软件包页面发起。目录中的注册表更新仅使用精选条目指定的确切版本。
- 控件支持英语、俄语和简体中文。精选说明提供英语和俄语，其他语言回退到英语。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

修改浏览器模块后，在本目录运行 `node scripts/build-client.mjs`，再运行 `node --test tests/*.test.mjs`。[Web 场景](../../../apps/web/tests/plugin-market.e2e.ts)验证随附的标签页和共用安装表单。

</details>
