---
kind: upgrade-guide
description: "Main navigation leaves Settings, sidebar panel pin controls are removed, and BrandWordmark requires localized text."
---

# Update sidebar navigation contributions

English | [中文](guide.zh.md)

## Change

Main-sidebar navigation shows schedules, Plugins, and other contributed panels above workspaces. Settings no longer repeats these links. Feedback lives in Settings; the bottom More menu still opens Settings. Plugins includes the bundled catalog, discovery, and creation actions.

The `sidebar.panellist.actions` slot and the sidebar pin-action props are removed. Conversation View and right-sidebar guide menus keep their customization slots. `BrandWordmark` now requires a locale-owned `name` prop. Plugins tabs with negative `order` appear before Installed and become the initial page; explicit selections remain unchanged.

Catalogue shows only offers from Ocean’s approved publication channel. Packages from local paths, Git, or other registries remain manageable in Installed; removing an offer does not uninstall its existing copies.

## Migration

1. Keep each main panel in `sidebar.panellist` with its matching `main` key. Remove duplicate footer and settings launchers, and remove registrations into `sidebar.panellist.actions`. Do not supply sidebar pin-state or pin-action props to custom sidebar shells.
2. Put plugin discovery and creation actions on the Plugins page through `plugins.tab` or `plugins.add.actions`. Use negative `order` only when a tab should precede Installed and open initially.
3. Pass localized text as `name` to each `BrandWordmark` call. The shipped brand uses the common dictionary’s `brand.localBuild` key.
4. If a profile separately installs `@local/ocean-plugin-market`, before upgrading, remove its old `ocean-plugin-market` entry from the profile patch and its separate package selection; Ocean now mounts `@ocean/ocean-plugin-market` under the same row id. Remove any disabled override of that id as well. Confirm that Plugins has one sidebar launcher and one catalog tab, opens the catalog, and still allows selecting Installed. Confirm that Feedback opens from Settings.
