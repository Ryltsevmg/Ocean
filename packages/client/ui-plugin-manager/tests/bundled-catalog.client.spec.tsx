// @vitest-environment jsdom
/** The shipped Web roster opens the catalog through one Plugins launcher and releases it on unload. */
import { createClientTest, webApp } from '@ocean/ocean-client-test-runtime/src/assembly/index.ts'
import { usePinnedBrowserLanguages } from '@ocean/ocean-client-test-runtime'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { expect } from 'vitest'

usePinnedBrowserLanguages('en-US')
const it = createClientTest({ roster: webApp }, { mount: true })

it('ships a catalog without an overlay and removes its tab on unload', async ({ start, mock }) => {
  mock.unary('pluginManager/listBundles', { ok: true, value: [] })
  mock.unary('pluginManager/listPlugins', { ok: true, value: [] })
  mock.unary('pluginManager/listPublishedCatalog', { ok: true, value: { status: 'ready', plugins: [] } })
  mock.unary('pluginInventory/list', { ok: true, value: { entries: [], managementAvailable: true } })
  const client = await start()
  expect(screen.getAllByRole('button', { name: 'Plugins' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Plugins' }))
  await waitFor(() => { expect(screen.getByRole('heading', { name: 'Plugin catalogue' })).toBeTruthy() })
  expect(screen.getAllByRole('tab').map(tab => [tab.textContent, tab.getAttribute('aria-selected')]))
    .toMatchInlineSnapshot(`
      [
        [
          "Catalogue",
          "true",
        ],
        [
          "Installed",
          "false",
        ],
      ]
    `)
  expect(screen.getByRole('button', { name: 'Choose how to add a plugin' })).toBeTruthy()
  await act(async () => { await client.reload('@ocean/ocean-plugin-market') })
  expect(screen.getAllByRole('tab', { name: 'Catalogue' })).toHaveLength(1)
  await act(async () => { await client.unload('@ocean/ocean-plugin-market') })
  expect(screen.queryByRole('tab', { name: 'Catalogue' })).toBeNull()
  expect(client.ctx.slots.entries('plugins.tab')).toHaveLength(0)
}, 60_000)
