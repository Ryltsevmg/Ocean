---
kind: upgrade-guide
description: "首次使用 Workspace 的客户端会收到专用 Documents 查询错误，已禁用的 Linux Documents 路径不再选择 HOME 子目录。"
---
# 默认 Workspace 目录失败

[English](guide.md) | 中文

## 变更

系统 Documents 查询失败或返回不可用目录时，`workspace/initializeDefault` 返回 `workspace/default-directory-unavailable`，不再返回 `gateway/internal`。Client 消费方在 `WorkspaceCreateError.rpcError` 中保留该失败。取消和非预期失败的处理不变。

在 Linux 上，等于 HOME 的 XDG Documents 路径即使带尾部分隔符也视为不可用。此前，`XDG_DOCUMENTS_DIR="$HOME/"` 可能在 HOME 下创建默认 Workspace，而 `"$HOME"` 会失败。已登记 Workspace 的路径和身份保持不变。尚不存在的有效 Documents 路径仍会被递归创建。

## 迁移

1. 更新 RPC 错误处理以识别 `workspace/default-directory-unavailable`，并提供显式文件夹选择。不要匹配诊断文本。
2. 如果首次启动提示 Documents 不可用，通过**选择工作区**选择已有项目文件夹或新建文件夹。无需修改全局 XDG 配置。需要自动位置的部署可以将 Workspace Controller 的 `documentsDirectory` 配置为明确的绝对目录。
3. 重启应用并确认已选 Workspace 仍在同一路径可用。已有 Workspace 目录无需移动或重命名。
