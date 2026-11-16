# 计算机操作

[English](computer-use.md) | 中文

计算机操作让模型通过配置的提供方观察并操作本地桌面。DSH 拥有任务循环；提供方提供桌面操作以及暴露这些操作的工具。

## 提供方注册

在同一组合中挂载 [`dsh-computer-use`](../../packages/computer-use/computer-use/README.zh.md) 和一个提供方。共享服务只注册名称，并拒绝任何第二个提供方，包括同名实例。它不包含通用桌面操作方法或模型控制的选择器，自身也不添加模型可见内容。

配置选择提供方；模型无法在运行时切换提供方。提供方拥有自己的工具目录、桌面操作、配置、权限处理与平台要求。提供方工具使用常规 DSH 执行管线与 Session 日志。

## 生命周期与桌面共享

提供方在停止接收工具调用、关闭资源并等待自有工作期间保留注册；`ctx.computerUse.providerName` 在释放前一直报告该名称。启动失败的插件会释放其尝试的注册。

一个已注册的提供方不会为某个 Session 预留桌面。调用方负责协调跨 Session 和独立 DSH 进程的完整观察、操作与验证流程。取消调用无法撤销桌面已收到的输入。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxcomputeruse--computeruseregistry"></a>

### `ctx.computerUse` — `ComputerUseRegistry`

Owns one optional provider registration in the shared computer-use service.

```ts cordis-catalog
/**
 * Reserve the sole provider slot until the contribution is disposed.
 * A second registration fails even when it repeats the current name. Providers
 * must stop their tools and await owned work before releasing this registration.
 * @param name - provider-owned name used in registration diagnostics.
 * @returns the effect disposer for this exact registration.
 */
register(name: ComputerUseProviderName): () => Promise<void>
```

Source: [`packages/computer-use/computer-use/src/index.ts`](../../packages/computer-use/computer-use/src/index.ts)
<!-- END GENERATED cordis-surface -->
