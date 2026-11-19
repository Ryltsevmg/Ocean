---
kind: upgrade-guide
description: "实验插件组及其随安装交付的可选 bundle 整体退役；引用它们的 profile 与组合需要清理。"
---

# 实验插件退役

[English](guide.md) | 中文

## 变更

`packages/experimental` 组及其包含的全部包已从仓库与安装中移除：语音输入、推理翻译、Computer Use（CUA）、Forge 变更请求与工作树、Session Inspector 与开发者工具、LiveShare、自定义插件索引、个性化推荐、操作卡片、会话标题、powered-by-dsh 徽章技能、会话搜索、作为可选 bundle 的持久终端、重复委派（Ralph）、Python PTC 运行时、browser-worker 运行时、webhook、hook 桥接以及 OAR 子代理。它们已发布的 `@ocean/ocean-*` 名称不再可安装；插件管理器中原本列出它们的页面现在以「Optional plugins」为标题，仅保留剩余的可选 bundle（`@ocean/ocean-subagent-codex`，以及按需安装的 `@ocean/ocean-subagent-claude-code`）。早期版本写入的 profile 仍可继续使用：app-boot 会在首次启动时从 profile 的 bundle 列表中删除每一个已退役的 bundle 名称。已退役插件贡献的设置键、工具与客户端面板会从设置 schema、工具列表和 Web 界面中消失。由 hook 桥写入的 Session 日志包含当前事件词表之外的 `hook/invoked` 与 `hook/result` 行；打开这些 Session 现在会报告 unsupported-event 错误，其余日志的可读性不受影响。在已退役的 Auto 审查访问模式下记录的会话不再拒绝打开，而是以受限方式恢复：只读沙箱并要求审批，取代旧的特权组合；转换事件追加到会话日志，既有事件全部保持可读；种子或分叉的 Auto 历史同样受限，而权限旋钮已被更改过的会话按原样恢复。

## 迁移

1. 打开每一个引用已退役 bundle 的 `cordis.yml` profile（例如 `@ocean/ocean-experimental-voice-input-bundle`、`@ocean/ocean-cua-bundle`、`@ocean/ocean-experimental-forge-bundle`），删除这些 bundle 列表项；升级后的首次启动已经会移除它们，因此此步骤只是让手工维护的 profile 保持可读。
2. 删除针对已退役插件 id 的 patch 与 overlay 行（例如 `voice-input`、`forge-panel`、`tool-worktree`、`inspector`）：当覆盖目标的 id 没有任何层声明时，组合阶段会给出警告，而不再配置某个插件。
3. 将调用已退役工具的自动化（`tool-session-query`、`tool-terminal`、`tool-ralph`、`tool-worktree`、webhook 入口）替换为产品内等价能力或删除调用；会话请求缺失工具时会报告 tool-not-found 错误。
4. 确认迁移完成：`dsh web` 启动时没有组合警告，插件管理器中不再出现已退役条目，且你自己仓库中类似 `pnpm run verify-product-use` 的组合检查在新安装上通过。
5. Auto 会话无需任何操作：升级后打开时会自动受限并记录转换；若受限组合过窄，在会话的权限控件中显式选择其他特权 bundle。
