---
kind: upgrade-guide
description: "First-use Workspace clients receive a specific Documents lookup error, and disabled Linux Documents paths no longer select a HOME subdirectory."
---
# Default Workspace directory failures

English | [中文](guide.zh.md)

## Change

`workspace/initializeDefault` reports `workspace/default-directory-unavailable` instead of `gateway/internal` when system Documents lookup fails or returns an unavailable directory. Client consumers retain that failure in `WorkspaceCreateError.rpcError`. Cancellation and unexpected failures are unchanged.

On Linux, an XDG Documents path equal to HOME is unavailable even with a trailing separator. Previously, `XDG_DOCUMENTS_DIR="$HOME/"` could create a default Workspace below HOME, while `"$HOME"` failed. Registered Workspaces keep their paths and identities. Valid Documents paths that do not yet exist are still created recursively.

## Migration

1. Update RPC error handling to recognize `workspace/default-directory-unavailable` and offer explicit folder selection. Do not match diagnostic text.
2. If first-use startup reports that Documents is unavailable, use **Choose workspace** to select an existing project folder or create a new folder. No global XDG change is required. Deployments that require an automatic location can configure the Workspace Controller's `documentsDirectory` with an explicit absolute directory.
3. Restart the application and confirm that the chosen Workspace remains available at the same path. Existing Workspace directories require no move or rename.
