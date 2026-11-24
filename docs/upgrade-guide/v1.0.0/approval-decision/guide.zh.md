---
kind: upgrade-guide
description: "`ctx.approval.request()` 返回 `ApprovalDecision` 对象，而不是裸的结果字符串。"
---

# 审批请求返回决策对象

[English](guide.md) | 中文

## 变更

`ApprovalService.request()` 现在解析为 `ApprovalDecision`，而不是 `ApprovalOutcome` 字符串。该对象携带相同的 `outcome` 字段，并在拒绝时额外携带 `deniedBy`，指明决定拒绝的分支：`'policy'` 表示 `never` 会话策略在任何应答者被咨询之前就拒绝，`'answerer'` 表示应答者针对该请求作出了否定决定。

此前调用方无法区分这两种情况。在调用前后读取会话策略，会在问题待决期间策略切换落地时报告错误的分支，也无法区分在检查与分发之间发生变化的策略。

应答者 waterfall 保留裸结果词汇，因此 `approval/request` 监听器仍然返回 `'allowed-once'`、`'rejected'`、`'cancelled'` 或 `'unavailable'`。`approval/decided` 审计事件仍然记录裸结果，因此会话数据没有变化，现有日志可原样回放。`ctx.approval.policyOf()` 已移除；服务自己报告分支。

## 迁移

1. 在代码比较解析值的地方改为比较 `decision.outcome`。只按结果分支的消费方无需其他改动。
2. 在代码重新读取会话策略以区分策略拒绝与应答者拒绝的地方，改为按 `decision.deniedBy` 分支。不要从 `approval/policy` 事件重建这个区分：问题待决期间策略可能改变。
3. 删除对 `ctx.approval.policyOf(session)` 的调用。服务不再暴露有效策略；`overrideOf(session)` 仍然读取已记录的覆盖值，`ApprovalPolicy` 仍是封闭的 `'ask' | 'never'` 词汇。
4. 重建任何本地服务替身。`request()` 解析为字符串的替身现在会通不过类型检查；在运行时，读取 `.outcome` 的调用方会得到 `undefined` 并拒绝该操作，这是以拒绝方式关闭，而不是放行。
