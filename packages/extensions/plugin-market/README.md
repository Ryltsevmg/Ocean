---
description: "Browse curated Ocean plugins and manage their installation from the bundled Catalog tab."
kind: "package-bundle"
---

# @ocean/ocean-plugin-market

English | [中文](README.zh.md)

## Summary

Open Plugins → Catalogue in Ocean Web or Desktop to find bundles approved and published by the Ocean maintainers. Select Install to install and enable the listed version without entering a source. Installed is a separate view of the active profile, including packages not offered in the catalogue. This package adds no model tools.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

<a id="use-this-package"></a>
## Use this package

The catalogue reads the public channel when opened and on Refresh. A newly published offer appears after a successful read without rebuilding Ocean. Removing an offer removes its card from the catalogue but never uninstalls an existing copy.

**Install** is available only for a current, compatible offer that neither has its own bundle nor is mounted by an installed one; a mounted offer names its bundle and opens it instead. Script approvals and restart notices use the standard installation dialog. Use Installed to manage packages that are not in the catalogue, or Add plugin to provide your own source.

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The Host entry is inert. The Client contributes one `plugins.tab` entry and joins each approved offer to the profile inventory by exact package name, or to the installed bundle that mounts the offer as one of its rows. The shared [plugin manager](../../boot/plugin-manager/README.md) owns network reads, verification and installation.

If the channel cannot be refreshed, the last successful list stays visible for this process and new installations from it are disabled. A successful empty list means no offers are published. A failure never removes any installed package.

</details>

<a id="further-exploration"></a>
## Further Exploration

- [Plugin manager](../../client/ui-plugin-manager/README.md): page tabs, installation dialogs, and permissions.
- [Web app](../../bundle/web-app/README.md): shipped composition and default catalogue channel.
- [Sidebar migration](../../../docs/upgrade-guide/v1.0.0/sidebar-navigation/guide.md): removing an old standalone market entry.

<a id="model-experience"></a>
## Model Experience

None, as the catalog contributes browser management controls and registers no model tools or prompt content.

#### KV Cache effect

None; the package does not assemble or send provider requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- The catalogue does not scan Git repositories or registries. Only offers with a reviewed archive in the public release channel appear.
- Publication and removal do not update or modify packages already installed in profiles.
- Published-archive upgrades are not automatic.
- Controls are available in English, Russian and Simplified Chinese. Offer titles and descriptions are the publisher’s localized text, shown in the active UI language with an English fallback; a language switch re-resolves the visible cards without re-reading the channel.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

Run `node scripts/build-client.mjs` from this directory after changing the browser modules, then `node --test tests/*.test.mjs`. The [Web scenario](../../../apps/web/tests/plugin-market.e2e.ts) exercises publication, installation and withdrawal through the shipped tab.

</details>
