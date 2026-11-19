---
kind: upgrade-guide
description: "主导航移出设置，侧边栏面板固定控件被移除，BrandWordmark 需要本地化文字。"
---

# 更新侧边栏导航贡献

[English](guide.md) | 中文

## 变更

主侧栏在工作区上方显示自动化任务、插件及其他面板。设置不再重复这些入口。意见反馈位于设置中；底部更多菜单仍打开设置。插件页面包含内置目录、发现与创建操作。

`sidebar.panellist.actions` slot 及侧栏固定操作 props 已移除。会话视图与右侧栏引导菜单保留各自的自定义 slot。`BrandWordmark` 现在必须接收由 locale 提供的 `name` prop。负数 `order` 的插件标签排在已安装之前，并成为初始页面；明确选择的标签保持不变。

目录只显示 Ocean 审核发布渠道的条目。从本地路径、Git 或其他注册表安装的软件包仍可在「已安装」中管理；撤下条目不会卸载已有副本。

## 迁移

1. 将每个主面板保留在 `sidebar.panellist` 中，并提供对应的 `main` key。移除页脚和设置中的重复入口，以及 `sidebar.panellist.actions` 注册。自定义侧栏不再接收面板固定状态或固定操作 props。
2. 通过 `plugins.tab` 或 `plugins.add.actions` 将插件发现与创建操作放入插件页面。只有需要排在已安装之前并默认打开的标签才使用负数 `order`。
3. 为每个 `BrandWordmark` 调用传入本地化的 `name`。产品品牌使用 common 字典中的 `brand.localBuild` key。
4. 如果 profile 单独安装了 `@local/ocean-plugin-market`，升级前，在 profile patch 中移除旧的 `ocean-plugin-market` 条目，并移除独立包选择；Ocean 现在以相同的条目 id 挂载 `@ocean/ocean-plugin-market`。同时移除该 id 的禁用覆盖项。确认插件只有一个侧栏入口和一个目录标签、默认打开目录，并且仍可选择已安装标签。确认意见反馈可以从设置打开。
