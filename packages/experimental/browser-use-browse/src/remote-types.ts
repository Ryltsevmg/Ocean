/** Explicit human-owned setup submission. No token values are accepted. */
export interface BrowserSetupRequest {
  revision: string
  enabled: boolean
  endpoint: string
  tokenFile: string
  browser: string
  allowedOrigins: string[]
}
/** Configuration observation is not a claim of a working browser connection. */
export interface BrowserSetupStatus {
  revision: string
  enabled: boolean
  writable: boolean
  blocked: boolean
  configuration: { endpoint: string; tokenFile: string; browser: string; allowedOrigins: string[] }
  connection: 'not-tested'
}
