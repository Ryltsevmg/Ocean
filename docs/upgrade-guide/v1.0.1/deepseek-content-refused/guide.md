---
kind: upgrade-guide
description: Completed DeepSeek content refusals report usage and fail with CONTENT_REFUSED instead of MALFORMED_RESPONSE.
---

# Handle DeepSeek content refusals

English | [中文](guide.zh.md)

## Change

A completed DeepSeek Messages refusal reports final token usage before failing with `CONTENT_REFUSED`. Ocean 1.0.0 reports `MALFORMED_RESPONSE` for this stop reason. The default retry policy does not retry content refusals.

## Migration

1. If your integration classifies DeepSeek errors by code, handle `CONTENT_REFUSED` as a provider refusal rather than a protocol failure.
2. Replay a completed refusal and verify that your integration retains usage and does not mark the response as successful.
