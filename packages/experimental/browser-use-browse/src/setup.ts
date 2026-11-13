/** Stable human-facing setup owner; never grants authority through model tools. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@ocean/ocean-config-editor'
import { createHash } from 'node:crypto'
import { Remote, TypertRemoteService } from '@ocean/ocean-typert-protocol'
import { z } from 'zod'
import { Config } from './config.ts'
import { resolveConnection } from './policy.ts'
import { BrowserLifecycle } from './lifecycle.ts'

/** Host-owned failure state survives removal of the optional setup and provider. */
class BrowseCleanupState {
  private failed = false
  /** Whether cleanup failed during this Host lifetime. */
  get blocked(): boolean { return this.failed }
  /** Retain failure until the Host ends; setup replacement cannot restore authority. */
  block(): void { this.failed = true }
}

function cleanupState(ctx: Context): BrowseCleanupState {
  const root = ctx.root
  const existing = root.get('browseCleanupState')
  if (existing !== undefined) return existing
  const state = new BrowseCleanupState()
  root.provide('browseCleanupState', state)
  return state
}

const request = z.strictObject({
  revision: z.string().min(1), enabled: z.boolean(), endpoint: z.string().max(1024),
  tokenFile: z.string().max(4096), browser: z.string().max(256),
  allowedOrigins: z.array(z.string().max(2048)).max(100),
})
import type { BrowserSetupRequest, BrowserSetupStatus } from './remote-types.ts'
function revision(raw: Record<string, unknown>): string {
  const config = Config(raw)
  return createHash('sha256').update(JSON.stringify(Object.keys(config).sort().map(key => [key, config[key as keyof Config]]))).digest('hex')
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    browserSetup: BrowserSetup
    /** Internal Host-lifetime failure state, retained independently of setup activation. */
    browseCleanupState: BrowseCleanupState
  }
}
/** Survives provider reload; failed cleanup prevents any replacement authority. */
export class BrowserSetup extends TypertRemoteService {
  /** Provider generations and cleanup failures retained across configuration reloads. */
  readonly lifecycle: BrowserLifecycle
  constructor(ctx: Context) {
    super(ctx, 'browserSetup')
    const state = cleanupState(ctx)
    this.lifecycle = new BrowserLifecycle(state.blocked)
    ctx.effect(() => async () => {
      // Root withdrawal may precede this completion; retain the state, not a late lookup.
      try { await this.lifecycle.dispose() } catch (error) { state.block(); throw error }
    }, 'browse-setup.dispose')
  }
  private entry() {
    return this.ctx.get('configEditor')?.entries().find(entry => entry.options.id === 'browser-use-browse'
      && entry.options.name === '@ocean/ocean-browser-use-browse')
  }
  /** Read configuration only. Does not read the token file or contact the relay.
   * @returns saved settings, revision, editability and blocked state; connection readiness is untested.
   */
  @Remote
  status(): BrowserSetupStatus {
    const entry = this.entry()
    const raw = (entry?.options.config ?? {}) as Record<string, unknown>
    const config = Config(raw)
    return {
      revision: revision(raw), enabled: config.enabled, writable: entry !== undefined,
      blocked: this.lifecycle.blocked,
      configuration: {
        endpoint: config.endpoint, tokenFile: config.tokenFile, browser: config.browser, allowedOrigins: [...config.allowedOrigins],
      },
      connection: 'not-tested',
    }
  }
  /** Validate, stop old sessions, and persist through the profile editor. Never pairs or connects.
   * Cleanup/write failure requires a restart, not an automatic authority retry.
   * @param input - complete visible form plus revision read by the user.
   * @returns saved configuration, not a connectivity test.
   */
  @Remote
  async save(input: BrowserSetupRequest): Promise<BrowserSetupStatus> {
    const parsed = request.parse(input)
    const editor = this.ctx.get('configEditor')
    const entry = this.entry()
    if (editor === undefined || entry === undefined) throw new Error('Browser setup has no editable profile entry')
    await this.lifecycle.reconfigure(() => {
      const raw = (entry.options.config ?? {}) as Record<string, unknown>
      if (parsed.revision !== revision(raw)) throw new Error('Browser configuration changed; refresh before saving')
      const { revision: _revision, ...fields } = parsed
      const next = { ...raw, ...fields }
      const config = Config(next)
      // Configuration validation is local only; token contents and relay are never read here.
      if (config.enabled) resolveConnection(config)
      return next
    }, async (next) => {
      await editor.edit(entry, (current) => {
        if (parsed.revision !== revision(current)) throw new Error('Browser configuration changed; refresh before saving')
        return next
      })
    })
    return this.status()
  }
}
export default BrowserSetup
