# 浏览器操作

[English](browser-use.md) | 中文

浏览器操作让模型通过配置的提供方检查与操作网页。OCEAN 拥有任务循环；提供方提供浏览器操作，并在一个实时 Session 的多个轮次之间保留浏览器状态。

## 提供方注册

在同一组合中挂载 [`ocean-browser-use`](../../packages/browser-use/browser-use/README.zh.md) 和一个提供方。共享服务只注册名称，并拒绝任何第二个提供方，包括同名实例。它不包含通用浏览器操作方法、浏览器资源或模型控制的选择器，自身也不添加模型可见内容。

配置选择提供方；模型无法在运行时切换提供方。提供方拥有自己的工具、结果渲染、图像支持、配置与浏览器资源，并为其持有的浏览器执行 Session 隔离。提供方工具使用常规 OCEAN 执行管线与 Session 日志。

## Desktop 应用内提供方

Desktop 应用在 profile 启动后安装 `browser_*` 工具。它们作用于用户显式共享给当前 Session Agent 的右侧 Sidebar 浏览器 tab：`browser_snapshot` 返回带元素 ref 的紧凑语义树，`browser_navigate`、`browser_click`、`browser_fill`、`browser_back`、`browser_forward` 和 `browser_reload` 作用于该 tab。Electron main 拥有 guest 并校验每条命令；Host 只收到文本观察。共享按 tab 生效、默认关闭，且一个 Session 同时只能共享一个 tab。Desktop 提供方在槽位空闲时注册自身；如果槽位已被其他提供方占用，应用内工具仍会与该提供方并存。

## Desktop 路线图

第一阶段已实现：每个 Session 一个显式共享的 Sidebar tab、带元素 ref 的语义 snapshot、click 与普通文本 fill、navigate/back/forward/reload、敏感字段拒绝以及有界观察。第二阶段加入截图与视觉校验、键盘/滚动/拖拽/选择原语、JavaScript 对话框处理、多 tab 管理，以及重大操作的强制确认步骤。第三阶段加入白名单下载/上传、受限 console/network 检查，以及与 Codex 应用内浏览器对齐的标注/handoff。每个阶段都保留逐 tab 显式开启与 Host/main 分离；任何阶段都不向模型暴露任意 JavaScript。

## 生命周期

提供方在停止接收工具调用、关闭资源并等待自有工作期间保留注册；`ctx.browserUse.providerName` 在释放前一直报告该名称。启动失败的插件会释放其尝试的注册。取消无法撤销已交付的浏览器操作，独立 OCEAN 进程也不受某一提供方保留的约束。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxbrowseruse--browseruseregistry"></a>

### `ctx.browserUse` — `BrowserUseRegistry`

Owns one optional provider registration in the shared browser-use service.

```ts cordis-catalog
/**
 * Reserve the sole provider slot until the contribution is disposed.
 * A second registration fails even when it repeats the current name. Providers
 * must stop their tools and await owned work before releasing this registration.
 * @param name - provider-owned name used in registration diagnostics.
 * @returns the effect disposer for this exact registration.
 */
register(name: BrowserUseProviderName): () => Promise<void>
```

Source: [`packages/browser-use/browser-use/src/index.ts`](../../packages/browser-use/browser-use/src/index.ts)
<!-- END GENERATED cordis-surface -->
