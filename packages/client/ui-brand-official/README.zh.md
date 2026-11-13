---
description: "通过客户端 slot 系统注册的 Ocean 侧栏品牌图形。"
kind: "package-reference"
---

# @ocean/ocean-client-ui-brand-official

[English](README.md) | 中文

## 概述

本包注册 Ocean 侧栏标志与文字标志。注册不依赖构建 profile。它只贡献浏览器呈现，不提供首页背景动画，也不发起模型请求。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在客户端组合中挂载本插件，即可占据 `sidebar.brand.mark` 与 `sidebar.brand.name`。标志使用 `FishLogo`；名称使用设置了 `includeMark={false}` 的 `BrandWordmark`，避免重复显示独立 slot 中的标志。文字标志显示“Ocean”。本包不接受图形配置，也不读取 `DSH_CLIENT_BUILD_PROFILE`。

需要其他身份标识时，不组合本包，而是为侧栏 slot 组合另一个包。本包不占据会话首屏标志 slot 或 `conversation.hero.frame`。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

[客户端入口](src/client/index.ts)通过嵌套的 `ctx.slots.inject()` 调用安装两个填充，使其注册跟随侧栏声明的生命周期。[品牌组件](src/client/Brand.tsx)渲染共享[标志](../ui-primitives/src/FishLogo.tsx)与[文字标志](../ui-primitives/src/BrandWordmark.tsx)。标志的尺寸来自 slot owner。两个基础组件都渲染装饰性 SVG，不启动动画，也不注册点击处理。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [ui-sidebar](../ui-sidebar/README.zh.md)——声明两个侧栏品牌 slot 并渲染其回退。
- [UI 基础组件](../ui-primitives/README.zh.md)——拥有共享品牌组件。
- [Web 客户端架构](../../../docs/subsystems/web-client.zh.md)——客户端插件加载与 slot 注册。

-----

<a id="model-experience"></a>
## 模型体验

无；本包只贡献浏览器呈现，不向模型请求添加内容。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 替代侧栏图形需要另一个 slot 填充包；本包不提供身份标识选择配置。
- 首页反馈、会话首屏图形与浏览器标题不属于本包的注册内容。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
