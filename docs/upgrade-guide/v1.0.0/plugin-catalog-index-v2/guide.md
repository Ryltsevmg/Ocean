---
kind: upgrade-guide
description: "The published plugin index moves to schema version 2, and Ocean 1.0.0 refuses it as unavailable."
---

# Read the version-2 plugin catalog index

English | [中文](guide.zh.md)

## Change

The public plugin index at `v1/current.json` in the `plugin-catalog` branch now carries `schemaVersion: 2`. Each offer may add an inline `icon` data URL and a localized `detail` Markdown document, which the **Catalogue** tab shows as card artwork and a long description in **Details**.

Ocean 1.0.0 accepts only `schemaVersion: 1` and rejects the whole index otherwise, so a 1.0.0 client shows **The published catalogue is unavailable** against the version-2 index. Upgrading to the next release restores the catalogue. Indexes that stay at version 1 keep working in both releases; they show no artwork and no long description. A custom `publishedCatalogUrl` channel is subject to the same rule.

## Migration

1. Upgrade Ocean to the release that follows 1.0.0 before publishing a version-2 index to a channel your users read.
2. If you operate your own channel, keep `schemaVersion: 1` until every reader is upgraded, or serve both: the path is free-form, so a second file such as `v1/current-v1.json` can hold the metadata-only index for older readers.
3. Confirm the migration by opening **Plugins → Catalogue**: cards show artwork, **Details** shows the long description, and no reader reports the catalogue as unavailable.
