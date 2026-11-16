# Browser use

English | [中文](browser-use.zh.md)

Browser use lets a model inspect and operate web pages through a configured provider. DSH owns the task loop; the provider supplies browser operations and keeps browser state across turns of one live Session.

## Provider registration

Mount [`dsh-browser-use`](../../packages/browser-use/browser-use/README.md) and one provider in the same composition. The shared service registers only a name and rejects any second provider, including another instance with the same name. It has no common browser-operation methods, browser resources, or model-controlled selector, and adds no model-visible content of its own.

Configuration selects the provider; the model cannot switch providers at runtime. A provider owns its tools, result rendering, image support, configuration, and browser resources, and enforces Session isolation for the browsers it holds. Provider tools use the normal DSH execution pipeline and Session log.

## Lifetime

A provider retains its registration while it stops admitting tool calls, closes its resources, and awaits owned work; `ctx.browserUse.providerName` reports that name until release. A plugin that fails startup disposes its attempted registration. Cancellation cannot undo a browser action already delivered, and separate DSH processes stay outside one provider's reservation.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
