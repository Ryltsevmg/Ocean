/** The shipped connection document keeps failures and partial success visible. */
import { readFile } from 'node:fs/promises'
import { Script } from 'node:vm'
import { JSDOM } from 'jsdom'
import { expect, it, onTestFinished, vi } from 'vitest'
import { resolveDesktopLocale } from '../src/locale.ts'
import type { DesktopRemoteResult } from '../src/remote-result.ts'

async function render() {
  const html = await readFile(new URL('../renderer/remote-connection.html', import.meta.url), 'utf8')
  const source = await readFile(new URL('../renderer/remote-connection.js', import.meta.url), 'utf8')
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'dsh-app://shell/remote-connection.html' })
  onTestFinished(() => { dom.window.close() })
  const messages = resolveDesktopLocale('en-US').messages
  const bridge = {
    load: async () => ({ addresses: ['https://saved.example/'], address: 'https://saved.example/', canSave: true, unreadable: false,
      messages: { address: messages.remoteAddress, token: messages.remoteToken, remember: messages.remoteRemember,
        connect: messages.remoteConnect, forget: messages.remoteForget, failure: messages.remoteSwitchFailed,
        done: messages.remoteDone, connecting: messages.remoteConnecting } }),
    connect: vi.fn<() => Promise<DesktopRemoteResult>>(),
    forget: vi.fn<() => Promise<DesktopRemoteResult>>(),
    close: vi.fn<() => Promise<void>>().mockResolvedValue(),
  }
  Object.assign(dom.window, { oceanRemoteForm: bridge, URL })
  await new Script(`(async () => {${source}\n})()`).runInContext(dom.getInternalVMContext())
  const document = dom.window.document
  const field = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)!
  const submit = () => document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }))
  return { bridge, messages, document, field, submit }
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
