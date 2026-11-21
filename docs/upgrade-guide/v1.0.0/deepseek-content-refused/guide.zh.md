---
kind: upgrade-guide
description: DeepSeek 内容拒绝完成后报告用量，并以 CONTENT_REFUSED 而不是 MALFORMED_RESPONSE 失败。
---

# 处理 DeepSeek 内容拒绝

[English](guide.md) | 中文

## 变更

DeepSeek Messages 内容拒绝完成后，先报告最终 token 用量，再以 `CONTENT_REFUSED` 失败。Ocean 1.0.0 对这一停止原因报告 `MALFORMED_RESPONSE`。默认重试策略不会重试内容拒绝。

## 迁移

1. 如果集成按错误代码分类，将 `CONTENT_REFUSED` 作为提供方拒绝处理，而不是协议错误。
2. 回放已完成的拒绝，确认集成保留用量，且不会将响应标记为成功。
