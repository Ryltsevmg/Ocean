---
kind: upgrade-guide
description: 自动网页搜索按模型路由选择提供方，不再始终使用 Search API。
---

# 固定网页搜索提供方

[English](guide.md) | 中文

## 变更

Ocean 1.0.0 默认使用 DeepSeek Search API。自动选择现在优先为 DeepSeek API key 和账号模型路由使用 DeepSeek 服务端搜索（`deepseek-official`），其他路由及没有模型路由的请求优先使用 DeepSeek Search API（`deepseek-search-api`）。这会改变接收搜索查询的端点及适用的计费方式。显式搜索选择与独立的网页抓取选择不变。

## 迁移

1. 若要让所有模型路由继续使用 Search API，在**设置 → 网页搜索**中选择 **DeepSeek Search API**；若其他位置未显式指定提供方，也可在启动配置时设置 `OCEAN_WEB_SEARCH_PROVIDER=deepseek-search-api`。
2. 重新打开设置，确认搜索选项。用 DeepSeek 模型运行一次搜索，确认请求使用预期端点。无需更改网页抓取选项。
