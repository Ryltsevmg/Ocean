/** The shipped connection document lists machines and keeps failures and partial success visible. */
import { readFile } from 'node:fs/promises'
import { Script } from 'node:vm'
import { JSDOM } from 'jsdom'
import { expect, it, onTestFinished, vi } from 'vitest'
import { resolveDesktopLocale } from '../src/locale.ts'
import type { DesktopRemoteResult } from '../src/remote-result.ts'
import type { RemoteDiscovery as Discovery } from '../src/remote-discovery.ts'

interface Machine { hostId: string; routes: string[] }

async function render(options: {
  canSave?: boolean
  pairing?: { address: string }
  unreadable?: boolean
  notice?: string
  machines?: Machine[]
  discover?: Partial<Discovery>
} = {}) {
  const html = await readFile(new URL('../renderer/remote-connection.html', import.meta.url), 'utf8')
  const source = await readFile(new URL('../renderer/remote-connection.js', import.meta.url), 'utf8')
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'dsh-app://shell/remote-connection.html' })
  onTestFinished(() => { dom.window.close() })
  const messages = resolveDesktopLocale('en-US').messages
  const bridge = {
    load: async () => ({
      address: 'https://saved.example/', canSave: options.canSave ?? true, unreadable: options.unreadable ?? false,
      machines: options.machines ?? [{ hostId: 'saved-host', routes: ['https://saved.example/'] }],
      notice: options.notice ?? (options.unreadable ? messages.remoteSavedUnreadable : undefined), pairing: options.pairing,
      messages: { title: messages.remoteDialogTitle, hint: messages.remoteDialogHint, pairHint: messages.remotePairHint,
        address: messages.remoteAddress, token: messages.remoteToken, remember: messages.remoteRemember,
        connect: messages.remoteConnect, forget: messages.remoteForget, cancel: messages.cancel,
        failure: messages.remoteSwitchFailed, invalidAddress: messages.remoteAddressInvalid,
        saveUnavailable: messages.remoteSaveUnavailable,
        hostIdentity: messages.remoteHostIdentity, hostRoutes: messages.remoteHostRoutes,
        hostDifferent: messages.remoteHostDifferent,
        sshLabel: messages.remoteSshLabel, sshHint: messages.remoteSshHint,
        sshStart: messages.remoteSshStart, sshStarting: messages.remoteSshStarting,
        done: messages.remoteDone, connecting: messages.remoteConnecting,
        machines: messages.remoteMachinesLabel, savedBadge: messages.remoteSavedBadge, sshBadge: messages.remoteSshBadge,
        tailscaleBadge: messages.remoteTailscaleBadge, setup: messages.remoteSetupAction, pair: messages.remotePairAction,
        forgetMachine: messages.remoteForgetMachine, discovering: messages.remoteDiscovering, refresh: messages.remoteRefresh,
        tailscaleMissing: messages.remoteTailscaleMissing, otherWays: messages.remoteOtherWays,
        password: messages.remotePasswordLabel, passwordHint: messages.remotePasswordHint, back: messages.remotePasswordBack },
    }),
    discover: vi.fn<() => Promise<Discovery>>().mockResolvedValue({
      kind: 'discovered', ssh: [], tailscale: [], tailscaleAvailable: true, ...options.discover,
    }),
    startSsh: vi.fn<(host: string) => Promise<DesktopRemoteResult>>(),
    probe: vi.fn<(address: string) => Promise<DesktopRemoteResult | {
      hostId: string
      known: boolean
      saved: boolean
      routes?: string[]
      conflict?: boolean
    }>>(),
    connect: vi.fn<() => Promise<DesktopRemoteResult>>(),
    forget: vi.fn<(address?: string) => Promise<DesktopRemoteResult>>(),
    pairLink: vi.fn<(link: string) => Promise<DesktopRemoteResult>>(),
    pair: vi.fn<() => Promise<DesktopRemoteResult>>(),
    pairPassword: vi.fn<(address: string, password: string) => Promise<DesktopRemoteResult>>(),
    close: vi.fn<() => Promise<void>>().mockResolvedValue(),
  }
  Object.assign(dom.window, { oceanRemoteForm: bridge, URL })
  await new Script(`(async () => {${source}\n})()`).runInContext(dom.getInternalVMContext())
  const document = dom.window.document
  /** The one element a selector names; a missing one is a broken fixture rather than a failed expectation. */
  const required = (selector: string): HTMLElement => {
    const element = document.querySelector<HTMLElement>(selector)
    if (element === null) throw new Error(`No element matches ${selector}`)
    return element
  }
  const field = (id: string) => required(`#${id}`) as HTMLInputElement
  const submit = () => required('form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }))
  const view = { bridge, messages, document, window: dom.window, field, submit }
  // Discovery starts with the document; the list and the status line settle once it answered.
  await vi.waitFor(() => { expect(view.field('refresh').disabled).toBe(false) })
  return view
}
const rows = (view: Awaited<ReturnType<typeof render>>) =>
  [...view.document.querySelectorAll<HTMLElement>('#machine-list [role="listitem"]')].map(row => ({
    name: row.querySelector('.name')!.textContent, badge: row.querySelector('.badge')!.textContent,
    action: row.querySelector<HTMLButtonElement>('button')!.textContent, buttons: [...row.querySelectorAll('button')].map(button => button.textContent),
  }))
const click = (view: Awaited<ReturnType<typeof render>>, text: string, index = 0): void => {
  [...view.document.querySelectorAll<HTMLButtonElement>('#machine-list button')].filter(button => button.textContent === text)[index]!.click()
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
  expect(view.document.querySelector<HTMLButtonElement>('#machine-list button')!.disabled).toBe(true)
  view.submit()
  expect(view.bridge.close).toHaveBeenCalledOnce()
  expect(view.bridge.connect).toHaveBeenCalledOnce()
})

it('lists saved machines with their most recent route, connects with the saved token, and focuses the first action', async () => {
  const view = await render({ machines: [
    { hostId: 'first-host', routes: ['https://lan.example/', 'https://first.tail71ee4f.ts.net:10443/'] },
    { hostId: 'second-host', routes: ['https://second.example/'] },
  ] })
  expect(rows(view)).toEqual([
    { name: 'first.tail71ee4f.ts.net:10443', badge: 'Saved', action: 'Connect', buttons: ['Connect', 'Forget'] },
    { name: 'second.example', badge: 'Saved', action: 'Connect', buttons: ['Connect', 'Forget'] },
  ])
  expect(view.document.activeElement).toBe(view.document.querySelector('#machine-list button'))
  expect(view.document.querySelector('#machines-label')!.textContent).toBe(view.messages.remoteMachinesLabel)
  expect(view.document.querySelector('#hint')!.textContent).toBe(view.messages.remoteDialogHint)
  view.bridge.connect.mockResolvedValue({ kind: 'connected', persistence: 'skipped' })
  click(view, 'Connect')
  await vi.waitFor(() => { expect(view.field('connect').textContent).toBe(view.messages.remoteDone) })
  expect(view.bridge.connect).toHaveBeenCalledWith('https://first.tail71ee4f.ts.net:10443/', '', false)
})

it('keeps a saved machine after a failed removal and drops it after a confirmed one', async () => {
  const view = await render()
  view.bridge.forget.mockResolvedValueOnce({ kind: 'failed', code: 'DESKTOP_REMOTE_STORAGE_REMOVE', message: view.messages.remoteStorageFailed })
  click(view, 'Forget')
  await vi.waitFor(() => { expect(view.field('failure').textContent).toBe(view.messages.remoteStorageFailed) })
  expect(view.bridge.forget).toHaveBeenCalledWith('https://saved.example/')
  expect(rows(view)).toHaveLength(1)
  expect(rows(view)[0]!.name).toBe('saved.example')
  view.bridge.forget.mockResolvedValueOnce({ kind: 'forgotten', logout: 'unconfirmed', message: view.messages.remoteLogoutUnconfirmed })
  click(view, 'Forget')
  await vi.waitFor(() => { expect(rows(view)).toHaveLength(0) })
  expect(view.field('failure').textContent).toBe(view.messages.remoteLogoutUnconfirmed)
  expect(view.field('failure').hidden).toBe(false)
})

it('offers an unreadable record for removal from the list', async () => {
  const view = await render({ unreadable: true, machines: [] })
  const forget = view.field('forget-unreadable')
  expect(view.document.querySelector('#failure')!.textContent).toBe(view.messages.remoteSavedUnreadable)
  expect(forget.hidden).toBe(false)
  expect(forget.textContent).toBe(view.messages.remoteForget)
  view.bridge.forget.mockResolvedValueOnce({ kind: 'forgotten', logout: 'confirmed' })
  forget.click()
  await vi.waitFor(() => { expect(view.bridge.forget).toHaveBeenCalledWith() })
  await vi.waitFor(() => { expect(forget.hidden).toBe(true) })
  expect(view.document.querySelector<HTMLElement>('#failure')!.hidden).toBe(true)
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

it('lists SSH destinations and Tailscale machines as they are discovered, and says so while looking', async () => {
  const view = await render({ machines: [] })
  const discovery = Promise.withResolvers<Discovery>()
  view.bridge.discover.mockReturnValue(discovery.promise)
  view.field('refresh').click()
  expect(view.document.querySelector('#discover-status')!.textContent).toBe(view.messages.remoteDiscovering)
  expect(view.field('refresh').disabled).toBe(true)
  discovery.resolve({
    kind: 'discovered', tailscaleAvailable: false,
    ssh: [{ host: 'bigpc', label: 'bigpc' }],
    tailscale: [{ address: 'https://air.tail71ee4f.ts.net/', hostId: 'air-host', known: false }],
  })
  await vi.waitFor(() => { expect(rows(view)).toHaveLength(2) })
  expect(rows(view)).toEqual([
    { name: 'bigpc', badge: 'SSH', action: 'Set up', buttons: ['Set up'] },
    { name: 'air.tail71ee4f.ts.net', badge: 'Tailscale', action: 'Pair', buttons: ['Pair'] },
  ])
  expect(view.document.querySelector('#discover-status')!.textContent).toBe(view.messages.remoteTailscaleMissing)
  expect(view.field('refresh').disabled).toBe(false)
  // A list that was empty at load receives the focus once its first row exists.
  expect(view.document.activeElement).toBe(view.document.querySelector('#machine-list button'))
})

it('refreshes the list on request and clears a Tailscale note that no longer applies', async () => {
  const view = await render({ machines: [], discover: { tailscaleAvailable: false, ssh: [{ host: 'bigpc', label: 'bigpc' }] } })
  expect(view.document.querySelector('#discover-status')!.textContent).toBe(view.messages.remoteTailscaleMissing)
  view.bridge.discover.mockResolvedValueOnce({ kind: 'discovered', ssh: [], tailscale: [], tailscaleAvailable: true })
  view.field('refresh').click()
  await vi.waitFor(() => { expect(view.bridge.discover).toHaveBeenCalledTimes(2) })
  await vi.waitFor(() => { expect(rows(view)).toHaveLength(0) })
  expect(view.document.querySelector('#discover-status')!.textContent).toBe('')
})

it('keeps the saved machines listed when discovery cannot run', async () => {
  const view = await render()
  view.bridge.discover.mockRejectedValueOnce(new Error('channel closed'))
  view.field('refresh').click()
  await vi.waitFor(() => { expect(view.field('refresh').disabled).toBe(false) })
  expect(rows(view)).toHaveLength(1)
  expect(view.document.querySelector('#discover-status')!.textContent).toBe('')
  expect(view.document.body.textContent).not.toContain('channel closed')
})

it('shows a Tailscale route of a saved machine on that machine\'s saved row', async () => {
  const view = await render({
    machines: [{ hostId: 'saved-host', routes: ['https://lan.example/'] }],
    discover: { tailscale: [{ address: 'https://saved.tail71ee4f.ts.net/', hostId: 'saved-host', known: true }] },
  })
  expect(rows(view)).toEqual([{ name: 'saved.tail71ee4f.ts.net', badge: 'Saved', action: 'Connect', buttons: ['Connect', 'Forget'] }])
  view.bridge.connect.mockResolvedValue({ kind: 'failed', code: 'DEVICE_CONNECTION_FAILED', message: view.messages.remoteNetworkFailed })
  click(view, 'Connect')
  await vi.waitFor(() => { expect(view.field('failure').textContent).toBe(view.messages.remoteNetworkFailed) })
  expect(view.bridge.connect).toHaveBeenCalledWith('https://saved.tail71ee4f.ts.net/', '', false)
  // Forgetting removes the saved route, not the discovered one, and leaves the machine to pair again.
  view.bridge.forget.mockResolvedValueOnce({ kind: 'forgotten', logout: 'confirmed' })
  click(view, 'Forget')
  await vi.waitFor(() => { expect(view.bridge.forget).toHaveBeenCalledWith('https://lan.example/') })
  await vi.waitFor(() => { expect(rows(view)).toEqual([{ name: 'saved.tail71ee4f.ts.net', badge: 'Tailscale', action: 'Pair', buttons: ['Pair'] }]) })
})

it('asks for the pairing password of a Tailscale machine, pairs with it, and returns to the list', async () => {
  const view = await render({ machines: [], discover: { tailscale: [{ address: 'https://air.tail71ee4f.ts.net/', hostId: 'air-host', known: false }] } })
  click(view, 'Pair')
  const passwordField = view.document.querySelector<HTMLElement>('#password-field')!
  expect(passwordField.hidden).toBe(false)
  expect(view.document.querySelector<HTMLElement>('#machines')!.hidden).toBe(true)
  expect(view.document.querySelector<HTMLElement>('#other-ways')!.hidden).toBe(true)
  expect(view.document.querySelector('#hint')!.textContent).toBe(view.messages.remotePasswordHint.replace('{address}', 'https://air.tail71ee4f.ts.net/'))
  expect(view.document.querySelector('#password-label')!.textContent).toBe(view.messages.remotePasswordLabel)
  expect(view.field('connect').textContent).toBe(view.messages.remotePairAction)
  // The password prompt keeps the footer: it is the Pair button.
  expect(view.field('connect').hidden).toBe(false)
  expect(view.field('connect').disabled).toBe(false)
  expect(view.document.activeElement).toBe(view.field('password'))
  expect(view.document.querySelector('#back')!.textContent).toBe(view.messages.remotePasswordBack)

  view.submit()
  expect(view.bridge.pairPassword).not.toHaveBeenCalled()
  const result = Promise.withResolvers<DesktopRemoteResult>()
  view.bridge.pairPassword.mockReturnValue(result.promise)
  view.field('password').value = 'correct horse'
  view.submit()
  expect(view.field('password').value).toBe('')
  expect(view.field('connect').disabled).toBe(true)
  result.resolve({ kind: 'failed', code: 'DEVICE_PAIRING_REJECTED', message: view.messages.remotePasswordWrong })
  await vi.waitFor(() => { expect(view.field('failure').textContent).toBe(view.messages.remotePasswordWrong) })
  expect(view.bridge.pairPassword).toHaveBeenCalledWith('https://air.tail71ee4f.ts.net/', 'correct horse')
  expect(view.document.body.textContent).not.toContain('correct horse')
  expect(passwordField.hidden).toBe(false)
  expect(view.field('connect').textContent).toBe(view.messages.remotePairAction)

  view.document.querySelector<HTMLButtonElement>('#back')!.click()
  expect(passwordField.hidden).toBe(true)
  expect(view.document.querySelector<HTMLElement>('#machines')!.hidden).toBe(false)
  expect(view.document.querySelector<HTMLElement>('#other-ways')!.hidden).toBe(false)
  expect(view.document.querySelector('#hint')!.textContent).toBe(view.messages.remoteDialogHint)
  expect(view.field('connect').textContent).toBe(view.messages.remoteConnect)
  expect(view.field('connect').hidden).toBe(true)
  expect(rows(view)).toHaveLength(1)
  expect(view.document.activeElement).toBe(view.document.querySelector('#machine-list button'))
})

it('closes after pairing with a password as after any other sign-in', async () => {
  const view = await render({ machines: [], discover: { tailscale: [{ address: 'https://air.tail71ee4f.ts.net/', hostId: 'air-host', known: false }] } })
  view.bridge.pairPassword.mockResolvedValue({ kind: 'connected', persistence: 'saved' })
  click(view, 'Pair')
  view.field('password').value = 'correct horse'
  view.submit()
  await vi.waitFor(() => { expect(view.field('connect').textContent).toBe(view.messages.remoteDone) })
  expect(view.field('close').hidden).toBe(true)
  expect(view.field('password').disabled).toBe(true)
  view.submit()
  expect(view.bridge.close).toHaveBeenCalledOnce()
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

it('keeps the address, token, and SSH fields collapsed under Other ways to connect', async () => {
  const view = await render()
  const details = view.document.querySelector<HTMLDetailsElement>('#other-ways')!
  expect(details.open).toBe(false)
  expect(details.querySelector('summary')!.textContent).toBe(view.messages.remoteOtherWays)
  for (const id of ['address', 'token', 'remember', 'ssh-host']) {
    expect(details.contains(view.field(id)), id).toBe(true)
  }
})

it('hides the footer while the machine list shows, and shows it enabled once Other ways opens', async () => {
  const view = await render()
  expect(view.field('connect').hidden).toBe(true)
  expect(view.field('connect').disabled).toBe(true)
  const details = view.document.querySelector<HTMLDetailsElement>('#other-ways')!
  details.open = true
  await vi.waitFor(() => { expect(view.field('connect').hidden).toBe(false) })
  expect(view.field('connect').disabled).toBe(false)
  details.open = false
  await vi.waitFor(() => { expect(view.field('connect').hidden).toBe(true) })
  expect(view.field('connect').disabled).toBe(true)
})

it('hides the machine list while Other ways is open and shows it again once the section collapses', async () => {
  const view = await render()
  const machines = view.document.querySelector<HTMLElement>('#machines')!
  expect(machines.contains(view.document.querySelector('#discover-status'))).toBe(true)
  expect(machines.hidden).toBe(false)
  const details = view.document.querySelector<HTMLDetailsElement>('#other-ways')!
  details.open = true
  await vi.waitFor(() => { expect(machines.hidden).toBe(true) })
  expect(view.field('connect').disabled).toBe(false)
  details.open = false
  await vi.waitFor(() => { expect(machines.hidden).toBe(false) })
})

it('returns from the password prompt to a hidden list while Other ways is open', async () => {
  const view = await render({ machines: [], discover: { tailscale: [{ address: 'https://air.tail71ee4f.ts.net/', hostId: 'air-host', known: false }] } })
  view.document.querySelector<HTMLDetailsElement>('#other-ways')!.open = true
  click(view, 'Pair')
  expect(view.document.querySelector<HTMLElement>('#machines')!.hidden).toBe(true)
  view.document.querySelector<HTMLButtonElement>('#back')!.click()
  expect(view.document.querySelector<HTMLElement>('#other-ways')!.hidden).toBe(false)
  expect(view.document.querySelector<HTMLElement>('#machines')!.hidden).toBe(true)
  expect(view.field('connect').disabled).toBe(false)
})

it('asks for confirmation of a pairing link before sending its grant and hides the list and the other ways', async () => {
  const view = await render({ pairing: { address: 'https://ocean.example/mount/' } })
  expect(view.document.querySelector('#hint')!.textContent)
    .toBe(view.messages.remotePairHint.replace('{address}', 'https://ocean.example/mount/'))
  for (const id of ['machines', 'other-ways', 'password-field']) {
    expect(view.document.querySelector<HTMLElement>(`#${id}`)!.hidden, id).toBe(true)
  }
  expect(view.field('forget-unreadable').hidden).toBe(true)
  expect(view.document.activeElement).toBe(view.field('connect'))
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
  expect(view.field('connect').textContent).toBe(view.messages.remoteConnect)
  view.submit()
  expect(view.bridge.pair).toHaveBeenCalledTimes(2)
})

it('turns a pasted pairing link into the confirmation without sending the grant to connect', async () => {
  const view = await render()
  view.bridge.pairLink.mockResolvedValue({ kind: 'pairing', address: 'https://ocean.example/' })
  view.field('address').value = '  ocean://pair?host=https%3A%2F%2Focean.example%2F&label=Phone#grant  '
  view.submit()
  await vi.waitFor(() => { expect(view.document.querySelector<HTMLElement>('#other-ways')!.hidden).toBe(true) })
  expect(view.bridge.pairLink).toHaveBeenCalledWith('ocean://pair?host=https%3A%2F%2Focean.example%2F&label=Phone#grant')
  expect(view.field('address').value).toBe('')
  expect(view.bridge.connect).not.toHaveBeenCalled()
  expect(view.document.querySelector('#hint')!.textContent).toContain('https://ocean.example/')
  view.bridge.pair.mockResolvedValue({ kind: 'connected', persistence: 'skipped' })
  view.submit()
  await vi.waitFor(() => { expect(view.bridge.pair).toHaveBeenCalledOnce() })
})

it('reports an invalid pasted pairing link and stays in the list', async () => {
  const view = await render()
  view.bridge.pairLink.mockResolvedValue({ kind: 'failed', code: 'DESKTOP_REMOTE_PAIR_LINK_INVALID', message: view.messages.remotePairLinkInvalid })
  view.field('address').value = 'ocean://pair?host=nope'
  view.submit()
  await vi.waitFor(() => { expect(view.field('failure').hidden).toBe(false) })
  expect(view.field('failure').textContent).toBe(view.messages.remotePairLinkInvalid)
  expect(view.document.querySelector<HTMLElement>('#machines')!.hidden).toBe(false)
  expect(view.document.querySelector<HTMLElement>('#other-ways')!.hidden).toBe(false)
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

it('prepares a listed SSH machine and then asks for the usual confirmation', async () => {
  const view = await render({ machines: [], discover: { ssh: [{ host: 'bigpc', label: 'bigpc' }] } })
  const started = Promise.withResolvers<DesktopRemoteResult>()
  view.bridge.startSsh.mockReturnValue(started.promise)
  click(view, 'Set up')
  // The action is unavailable while the machine is being prepared, and says so.
  await vi.waitFor(() => { expect(view.bridge.startSsh).toHaveBeenCalledWith('bigpc') })
  const button = view.document.querySelector<HTMLButtonElement>('#machine-list button')!
  expect(button.disabled).toBe(true)
  expect(button.textContent).toBe(view.messages.remoteSshStarting)
  started.resolve({ kind: 'pairing', address: 'https://bigpc.tail71ee4f.ts.net/' })
  await vi.waitFor(() => { expect(view.field('hint').textContent).toContain('https://bigpc.tail71ee4f.ts.net/') })
  expect(view.document.querySelector<HTMLElement>('#machines')!.hidden).toBe(true)
  expect(button.disabled).toBe(false)
})

it('reports a listed machine that could not be prepared and keeps the list usable', async () => {
  const view = await render({ machines: [], discover: { ssh: [{ host: 'bigpc', label: 'bigpc' }] } })
  view.bridge.startSsh.mockResolvedValue({ kind: 'failed', code: 'DESKTOP_SSH_UNREACHABLE', message: 'Could not reach the Host securely.' })
  click(view, 'Set up')
  await vi.waitFor(() => { expect(view.field('failure').hidden).toBe(false) })
  expect(view.field('failure').textContent).toBe('Could not reach the Host securely.')
  const button = view.document.querySelector<HTMLButtonElement>('#machine-list button')!
  expect(button.disabled).toBe(false)
  expect(button.textContent).toBe(view.messages.remoteSetupAction)
})

it('prepares a machine over SSH from the field and then asks for the usual confirmation', async () => {
  const view = await render()
  const started = Promise.withResolvers<DesktopRemoteResult>()
  view.bridge.startSsh.mockReturnValue(started.promise)
  view.field('ssh-host').value = 'bigpc'
  view.document.querySelector<HTMLElement>('#ssh-start')!.click()
  // The action is unavailable while the machine is being prepared, and says so.
  await vi.waitFor(() => { expect(view.bridge.startSsh).toHaveBeenCalledWith('bigpc') })
  expect(view.field('ssh-start').disabled).toBe(true)
  expect(view.field('ssh-start').textContent).toBe(view.messages.remoteSshStarting)

  started.resolve({ kind: 'pairing', address: 'https://bigpc.tail71ee4f.ts.net/' })
  await vi.waitFor(() => { expect(view.field('hint').textContent).toContain('https://bigpc.tail71ee4f.ts.net/') })
  expect(view.document.querySelector<HTMLElement>('#other-ways')!.hidden).toBe(true)
  expect(view.field('ssh-start').disabled).toBe(false)
})

it('reports a machine that could not be prepared and keeps the form usable', async () => {
  const view = await render()
  view.bridge.startSsh.mockResolvedValue({ kind: 'failed', code: 'DESKTOP_SSH_UNREACHABLE', message: 'Could not reach the Host securely.' })
  view.field('ssh-host').value = 'bigpc'
  view.document.querySelector<HTMLElement>('#ssh-start')!.click()

  await vi.waitFor(() => { expect(view.field('failure').hidden).toBe(false) })
  expect(view.field('failure').textContent).toBe('Could not reach the Host securely.')
  expect(view.field('ssh-host').disabled).toBe(false)
  expect(view.field('ssh-start').textContent).toBe(view.messages.remoteSshStart)
})

it('asks for a machine instead of starting one when the field is empty', async () => {
  const view = await render()
  view.document.querySelector<HTMLElement>('#ssh-start')!.click()

  expect(view.bridge.startSsh).not.toHaveBeenCalled()
})

it('reports a carrier failure from the SSH action', async () => {
  const view = await render()
  view.bridge.startSsh.mockRejectedValue(new Error('channel closed'))
  view.field('ssh-host').value = 'bigpc'
  view.document.querySelector<HTMLElement>('#ssh-start')!.click()

  await vi.waitFor(() => { expect(view.field('failure').hidden).toBe(false) })
  expect(view.field('failure').textContent).toBe(view.messages.remoteSwitchFailed)
})
