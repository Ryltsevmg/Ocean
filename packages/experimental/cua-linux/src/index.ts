/** Experimental Linux AT-SPI provider: semantic actions, never global input. */
import { isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { CuaConfig, installCua, type CuaStartupCapabilities } from '@ocean/ocean-cua'
import { CuaConfigFields } from '@ocean/ocean-cua/config'
import { createLinuxChannel } from './channel.ts'

/** Loader identity. */
export const name = 'cua-linux'
/** Shared authorization and logging remain owned by Ocean CUA. */
export const inject = ['computerUse', 'tools', 'systemPrompt', 'subprocess', 'agents']
/** System Python must supply gi.repository.Atspi; no runtime dependency installation. */
export interface Config extends CuaConfig {
  /** Absolute path to a system Python interpreter with AT-SPI bindings installed. */
  pythonPath: string
  /** Exact logind session identifier used to scope access to the intended desktop. */
  sessionId?: string
}
/** Bound observations and use an absolute system interpreter, not the bundled Python. */
export const Config = Schema.object({
  ...CuaConfigFields,
  pythonPath: Schema.string().pattern(/^\//).default('/usr/bin/python3'),
  sessionId: Schema.string().pattern(/^[a-zA-Z0-9_-]{1,64}$/),
  maxElements: CuaConfigFields.maxElements.max(2000).default(500),
  maxDepth: CuaConfigFields.maxDepth.max(50).default(20),
  maxRequestBytes: CuaConfigFields.maxRequestBytes.max(1024 * 1024).default(64 * 1024),
  maxResponseBytes: CuaConfigFields.maxResponseBytes.max(4 * 1024 * 1024).default(1024 * 1024),
}) satisfies Schema<Record<string, unknown>, Config>

/** No coordinate input, screenshots, key injection or application launch is advertised. */
export const CAPABILITIES: CuaStartupCapabilities = {
  platform: 'linux', methods: ['getCapabilities', 'listApps', 'findApps', 'getApp', 'listWindows', 'getState', 'listActions', 'performAction', 'invoke'],
  appLevelAccessibility: true, keyboard: [], browser: false, coordinateSpace: 'screenshot-pixels',
}
const GUIDANCE = 'Linux Computer Use reads accessibility trees and performs explicitly advertised semantic actions in an authorized application. Select a running application, obtain permission, then read fresh state and use only returned element IDs and action names. Applications without AT-SPI support are unsupported. Screenshots, mouse/keyboard injection, clipboard, launching and focusing windows are not supported. A timeout may mean an action completed; never retry it blindly. Read fresh state.'
/** @param ctx Host context. @param config Explicit provider settings. */
export function apply(ctx: Context, config: Config): void {
  if (process.platform !== 'linux') throw new Error('Linux AT-SPI provider requires a Linux Host')
  if (!isAbsolute(config.pythonPath) || config.helperPath !== undefined && !isAbsolute(config.helperPath))
    throw new Error('Linux CUA interpreter and helper must use absolute paths')
  if (config.sessionId !== undefined && !/^[a-zA-Z0-9_-]{1,64}$/.test(config.sessionId))
    throw new Error('Linux CUA requires an exact logind session ID')
  installCua(ctx, config, {
    helperPath: config.helperPath ?? fileURLToPath(new URL('../native/helper.py', import.meta.url)),
    createChannel: createLinuxChannel(config.pythonPath, config.sessionId), capabilities: CAPABILITIES, acceptsPidSelector: true,
    getGuidance: () => GUIDANCE,
    permissionParameters: (_method, permission) => ({ permission }),
  })
}
