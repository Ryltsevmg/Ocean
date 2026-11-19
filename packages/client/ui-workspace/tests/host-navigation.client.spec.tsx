// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { allowAllAccess, contextMenuHook, makeTranslate } from '@ocean/ocean-client-test-runtime'
import { HostNavigation } from '../src/client/HostNavigation.tsx'
import type { HostNavigationProps, HostSelection } from '../src/client/hosts.ts'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)
const neverHook = (() => { throw new Error('Host navigation does not read unrelated hooks') }) as never
const selection: HostSelection = {
  revision: 2, publicationRevision: 3, label: 'Hosts', selected: 'local',
  entries: [
    { id: 'local', label: 'Local', pendingApprovals: 0, pendingQuestions: 0 },
    { id: 'remote', label: 'Remote', pendingApprovals: 2, pendingQuestions: 3,
      sessions: [{ id: 'session-1', title: 'Waiting session' }] },
    { id: 'loading', label: 'Connecting' },
  ],
}
/** Mount the control over one Host snapshot; `view.selection: undefined` is the pre-load browser state. */
function mount(wide: boolean, error?: 'load' | 'select' | 'publish',
  view: { selection: HostSelection | undefined; address?: string } = { selection }) {
  const select = vi.fn()
  const retry = vi.fn()
  const props: HostNavigationProps = {
    wide, useHosts: selector => selector({ selection: view.selection, address: view.address, busy: false, error }), select, retry,
    useContextMenu: contextMenuHook(), useSessions: neverHook, useSessionStatus: neverHook,
    useSessionRetainInfo: neverHook, usePanelInfo: neverHook, useResource: neverHook,
    useWorkspaces: neverHook, ...allowAllAccess, t: makeTranslate(en),
  }
  render(<HostNavigation {...props} />)
  return { select, retry }
}

describe('Host navigation control', () => {
  it.each([true, false])('shows all Host attention and opens a remote session with wide=%s', (wide) => {
    const { select } = mount(wide)
    const trigger = screen.getByRole('button', { name: 'Local. Hosts: Waiting: 2 approvals, 3 questions' })
    expect(trigger.textContent).toContain('5')
    fireEvent.click(trigger)
    expect(screen.getByText('Waiting: 2 approvals, 3 questions')).toBeTruthy()
    expect(screen.getByText('Syncing pending requests…')).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Waiting session Remote' }))
    expect(select).toHaveBeenCalledWith('remote', 'session-1')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('offers a visible retry when Host selection fails', () => {
    const { retry } = mount(true, 'select')
    fireEvent.click(screen.getByRole('button', { name: 'Could not switch hosts. Retry' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('describes the current Host and navigates to another Host when nothing waits', () => {
    const calm: HostSelection = {
      revision: 1, publicationRevision: 0, label: 'Hosts', selected: 'local',
      entries: [
        { id: 'local', label: 'Local', pendingApprovals: 0, pendingQuestions: 0 },
        { id: 'remote', label: 'Remote', pendingApprovals: 0, pendingQuestions: 0 },
      ],
    }
    const { select } = mount(true, undefined, { selection: calm })
    const trigger = screen.getByRole('button', { name: 'Local. Waiting: 0 approvals, 0 questions' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remote. Waiting: 0 approvals, 0 questions' }))
    expect(select).toHaveBeenCalledExactlyOnceWith('remote', undefined)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes the Host menu without navigating when it is dismissed', () => {
    const { select } = mount(true)
    fireEvent.click(screen.getByRole('button', { name: 'Local. Hosts: Waiting: 2 approvals, 3 questions' }))
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(select).not.toHaveBeenCalled()
  })

  it('offers the browser address as the only Host before a selection loads', () => {
    const { select } = mount(true, undefined, { selection: undefined, address: 'https://host.example/' })
    const trigger = screen.getByRole('button', { name: 'https://host.example/' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'https://host.example/' }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(select).not.toHaveBeenCalled()
  })

  it('falls back to the local Host label without a selection or a browser address', () => {
    const { select } = mount(true, undefined, { selection: undefined })
    fireEvent.click(screen.getByRole('button', { name: 'Local host' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Local host' }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(select).not.toHaveBeenCalled()
  })

  it('offers a compact retry on the collapsed rail', () => {
    const { retry } = mount(false, 'publish')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
