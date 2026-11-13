import { Context } from '@deepseek-ai/cordis'
import Sandbox from '@ocean/ocean-sandbox-local'
import SandboxPolicy from '@ocean/ocean-sandbox-policy'
import SessionProjections from '@ocean/ocean-session-projection'
import { onTestFinished } from 'vitest'
import type { SandboxMode } from '@ocean/ocean-sandbox'

/** Mount the Python runtime's policy and confinement providers with owned teardown. */
export async function createRuntimeContext(policy: { mode?: SandboxMode; workspaceRoot?: string } = {}): Promise<Context> {
  const ctx = new Context()
  onTestFinished(async () => { await ctx.fiber.dispose() })
  await ctx.plugin(Sandbox, {})
  await ctx.plugin(SessionProjections)
  await ctx.plugin(SandboxPolicy, { mode: 'danger-full-access', ...policy })
  return ctx
}
