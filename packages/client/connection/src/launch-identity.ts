/** Root-owned identities shared across Connection plugin reloads. */
import { randomBytes, randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type { HostEpoch } from './connect-protocol.ts'

/** Credentials and epoch valid for one application root lifetime. */
export interface ConnectionLaunch {
  readonly launchToken: string
  readonly epoch: HostEpoch
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Application-root owner of Connection launch credentials and epoch. */
    connectionLaunch: ConnectionLaunch
  }
}

/**
 * Obtain the launch identity from the application root, creating its owner once.
 * @param ctx - Context belonging to this application launch.
 * @returns Identity retained until the root is disposed.
 */
export function connectionLaunch(ctx: Context): ConnectionLaunch {
  const root = ctx.root
  const current = root.get('connectionLaunch')
  if (current !== undefined) return current
  const value = { launchToken: randomBytes(32).toString('base64url'), epoch: randomUUID() as HostEpoch }
  root.provide('connectionLaunch', value)
  return value
}
