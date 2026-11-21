/** Main-process operations for one Agent-shared Sidebar browser guest. */
import { stat } from 'node:fs/promises'
import type { WebContents } from 'electron'
import type { BrowserAgentCommand, BrowserAgentImage, BrowserAgentMethod } from '@ocean/ocean-client-ui-sidebar-browser/agent-protocol'

/** Longest text one observation may return to the Host. */
const MAX_OBSERVATION_CHARS = 60_000

/** Bounded wait for a navigation or a click-induced document change. */
const SETTLE_TIMEOUT_MS = 8_000

/** Quiet period after an action that did not start a navigation. */
const QUIET_DELAY_MS = 350

const AGENT_METHODS: readonly BrowserAgentMethod[] = ['info', 'snapshot', 'click', 'fill', 'navigate', 'back', 'forward', 'reload', 'screenshot', 'press_key', 'scroll', 'select', 'check', 'dialog', 'upload']

/**
 * Validate one Host command before it reaches the guest.
 * @param value - untrusted private-IPC message.
 * @returns whether the value is one complete browser command.
 */
export function isBrowserAgentCommand(value: unknown): value is BrowserAgentCommand {
  if (typeof value !== 'object' || value === null || !('type' in value) || value.type !== 'browser-agent-command') return false
  const command = value as Record<string, unknown>
  if (!Number.isSafeInteger(command.requestId) || (command.requestId as number) < 0) return false
  if (typeof command.sessionId !== 'string' || command.sessionId.length === 0 || command.sessionId.length > 256) return false
  if (typeof command.method !== 'string' || !AGENT_METHODS.includes(command.method as BrowserAgentMethod)) return false
  if (typeof command.args !== 'object' || command.args === null || Array.isArray(command.args)) return false
  return Object.values(command.args).every(item => typeof item === 'string'
    || (typeof item === 'number' && Number.isFinite(item)))
}

/** One failure that is safe to show to the model. */
export class BrowserAgentError extends Error {
  /**
   * @param message - model-facing description without page content.
   * @param code - stable failure code for routing and diagnostics.
   */
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'BrowserAgentError'
  }
}

/** A point in guest viewport coordinates. */
interface ClickPoint {
  readonly x: number
  readonly y: number
}

/** The page-side snapshot: compact tree plus metadata, never raw HTML. */
interface SnapshotValue {
  readonly title: string
  readonly url: string
  readonly text: string
  readonly truncated: boolean
}

const SNAPSHOT_SCRIPT = String.raw`(() => {
  const REF = 'data-ocean-agent-ref'
  const MAX_NODES = 900
  const MAX_NAME = 140
  const MAX_TEXT = 120
  let next = 0
  const lines = []
  const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
  const clip = (value, limit = MAX_NAME) => {
    const text = clean(value)
    return text.length > limit ? text.slice(0, limit - 1) + '…' : text
  }
  const visible = (el) => {
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    }
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
    return el.getClientRects().length > 0
  }
  const labelOf = (el) => {
    const labelledby = el.getAttribute('aria-labelledby')
    if (labelledby) {
      const text = labelledby.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ')
      if (clean(text)) return clip(text)
    }
    const aria = el.getAttribute('aria-label')
    if (aria) return clip(aria)
    const tag = el.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      const labels = el.labels ? Array.from(el.labels).map((label) => label.textContent ?? '').join(' ') : ''
      if (clean(labels)) return clip(labels)
      const placeholder = el.getAttribute('placeholder')
      if (placeholder) return clip(placeholder)
      return clip(el.getAttribute('name') || el.getAttribute('type') || '')
    }
    if (tag === 'img') return clip(el.getAttribute('alt') || '')
    const text = el.innerText || el.textContent || ''
    return clip(text)
  }
  const roleOf = (el) => {
    const explicit = el.getAttribute('role')
    if (explicit) return explicit
    const tag = el.tagName.toLowerCase()
    if (tag === 'a') return el.hasAttribute('href') ? 'link' : 'text'
    if (tag === 'button') return 'button'
    if (tag === 'textarea') return 'textbox'
    if (tag === 'select') return 'combobox'
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase()
      if (type === 'checkbox') return 'checkbox'
      if (type === 'radio') return 'radio'
      if (type === 'range') return 'slider'
      if (type === 'button' || type === 'submit' || type === 'reset') return 'button'
      return 'textbox'
    }
    if (/^h[1-6]$/.test(tag)) return 'heading'
    if (tag === 'img') return 'image'
    if (tag === 'nav') return 'navigation'
    if (tag === 'main') return 'main'
    if (tag === 'header') return 'banner'
    if (tag === 'footer') return 'contentinfo'
    if (tag === 'aside') return 'complementary'
    if (tag === 'form') return 'form'
    if (tag === 'dialog') return 'dialog'
    if (tag === 'ul' || tag === 'ol') return 'list'
    if (tag === 'li') return 'listitem'
    if (tag === 'table') return 'table'
    if (tag === 'tr') return 'row'
    if (tag === 'td' || tag === 'th') return 'cell'
    if (tag === 'label') return 'label'
    return ''
  }
  const interactive = (el) => {
    const tag = el.tagName.toLowerCase()
    if (tag === 'a' && el.hasAttribute('href')) return true
    if (tag === 'button' || tag === 'input' || tag === 'textarea' || tag === 'select') return true
    if (el.isContentEditable) return true
    if (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1') return true
    const role = el.getAttribute('role')
    return role === 'button' || role === 'link' || role === 'checkbox' || role === 'radio'
      || role === 'combobox' || role === 'textbox' || role === 'tab' || role === 'menuitem'
  }
  const refOf = (el) => {
    let ref = el.getAttribute(REF)
    if (!ref || !/^e[0-9]+$/.test(ref)) {
      ref = 'e' + String(++next)
      el.setAttribute(REF, ref)
    }
    return ref
  }
  const stateOf = (el, tag) => {
    const parts = []
    if (el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled')) parts.push('disabled')
    if (el.getAttribute('aria-expanded') !== null) parts.push('expanded=' + el.getAttribute('aria-expanded'))
    if (el.getAttribute('aria-selected') === 'true') parts.push('selected')
    if (el.getAttribute('aria-checked') !== null) parts.push('checked=' + el.getAttribute('aria-checked'))
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase()
      const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase()
      const secret = type === 'password' || /password|one-time-code|cc-/.test(autocomplete)
      if (type !== 'hidden' && !secret && el.value) parts.push('value=' + JSON.stringify(clip(el.value, MAX_TEXT)))
      if (el.checked) parts.push('checked')
      if (type !== 'text') parts.push('type=' + type)
    } else if (tag === 'textarea' && el.value) {
      parts.push('value=' + JSON.stringify(clip(el.value, MAX_TEXT)))
    } else if (tag === 'select') {
      const selected = el.selectedOptions?.[0]
      if (selected) parts.push('selected=' + JSON.stringify(clip(selected.textContent || selected.value)))
    } else if (tag === 'a' && el.getAttribute('href')) {
      parts.push('href=' + JSON.stringify(clip(el.getAttribute('href'), 200)))
    }
    if (el.getAttribute('aria-required') === 'true' || el.hasAttribute('required')) parts.push('required')
    return parts.length ? ' [' + parts.join(' ') + ']' : ''
  }
  const walk = (el, depth) => {
    if (lines.length >= MAX_NODES) return
    if (!(el instanceof Element)) return
    const tag = el.tagName.toLowerCase()
    if (['script', 'style', 'noscript', 'template', 'head', 'meta', 'link'].includes(tag)) return
    if (el.closest('[aria-hidden="true"]')) return
    if (!visible(el)) return
    const role = roleOf(el)
    const ref = interactive(el) ? refOf(el) : ''
    if (role || ref) {
      const name = labelOf(el)
      const state = stateOf(el, tag)
      lines.push(' '.repeat(depth) + (ref ? ref + ' ' : '') + role + (name ? ' ' + JSON.stringify(name) : '') + state)
    }
    const childDepth = role ? depth + 1 : depth
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = clip(node.textContent || '', MAX_TEXT)
        if (text && !interactive(el)) lines.push(' '.repeat(childDepth) + 'text ' + JSON.stringify(text))
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        walk(node, childDepth)
      }
    }
  }
  if (document.body) walk(document.body, 0)
  const text = lines.join('\n')
  return {
    title: document.title,
    url: location.href,
    text: text.length > ${MAX_OBSERVATION_CHARS} ? text.slice(0, ${MAX_OBSERVATION_CHARS}) : text,
    truncated: lines.length >= MAX_NODES || text.length > ${MAX_OBSERVATION_CHARS},
  }
})()`

/** Validate one Agent navigation target: HTTP(S), no credentials. */
export function assertAgentUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 16 * 1024) {
    throw new BrowserAgentError('The address is invalid.', 'BROWSER_URL_INVALID')
  }
  let url: URL
  try { url = new URL(value) } catch { throw new BrowserAgentError('The address is invalid.', 'BROWSER_URL_INVALID') }
  if (url.username !== '' || url.password !== '') {
    throw new BrowserAgentError('The address must not contain credentials.', 'BROWSER_URL_CREDENTIALS')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BrowserAgentError('Only HTTP and HTTPS addresses are supported.', 'BROWSER_URL_PROTOCOL')
  }
  return url.href
}

/** Validate one element reference emitted by the snapshot. */
export function assertAgentRef(value: unknown): string {
  if (typeof value !== 'string' || !/^e[0-9]+$/u.test(value)) {
    throw new BrowserAgentError('The element reference is invalid; read the page again.', 'BROWSER_REF_INVALID')
  }
  return value
}

/** Run one command against the guest; the caller serializes commands per Session. */
export async function executeBrowserAgent(guest: WebContents, method: BrowserAgentMethod,
  args: Readonly<Record<string, string | number>>): Promise<string> {
  if (guest.isDestroyed()) throw new BrowserAgentError('The shared tab is closed.', 'BROWSER_GUEST_CLOSED')
  switch (method) {
    case 'info':
      return information(guest)
    case 'snapshot':
      return observe(guest)
    case 'navigate': {
      const url = assertAgentUrl(args.url)
      await load(guest, url)
      return observe(guest)
    }
    case 'back':
    case 'forward': {
      const history = guest.navigationHistory
      const can = method === 'back' ? history.canGoBack() : history.canGoForward()
      if (!can) return (method === 'back' ? 'No previous page.' : 'No next page.') + '\n\n' + await observe(guest)
      if (method === 'back') history.goBack(); else history.goForward()
      await settle(guest)
      return observe(guest)
    }
    case 'reload':
      guest.reload()
      await settle(guest)
      return observe(guest)
    case 'click': {
      const ref = assertAgentRef(args.ref)
      const point = await clickPoint(guest, ref)
      guest.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y })
      guest.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 })
      guest.sendInputEvent({ type: 'mouseUp', x: point.x, y: point.y, button: 'left', clickCount: 1 })
      await settle(guest)
      return observe(guest)
    }
    case 'fill': {
      const ref = assertAgentRef(args.ref)
      if (typeof args.text !== 'string') throw new BrowserAgentError('The text is missing.', 'BROWSER_TEXT_INVALID')
      const focus = await fillTarget(guest, ref)
      if (!focus.ok) throw new BrowserAgentError(focus.message, focus.code)
      await guest.insertText(args.text)
      await delay(QUIET_DELAY_MS)
      return observe(guest)
    }
    case 'press_key': {
      const key = assertKey(args.key)
      const modifiers = assertModifiers(args.modifiers)
      guest.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers })
      guest.sendInputEvent({ type: 'keyUp', keyCode: key, modifiers })
      await settle(guest)
      return observe(guest)
    }
    case 'scroll': {
      const deltaX = boundedDelta(args.deltaX)
      const deltaY = boundedDelta(args.deltaY)
      const ref = args.ref === undefined ? undefined : assertAgentRef(args.ref)
      const script = ref === undefined
        ? `(() => { window.scrollBy(${String(deltaX)}, ${String(deltaY)}); return true })()`
        : `(() => { const el = document.querySelector(${JSON.stringify(`[data-ocean-agent-ref="${ref}"]`)}); if (!el) return false; el.scrollBy(${String(deltaX)}, ${String(deltaY)}); return true })()`
      const ok = await guest.executeJavaScript(script, true) as boolean
      if (!ok) throw new BrowserAgentError('The element is no longer on the page; read the page again.', 'BROWSER_REF_STALE')
      await delay(QUIET_DELAY_MS)
      return observe(guest)
    }
    case 'select': {
      const ref = assertAgentRef(args.ref)
      if (typeof args.value !== 'string') throw new BrowserAgentError('The option value is missing.', 'BROWSER_VALUE_INVALID')
      const script = `(() => {
        const el = document.querySelector(${JSON.stringify(`[data-ocean-agent-ref="${ref}"]`)})
        if (!el || el.tagName.toLowerCase() !== 'select') return 'unsupported'
        const option = [...el.options].find(item => item.value === ${JSON.stringify(args.value)})
        if (!option) return 'missing'
        el.value = option.value
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return 'ok'
      })()`
      const outcome = await guest.executeJavaScript(script, true) as string
      if (outcome === 'unsupported') throw new BrowserAgentError('This element is not a select control.', 'BROWSER_SELECT_UNSUPPORTED')
      if (outcome === 'missing') throw new BrowserAgentError('The option is not present; read the page again.', 'BROWSER_OPTION_MISSING')
      await delay(QUIET_DELAY_MS)
      return observe(guest)
    }
    case 'check': {
      const ref = assertAgentRef(args.ref)
      const desired = args.checked === 'true'
      const script = `(() => {
        const el = document.querySelector(${JSON.stringify(`[data-ocean-agent-ref="${ref}"]`)})
        if (!el) return 'missing'
        const type = (el.getAttribute('type') || '').toLowerCase()
        if (el.tagName.toLowerCase() !== 'input' || (type !== 'checkbox' && type !== 'radio')) return 'unsupported'
        if (el.checked !== ${String(desired)}) el.click()
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return el.checked === ${String(desired)} ? 'ok' : 'blocked'
      })()`
      const outcome = await guest.executeJavaScript(script, true) as string
      if (outcome === 'missing') throw new BrowserAgentError('The element is no longer on the page; read the page again.', 'BROWSER_REF_STALE')
      if (outcome === 'unsupported') throw new BrowserAgentError('This element is not a checkbox or radio.', 'BROWSER_CHECK_UNSUPPORTED')
      if (outcome === 'blocked') throw new BrowserAgentError('The page refused the state change.', 'BROWSER_CHECK_BLOCKED')
      await delay(QUIET_DELAY_MS)
      return observe(guest)
    }
    case 'upload': {
      const ref = assertAgentRef(args.ref)
      if (typeof args.path !== 'string' || args.path.length === 0) {
        throw new BrowserAgentError('The upload file path is missing.', 'BROWSER_UPLOAD_PATH_INVALID')
      }
      try { await stat(args.path) } catch {
        throw new BrowserAgentError('The upload file does not exist.', 'BROWSER_UPLOAD_FILE_MISSING')
      }
      if (!guest.debugger.isAttached()) guest.debugger.attach('1.3')
      const point = await clickPoint(guest, ref)
      try {
        await guest.debugger.sendCommand('Page.enable')
        await guest.debugger.sendCommand('Page.setInterceptFileChooserDialog', { enabled: true })
      } catch {
        throw new BrowserAgentError('File-chooser control is unavailable for this tab.', 'BROWSER_UPLOAD_UNAVAILABLE')
      }
      const opened = new Promise<number>((resolve, reject) => {
        const timer = setTimeout(() => { guest.debugger.removeListener('message', onMessage); reject(new BrowserAgentError('The file chooser did not open.', 'BROWSER_UPLOAD_NO_CHOOSER')) }, 5_000)
        timer.unref()
        const onMessage = (_event: unknown, method: string, params: Record<string, unknown>): void => {
          if (method === 'Page.fileChooserOpened') {
            clearTimeout(timer); guest.debugger.removeListener('message', onMessage)
            resolve(typeof params.backendNodeId === 'number' ? params.backendNodeId : -1)
          } else if (method === 'Page.javascriptDialogOpening') {
            clearTimeout(timer); guest.debugger.removeListener('message', onMessage)
            reject(new BrowserAgentError('A dialog opened instead of the file chooser.', 'BROWSER_DIALOG_PENDING'))
          }
        }
        guest.debugger.on('message', onMessage)
      })
      guest.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y })
      guest.sendInputEvent({ type: 'mouseDown', x: point.x, y: point.y, button: 'left', clickCount: 1 })
      guest.sendInputEvent({ type: 'mouseUp', x: point.x, y: point.y, button: 'left', clickCount: 1 })
      const backendNodeId = await opened
      if (backendNodeId < 0) throw new BrowserAgentError('The file chooser did not report its node.', 'BROWSER_UPLOAD_NO_CHOOSER')
      await guest.debugger.sendCommand('DOM.setFileInputFiles', { files: [args.path], backendNodeId })
      await guest.debugger.sendCommand('Page.setInterceptFileChooserDialog', { enabled: false }).catch(() => {})
      await delay(QUIET_DELAY_MS)
      return observe(guest)
    }
    default:
      throw new BrowserAgentError('Unknown browser operation.', 'BROWSER_METHOD_UNKNOWN')
  }
}

/** Read the current page as a bounded semantic tree. */
async function observe(guest: WebContents): Promise<string> {
  const value = await guest.executeJavaScript(SNAPSHOT_SCRIPT, true) as SnapshotValue
  const truncated = value.truncated ? '\n… snapshot truncated; narrow the page or use a smaller target.' : ''
  return `${value.title || '(untitled)'}\n${value.url}\n\n${value.text}${truncated}`
}

/** Read basic tab facts without touching page content. */
function information(guest: WebContents): string {
  return `title: ${guest.getTitle() || '(untitled)'}\nurl: ${guest.getURL() || '(none)'}\nloading: ${String(guest.isLoading())}`
}

/** Load one address and wait for its document to settle. */
async function load(guest: WebContents, url: string): Promise<void> {
  await guest.loadURL(url)
  await settle(guest)
}

/** Resolve a snapshot reference to a clickable viewport point. */
async function clickPoint(guest: WebContents, ref: string): Promise<ClickPoint> {
  const selector = JSON.stringify(`[data-ocean-agent-ref="${ref}"]`)
  const script = `(() => {
    const el = document.querySelector(${selector})
    if (!el) return { ok: false, reason: 'missing' }
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return { ok: false, reason: 'hidden' }
    return { ok: true, x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
  })()`
  const value = await guest.executeJavaScript(script, true) as { ok: boolean; reason?: string; x?: number; y?: number }
  if (!value.ok || value.x === undefined || value.y === undefined) {
    throw new BrowserAgentError(value.reason === 'hidden'
      ? 'The element is not visible; read the page again.'
      : 'The element is no longer on the page; read the page again.', 'BROWSER_REF_STALE')
  }
  return { x: value.x, y: value.y }
}

/** Focus one text control and select its current value. */
async function fillTarget(guest: WebContents,
  ref: string): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const selector = JSON.stringify(`[data-ocean-agent-ref="${ref}"]`)
  const script = `(() => {
    const el = document.querySelector(${selector})
    if (!el) return { ok: false, reason: 'missing' }
    const tag = el.tagName.toLowerCase()
    if (tag === 'select') return { ok: false, reason: 'select' }
    if (!(tag === 'input' || tag === 'textarea' || el.isContentEditable)) return { ok: false, reason: 'unsupported' }
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase()
      const autocomplete = el.getAttribute('autocomplete') || ''
      if (type === 'password' || /password|one-time-code|cc-/i.test(autocomplete)) return { ok: false, reason: 'sensitive' }
    }
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
    el.focus()
    if (tag === 'input' || tag === 'textarea') el.select()
    else {
      const range = document.createRange()
      range.selectNodeContents(el)
      const selection = getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    }
    return { ok: true }
  })()`
  const value = await guest.executeJavaScript(script, true) as { ok: boolean; reason?: string }
  if (value.ok) return { ok: true }
  switch (value.reason) {
    case 'sensitive': return { ok: false, code: 'BROWSER_SECRET_FIELD', message: 'This field is for a secret; ask the person to enter it.' }
    case 'select': return { ok: false, code: 'BROWSER_FILL_UNSUPPORTED', message: 'Use a click to choose an option in this control.' }
    case 'unsupported': return { ok: false, code: 'BROWSER_FILL_UNSUPPORTED', message: 'This element does not accept text.' }
    default: return { ok: false, code: 'BROWSER_REF_STALE', message: 'The element is no longer on the page; read the page again.' }
  }
}

/** Wait for a navigation that the action started, or a bounded quiet period. */
async function settle(guest: WebContents): Promise<void> {
  const navigation = { started: false }
  const start = (): void => { navigation.started = true }
  guest.on('did-start-navigation', start)
  await delay(100)
  guest.removeListener('did-start-navigation', start)
  if (navigation.started || guest.isLoading()) {
    await waitForStop(guest)
    return
  }
  await delay(QUIET_DELAY_MS)
}

/** Wait until the guest stops loading, fails, or disappears. */
async function waitForStop(guest: WebContents): Promise<void> {
  await new Promise<void>((resolve) => {
    const cleanup = (): void => {
      guest.removeListener('did-stop-loading', finish)
      guest.removeListener('did-fail-load', finish)
      guest.removeListener('destroyed', finish)
    }
    const finish = (): void => { clearTimeout(timer); cleanup(); resolve() }
    const timer = setTimeout(finish, SETTLE_TIMEOUT_MS)
    guest.once('did-stop-loading', finish)
    guest.once('did-fail-load', finish)
    guest.once('destroyed', finish)
  })
}

/** Resolve after one non-unref'd delay. */
function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, milliseconds) })
}

/** Read one bounded viewport raster from the guest without touching page content. */
export async function captureBrowserScreenshot(guest: WebContents,
  args: Readonly<Record<string, string | number>>): Promise<{ text: string; image: BrowserAgentImage }> {
  if (guest.isDestroyed()) throw new BrowserAgentError('The shared tab is closed.', 'BROWSER_GUEST_CLOSED')
  const maxWidth = boundedInteger(args.maxWidth, 1280, 64, 4096)
  const maxBytes = boundedInteger(args.maxBytes, 4_000_000, 1024, 16_000_000)
  const captured = await guest.capturePage()
  const size = captured.getSize()
  const scaled = size.width > maxWidth ? captured.resize({ width: maxWidth }) : captured
  const png = scaled.toPNG()
  if (png.byteLength > maxBytes) {
    throw new BrowserAgentError('The page screenshot exceeds the configured byte limit.', 'BROWSER_SCREENSHOT_TOO_LARGE')
  }
  const dims = scaled.getSize()
  return {
    text: `screenshot ${String(dims.width)}x${String(dims.height)}`,
    image: { data: png.toString('base64'), mediaType: 'image/png', width: dims.width, height: dims.height },
  }
}

/** Validate one numeric screenshot bound, falling back to the deployment default. */
function boundedInteger(value: string | number | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

/** The bounded key set the Agent may press, mapped to Electron key codes. */
const KEY_CODES: Readonly<Record<string, string>> = {
  Enter: 'Enter', Tab: 'Tab', Escape: 'Escape', Backspace: 'Backspace', Delete: 'Delete',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Space: 'Space',
}

/** Validate one pressable key name. */
function assertKey(value: string | number | undefined): string {
  if (typeof value !== 'string' || KEY_CODES[value] === undefined) {
    throw new BrowserAgentError('The key is not supported.', 'BROWSER_KEY_UNSUPPORTED')
  }
  return KEY_CODES[value]
}

/** Validate the modifier list carried as a comma-separated string. */
function assertModifiers(value: string | number | undefined): ('shift' | 'control' | 'alt' | 'meta')[] {
  if (value === undefined || value === '') return []
  if (typeof value !== 'string') throw new BrowserAgentError('The modifiers are invalid.', 'BROWSER_MODIFIERS_INVALID')
  const allowed = ['shift', 'control', 'alt', 'meta'] as const
  const parts = value.split(',')
  if (parts.some(part => !(allowed as readonly string[]).includes(part))) {
    throw new BrowserAgentError('The modifiers are invalid.', 'BROWSER_MODIFIERS_INVALID')
  }
  return parts as ('shift' | 'control' | 'alt' | 'meta')[]
}

/** Clamp one scroll delta to a bounded viewport movement. */
function boundedDelta(value: string | number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(-10_000, Math.min(10_000, Math.round(value)))
}

/** One pending JavaScript dialog observed through the scoped Page domain. */
export interface PendingDialog {
  readonly type: string
  readonly message: string
  readonly defaultPrompt?: string
}

/** Scoped dialog observation and answering for one guest; no other CDP domain is enabled. */
export interface DialogWatch {
  pending(): PendingDialog | undefined
  answer(action: 'accept' | 'dismiss', promptText?: string): Promise<void>
  dispose(): void
}

/** Attach only the Page domain needed for JavaScript dialogs; a foreign debugger leaves the watch inert. */
export function watchDialogs(guest: WebContents): DialogWatch {
  let pending: PendingDialog | undefined
  let active = true
  const onMessage = (_event: unknown, method: string, params: Record<string, unknown>): void => {
    if (method === 'Page.javascriptDialogOpening') {
      pending = {
        type: String(params.type), message: String(params.message),
        ...typeof params.defaultPrompt === 'string' ? { defaultPrompt: params.defaultPrompt } : {},
      }
    } else if (method === 'Page.javascriptDialogClosed') pending = undefined
  }
  try {
    guest.debugger.attach('1.3')
    guest.debugger.on('message', onMessage)
    void guest.debugger.sendCommand('Page.enable').catch(() => { active = false })
  } catch {
    active = false
  }
  return {
    pending: () => pending,
    async answer(action, promptText) {
      if (!active) throw new BrowserAgentError('Dialog control is unavailable for this tab.', 'BROWSER_DIALOG_UNAVAILABLE')
      if (pending === undefined) throw new BrowserAgentError('No JavaScript dialog is open.', 'BROWSER_DIALOG_NONE')
      await guest.debugger.sendCommand('Page.handleJavaScriptDialog', {
        accept: action === 'accept', ...promptText === undefined ? {} : { promptText },
      })
      pending = undefined
    },
    dispose() {
      pending = undefined
      guest.debugger.removeListener('message', onMessage)
      if (active && !guest.isDestroyed()) {
        void guest.debugger.sendCommand('Page.disable').catch(() => {})
        try { guest.debugger.detach() } catch { /* already detached by the guest teardown */ }
      }
      active = false
    },
  }
}
