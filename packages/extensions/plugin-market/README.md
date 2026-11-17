---
description: "Browse curated Ocean plugins and manage their installation from the bundled Catalog tab."
kind: "package-bundle"
---

# @ocean/ocean-plugin-market

English | [中文](README.zh.md)

## Summary

Open Plugins in Ocean Web or Desktop to browse the bundled catalog and manage curated plugins. Read each plugin’s description, install available packages, and enable, disable, update, or remove profile packages. The catalog uses the Host’s installed bundle list and the shared installation dialogs. It has one main-sidebar entry and adds no model tools.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

<a id="use-this-package"></a>
## Use this package

The Web app composition includes this package in Web and Desktop. It needs no separate installation or external checkout. Plugins opens Catalog before Installed; explicit tab selections remain unchanged during catalog updates. The catalog cannot uninstall itself. Build-carried packages follow the Ocean build.

The catalog reads on first opening, then refreshes after Host changes. A failed management request remains visible and can be retried. Its Host API calls use the existing connection and permissions; no separate credentials or network client are stored here.

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The Host entry is inert. The Client contributes one `plugins.tab` entry with negative order. `src/catalog.js` lists curated packages; `src/view.js` derives cards; `src/controller.js` owns loading and management operations. The standard Client bundler emits `lib/client.js`; `scripts/build-client.mjs` refreshes the separate source-derived bundle used by the Node tests.

The package was moved from `plugins/plugin-market` in the Ocean plugins repository, including its local working-tree changes. `src/source-snapshot.json` records the base commit and original per-file SHA-256 values; that commit does not identify a clean source tree. Ocean is the sole supported source home. The imported modules have explicit ESM imports, a typed Client entry, Ocean package metadata, lazy Host invalidation, and initial catalog navigation. The original MIT license is retained.

</details>

<a id="further-exploration"></a>
## Further Exploration

- [Plugin manager](../../client/ui-plugin-manager/README.md): page tabs, installation dialogs, and permissions.
- [Web app](../../bundle/web-app/README.md): shipped composition.
- [Sidebar migration](../../../docs/upgrade-guide/v1.0.0/sidebar-navigation/guide.md): removing an old standalone market entry.

<a id="model-experience"></a>
## Model Experience

None, as the catalog contributes browser management controls and registers no model tools or prompt content.

#### KV Cache effect

None; the package does not assemble or send provider requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The catalog lists curated entries only and does not scan public registries. An absent package without an install source remains visibly unavailable.
- Catalog copy is English and Russian with English fallback. The shared Plugins page localizes its own controls independently.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Run `node scripts/build-client.mjs` after changing the modules and `node --test tests/*.test.mjs` for their behavior. The shared Plugins page and the real Web roster own navigation and lifecycle regressions. Edit only this package; the standalone Ocean-plugin copy has been removed.

</details>
