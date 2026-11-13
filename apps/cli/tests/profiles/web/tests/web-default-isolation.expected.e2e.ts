/** Real Web startup, mounted plugin package identities, and delivered Client graph isolation. */

import { FiberState } from '@deepseek-ai/cordis'
import type { WebBootGraph } from '@ocean/ocean-client-modules/client'
import { expect, it } from 'vitest'
import { modulePackage } from './runtime-roster.ts'
import { experimentalRuntimeReferences } from './runtime-roster-isolation.ts'
import { withDefaultWeb, webGet } from './default-web-process.ts'

const experimentalName = '@ocean/ocean-experimental-client-ui-voice-input'

it('boots default Web with the shipped Schedule rows, without experimental modules, time context, or an active built-in Browser', async (test) => {
  await withDefaultWeb(test, async ({ url, request }) => {
    const auth = await webGet(url, test.signal)
    const cookie = auth.headers['set-cookie']?.[0]?.split(';', 1)[0]
    expect(cookie).toBeDefined()
    const page = await webGet(new URL('/', url), test.signal, { cookie: cookie! })
    expect(page.status).toBe(200)
    const html = page.text
    const rawBoot = /globalThis\["__DSH_BOOT__"\] = ([\s\S]*?)<\/script>/u.exec(html)?.[1]
    expect(rawBoot, html).toBeDefined()
    const delivered = JSON.parse(rawBoot!) as WebBootGraph
    const roster = await request('roster')
    expect(roster.client).toEqual(delivered)
    expect(roster.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '@ocean/ocean-host-webserver', state: FiberState.ACTIVE }),
      expect.objectContaining({ name: '@ocean/ocean-client-modules', state: FiberState.ACTIVE }),
    ]))
    expect(roster.entries.some(entry => entry.name.endsWith('/runtime-roster-observer.js') && entry.state === FiberState.ACTIVE)).toBe(true)
    expect(roster.plugins.length).toBeGreaterThan(roster.entries.length)
    expect(roster.modules.some(url => modulePackage(url) === '@ocean/ocean')).toBe(true)
    expect(roster.client.entries.length).toBeGreaterThan(0)
    const browser = roster.entries.find(entry => entry.name === '@ocean/ocean-client-ui-sidebar-browser')
    expect(browser).toBeDefined()
    expect(browser!.state).toBeUndefined()
    expect(delivered.entries.some(entry => entry.id === '@ocean/ocean-client-ui-sidebar-browser')).toBe(false)
    // The shipped composition mounts the Host Schedule service and its task
    // page; the clock stays preset-level, so neither plane carries a row for it.
    expect(roster.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '@ocean/ocean-agent-team', state: FiberState.ACTIVE }),
      expect.objectContaining({ name: '@ocean/ocean-tool-agent-team', state: FiberState.ACTIVE }),
      expect.objectContaining({ name: '@ocean/ocean-client-ui-agent-team', state: FiberState.ACTIVE }),
      expect.objectContaining({ name: '@ocean/ocean-schedule', state: FiberState.ACTIVE }),
      expect.objectContaining({ name: '@ocean/ocean-client-ui-schedule', state: FiberState.ACTIVE }),
    ]))
    expect(delivered.entries.some(entry => entry.id === '@ocean/ocean-client-ui-schedule')).toBe(true)
    expect(roster.entries.some(entry => entry.name === '@ocean/ocean-time-context')).toBe(false)
    expect(delivered.entries.some(entry => entry.id === '@ocean/ocean-time-context')).toBe(false)
    expect(experimentalRuntimeReferences(roster)).toEqual([])

    const contaminated = await request('mount-experimental')
    expect(contaminated.entries.some(entry => entry.name === experimentalName)).toBe(false)
    const mounted = contaminated.plugins.filter(plugin => plugin.modules.some(url => modulePackage(url) === experimentalName))
    expect(mounted).toEqual([expect.objectContaining({ state: FiberState.ACTIVE })])
    expect(experimentalRuntimeReferences(contaminated)).toEqual(expect.arrayContaining([
      expect.stringContaining('/packages/experimental/client-ui-voice-input/'),
    ]))
  })
})
