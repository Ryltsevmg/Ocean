---
kind: upgrade-guide
description: "New first-use Workspaces use the Ocean Documents directory."
---
# Ocean default Workspace directory

English | [中文](guide.zh.md)

## Change

New first-use Workspaces use `<Documents>/Ocean/default-workspace` instead of `<Documents>/deepseek-harness/default-workspace`. Registered Workspaces retain their stored paths. If the Ocean directory does not exist but the legacy directory does, initialization reuses the legacy directory in place. When both exist, Ocean is selected. Inspection errors and non-directory collisions fail rather than silently falling back.

## Migration

1. No migration is required for existing Workspaces. Do not rename or move their directories as part of this upgrade.
2. On a new profile, confirm the default Workspace points to the Ocean directory, or to the existing legacy directory when the Ocean directory is absent. The resolver never creates, moves, copies, or deletes user files.
