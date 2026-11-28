---
kind: upgrade-guide
description: "1.0.0 读取端会拒绝 schema 版本 2 的索引，因此渠道在其读取的地址保留纯元数据文件。"
---

# 读取版本 2 的插件目录索引

[English](guide.md) | 中文

## 变更

`plugin-catalog` 分支中的公开插件索引现在包含两个文件：`v1/current.json` 继续为已发布客户端保留 `schemaVersion: 1`，`v2/current.json` 携带 `schemaVersion: 2`，其中每个条目可以增加内联 `icon` data URL 和本地化的 `detail` Markdown 说明，「目录」标签页将其显示为卡片图标，并在**详情**中显示长说明。随附组合读取 `v2/current.json`。

1.0.0 读取端只接受 `schemaVersion: 1`，其他版本会让整个索引被拒绝。它继续读取 `v1/current.json`，因此已发布客户端的目录与之前一致，只是不显示图标和长说明，无需任何改动。只有当版本 2 索引位于 1.0.0 读取端读取的地址时才会出现拒绝，例如指向它的自定义 `publishedCatalogUrl`。

## 迁移

1. 在向用户读取的渠道发布版本 2 索引之前，先把 Ocean 升级到 1.0.0 之后的发布版本。
2. 如果自行运营渠道，请以同样方式发布两份文件：在已发布客户端读取的地址保留纯元数据的 `schemaVersion: 1` 索引，并让升级后的组合读取 `schemaVersion: 2` 索引。
3. 打开**插件 → 目录**确认迁移：卡片显示图标，**详情**显示长说明，且没有读取端报告目录不可用。
