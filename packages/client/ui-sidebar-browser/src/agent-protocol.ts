/**
 * Type-only wire vocabulary between the Desktop Host tools and the Electron
 * main-process browser executor. Both processes implement their own runtime
 * validation so the shared contract stays free of executable code.
 * @module
 */

/** One operation the Desktop main process performs on a shared guest. */
export type BrowserAgentMethod =
  | 'info'
  | 'snapshot'
  | 'click'
  | 'fill'
  | 'navigate'
  | 'back'
  | 'forward'
  | 'reload'
  | 'screenshot'
  | 'press_key'
  | 'scroll'
  | 'select'
  | 'check'
  | 'dialog'
  | 'tabs'
  | 'downloads'
  | 'console'
  | 'network'
  | 'upload'
  | 'tab_select'

/** Host-to-main request for one operation on the Session's shared tab. */
export interface BrowserAgentCommand {
  readonly type: 'browser-agent-command'
  readonly requestId: number
  readonly sessionId: string
  readonly method: BrowserAgentMethod
  readonly args: Readonly<Record<string, string | number>>
}

/** Stable failure reported by the Desktop browser executor. */
export interface BrowserAgentFailure {
  readonly code: string
  readonly message: string
}

/** One bounded raster observation carried beside the text of a successful result. */
export interface BrowserAgentImage {
  readonly data: string
  readonly mediaType: 'image/png'
  readonly width: number
  readonly height: number
}

/** Main-to-Host answer for one command; text is the model-facing observation. */
export type BrowserAgentResult =
  | {
    readonly type: 'browser-agent-result'
    readonly requestId: number
    readonly ok: true
    readonly text: string
    readonly image?: BrowserAgentImage
  }
  | {
    readonly type: 'browser-agent-result'
    readonly requestId: number
    readonly ok: false
    readonly error: BrowserAgentFailure
  }
