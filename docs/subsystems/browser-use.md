# Browser use

English | [中文](browser-use.zh.md)

Browser use lets a model inspect and operate web pages through a configured provider. OCEAN owns the task loop; the provider supplies browser operations and keeps browser state across turns of one live Session.

## Provider registration

Mount [`ocean-browser-use`](../../packages/browser-use/browser-use/README.md) and one provider in the same composition. The shared service registers only a name and rejects any second provider, including another instance with the same name. It has no common browser-operation methods, browser resources, or model-controlled selector, and adds no model-visible content of its own.

Configuration selects the provider; the model cannot switch providers at runtime. A provider owns its tools, result rendering, image support, configuration, and browser resources, and enforces Session isolation for the browsers it holds. Provider tools use the normal OCEAN execution pipeline and Session log.

## Desktop in-app provider

The Desktop application installs `browser_*` tools after its profile starts. They operate on a right-Sidebar Browser tab that the person explicitly shares with the Session's Agent: `browser_snapshot` returns a compact semantic tree with element refs, while `browser_navigate`, `browser_click`, `browser_fill`, `browser_back`, `browser_forward`, and `browser_reload` act on that tab. Electron main owns the guest and validates every command; the Host receives text observations only. Sharing is per tab, off by default, and limited to one tab per Session. The Desktop provider registers itself when the slot is free; if another provider already owns it, the in-app tools remain available alongside that provider.

## Desktop roadmap

Phase 1 is implemented: one explicitly shared Sidebar tab per Session, semantic snapshots with element refs, click and ordinary text fill, navigate/back/forward/reload, secret-field refusal, and bounded observations. Phase 2.1 is implemented: `browser_screenshot` captures one bounded viewport PNG, downscaled and byte-capped by plugin config, stored through the attachment service and returned as a durable image reference. Phase 2 continues with keyboard/scroll/drag/select primitives, JavaScript dialog handling, multi-tab management, and an enforced confirmation step for consequential actions. Phase 3 adds allowlisted downloads and uploads, scoped console/network inspection, and annotation/handoff parity with the Codex in-app browser. Each phase keeps the per-tab opt-in and the Host/main separation; no phase exposes arbitrary JavaScript to the model.

## Lifetime

A provider retains its registration while it stops admitting tool calls, closes its resources, and awaits owned work; `ctx.browserUse.providerName` reports that name until release. A plugin that fails startup disposes its attempted registration. Cancellation cannot undo a browser action already delivered, and separate OCEAN processes stay outside one provider's reservation.

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
