---
description: "通过内置目录标签浏览精选 Ocean 插件并管理安装。"
kind: "package-bundle"
---

# @ocean/ocean-plugin-market

[English](README.md) | 中文

## 概述

在 Ocean Web 或 Desktop 中打开插件页面，即可浏览内置目录并管理精选插件。阅读功能介绍、安装可用的包，以及启用、停用、更新或移除 profile 包。目录使用 Host 已安装包列表和共用安装对话框。主侧栏只有一个入口，不增加模型工具。

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

目录在首次打开时读取数据，此后响应 Host 变化进行刷新。管理请求失败后错误保持可见，并允许重试。Host API 调用使用现有连接与权限；本包不保存独立凭据，也没有独立网络客户端。

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

Host 入口不执行操作。Client 提供一个负数顺序的 `plugins.tab` 条目。`src/catalog.js` 列出精选包；`src/view.js` 派生卡片；`src/controller.js` 负责加载与管理操作。标准 Client 打包器输出 `lib/client.js`；`scripts/build-client.mjs` 刷新 Node 测试使用的独立源码生成 bundle。

本包从 Ocean 插件仓库中的 `plugins/plugin-market` 移入，包括其本地工作区修改。`src/source-snapshot.json` 记录基础提交和原始文件 SHA-256 摘要；该提交不代表没有本地修改的源码树。Ocean 是唯一受支持的源码位置。导入的模块增加了显式 ESM import、具有类型声明的 Client 入口、Ocean 包元数据、延迟 Host 刷新和目录初始导航。保留原始 MIT 许可证。

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

- 目录仅列出精选条目，不扫描公开 registry。安装中不存在且没有安装来源的包会明确显示为不可用。
- 目录提供英文和俄文文案，其他语言回退到英文。共用插件页面独立本地化自身控件。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

修改模块后运行 `node scripts/build-client.mjs`，再运行 `node --test tests/*.test.mjs` 检查行为。共用插件页面与真实 Web roster 负责导航和生命周期回归。仅编辑本包；独立的 Ocean-plugin 副本已经移除。

</details>
