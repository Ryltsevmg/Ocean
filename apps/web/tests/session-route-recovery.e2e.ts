/** Recorded-history recovery UI; provider availability is an explicit test fixture. */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Browser } from 'playwright'
import { chromium } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import { SessionId } from '@ocean/ocean-session'
import {
  captureStableAria, compareOrRefreshGolden, launchWebScaffold, parseSeedFixture,
  renderSeedFixture, seedSession, webSnapshotMode,
} from './scaffold.ts'
import { newEnglishPage } from './support.ts'

it('requires a model choice when branching recorded credential failure history', async () => {
  const scaffold = await launchWebScaffold()
  const resources: { browser?: Browser } = {}
  onTestFinished(async () => { await resources.browser?.close(); await scaffold.close() })
  const raw = await readFile(fileURLToPath(new URL('../../../snapshots/web/seeded-history/session.v3.jsonl', import.meta.url)), 'utf8')
  const decoded = parseSeedFixture(raw)
  const turn = Math.max(...decoded.events.flatMap(event => event.type === 'turn/start' ? [event.data.turn] : [])) + 1
  const seq = decoded.events.length
  const sourceId = SessionId('recorded-route-recovery')
  const events = [
    ...decoded.events,
    { seq, time: 0, type: 'model/selection', data: { provider: 'qwen-token-plan', model: 'qwen3.8-flash' } },
    { seq: seq + 1, time: 0, type: 'turn/start', data: { turn } },
    { seq: seq + 2, time: 0, type: 'turn/end', data: { turn, reason: { kind: 'error', error: { code: 'MISSING_CREDENTIAL', message: 'Credential unavailable' } } } },
  ]
  await seedSession(scaffold, renderSeedFixture(decoded.headerLine, events), sourceId)
  resources.browser = await chromium.launch()
  const page = await newEnglishPage(resources.browser)
  await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
  await page.getByRole('treeitem').first().click()
  await page.getByRole('treeitem').nth(1).click()
  const recovery = page.getByRole('button', { name: 'Continue in a new conversation', exact: true })
  await recovery.waitFor({ state: 'visible' })
  const source = scaffold.ctx.sessions.get(sourceId)
  if (source === undefined) throw new Error('opened source is missing')
  const before = source.snapshotEvents()
  const failure = before.findLast(event => event.type === 'turn/end'
    && event.data.reason.kind === 'error' && event.data.reason.error.code === 'MISSING_CREDENTIAL')
  if (failure === undefined) throw new Error('recorded credential failure is missing')
  const inherited = before.slice(0, failure.seq + 1)
  await recovery.click()
  const dialog = page.getByRole('dialog', { name: 'Choose a model for the new conversation' })
  await dialog.getByRole('radio').first().waitFor()
  expect(await dialog.getByRole('radio').evaluateAll(nodes => nodes.some(node => (node as HTMLInputElement).checked))).toBe(false)
  expect(await dialog.getByRole('button', { name: 'Create conversation', exact: true }).isDisabled()).toBe(true)
  const expected = fileURLToPath(new URL('../../../snapshots/web/session-route-recovery/dialog.expected.md', import.meta.url))
  await compareOrRefreshGolden(expected, await captureStableAria(page, '[role="dialog"]', scaffold.workspaceCwd), webSnapshotMode())
  await dialog.getByRole('radio').first().check()
  await dialog.getByRole('button', { name: 'Create conversation', exact: true }).click()
  await dialog.waitFor({ state: 'hidden' })
  const agents = scaffold.ctx.agents.list().filter(agent => agent.id !== sourceId)
  const child = agents.find(agent => agent.session.inheritedEventCount === inherited.length)
  expect(child).toBeDefined()
  if (child === undefined) throw new Error('recovery did not create a child')
  expect(child.session.snapshotEvents().slice(0, inherited.length)).toEqual(inherited)
  expect(child.session.snapshotEvents().slice(inherited.length).map(event => event.type))
    .toEqual(['session/end-seed', 'model/selection', 'permission/preset', 'sandbox/mode', 'approval/policy'])
  expect(child.model.current()?.provider).not.toBe('qwen-token-plan')
  expect(source.snapshotEvents()).toEqual(before)
})
