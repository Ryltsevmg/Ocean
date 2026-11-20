---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-11-20-skill-catalog-source

[English](2026-11-20-skill-catalog-source.md) | 中文

## 概述

为持久化的 skill-catalog 条目增加可选的发现来源。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-11-20-skill-catalog-source
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-11-17-remote-device-principal"
    after: "58db3d2bda413d764af1272ffc9e45904ab3f26fe8c1164c457e21785d5ed58c"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-11-17-remote-device-principal"
    after: "33ba2d4b0682046bfbdb10fefb6b493b17555806c72e74f35a13071d4daa1bc9"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-11-17-remote-device-principal"
    after: "633925834cb37e550d7e17e605a1e4fc31465f7448c1d4189e7f360f7736f950"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-11-17-remote-device-principal"
    after: "d9d2129fbb8c65eeb6dd0cc194fff034b6b95f864551d89cd755e75f2f1ea38b"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

已有记录仍然有效：该字段可选，在此变更之前的日志中没有它。读取方将缺失视为未标记来源，并渲染旧格式目录行与 skill_content 块。写入方现在记录胜出的发现来源；目录文本与加载内容由这些条目派生，从不回写。

<a id="verification"></a>
## 验证

pnpm exec vitest run packages/skill：226 个测试通过。pnpm run test:snapshot refresh/replay：在 build:artifacts 之后分别为 228/228 与 229/229。

<a id="dev-note"></a>
## 开发备注

无。
