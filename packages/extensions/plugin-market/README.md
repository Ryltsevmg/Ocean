---
description: "Browse curated Ocean plugins and manage their installation from the bundled Catalog tab."
kind: "package-bundle"
---

# @ocean/ocean-plugin-market

English | [中文](README.zh.md)

## Summary

Open Plugins in Ocean Web or Desktop to browse curated entries and manage plugins in the current profile. Search by name, description, or package name. Open Details to read what a plugin does and see its current status. The catalog uses the shared installation dialogs and adds no model tools.

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

If the host offers an exact installation target, use **Install**. Otherwise use **Install from source** to open the shared Add plugin form, prefilled with the package name. You can enter another package name, a Git URL, a tarball, or a local directory. Opening the form does not check or install the package.

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The Host entry is inert. The Client contributes one `plugins.tab` entry with negative order. `src/catalog.js` lists curated packages; `src/view.js` derives cards; `src/controller.js` owns loading and management operations. The standard Client bundler emits `lib/client.js`; `scripts/build-client.mjs` refreshes the separate source-derived bundle used by the Node tests.

The catalog reads the inventory on first opening and after host changes, keeping existing cards visible if refresh fails. A plugin referenced in the profile with missing files keeps its diagnostic and the available management actions. Those actions use the existing host connection and permissions.

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

- Curated entries do not imply that a package is publicly available. The catalog does not search registries or embed installation paths from a developer checkout.
- Native Codex and Claude Code subagents, internal components, and individual theme palettes do not appear as separate catalog cards.
- Git updates start from the package page in Installed. A registry update in the catalog targets only the exact version named by its curated entry.
- Controls are available in English, Russian, and Simplified Chinese. Curated descriptions are available in English and Russian, with English fallback.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Run `node scripts/build-client.mjs` from this directory after changing the browser modules, then `node --test tests/*.test.mjs`. The [Web scenario](../../../apps/web/tests/plugin-market.e2e.ts) exercises the shipped tab and shared install form.

</details>
