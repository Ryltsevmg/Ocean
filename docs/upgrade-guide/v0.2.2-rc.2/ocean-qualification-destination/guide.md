---
kind: upgrade-guide
description: "Installed-update qualification now requires an explicit Ocean test destination and a new schema-2 run."
---
# Ocean installed-update qualification destination

English | [中文](guide.zh.md)

## Change

Qualification no longer uses the upstream test origin or bucket. All qualification commands require an independently configured test destination. The manifest and Windows publication configuration must match it. COS operations are restricted to the selected run's private namespace. Schema-1 manifests and their old test application identities are rejected; retained data is not changed.

## Migration

1. Set `DSH_DESKTOP_AUTO_UPDATE_ENV=test`, `DOWNLOAD_TEST_ORIGIN` to your own HTTPS test origin, and `DOWNLOAD_TEST_COS_BUCKET` to your own test bucket. Do not use the upstream or production destination. Keep matching settings in the Windows test configuration.
2. Allocate a fresh run using `prepare-installed-update.ts init`. Do not change a schema-1 manifest or reuse its receipts as schema-2 evidence.
3. Repeat preparation and supervised signing, installation, and update checks. Local test passes and allocation are not proof of a successful installed Windows update; operator acceptance remains required.
