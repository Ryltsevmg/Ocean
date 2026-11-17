/** Tool-owned path resolution supplied by the existing toolview registration. */
import type { ToolFileInjected } from '../contract/file-menu.ts'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@ocean/ocean-session/types'
import type {} from '@ocean/ocean-api-session-controller/client'
import { resolveWorkspacePath } from '@ocean/ocean-util-workspace-path'

/**
 * Bind a toolview's path reader to its originating Session.
 * @param ctx - Tool plugin context.
 * @returns Existing Slot registration's inject callback.
 */
export function toolFileInject(ctx: Context): (sessionId: SessionId) => ToolFileInjected {
  return sessionId => ({
    resolveFilePath: (path) => {
      const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd
      const current = ctx.sessions.binding(sessionId)?.session.projections.faceOf('workingDirectory').getSnapshot() as string | null | undefined
      return resolveWorkspacePath(current ?? cwd, path)
    },
  })
}
