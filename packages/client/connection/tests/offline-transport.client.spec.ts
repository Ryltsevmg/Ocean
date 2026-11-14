/** Browser connectivity hints apply only to carriers without an owned local Host. */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apply, type ClientTransportHooks, type ConnectionHandle } from '../src/client/index.ts'
import { FakeGenerationSource } from './fake-generation.client.ts'

const RECOVERY = { backoffBaseMs: 10, backoffFactor: 2, backoffMaxMs: 20, generationReadyTimeoutMs: 100 }

class BrowserNetwork extends EventTarget {
  readonly navigator = { onLine: false }

  setOnline(online: boolean): void {
    this.navigator.onLine = online
    this.dispatchEvent(new Event(online ? 'online' : 'offline'))
  }
}

interface FixtureOptions {
  readonly hostname: string
  readonly transport?: ClientTransportHooks
  readonly online?: boolean
  readonly holdReady?: boolean
}

async function mount(options: FixtureOptions) {
  const browser = new BrowserNetwork()
  const addedListeners = vi.spyOn(browser, 'addEventListener')
  const removedListeners = vi.spyOn(browser, 'removeEventListener')
  browser.navigator.onLine = options.online ?? false
  vi.stubGlobal('window', browser)
  vi.stubGlobal('location', { hostname: options.hostname })
  vi.stubGlobal('__DSH_TRANSPORT__', options.transport)
  const ctx = new Context()
  await ctx.plugin({ apply, inject: [] })
  const connection = ctx.get('connection') as ConnectionHandle
  const source = new FakeGenerationSource()
  source.holdReady = options.holdReady ?? false
  const open = vi.fn(source.source)
  const unregister = connection.registerGenerationSource(open)
  const reconnect = vi.fn()
  const loop = connection.start({ onReconnectRequested: reconnect }, RECOVERY)
  return {
    browser, connection, source, open, reconnect, loop,
    async dispose() {
      loop.stop()
      unregister()
      source.releaseReady()
      await vi.advanceTimersByTimeAsync(0)
      await ctx.fiber.dispose()
      expect(source.activeCount).toBe(0)
      expect(vi.getTimerCount()).toBe(0)
      expect(addedListeners).toHaveBeenCalledTimes(options.transport?.ownsHost === true ? 0 : 2)
      expect(removedListeners.mock.calls).toEqual(addedListeners.mock.calls)
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('owned local transport offline recovery', () => {
  it.each([
    { hostname: 'app', transport: { ownsHost: true, streamBaseUrl: 'http://127.0.0.1:3080' } },
    { hostname: 'preview.example', transport: { ownsHost: true } },
  ])('connects to its owned Host from $hostname while the browser starts offline', async (options) => {
    const fixture = await mount(options)
    try {
      await vi.advanceTimersByTimeAsync(0)
      expect(fixture.browser.navigator.onLine).toBe(false)
      expect(fixture.open).toHaveBeenCalledOnce()
      expect(fixture.connection.state.getSnapshot()).toBe('connected')
      expect(fixture.connection.generation.getSnapshot()).toEqual({ id: 1, host: { home: '/h' } })
      expect(fixture.reconnect).not.toHaveBeenCalled()
    } finally {
      await fixture.dispose()
    }
  })

  it('keeps its generation through network changes and retries carrier loss while offline', async () => {
    const fixture = await mount({ hostname: 'app', transport: { ownsHost: true }, online: true })
    try {
      await vi.advanceTimersByTimeAsync(0)
      const first = fixture.connection.generation.getSnapshot()
      fixture.browser.setOnline(false)
      fixture.browser.setOnline(true)
      fixture.browser.setOnline(false)
      await vi.advanceTimersByTimeAsync(0)
      expect(fixture.connection.generation.getSnapshot()).toBe(first)
      expect(fixture.open).toHaveBeenCalledOnce()
      expect(fixture.open.mock.calls[0]![0].aborted).toBe(false)

      fixture.source.holdReady = true
      fixture.source.fail(new Error('local carrier lost'))
      await vi.advanceTimersByTimeAsync(0)
      expect(fixture.connection.generation.getSnapshot()).toBeUndefined()
      expect(fixture.connection.state.getSnapshot()).toBe('connecting')
      for (const delay of [5, 10, 10]) {
        const previous = fixture.open.mock.calls.length
        await vi.advanceTimersByTimeAsync(delay - 1)
        expect(fixture.open).toHaveBeenCalledTimes(previous)
        await vi.advanceTimersByTimeAsync(1)
        expect(fixture.open).toHaveBeenCalledTimes(previous + 1)
        expect(fixture.source.activeCount).toBe(1)
        fixture.source.fail(new Error('local Host still unavailable'))
        await vi.advanceTimersByTimeAsync(0)
      }
      fixture.source.holdReady = false
      await vi.advanceTimersByTimeAsync(10)
      expect(fixture.connection.generation.getSnapshot()?.id).toBe(2)
      expect(fixture.connection.state.getSnapshot()).toBe('connected')
      expect(fixture.browser.navigator.onLine).toBe(false)
      expect(fixture.reconnect).toHaveBeenCalledTimes(4)
      expect(fixture.source.activeCount).toBe(1)
    } finally {
      await fixture.dispose()
    }
  })

  it('waits for a late Host ready item without requiring an online event', async () => {
    const fixture = await mount({ hostname: 'app', transport: { ownsHost: true }, holdReady: true })
    try {
      await vi.advanceTimersByTimeAsync(50)
      expect(fixture.open).toHaveBeenCalledOnce()
      expect(fixture.connection.generation.getSnapshot()).toBeUndefined()
      expect(fixture.connection.state.getSnapshot()).toBeUndefined()
      fixture.source.releaseReady()
      await vi.advanceTimersByTimeAsync(0)
      expect(fixture.connection.state.getSnapshot()).toBe('connected')
      expect(fixture.connection.generation.getSnapshot()?.id).toBe(1)
      expect(fixture.browser.navigator.onLine).toBe(false)
    } finally {
      await fixture.dispose()
    }
  })

  it('retries an offline readiness timeout and ignores the cancelled source ready item', async () => {
    const fixture = await mount({ hostname: 'app', transport: { ownsHost: true }, holdReady: true })
    try {
      await vi.advanceTimersByTimeAsync(100)
      expect(fixture.open).toHaveBeenCalledOnce()
      expect(fixture.open.mock.calls[0]![0].aborted).toBe(true)
      expect(fixture.source.activeCount).toBe(0)
      expect(fixture.connection.state.getSnapshot()).toBe('connecting')
      fixture.source.releaseReady()
      await vi.advanceTimersByTimeAsync(0)
      expect(fixture.connection.generation.getSnapshot()).toBeUndefined()
      await vi.advanceTimersByTimeAsync(5)
      expect(fixture.open).toHaveBeenCalledTimes(2)
      fixture.source.releaseReady()
      await vi.advanceTimersByTimeAsync(0)
      expect(fixture.connection.generation.getSnapshot()?.id).toBe(1)
      expect(fixture.connection.state.getSnapshot()).toBe('connected')

      fixture.source.end()
      await vi.advanceTimersByTimeAsync(0)
      fixture.loop.stop()
      fixture.browser.setOnline(true)
      await vi.advanceTimersByTimeAsync(1_000)
      expect(fixture.open).toHaveBeenCalledTimes(2)
      expect(fixture.connection.state.getSnapshot()).toBeUndefined()
    } finally {
      await fixture.dispose()
    }
  })
})

describe('unowned transport network restrictions', () => {
  it.each<FixtureOptions>([
    { hostname: 'remote.example' },
    { hostname: 'remote.example', transport: { ownsHost: false } },
    { hostname: 'localhost' },
    { hostname: 'app', transport: { streamBaseUrl: 'http://127.0.0.1:3080' } },
  ])('suspends automatic attempts from $hostname without an owned Host declaration: $transport', async (options) => {
    vi.stubGlobal('dshDesktop', { protocolVersion: 1 })
    const fixture = await mount(options)
    try {
      await vi.advanceTimersByTimeAsync(1_000)
      expect(fixture.open).not.toHaveBeenCalled()
      expect(fixture.connection.state.getSnapshot()).toBe('disconnected')
      fixture.browser.setOnline(true)
      await vi.advanceTimersByTimeAsync(5)
      expect(fixture.open).toHaveBeenCalledOnce()
      expect(fixture.connection.state.getSnapshot()).toBe('connected')

      fixture.browser.setOnline(false)
      await vi.advanceTimersByTimeAsync(1_000)
      expect(fixture.open).toHaveBeenCalledOnce()
      expect(fixture.connection.state.getSnapshot()).toBe('disconnected')
      fixture.connection.reconnect()
      await vi.advanceTimersByTimeAsync(0)
      expect(fixture.open).toHaveBeenCalledTimes(2)
      expect(fixture.connection.state.getSnapshot()).toBe('connected')
      fixture.source.fail(new Error('network carrier lost'))
      await vi.advanceTimersByTimeAsync(1_000)
      expect(fixture.open).toHaveBeenCalledTimes(2)
      expect(fixture.connection.state.getSnapshot()).toBe('disconnected')
    } finally {
      await fixture.dispose()
    }
  })
})
