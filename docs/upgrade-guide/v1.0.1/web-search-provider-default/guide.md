---
kind: upgrade-guide
description: Automatic web search selects a provider based on the model route instead of always using the Search API.
---

# Pin a web search provider

English | [中文](guide.zh.md)

## Change

Ocean 1.0.0 uses DeepSeek Search API by default. With automatic selection, the DeepSeek API-key and account model routes now prefer DeepSeek server-side search (`deepseek-official`); other routes and requests without a model route prefer DeepSeek Search API (`deepseek-search-api`). This changes which endpoint receives search queries and which billing applies. Explicit search selections and the independent Fetch selection are unchanged.

## Migration

1. To keep the Search API on every model route, select **DeepSeek Search API** in **Settings → Web search**, or set `OCEAN_WEB_SEARCH_PROVIDER=deepseek-search-api` for the profile launch if the provider is not explicitly set elsewhere.
2. Reopen settings and verify the search selection. Run a search with a DeepSeek model and verify that it uses the intended endpoint. The Fetch selection does not need to change.
