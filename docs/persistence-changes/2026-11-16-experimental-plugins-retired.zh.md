---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-11-16-experimental-plugins-retired

[English](2026-11-16-experimental-plugins-retired.md) | 中文

## 概述

实验插件组退役后，持久化类型历史移除了 `hook/invoked` 与 `hook/result` 事件声明，以及实验性的消息 source 与标题请求 union 变体。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-11-16-experimental-plugins-retired
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-10-27-retry-control-input"
    after: "552c92b1fb16320b3e885a64a6b8c9a57fecc7aa7cb458f037a469a17be0f700"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-10-27-retry-control-input"
    after: "9515a567164462897f1e878eadc836188db65fc3d67fab164c3eaf5ae41aaacc"
    decision: same-version
  - root: "event:hook/invoked"
    previous: "2026-09-11-initial"
    after: null
    decision: same-version
  - root: "event:hook/result"
    previous: "2026-09-11-initial"
    after: null
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-10-27-retry-control-input"
    after: "478a2e9f8d1875d4e5369710738fc7d55217875757e03fbc95fc9f0f2d769fe9"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-10-27-retry-control-input"
    after: "6261361093783863e9b6c25ac3b8bbce12308bbb1786b130a788a36f3ca98f2b"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

未使用 hook 桥写入的日志仍可读取。`hook/*` 记录仅写入日志（无 `surfaceOp`）：模型历史从不回放它们，surface 折叠对未知类型走文档化的 default 分支。恢复路径要求每条非 ignorable 事件类型都在当前词表内，因此包含 `hook/invoked` 或 `hook/result` 行的 Session 日志在本变更后不再打开；拒绝是显式的，任何日志都不会被错误解读。Hook 桥是默认关闭的实验能力，不承担产品支持承诺，升级指南已宣告退役。被移除的 `MessageSourceMap` 与标题请求变体是判别字符串与 payload 形态，当前读取方将其视为缺失或不透明；没有当前写入方写它们，且声明包已删除，写入方无法再产出被移除的变体。`SessionHeader.version` 不变：既有判别字段足以阻止不安全解释。

<a id="verification"></a>
## 验证

pnpm run test:snapshot：227 通过（经交付 profile 的录制会话回放）。node_modules/.bin/vitest run packages/session/session-format-v0-to-v1/tests packages/session/session-format-v3-to-v4/tests/corpus.spec.ts packages/test-support/session-snapshot/tests：全部通过；validation.spec 的退役词表不变量现将 `hook/invoked` 与 `hook/result` 列在此前已退役类型旁。pnpm run test：约 4.7 万单元测试，无归因于这些根的回归。

<a id="dev-note"></a>
## 开发备注

无。
