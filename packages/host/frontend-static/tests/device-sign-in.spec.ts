// @vitest-environment jsdom
/** The sign-in document spends a pairing grant for its own Host and sends none to another. */
import { runInThisContext } from 'node:vm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEVICE_PROTOCOL_HEADER, DEVICE_PROTOCOL_VERSION } from '@ocean/ocean-client-connection/protocol'
import { deviceSignIn } from '../src/device-sign-in.ts'

const grant = `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.${'B'.repeat(43)}`
const token = `${'c'.repeat(8)}-cccc-4ccc-8ccc-${'c'.repeat(12)}.${'D'.repeat(43)}`
const mount = 'https://ocean.example/mount/'
const PAIR = './connect/pair'
const ENTER = './connect'
const call = (path: string, secret: string) => ({ path, authorization: `Bearer ${secret}`, protocol: DEVICE_PROTOCOL_VERSION })

const calls: { path: string; authorization: string | null; protocol: string | null }[] = []
const replace = vi.fn()
/** Statuses the next requests answer with; an exhausted queue answers as a Host that accepts everything. */
const replies: number[] = []
const fetchMock = vi.fn(async (path: string, init: RequestInit): Promise<Response> => {
  const headers = new Headers(init.headers)
  calls.push({ path, authorization: headers.get('authorization'), protocol: headers.get(DEVICE_PROTOCOL_HEADER) })
  const status = replies.shift() ?? 204
  return path === './connect/pair' && status === 204 ? Response.json({ id: 'device', token }) : new Response(null, { status })
})

/** Let the document's requests and the continuations behind them run to completion. */
const settled = async (): Promise<void> => {
  for (let turn = 0; turn < 8; turn += 1) await new Promise<void>((resolve) => { setTimeout(resolve, 0) })
}

/** Open the sign-in document at an address, running exactly the script it embeds. */
async function open(address: string): Promise<void> {
  const html = await deviceSignIn(new Request(mount)).text()
  const script = /<script>([\s\S]*)<\/script>/u.exec(html)?.[1]
  if (script === undefined) throw new Error('the sign-in document embeds no script')
  const url = new URL(address)
  vi.stubGlobal('location', { href: url.href, hash: url.hash, pathname: url.pathname, search: url.search, origin: url.origin, replace })
  // Scripts inserted as markup never run, so the document's own script runs below, once, on purpose.
  document.body.innerHTML = /<body>([\s\S]*)<\/body>/u.exec(html)?.[1] ?? ''
  // A block keeps the script's top-level declarations from leaking between tests, as a page load would not.
  runInThisContext(`{ ${script} }`)
  await settled()
}

/** Submit the form with the text a user pasted or typed. */
async function submit(text: string): Promise<void> {
  const form = document.querySelector('form')!
  document.querySelector('input')!.setAttribute('value', text)
  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
  await settled()
}

beforeEach(() => {
  calls.length = 0
  replies.length = 0
  replace.mockClear()
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('device sign-in document', () => {
  it('pairs from the grant in its address bar, then signs in with the new token', async () => {
    const replaceState = vi.spyOn(history, 'replaceState')
    await open(`${mount}#pair=${grant}`)
    expect(replaceState).toHaveBeenCalledWith(null, '', '/mount/')
    expect(calls).toEqual([
      call(PAIR, grant),
      call(ENTER, token),
    ])
    expect(replace).toHaveBeenCalledWith('./')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', credentials: 'same-origin', redirect: 'error' })
  })

  it('leaves the form ready when the address bar carries no grant', async () => {
    await open(mount)
    expect(calls).toEqual([])
    expect(replace).not.toHaveBeenCalled()
    expect(document.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false)
    expect(document.querySelector<HTMLElement>('[role="status"]')!.hidden).toBe(true)
  })

  it('pairs from a pasted ocean://pair link for this Host', async () => {
    await open(mount)
    const link = new URL('ocean://pair')
    link.searchParams.set('host', 'https://ocean.example/mount')
    link.searchParams.set('label', 'Phone')
    link.hash = grant
    await submit(`  ${link.href}\n`)
    expect(calls).toEqual([call(PAIR, grant), call(ENTER, token)])
    expect(replace).toHaveBeenCalledWith('./')
    expect(document.querySelector<HTMLInputElement>('input')!.value).toBe('')
  })

  it('pairs from a pasted browser pairing URL', async () => {
    await open(mount)
    await submit(`${mount}#pair=${grant}`)
    expect(calls).toEqual([call(PAIR, grant), call(ENTER, token)])
  })

  it.each([
    ['an ocean://pair link', `ocean://pair?host=${encodeURIComponent('https://other.example/')}&label=Phone#${grant}`],
    ['a browser pairing URL', `https://other.example/mount/#pair=${grant}`],
    ['a link for another mount', `https://ocean.example/other/#pair=${grant}`],
  ])('sends no grant from %s that names another Host', async (_description, link) => {
    await open(mount)
    await submit(link)
    expect(calls).toEqual([])
    expect(document.querySelector<HTMLElement>('[data-foreign]')!.hidden).toBe(false)
    expect(document.querySelector<HTMLElement>('[data-failed]')!.hidden).toBe(true)
    expect(document.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false)
  })

  it('signs in with a typed device token without pairing first', async () => {
    await open(mount)
    await submit(token)
    expect(calls).toEqual([call(ENTER, token)])
    expect(replace).toHaveBeenCalledWith('./')
    expect(document.querySelector<HTMLElement>('[role="status"]')!.hidden).toBe(true)
  })

  it('offers the form again when the Host refuses the grant', async () => {
    replies.push(401)
    await open(`${mount}#pair=${grant}`)
    expect(calls).toEqual([call(PAIR, grant)])
    expect(replace).not.toHaveBeenCalled()
    expect(document.querySelector<HTMLElement>('[data-failed]')!.hidden).toBe(false)
    expect(document.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false)
  })

  it('offers the form again when the paired token is refused', async () => {
    replies.push(204, 401)
    await open(`${mount}#pair=${grant}`)
    expect(calls).toEqual([call(PAIR, grant), call(ENTER, token)])
    expect(replace).not.toHaveBeenCalled()
    expect(document.querySelector<HTMLElement>('[data-failed]')!.hidden).toBe(false)
  })

  it('treats a link without a grant as a token', async () => {
    await open(mount)
    await submit(`ocean://pair?host=${encodeURIComponent('https://ocean.example/mount/')}&label=Phone`)
    expect(calls).toEqual([call(ENTER, 'ocean://pair?host=https%3A%2F%2Focean.example%2Fmount%2F&label=Phone')])
  })
})
