---
kind: upgrade-guide
description: "A 1.0.0 reader refuses a schema-version-2 index, so the channel keeps the metadata-only file at the address it reads."
---

# Read the version-2 plugin catalog index

English | [中文](guide.zh.md)

## Change

The public plugin index in the `plugin-catalog` branch now has two files: `v1/current.json` keeps `schemaVersion: 1` for released clients, and `v2/current.json` carries `schemaVersion: 2`, where each offer may add an inline `icon` data URL and a localized `detail` Markdown document that the **Catalogue** tab shows as card artwork and a long description in **Details**. The shipped composition reads `v2/current.json`.

A 1.0.0 reader accepts only `schemaVersion: 1` and rejects the whole index otherwise. It keeps reading `v1/current.json`, so a released client shows the catalogue as before, without artwork and long descriptions, and needs no change. The refusal appears only when a version-2 index sits at the address a 1.0.0 reader reads, such as a custom `publishedCatalogUrl` that points at it.

## Migration

1. Upgrade Ocean to the release that follows 1.0.0 before publishing a version-2 index to a channel your users read.
2. If you operate your own channel, publish the two files the same way: keep the metadata-only `schemaVersion: 1` index at the address released clients read, and point the upgraded composition at the `schemaVersion: 2` index.
3. Confirm the migration by opening **Plugins → Catalogue**: cards show artwork, **Details** shows the long description, and no reader reports the catalogue as unavailable.
