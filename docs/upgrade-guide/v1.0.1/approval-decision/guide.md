---
kind: upgrade-guide
description: "`ctx.approval.request()` returns an `ApprovalDecision` object instead of a bare outcome string."
---

# Approval requests return a decision

English | [中文](guide.zh.md)

## Change

`ApprovalService.request()` now resolves an `ApprovalDecision` instead of an `ApprovalOutcome` string. The object carries the same `outcome` field plus, for a rejection, a `deniedBy` field naming the branch that settled it: `'policy'` when a `never` session policy rejected before consulting any answerer, or `'answerer'` when an answerer decided against the request.

A caller could not previously tell those two apart. Reading the session policy around the call reports the wrong branch when a policy switch lands while a question is pending, and it cannot distinguish a policy that changed between the check and the dispatch.

The answerer waterfall keeps the bare outcome vocabulary, so an `approval/request` listener still returns `'allowed-once'`, `'rejected'`, `'cancelled'`, or `'unavailable'`. The `approval/decided` audit event still records the bare outcome, so no Session data changes and existing logs replay unchanged. `ctx.approval.policyOf()` is gone; the service reports the branch itself.

## Migration

1. Compare `decision.outcome` where the code compared the resolved value. A consumer that only branches on the outcome needs no other change.
2. Branch on `decision.deniedBy` where the code re-read the session policy to tell a policy denial from an answerer's refusal. Do not reconstruct that distinction from `approval/policy` events: the policy can change while a question is pending.
3. Remove calls to `ctx.approval.policyOf(session)`. The service no longer exposes the effective policy; `overrideOf(session)` still reads the logged override, and `ApprovalPolicy` remains the closed `'ask' | 'never'` vocabulary.
4. Rebuild any local stand-in for the service. A stub whose `request()` resolves a string now fails the type check and, at runtime, a caller reading `.outcome` sees `undefined` and denies the action, which fails closed rather than granting it.
