---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-11-17-remote-device-principal

[English](2026-11-17-remote-device-principal.md) | 中文

## 概述

用户请求与重试请求的归属信息可以在现有 principal 字段中记录远程设备标识。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-11-17-remote-device-principal
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-11-16-experimental-plugins-retired"
    after: "017b78b55d989ac7cb61652120642f6d91c7b81939da788cbc09cd0c7c5c2680"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-11-16-experimental-plugins-retired"
    after: "26eee70cb2be17f0133f37882e743bcc917cd29068716db856af8c4fe70ea8f6"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-11-16-experimental-plugins-retired"
    after: "1df135bf9753320edcb2f4ae31134631d9e077204d0a9cb5350aec8d9172bb37"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-11-16-experimental-plugins-retired"
    after: "31e40341753c471de00118aefa98d67cbfd17952c1c9504b5fcc06ff936b4b5a"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

当前读取方接受已有的所有者归属信息。基线版本的 V4 解码器和 Session 事件接纳逻辑未变。它们在现有 user 或 retry 来源类型下将嵌套的 principal 保留为 JSON，因此可以保留新的设备归属信息，回放授权不使用此字段。Session 标头版本仍为 4。

<a id="verification"></a>
## 验证

原生 V4 消息来源测试通过 12 项，包括为用户消息和重试消息写入所有者与远程设备 principal 后严格恢复。与 HEAD 的源码比较确认 V4 和 V2 行格式、持久化事件校验和 Session 事件接纳逻辑均未变。

<a id="dev-note"></a>
## 开发备注

无。
