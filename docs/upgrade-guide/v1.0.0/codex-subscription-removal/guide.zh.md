---
kind: upgrade-guide
description: "Web 与 Desktop 移除了内置 ChatGPT 订阅插件及其模型提供方。"
---

# 移除内置 ChatGPT 订阅配置

[English](guide.md) | 中文

## 变更

Web 与 Desktop 不再附带 `@ocean/ocean-codex-subscription`。它的设置分区、ChatGPT plan 预览、旧版订阅登录、账号模型目录和提供方路由均不可用。选择过其模型或在自定义 profile 中挂载此包的用户需要迁移。独立的 `@ocean/ocean-subagent-codex` 包仍可使用。

升级不会撤销远程授权或删除已保存的凭据记录。历史对话仍可阅读，但使用已移除提供方的对话需要选择可用模型才能继续。

## 迁移

1. 升级前，若使用过旧插件的两种订阅账号流程，请分别退出登录。无法确认撤销时，通过提供方账号处理。如果已经升级，请在提供方账号中管理授权，不要将令牌复制到配置文件。
2. 从自定义包依赖中删除 `@ocean/ocean-codex-subscription`，并从自定义 `cordis.yml`、patch 或 profile insert 中删除 `ocean-codex-subscription` 条目。随附 profile 已不包含它。
3. 打开**设置 → 模型**，配置可用提供方，并为受影响的会话或 preset 选择其模型。已有选择不会自动切换提供方。
4. 重启 Web 或 Desktop，确认启动时没有缺失包错误、订阅设置分区不再显示，并且新消息能使用选定提供方完成。
