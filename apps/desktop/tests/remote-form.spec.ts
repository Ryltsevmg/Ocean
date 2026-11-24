/** The shipped connection document keeps failures and partial success visible. */
import { readFile } from 'node:fs/promises'
import { Script } from 'node:vm'
import { JSDOM } from 'jsdom'
import { expect, it, onTestFinished, vi } from 'vitest'
import { resolveDesktopLocale } from '../src/locale.ts'
import type { DesktopRemoteResult } from '../src/remote-result.ts'

async function render(options: { canSave?: boolean; pairing?: { address: string } } = {}) {
  const html = await readFile(new URL('../renderer/remote-connection.html', import.meta.url), 'utf8')
  const source = await readFile(new URL('../renderer/remote-connection.js', import.meta.url), 'utf8')
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'dsh-app://shell/remote-connection.html' })
  onTestFinished(() => { dom.window.close() })
  const messages = resolveDesktopLocale('en-US').messages
  const bridge = {
    load: async () => ({ addresses: ['https://saved.example/'], address: 'https://saved.example/',
      canSave: options.canSave ?? true, unreadable: false, pairing: options.pairing,
      messages: { title: messages.remoteDialogTitle, hint: messages.remoteDialogHint, pairHint: messages.remotePairHint,
        address: messages.remoteAddress, token: messages.remoteToken, remember: messages.remoteRemember,
        connect: messages.remoteConnect, forget: messages.remoteForget, cancel: messages.cancel,
        failure: messages.remoteSwitchFailed, invalidAddress: messages.remoteAddressInvalid,
        saveUnavailable: messages.remoteSaveUnavailable,
        hostIdentity: messages.remoteHostIdentity, hostRoutes: messages.remoteHostRoutes,
        hostDifferent: messages.remoteHostDifferent,
        done: messages.remoteDone, connecting: messages.remoteConnecting } }),
    probe: vi.fn<(address: string) => Promise<DesktopRemoteResult | {
      hostId: string
      known: boolean
      saved: boolean
      routes?: string[]
      conflict?: boolean
    }>>(),
    connect: vi.fn<() => Promise<DesktopRemoteResult>>(),
    forget: vi.fn<() => Promise<DesktopRemoteResult>>(),
    pairLink: vi.fn<(link: string) => Promise<DesktopRemoteResult>>(),
    pair: vi.fn<() => Promise<DesktopRemoteResult>>(),
    close: vi.fn<() => Promise<void>>().mockResolvedValue(),
  }
  Object.assign(dom.window, { oceanRemoteForm: bridge, URL })
  await new Script(`(async () => {${source}\n})()`).runInContext(dom.getInternalVMContext())
  const document = dom.window.document
  const field = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)!
  const submit = () => document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }))
  return { bridge, messages, document, window: dom.window, field, submit }
}

it('keeps successful connection and failed saving distinct through dismissal', async () => {
  const view = await render()
  const result = Promise.withResolvers<DesktopRemoteResult>()
  view.bridge.connect.mockReturnValue(result.promise)
  view.field('token').value = 'fixture-secret'
  view.submit()
  expect(view.field('token').value).toBe('')
  expect(view.field('address').disabled).toBe(true)
  expect(view.document.querySelector('form')!.getAttribute('aria-busy')).toBe('true')
  result.resolve({ kind: 'connected', persistence: 'failed', message: view.messages.remoteSaveFailed })
  await vi.waitFor(() => { expect(view.field('connect').textContent).toBe(view.messages.remoteDone) })
  expect({
    message: view.field('failure').textContent,
    warningVisible: !view.field('failure').hidden,
    addressEditable: !view.field('address').disabled,
    action: view.field('connect').textContent,
  }).toMatchInlineSnapshot(`
    {
      "action": "Done",
      "addressEditable": false,
      "message": "Connected, but the token could not be saved. Keep it available for the next sign-in.",
      "warningVisible": true,
    }
  `)
  expect(view.field('close').hidden).toBe(true)
  view.submit()
  expect(view.bridge.close).toHaveBeenCalledOnce()
  expect(view.bridge.connect).toHaveBeenCalledOnce()
})

it('preserves the saved row after failed removal and reports unconfirmed logout after removal', async () => {
  const view = await render()
  view.bridge.forget.mockResolvedValueOnce({ kind: 'failed', code: 'DESKTOP_REMOTE_STORAGE_REMOVE', message: view.messages.remoteStorageFailed })
  view.field('forget').click()
  await vi.waitFor(() => { expect(view.field('failure').textContent).toBe(view.messages.remoteStorageFailed) })
  expect(view.field('address').value).toBe('https://saved.example/')
  expect(view.field('forget').hidden).toBe(false)
  view.bridge.forget.mockResolvedValueOnce({ kind: 'forgotten', logout: 'unconfirmed', message: view.messages.remoteLogoutUnconfirmed })
  view.field('forget').click()
  await vi.waitFor(() => { expect(view.field('failure').textContent).toBe(view.messages.remoteLogoutUnconfirmed) })
  expect(view.field('address').value).toBe('')
  expect(view.field('forget').hidden).toBe(true)
  expect(view.field('failure').hidden).toBe(false)
})

it('contains an IPC failure without displaying its raw message', async () => {
  const view = await render()
  view.bridge.connect.mockRejectedValue(new Error('fixture-secret'))
  view.submit()
  await vi.waitFor(() => { expect(view.field('failure').hidden).toBe(false) })
  expect(view.field('failure').textContent).toBe(view.messages.remoteSwitchFailed)
  expect(view.document.body.textContent).not.toContain('fixture-secret')
  expect(view.field('address').disabled).toBe(false)
})

it('closes the form from the Cancel button and the Escape key', async () => {
  const view = await render()
  expect(view.field('close').textContent).toBe(view.messages.cancel)
  view.field('close').click()
  expect(view.bridge.close).toHaveBeenCalledTimes(1)
  view.document.dispatchEvent(new view.window.KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
  expect(view.bridge.close).toHaveBeenCalledTimes(2)
  expect(view.bridge.connect).not.toHaveBeenCalled()
})

it('keeps Cancel available while a sign-in is pending', async () => {
  const view = await render()
  view.bridge.connect.mockReturnValue(new Promise(() => {}))
  view.field('token').value = 'fixture-secret'
  view.submit()
  expect(view.field('connect').disabled).toBe(true)
  expect(view.field('close').disabled).toBe(false)
  view.field('close').click()
  expect(view.bridge.close).toHaveBeenCalledOnce()
})

it('shows the dialog title and explains that saving is unavailable instead of a disabled checkbox', async () => {
  const view = await render({ canSave: false })
  expect(view.document.querySelector('#title')!.textContent).toBe(view.messages.remoteDialogTitle)
  expect(view.document.querySelector('#hint')!.textContent).toBe(view.messages.remoteDialogHint)
  expect(view.document.querySelector<HTMLElement>('#remember-row')!.hidden).toBe(true)
  expect(view.document.querySelector<HTMLElement>('#save-hint')!.hidden).toBe(false)
  expect(view.document.querySelector('#save-hint')!.textContent).toBe(view.messages.remoteSaveUnavailable)
})

it('rejects an address that is not an HTTPS URL before calling the Host', async () => {
  const view = await render()
  view.field('address').value = 'host.example'
  view.submit()
  expect(view.bridge.connect).not.toHaveBeenCalled()
  expect(view.field('failure').hidden).toBe(false)
  expect(view.field('failure').textContent).toBe(view.messages.remoteAddressInvalid)
  expect(view.field('address').getAttribute('aria-invalid')).toBe('true')
  view.field('address').value = 'https://host.example/'
  view.field('address').dispatchEvent(new view.window.Event('input'))
  expect(view.field('address').hasAttribute('aria-invalid')).toBe(false)
  expect(view.field('failure').hidden).toBe(true)
})

it('asks for confirmation of a pairing link before sending its grant and hides the token fields', async () => {
  const view = await render({ pairing: { address: 'https://ocean.example/mount/' } })
  expect(view.document.querySelector('#hint')!.textContent)
    .toBe(view.messages.remotePairHint.replace('{address}', 'https://ocean.example/mount/'))
  for (const id of ['address-field', 'token-row', 'remember-field']) {
    expect(view.document.querySelector<HTMLElement>(`#${id}`)!.hidden, id).toBe(true)
  }
  expect(view.field('forget').hidden).toBe(true)
  view.bridge.pair.mockResolvedValue({ kind: 'connected', persistence: 'saved' })
  view.submit()
  await vi.waitFor(() => { expect(view.field('connect').textContent).toBe(view.messages.remoteDone) })
  expect(view.bridge.pair).toHaveBeenCalledOnce()
  expect(view.bridge.connect).not.toHaveBeenCalled()
  expect(view.field('close').hidden).toBe(true)
})

it('keeps the confirmation open after a rejected pairing so the user can retry or cancel', async () => {
  const view = await render({ pairing: { address: 'https://ocean.example/' } })
  view.bridge.pair.mockResolvedValue({ kind: 'failed', code: 'DEVICE_PAIRING_REJECTED', message: view.messages.remotePairingRejected })
  view.submit()
  await vi.waitFor(() => { expect(view.field('failure').hidden).toBe(false) })
  expect(view.field('failure').textContent).toBe(view.messages.remotePairingRejected)
  expect(view.field('connect').disabled).toBe(false)
  view.submit()
  expect(view.bridge.pair).toHaveBeenCalledTimes(2)
})

it('turns a pasted pairing link into the confirmation without sending the grant to connect', async () => {
  const view = await render()
  view.bridge.pairLink.mockResolvedValue({ kind: 'pairing', address: 'https://ocean.example/' })
  view.field('address').value = '  ocean://pair?host=https%3A%2F%2Focean.example%2F&label=Phone#grant  '
  view.submit()
  await vi.waitFor(() => { expect(view.document.querySelector<HTMLElement>('#token-row')!.hidden).toBe(true) })
  expect(view.bridge.pairLink).toHaveBeenCalledWith('ocean://pair?host=https%3A%2F%2Focean.example%2F&label=Phone#grant')
  expect(view.field('address').value).toBe('')
  expect(view.bridge.connect).not.toHaveBeenCalled()
  expect(view.document.querySelector('#hint')!.textContent).toContain('https://ocean.example/')
  view.bridge.pair.mockResolvedValue({ kind: 'connected', persistence: 'skipped' })
  view.submit()
  await vi.waitFor(() => { expect(view.bridge.pair).toHaveBeenCalledOnce() })
})

it('reports an invalid pasted pairing link and stays in the ordinary form', async () => {
  const view = await render()
  view.bridge.pairLink.mockResolvedValue({ kind: 'failed', code: 'DESKTOP_REMOTE_PAIR_LINK_INVALID', message: view.messages.remotePairLinkInvalid })
  view.field('address').value = 'ocean://pair?host=nope'
  view.submit()
  await vi.waitFor(() => { expect(view.field('failure').hidden).toBe(false) })
  expect(view.field('failure').textContent).toBe(view.messages.remotePairLinkInvalid)
  expect(view.document.querySelector<HTMLElement>('#token-row')!.hidden).toBe(false)
})

it('names the machine an address reaches, without asking for a token', async () => {
  const view = await render()
  view.bridge.probe.mockResolvedValue({ hostId: '6ace72c7-0fd3-4337-99af-761f403dceda', known: false, saved: false })
  view.field('address').value = 'https://new.example/'
  view.field('address').dispatchEvent(new view.window.Event('input'))
  const identity = view.document.querySelector<HTMLElement>('#host-identity')!
  await vi.waitFor(() => { expect(identity.hidden).toBe(false) })
  expect(identity.textContent).toBe('Host: 6ace72c7')
  expect(identity.classList.contains('warning')).toBe(false)
  expect(view.bridge.probe).toHaveBeenCalledWith('https://new.example/')
})

it('lists the other routes of a machine the record already knows', async () => {
  const view = await render()
  view.bridge.probe.mockResolvedValue({
    hostId: '6ace72c7-0fd3-4337-99af-761f403dceda', known: true, saved: false,
    routes: ['https://lan.example/', 'https://tailnet.example/'],
  })
  view.field('address').value = 'https://third.example/'
  view.field('address').dispatchEvent(new view.window.Event('input'))
  const identity = view.document.querySelector<HTMLElement>('#host-identity')!
  await vi.waitFor(() => { expect(identity.hidden).toBe(false) })
  expect(identity.textContent).toBe('Host: 6ace72c7 — also reachable at https://lan.example/, https://tailnet.example/')
})

it('names the machine behind a saved address', async () => {
  const view = await render()
  view.bridge.probe.mockResolvedValue({
    hostId: '6ace72c7-0fd3-4337-99af-761f403dceda', known: true, saved: true, routes: ['https://saved.example/'],
  })
  view.field('address').value = 'https://saved.example/'
  view.field('address').dispatchEvent(new view.window.Event('input'))
  const identity = view.document.querySelector<HTMLElement>('#host-identity')!
  await vi.waitFor(() => { expect(identity.hidden).toBe(false) })
  expect(identity.textContent).toBe('Host: 6ace72c7 — also reachable at https://saved.example/')
})

it('keeps the identity hidden for an invalid address and ignores a stale probe', async () => {
  const view = await render()
  const first = Promise.withResolvers<{ hostId: string; known: boolean; saved: boolean }>()
  view.bridge.probe.mockReturnValueOnce(first.promise)
  view.bridge.probe.mockResolvedValue({ hostId: 'second-host', known: false, saved: false })
  const identity = view.document.querySelector<HTMLElement>('#host-identity')!
  view.field('address').value = 'http://insecure.example/'
  view.field('address').dispatchEvent(new view.window.Event('input'))
  await new Promise(resolve => setTimeout(resolve, 500))
  expect(view.bridge.probe).not.toHaveBeenCalled()
  view.field('address').value = 'https://first.example/'
  view.field('address').dispatchEvent(new view.window.Event('input'))
  await new Promise(resolve => setTimeout(resolve, 500))
  view.field('address').value = 'https://second.example/'
  view.field('address').dispatchEvent(new view.window.Event('input'))
  await new Promise(resolve => setTimeout(resolve, 500))
  await vi.waitFor(() => { expect(identity.textContent).toBe('Host: second-h') })
  first.resolve({ hostId: 'first-host', known: false, saved: false })
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(identity.textContent).toBe('Host: second-h')
})
