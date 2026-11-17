# 浏览器操作

[English](browser-use.md) | 中文

浏览器操作让模型通过配置的提供方检查与操作网页。OCEAN 拥有任务循环；提供方提供浏览器操作，并在一个实时 Session 的多个轮次之间保留浏览器状态。

## 提供方注册

在同一组合中挂载 [`ocean-browser-use`](../../packages/browser-use/browser-use/README.zh.md) 和一个提供方。共享服务只注册名称，并拒绝任何第二个提供方，包括同名实例。它不包含通用浏览器操作方法、浏览器资源或模型控制的选择器，自身也不添加模型可见内容。

配置选择提供方；模型无法在运行时切换提供方。提供方拥有自己的工具、结果渲染、图像支持、配置与浏览器资源，并为其持有的浏览器执行 Session 隔离。提供方工具使用常规 OCEAN 执行管线与 Session 日志。

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
