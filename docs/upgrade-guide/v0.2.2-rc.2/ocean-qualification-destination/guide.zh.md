---
kind: upgrade-guide
description: "安装后更新验收现在要求显式 Ocean 测试目标及新的 schema-2 批次。"
---
# Ocean 安装后更新验收目标

[English](guide.md) | 中文

## 变更

验收不再使用上游测试源或存储桶。所有验收命令要求独立配置测试目标，清单及 Windows 发布配置必须与之匹配。COS 操作仅限所选批次的私有命名空间。拒绝 schema-1 清单及其旧测试应用身份；不会更改保留的数据。

## 迁移

1. 设置 `DSH_DESKTOP_AUTO_UPDATE_ENV=test`，将 `DOWNLOAD_TEST_ORIGIN` 设置为自己的 HTTPS 测试源，将 `DOWNLOAD_TEST_COS_BUCKET` 设置为自己的测试桶。不要使用上游或生产目标。Windows 测试配置必须保持一致。
2. 使用 `prepare-installed-update.ts init` 创建新批次。不要修改 schema-1 清单，也不要将旧回执作为 schema-2 证据复用。
3. 重新进行准备及人工监督的签名、安装和更新检查。本地测试通过及批次分配不证明已成功完成 Windows 安装后更新；仍需人工验收。
