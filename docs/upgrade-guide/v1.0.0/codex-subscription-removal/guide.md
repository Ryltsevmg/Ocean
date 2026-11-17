---
kind: upgrade-guide
description: "The bundled ChatGPT subscription plugin and its model providers are removed from Web and Desktop."
---

# Remove the bundled ChatGPT subscription configuration

English | [中文](guide.zh.md)

## Change

Web and Desktop no longer ship `@ocean/ocean-codex-subscription`. Its settings section, ChatGPT plan preview, legacy subscription sign-in, account catalog, and provider routes are unavailable. This affects users who selected its models or mounted the package in custom profiles. The independent `@ocean/ocean-subagent-codex` package remains available.

The upgrade does not revoke remote grants or delete saved credential records. Previously recorded conversations remain readable, but continuing with a removed provider requires choosing an available model.

## Migration

1. Before upgrading, sign out of both subscription account flows in the old plugin if you used them. Resolve any unconfirmed revocation through your provider account. If already upgraded, manage the grant through that account; do not copy tokens into configuration files.
2. Remove `@ocean/ocean-codex-subscription` from custom package dependencies and remove its `ocean-codex-subscription` entry from custom `cordis.yml`, patches, or profile inserts. Shipped profiles already omit it.
3. Open **Settings → Models**, configure an available provider, and choose its model for any affected session or preset. Existing selections do not silently switch providers.
4. Restart Web or Desktop. Confirm that startup has no missing-package error, the subscription settings section is absent, and a new message completes with the selected provider.
