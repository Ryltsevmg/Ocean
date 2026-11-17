// @vitest-environment jsdom
import { createSnapshotStore } from '@ocean/ocean-client-store'
/** Global panel rows and DOM focus through the production slot renderer. */
import type { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { SlotTestRuntime } from '@ocean/ocean-client-test-runtime'
import { LocaleRuntime } from '@ocean/ocean-client-locale/client'
import { en as commonEn } from '@ocean/ocean-client-locale/src/locales/en.ts'
import { zh as commonZh } from '@ocean/ocean-client-locale/src/locales/zh.ts'
import { IconGlobeOutlineRegular } from '@ocean/ocean-client-ui-primitives'
import type { ILayout, MainPanelId } from '@ocean/ocean-client-ui-layout/client'
import type { PropsRenderSlots, PropsRuntime, SlotLabel } from '@ocean/ocean-client-ui-slots'
import type { TrackProductEvent } from '@ocean/ocean-client-product-analytics/client'
import { apply, inject } from '../src/client/index.ts'

declare module '@ocean/ocean-client-ui-slots' {
  interface LocaleNamespaceMap {
    'sidebar-panel-test': 'alpha'
  }
}

const ALPHA = 'sidebar-test-alpha' as MainPanelId
const BETA = 'sidebar-test-beta' as MainPanelId
const PLUGINS = 'plugins' as MainPanelId
const SCHEDULES = 'schedules' as MainPanelId
const runtimes = new Set<SlotTestRuntime>()

afterEach(async () => {
  try {
    for (const runtime of runtimes) await runtime.dispose()
  } finally {
    runtimes.clear()
    cleanup()
    localStorage.clear()
  }
})

async function bench(collapsed = false, track?: TrackProductEvent) {
  const runtime = await SlotTestRuntime.create()
  runtimes.add(runtime)
  const locale = new LocaleRuntime(runtime.ctx)
  locale.setLocale('en')
  const layout = {
    panelInfo: runtime.panelInfo,
    beginNavigation: vi.fn(() => new AbortController().signal),
    toggleSidebar: vi.fn(),
    selectPanel: vi.fn((activePanelId: MainPanelId | null) => { runtime.panelInfo.set({ activePanelId }) }),
    openRightbar: vi.fn(),
    closeRightbar: vi.fn(),
  } satisfies ILayout
  await runtime.mount({
    inject: ['slots'],
    apply(ctx: Context) {
      ctx.provide('shortcuts', { catalog: createSnapshotStore([]) } as never)
      ctx.provide('layout', layout)
      ctx.provide('uiWorkspace', { startSession: vi.fn() } as never)
      ctx.provide('locale', locale)
      if (track !== undefined) ctx.provide('productAnalytics', { track } as never)
      ctx.effect(() => locale.register('common', { zh: commonZh, en: commonEn }), 'panel test: common locale')
      ctx.effect(() => locale.register('sidebar-panel-test', {
        zh: { alpha: '甲面板' }, en: { alpha: 'Alpha panel' },
      }), 'panel test: panel locale')
      ctx.slots.installLocale(locale)
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'conversation' }, () => (
        <p>Conversation content</p>
      )))
    },
  })
  const closeSettings = vi.fn()
  function Frame({ usePanelInfo, renderSlot }: PropsRuntime<'root'> & PropsRenderSlots<'sidebar' | 'main' | 'settings.navigation'>) {
    const activePanelId = usePanelInfo(info => info.activePanelId)
    return (
      <>
        <aside>{renderSlot('sidebar', { collapsed, width: collapsed ? 56 : 300, drawer: false })}</aside>
        <div data-testid="settings">{renderSlot('settings.navigation', { close: closeSettings })}</div>
        <main>{renderSlot('main', {}, { entryKey: activePanelId ?? 'conversation' })}</main>
      </>
    )
  }
  await runtime.root.declare({
    sidebar: { kind: 'single', scope: 'root' },
    'settings.navigation': { kind: 'list', scope: 'root' },
    main: { kind: 'keyed', scope: 'root' },
  }, Frame)
  const sidebar = await runtime.mount({ inject: [...inject], apply })
  const view = runtime.renderRoot()
  return { runtime, locale, layout, sidebar, view, closeSettings }
}

interface TestPanel {
  id: MainPanelId
  heading: string
  order?: number
  label?: SlotLabel
}

async function mountPanel(runtime: SlotTestRuntime, { heading, ...metadata }: TestPanel) {
  function Icon({ size, active }: PropsRuntime<'sidebar.panellist'>) {
    return (
      <span data-testid={`${metadata.id}-icon`} data-active={active}>
        <IconGlobeOutlineRegular size={size} />
      </span>
    )
  }
  function Body() {
    return (
      <section>
        <h1>{heading}</h1>
        <input aria-label={`${heading} input`} />
        <button type="button">{heading} action</button>
      </section>
    )
  }
  return runtime.mount({
    inject: ['slots'],
    apply(ctx: Context) {
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: metadata.id }, Body))
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', ...metadata }, Icon))
    },
  })
}

async function mountPanels(runtime: SlotTestRuntime, locale: LocaleRuntime, betaOrder = 10) {
  const t = locale.bind('sidebar-panel-test')
  const alpha = await mountPanel(runtime, { id: ALPHA, heading: 'Alpha content', label: () => t('alpha'), order: 20 })
  const beta = await mountPanel(runtime, { id: BETA, heading: 'Beta content', label: 'Beta panel', order: betaOrder })
  return { alpha, beta }
}

describe('sidebar global panels', () => {
  it('adds late registrations, removes each plugin contribution, and leaves no empty panel-list DOM', async () => {
    const { runtime, locale, view } = await bench()
    expect(runtime.slots.entries('sidebar.panellist')).toEqual([])
    expect(within(view.container.querySelector('aside')!).queryByRole('navigation')).toBeNull()
    expect(view.container.querySelector('[data-slot="sidebar.panellist"]')).toBeNull()
    expect(view.getByText('Conversation content')).toBeTruthy()

    const { alpha, beta } = await mountPanels(runtime, locale)
    const navigation = await within(view.container.querySelector('aside')!).findByRole('navigation', { name: 'Tools' })
    expect(within(navigation).getAllByRole('button')).toHaveLength(2)
    fireEvent.click(within(navigation).getByRole('button', { name: 'Alpha panel' }))
    expect(view.getByRole('heading', { name: 'Alpha content' })).toBeTruthy()

    await alpha.dispose()
    await waitFor(() => {
      expect(within(view.container.querySelector('aside')!).queryByRole('button', { name: 'Alpha panel' })).toBeNull()
      expect(view.queryByRole('heading', { name: 'Alpha content' })).toBeNull()
    })
    expect(runtime.slots.entries('main').map(entry => entry.options.key)).toEqual(['conversation', BETA])
    fireEvent.click(within(navigation).getByRole('button', { name: 'Beta panel' }))
    expect(view.getByRole('heading', { name: 'Beta content' })).toBeTruthy()

    await beta.dispose()
    await waitFor(() => { expect(within(view.container.querySelector('aside')!).queryByRole('navigation')).toBeNull() })
    expect(view.queryByRole('heading', { name: 'Beta content' })).toBeNull()
    expect(view.container.querySelector('[data-slot="sidebar.panellist"]')).toBeNull()
    expect(runtime.slots.entries('sidebar.panellist')).toEqual([])
    expect(runtime.slots.entries('main').map(entry => entry.options.key)).toEqual(['conversation'])
  })

  it.each([false, true])('renders ordered rows, icon sizes, and tooltip labels with collapsed=%s', async (collapsed) => {
    const { runtime, locale, view } = await bench(collapsed)
    await mountPanels(runtime, locale)
    const navigation = await within(view.container.querySelector('aside')!).findByRole('navigation', { name: 'Tools' })
    const rows = within(navigation).getAllByRole('button')
    expect(rows.map(row => row.getAttribute('aria-label'))).toEqual(['Beta panel', 'Alpha panel'])
    for (const [id, label] of [[BETA, 'Beta panel'], [ALPHA, 'Alpha panel']] as const) {
      const row = within(navigation).getByRole('button', { name: label })
      expect(row.getAttribute('aria-current')).toBeNull()
      expect(row.textContent).toBe(collapsed ? '' : label)
      expect(row.querySelectorAll('svg')).toHaveLength(1)
      const icon = within(row).getByTestId(`${id}-icon`)
      expect(icon.getAttribute('data-active')).toBe('false')
      expect(icon.querySelector('svg')?.getAttribute('width')).toBe(collapsed ? '18' : '16')
      expect(icon.querySelector('svg')?.getAttribute('height')).toBe(collapsed ? '18' : '16')
      act(() => { row.focus() })
      expect(document.activeElement).toBe(row)
      if (collapsed) expect(view.getByRole('tooltip').textContent).toBe(label)
      else expect(view.queryByRole('tooltip')).toBeNull()
      act(() => { row.blur() })
      expect(document.activeElement).not.toBe(row)
      expect(view.queryByRole('tooltip')).toBeNull()
    }
  })

  it('keeps registration order when panel rows have equal order', async () => {
    const { runtime, locale, view } = await bench()
    await mountPanels(runtime, locale, 20)
    const navigation = await within(view.container.querySelector('aside')!).findByRole('navigation', { name: 'Tools' })
    expect(within(navigation).getAllByRole('button').map(row => row.textContent)).toEqual(['Alpha panel', 'Beta panel'])
  })

  it('selects registered main content and keeps a repeated selection active', async () => {
    const { runtime, locale, layout, view, closeSettings } = await bench()
    await mountPanels(runtime, locale)
    expect(within(view.container.querySelector('aside')!).getByRole('button', { name: 'Alpha panel' })).toBeTruthy()
    const navigation = await within(view.container.querySelector('aside')!).findByRole('navigation', { name: 'Tools' })
    const alpha = within(navigation).getByRole('button', { name: 'Alpha panel' })
    const beta = within(navigation).getByRole('button', { name: 'Beta panel' })
    fireEvent.click(alpha)
    expect(layout.selectPanel).toHaveBeenLastCalledWith(ALPHA)
    expect(closeSettings).not.toHaveBeenCalled()
    expect(runtime.panelInfo.getSnapshot()).toEqual({ activePanelId: ALPHA })
    expect(alpha.getAttribute('aria-current')).toBe('page')
    expect(beta.getAttribute('aria-current')).toBeNull()
    expect(within(alpha).getByTestId(`${ALPHA}-icon`).getAttribute('data-active')).toBe('true')
    expect(view.getByRole('heading', { name: 'Alpha content' })).toBeTruthy()
    expect(view.queryByRole('heading', { name: 'Beta content' })).toBeNull()

    fireEvent.click(alpha)
    expect(layout.selectPanel).toHaveBeenLastCalledWith(ALPHA)
    expect(alpha.getAttribute('aria-current')).toBe('page')
    expect(view.getByRole('heading', { name: 'Alpha content' })).toBeTruthy()

    fireEvent.click(beta)
    expect(layout.selectPanel).toHaveBeenLastCalledWith(BETA)
    expect(runtime.panelInfo.getSnapshot()).toEqual({ activePanelId: BETA })
    expect(alpha.getAttribute('aria-current')).toBeNull()
    expect(beta.getAttribute('aria-current')).toBe('page')
    expect(within(alpha).getByTestId(`${ALPHA}-icon`).getAttribute('data-active')).toBe('false')
    expect(within(beta).getByTestId(`${BETA}-icon`).getAttribute('data-active')).toBe('true')
    expect(view.queryByRole('heading', { name: 'Alpha content' })).toBeNull()
    expect(view.getByRole('heading', { name: 'Beta content' })).toBeTruthy()
  })

  it('refreshes locale labels without re-registering icons or changing plain labels', async () => {
    const { runtime, locale, view } = await bench()
    await mountPanels(runtime, locale)
    const navigation = await within(view.container.querySelector('aside')!).findByRole('navigation', { name: 'Tools' })
    const entries = runtime.slots.entries('sidebar.panellist')
    act(() => { locale.setLocale('zh') })
    await waitFor(() => {
      expect(within(navigation).getByRole('button', { name: '甲面板' }).textContent).toBe('甲面板')
    })
    expect(within(navigation).getByRole('button', { name: 'Beta panel' }).textContent).toBe('Beta panel')
    expect(runtime.slots.entries('sidebar.panellist')).toBe(entries)
  })

  it('uses an omitted label and order as the panel id and order zero', async () => {
    const { runtime, view } = await bench()
    await mountPanel(runtime, { id: ALPHA, heading: 'Alpha content', label: 'Alpha panel', order: 20 })
    await mountPanel(runtime, { id: BETA, heading: 'Beta content' })
    const navigation = await within(view.container.querySelector('aside')!).findByRole('navigation', { name: 'Tools' })
    expect(within(navigation).getAllByRole('button').map(row => row.textContent)).toEqual([BETA, 'Alpha panel'])
    fireEvent.click(within(navigation).getByRole('button', { name: BETA }))
    expect(view.getByRole('heading', { name: 'Beta content' })).toBeTruthy()
  })

  it.each([false, true])('keeps main selection while DOM focus moves between controls with collapsed=%s', async (collapsed) => {
    const { runtime, locale, layout, view } = await bench(collapsed)
    await mountPanels(runtime, locale)
    const navigation = await within(view.container.querySelector('aside')!).findByRole('navigation', { name: 'Tools' })
    const alpha = within(navigation).getByRole('button', { name: 'Alpha panel' })
    const beta = within(navigation).getByRole('button', { name: 'Beta panel' })
    act(() => { alpha.focus() })
    expect(document.activeElement).toBe(alpha)
    expect(runtime.panelInfo.getSnapshot()).toEqual({ activePanelId: null })
    expect(alpha.getAttribute('aria-current')).toBeNull()
    expect(layout.selectPanel).not.toHaveBeenCalled()
    fireEvent.click(alpha)
    const selected = runtime.panelInfo.getSnapshot()
    const textbox = view.getByRole('textbox', { name: 'Alpha content input' })
    const action = view.getByRole('button', { name: 'Alpha content action' })
    for (const target of [textbox, action, beta, alpha]) {
      act(() => { target.focus() })
      expect(document.activeElement).toBe(target)
      expect(runtime.panelInfo.getSnapshot()).toBe(selected)
      expect(alpha.getAttribute('aria-current')).toBe('page')
      expect(beta.getAttribute('aria-current')).toBeNull()
      expect(view.getByRole('heading', { name: 'Alpha content' })).toBeTruthy()
      expect(view.queryByRole('heading', { name: 'Beta content' })).toBeNull()
    }
    expect(layout.selectPanel).toHaveBeenCalledExactlyOnceWith(ALPHA)
  })

  it('disposes the sidebar while retaining independently owned main panel bodies', async () => {
    const { runtime, locale, sidebar, view } = await bench()
    await mountPanels(runtime, locale)
    fireEvent.click(await within(view.container.querySelector('aside')!).findByRole('button', { name: 'Alpha panel' }))
    await sidebar.dispose()
    expect(within(view.container.querySelector('aside')!).queryByRole('navigation')).toBeNull()
    expect(runtime.slots.spec('sidebar.panellist')).toBeUndefined()
    expect(runtime.slots.entries('sidebar.panellist')).toEqual([])
    expect(view.getByRole('heading', { name: 'Alpha content' })).toBeTruthy()
    act(() => { locale.setLocale('zh') })
    expect(within(view.container.querySelector('aside')!).queryByRole('navigation')).toBeNull()
    await runtime.mount({ inject: [...inject], apply })
    const restored = await within(view.container.querySelector('aside')!).findByRole('button', { name: '甲面板' })
    expect(restored.getAttribute('aria-current')).toBe('page')
    const icon = within(restored).getByTestId(`${ALPHA}-icon`)
    expect(icon.getAttribute('data-active')).toBe('true')
    expect(icon.querySelector('svg')?.getAttribute('width')).toBe('16')
    expect(runtime.slots.entries('sidebar.panellist').map(entry => entry.options.id)).toEqual([BETA, ALPHA])
  })
})

describe('sidebar launcher discovery', () => {
  const PINS_KEY = 'ocean.slot.manual-order.sidebar.panellist.v1'

  it('shows every panel in the sidebar and leaves Settings without panel duplicates', async () => {
    localStorage.setItem(PINS_KEY, JSON.stringify({ unpinned: [ALPHA, BETA, PLUGINS, 'removed-plugin'] }))
    const { runtime, locale, view } = await bench()
    await mountPanels(runtime, locale)
    const navigation = await within(view.container.querySelector('aside')!).findByRole('navigation', { name: 'Tools' })
    expect(within(navigation).getAllByRole('button').map(row => row.textContent)).toEqual(['Beta panel', 'Alpha panel'])
    await mountPanel(runtime, { id: PLUGINS, heading: 'Plugins content', label: 'Plugins', order: 0 })
    await waitFor(() => {
      expect(within(navigation).getAllByRole('button').map(row => row.textContent)).toEqual(['Plugins', 'Beta panel', 'Alpha panel'])
    })
    const sidebar = within(view.container.querySelector('aside')!)
    expect(sidebar.getByRole('button', { name: 'Alpha panel' })).toBeTruthy()
    expect(runtime.slots.entries('main').map(entry => entry.options.key)).toEqual(['conversation', ALPHA, BETA, PLUGINS])
  })

  it('shows every panel when the stored list is not a string array', async () => {
    localStorage.setItem(PINS_KEY, JSON.stringify({ unpinned: [ALPHA, 1] }))
    const { runtime, locale, view } = await bench()
    await mountPanels(runtime, locale)
    const navigation = await within(view.container.querySelector('aside')!).findByRole('navigation', { name: 'Tools' })
    expect(within(navigation).getAllByRole('button').map(row => row.textContent)).toEqual(['Beta panel', 'Alpha panel'])
  })

  it('reports the Plugins and Automation rows and leaves other panel rows unreported', async () => {
    const track = vi.fn<TrackProductEvent>()
    const { runtime, locale, view, layout } = await bench(false, track)
    await mountPanels(runtime, locale)
    await mountPanel(runtime, { id: PLUGINS, heading: 'Plugins content', label: 'Plugins', order: 0 })
    await mountPanel(runtime, { id: SCHEDULES, heading: 'Automation content', label: 'Automation', order: 50 })
    const sidebar = view.container.querySelector('aside')!
    expect(within(view.getByTestId('settings')).queryByRole('button')).toBeNull()
    expect(within(sidebar).getByRole('navigation').textContent).toMatchInlineSnapshot('"AutomationPluginsBeta panelAlpha panel"')
    for (const name of ['Plugins', 'Automation', 'Alpha panel', 'Beta panel']) {
      fireEvent.click(within(sidebar).getByRole('button', { name }))
    }
    expect(track.mock.calls).toEqual([
      ['sidebar_menu_click', { menu_name: 'plugin', position: 'sidebar' }],
      ['sidebar_menu_click', { menu_name: 'cron', position: 'sidebar' }],
    ])
    expect(layout.selectPanel.mock.calls).toEqual([[PLUGINS], [SCHEDULES], [ALPHA], [BETA]])
    expect(track.mock.invocationCallOrder[0]).toBeLessThan(layout.selectPanel.mock.invocationCallOrder[0]!)
  })

})
