---
kind: upgrade-guide
description: "The published plugin index moves to schema version 2, and Ocean 1.0.0 refuses it as unavailable."
---

# Read the version-2 plugin catalog index

English | [中文](guide.zh.md)

## Change

The public plugin index in the `plugin-catalog` branch now has two files: `v1/current.json` keeps `schemaVersion: 1` for released clients, and `v2/current.json` carries `schemaVersion: 2`, where each offer may add an inline `icon` data URL and a localized `detail` Markdown document that the **Catalogue** tab shows as card artwork and a long description in **Details**. The shipped composition reads `v2/current.json`.

Ocean 1.0.0 accepts only `schemaVersion: 1` and rejects the whole index otherwise, so a 1.0.0 client shows **The published catalogue is unavailable** against the version-2 index. Upgrading to the next release restores the catalogue. Indexes that stay at version 1 keep working in both releases; they show no artwork and no long description. A custom `publishedCatalogUrl` channel is subject to the same rule.

## Migration

1. Upgrade Ocean to the release that follows 1.0.0 before publishing a version-2 index to a channel your users read.
2. If you operate your own channel, publish the two files the same way: keep the metadata-only `schemaVersion: 1` index at the address released clients read, and point the upgraded composition at the `schemaVersion: 2` index.
3. Confirm the migration by opening **Plugins → Catalogue**: cards show artwork, **Details** shows the long description, and no reader reports the catalogue as unavailable.
