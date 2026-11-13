/** Immutable provider authority and limits. */
import Schema from '@deepseek-ai/schemastery'
import type { ConnectionConfig } from './policy.ts'
/** Profile-owned opt-in and local connection. No model tool can alter these settings. */
export interface Config extends ConnectionConfig {
  /** Allow browser tools after explicit configuration; does not pair or connect a browser. */
  enabled: boolean
}
/** Inert defaults; all connection settings are validated before activation. */
export const Config = Schema.object({
  enabled: Schema.boolean().default(false),
  endpoint: Schema.string().default('http://127.0.0.1:19988'),
  tokenFile: Schema.string().default(''),
  browser: Schema.string().default(''),
  allowedOrigins: Schema.array(Schema.string()).default([]),
  handoffTimeoutMs: Schema.number().step(1).min(1000).max(600000).default(300000),
  timeoutMs: Schema.number().step(1).min(100).max(120000).default(30000),
  maxResponseBytes: Schema.number().step(1).min(1024).max(1000000).default(262144),
})
