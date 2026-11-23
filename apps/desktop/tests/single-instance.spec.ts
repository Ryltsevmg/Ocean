import { describe, expect, it, vi } from 'vitest'
import { claimDesktopSingleInstance, type DesktopSingleInstanceApplication } from '../src/single-instance.ts'

describe('desktop single-instance ownership', () => {
  it('quits a second process without registering lifecycle work', () => {
    const quit = vi.fn()
    const on = vi.fn()
    const application = {
      requestSingleInstanceLock: () => false,
      quit,
      on,
    } satisfies DesktopSingleInstanceApplication

    expect(claimDesktopSingleInstance(application, vi.fn())).toBe(false)
    expect(quit).toHaveBeenCalledOnce()
    expect(on).not.toHaveBeenCalled()
  })

  it('routes a later launch and its arguments to the primary process', () => {
    let secondInstance: ((event: unknown, argv: string[]) => void) | undefined
    const focus = vi.fn()
    const application = {
      requestSingleInstanceLock: () => true,
      quit: vi.fn(),
      on: vi.fn((_event: 'second-instance', listener: (event: unknown, argv: string[]) => void) => { secondInstance = listener }),
    } satisfies DesktopSingleInstanceApplication

    expect(claimDesktopSingleInstance(application, focus)).toBe(true)
    secondInstance?.({}, ['ocean', 'ocean://pair?host=https%3A%2F%2Focean.example%2F'])
    expect(focus).toHaveBeenCalledExactlyOnceWith(['ocean', 'ocean://pair?host=https%3A%2F%2Focean.example%2F'])
  })
})
