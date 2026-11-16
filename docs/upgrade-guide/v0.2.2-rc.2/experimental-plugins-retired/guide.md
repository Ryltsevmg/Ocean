---
kind: upgrade-guide
description: "The experimental plugin group and its shipped optional bundles are retired; profiles and compositions referencing them need cleanup."
---

# Experimental plugins retired

English | [中文](guide.zh.md)

## Change

The `packages/experimental` group and every package it contained are removed from the repository and from the installation: voice input, reasoning translation, Computer Use (CUA), Forge change requests and worktrees, the Session Inspector and developer tools, LiveShare, custom plugin indexes, personalized recommendations, action cards, session titles, the powered-by-dsh badge skill, session search, persistent terminals as an optional bundle, repeated delegation (Ralph), the Python PTC runtime, the browser-worker runtime, webhooks, hook bridges, and the OAR subagent. Their published `@ocean/ocean-*` names no longer install, and the plugin manager page that listed them now carries only the remaining optional bundles under the title `Optional plugins` (`@ocean/ocean-subagent-codex`, plus `@ocean/ocean-subagent-claude-code` on demand). Profiles written by earlier releases keep working: app-boot drops every retired bundle name from the profile bundle list at first launch. Settings keys, tools, and client panels the retired plugins contributed disappear from the settings schema, the tool list, and the Web UI. Session logs that the hook bridges wrote contain `hook/invoked` and `hook/result` rows outside the current event vocabulary; opening those Sessions now fails with an unsupported-event error, and no other log changes readability.

## Migration

1. Open each `cordis.yml` profile that named a retired bundle (for example `@ocean/ocean-experimental-voice-input-bundle`, `@ocean/ocean-cua-bundle`, `@ocean/ocean-experimental-forge-bundle`) and delete those bundle list entries; a first launch after the upgrade already removes them, so this step only keeps hand-maintained profiles readable.
2. Delete patch and overlay rows that target retired plugin ids (for example `voice-input`, `forge-panel`, `tool-worktree`, `inspector`): an override whose id no layer declares now warns at compose time instead of configuring a plugin.
3. Replace automations that called retired tools (`tool-session-query`, `tool-terminal`, `tool-ralph`, `tool-worktree`, webhook ingress) with product equivalents or remove the calls; a session that requests a missing tool reports a tool-not-found error.
4. Confirm the migration: `dsh web` starts without compose warnings, the plugin manager shows no retired rows, and `pnpm run verify-product-use`-style composition checks in your own repository pass against the new installation.
