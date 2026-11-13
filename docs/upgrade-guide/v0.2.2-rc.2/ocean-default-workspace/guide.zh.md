---
kind: upgrade-guide
description: "首次创建的工作区改用 Ocean 文档目录。"
---
# Ocean 默认工作区目录

[English](guide.md) | 中文

## 变更

首次创建的工作区使用 `<Documents>/Ocean/default-workspace`，不再使用 `<Documents>/deepseek-harness/default-workspace`。已注册的工作区保留已保存的路径。若 Ocean 目录不存在而旧目录已存在，则直接复用旧目录。两个目录同时存在时选择 Ocean。检查错误和非目录冲突会导致失败，而不会静默回退。

## 迁移

1. 现有工作区无需迁移。升级时不要重命名或移动其目录。
2. 新配置中请确认默认工作区指向 Ocean 目录；若 Ocean 目录不存在而旧目录存在，则应指向旧目录。路径解析器不会创建、移动、复制或删除用户文件。
