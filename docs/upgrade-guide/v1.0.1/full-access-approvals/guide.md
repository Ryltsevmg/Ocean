---
kind: upgrade-guide
description: "Web and Desktop keep approval confirmations under Full access, and a disabled-approval session no longer reports a user refusal."
---

# Full access keeps approval confirmations

English | [中文](guide.zh.md)

## Change

Web, Desktop, Remote device, and Connect now pair the Full access preset with the `ask` approval policy. Selecting Full access lifts the file sandbox, but an action that asks before running — a GitHub or GitLab write, or any other confirmation-gated tool — still asks you. The preset previously pinned `never`, so those actions were rejected without showing anyone a prompt.

The `never` policy and the base preset table are unchanged, because the automation profiles have no one to answer a prompt: headless, ACP, and SDK sessions keep Full access paired with `never` and stay deterministic. Only the interactive bundle overrides the pair.

A session whose approval policy is `never` now reports a gated action as denied because approval prompts are disabled, instead of claiming that the user rejected it. A denied sandbox escalation likewise no longer attributes the denial to the user.

## Migration

1. Existing sessions keep the approval policy recorded when they were created, so a session that selected Full access before the upgrade now reports **Custom** in the Permissions picker until you select Full access again. Selecting it records the interactive pair and restores the label; new sessions start with it.
2. A Web or Desktop deployment that needs silent writes with no prompt must add a preset with `approval: never` to the `presets` table of `@ocean/ocean-permission-presets` in its own patch layer, then select it. The interactive bundle no longer reads `OCEAN_PERMISSION_MODE` to disable approvals.
3. A gated action in an unattended profile still resolves as a rejection, because those profiles keep `never`; only its wording changed from a user refusal to disabled approval prompts. A profile that selects an `ask` preset without composing an answerer reports "no approval channel is available" instead.
4. After upgrading, confirm that selecting **Full access** still leaves file and command execution unrestricted, and that a write on GitHub asks once before it runs.
