---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-11-18-tool-schema-program-image

[English](2026-11-18-tool-schema-program-image.md) | 中文

## 概述

面向模型的 `ToolSchema` 新增可选 `programImage` 标志，声明程序图像适配的图像产出工具会在记录的 `request/header` 工具列表中写入 `programImage: true`。Session 头仍为格式 4。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

```yaml persistence-change
schemaVersion: 1
id: 2026-11-18-tool-schema-program-image
baseline: false
changes:
  - root: "event:request/header"
    previous: "2026-09-16-session-format-v4"
    after: "ebfcbad087d5a3201d6f2f955b3384512bfb8e1ab25fe2bb458f1ce219f44962"
    decision: same-version
```

<a id="compatibility"></a>
## 兼容性

早于该标志的读取器会把它当作未知可选成员：头部折叠逐字复制 `tools`，提供方序列化器只按 `name`、`description` 和 `parameters` 重建每个请求工具，因此该标志不会进入提供方载荷，也不会改变请求。带该标志的日志对旧读取器仍保持含义，它们会在下次组装头部时丢弃未知成员。新读取器把缺失的标志视为不适配，因此所有既有日志的行为完全不变。没有任何成员变为必需、被重命名或改变类型，头部版本保持 4。

<a id="verification"></a>
## 验证

schema、PTC 类型渲染与 PTC 执行套件共 212 项通过（schema 12、ts-types 15、ptc 185），覆盖声明式工具返回单图、无图、多图以及输出策略替换图像的情形。cordis 目录、持久化目录与类型等价门禁在重新生成产物后通过，`persistence-changes --check` 报告历史一致。

<a id="dev-note"></a>
## 开发备注

无。
