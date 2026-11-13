/** Opt-in real Linux AT-SPI + built Web consent pilot, scoped to its own GTK window. */
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ToolCallId } from '@ocean/ocean-llm'
import type {} from '@ocean/ocean-user-approval'
import type {} from '@ocean/ocean-agent-preset-registry'
import type {} from '@ocean/ocean-cua'
import { chromium, type Browser } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import { launchWebScaffold, type WebScaffold } from './scaffold.ts'
import { connectFreshWorkspace, newEnglishPage, openSettings } from './support.ts'

const sessionId = process.env.OCEAN_CUA_LINUX_PILOT_SESSION
const enabled = process.platform === 'linux' && sessionId !== undefined
const gtkProgram = `import gi, sys
from pathlib import Path
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib
GLib.set_prgname('ocean-cua-consent-fixture')
root = Path(sys.argv[1])
window = Gtk.Window(title='Ocean isolated consent fixture')
box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
window.add(box)
label = Gtk.Label(label='fixture count 0')
button = Gtk.Button(label='Increment isolated fixture')
box.add(label)
box.add(button)
count = 0
def clicked(*_):
    global count
    count += 1
    label.set_text('fixture count ' + str(count))
    (root / 'count').write_text(str(count))
button.connect('clicked', clicked)
window.connect('destroy', Gtk.main_quit)
window.show_all()
(root / 'count').write_text('0')
(root / 'ready').write_text('ready')
GLib.timeout_add_seconds(170, lambda: (Gtk.main_quit(), False)[1])
Gtk.main()
`

it.skipIf(!enabled)('denies, allows and revokes only its own real GTK application through Web UI', async () => {
  expect(sessionId).toMatch(/^[A-Za-z0-9_-]{1,64}$/)
  const root = await mkdtemp(join(tmpdir(), 'ocean-cua-consent-'))
  const resources: { gtk?: ChildProcess; browser?: Browser; scaffold?: WebScaffold } = {}
  onTestFinished(async () => {
    try { await resources.browser?.close() } finally {
      try { await resources.scaffold?.close() } finally {
        const child = resources.gtk
        if (child && child.exitCode === null && child.signalCode === null) {
          await new Promise<void>((resolve) => { child.once('exit', () => { resolve() }); child.kill('SIGTERM') })
        }
        await rm(root, { recursive: true, force: true })
      }
    }
  })
  const script = join(root, 'fixture.py')
  await writeFile(script, gtkProgram)
  const gtk = resources.gtk = spawn('/usr/bin/python3', ['-I', script, root], {
    stdio: 'ignore', env: { ...process.env, NO_AT_BRIDGE: '0' },
  })
  const pid = gtk.pid
  expect(pid).toBeGreaterThan(0)
  await expect.poll(async () => readFile(join(root, 'ready'), 'utf8').catch(() => ''), { timeout: 10_000 }).toBe('ready')
  const overlay = join(root, 'linux.yml')
  await writeFile(overlay, JSON.stringify([{ id: 'cua-linux', config: {
    sessionId, pythonPath: '/usr/bin/python3', agentPreset: 'ptc',
  } }]))
  const scaffold = resources.scaffold = await launchWebScaffold({
    profile: { hmr: false, packages: [{ dir: fileURLToPath(new URL('../../../packages/experimental/cua-bundle', import.meta.url)), enabled: true }] },
    extraOverlayPath: overlay,
  })
  expect(await scaffold.ctx.cuaAccess.systemStatus()).toMatchObject({ platform: 'linux', accessibility: true, sessionLocked: false })
  const browser = resources.browser = await chromium.launch({ headless: true })
  const page = await newEnglishPage(browser)
  await page.goto(scaffold.authenticatedUrl)
  await connectFreshWorkspace(page, scaffold.workspaceCwd)
  const conversationUrl = page.url()
  const agent = scaffold.ctx.agents.list()[0]!
  await scaffold.ctx.agentPresets.select(agent, 'ptc')
  // Only this disposable test agent skips generic tool approval; native app consent stays real.
  scaffold.ctx.approval.setPolicy(agent, 'never')
  const code = `const selected = await tools.cua({method:'getApp',params:{selector:${JSON.stringify(String(pid))}}});
const state = await tools.cua({method:'getState',params:{appHandle:selected.appHandle}});
const row = state.tree.split('\\n').find(line => line.includes('Increment isolated fixture'));
if (!row) throw new Error('Owned fixture button missing');
const elementId = row.match(/\\[([a-f0-9]+)\\]/)?.[1];
if (!elementId) throw new Error('Owned fixture reference missing');
const params = {appHandle:selected.appHandle,snapshotId:state.snapshotId,elementId};
const actions = await tools.cua({method:'listActions',params});
if (!actions.includes('click')) throw new Error('Fixture does not advertise click');
return await tools.cua({method:'performAction',params:{...params,action:'click'}});`
  let sequence = 0
  const execute = () => scaffold.ctx.tools.execute({ agent, signal: new AbortController().signal,
    calls: [{ type: 'tool-call', id: ToolCallId(`linux-consent-${++sequence}`), name: 'run_code',
      arguments: JSON.stringify({ code, description: 'Increment only the isolated GTK test counter' }) }] })
  const card = page.locator('[data-approval-key]')
  const denied = execute()
  await Promise.race([card.waitFor(), denied.then((result) => { throw new Error(`No consent prompt: ${JSON.stringify(result)}`) })])
  expect(await card.getByRole('button', { name: 'Always allow', exact: true }).count()).toBe(0)
  await card.getByRole('button', { name: 'Reject', exact: true }).click()
  expect((await denied).results).toMatchObject([{ result: { isError: true } }])
  expect(await readFile(join(root, 'count'), 'utf8')).toBe('0')
  expect((await scaffold.ctx.cuaAccess.applications()).blockedApps).toHaveLength(1)

  await openSettings(page, 'en')
  await page.getByRole('button', { name: 'Plugins', exact: true }).click()
  await page.getByRole('button', { name: 'View Computer use', exact: true }).click()
  const panel = page.locator('[data-cua-settings]')
  await panel.getByRole('button', { name: 'Allow asking again', exact: true }).click()
  await expect.poll(async () => (await scaffold.ctx.cuaAccess.applications()).blockedApps.length).toBe(0)
  // Restore this disposable conversation after the full-page plugin route.
  await page.goto(conversationUrl)
  const allowed = execute()
  await Promise.race([card.waitFor(), allowed.then((result) => { throw new Error(`No fresh consent prompt: ${JSON.stringify(result)}`) })])
  await card.getByRole('button', { name: 'Allow for this session', exact: true }).click()
  expect((await allowed).results).toMatchObject([{ result: { isError: false } }])
  await expect.poll(() => readFile(join(root, 'count'), 'utf8')).toBe('1')
  await openSettings(page, 'en')
  await page.getByRole('button', { name: 'Plugins', exact: true }).click()
  await page.getByRole('button', { name: 'View Computer use', exact: true }).click()
  await panel.getByText('Session-only access', { exact: true }).waitFor()
  await panel.getByRole('button', { name: 'Revoke', exact: true }).click()
  await expect.poll(async () => (await scaffold.ctx.cuaAccess.applications()).blockedApps.length).toBe(1)
  expect((await execute()).results).toMatchObject([{ result: { isError: true } }])
  expect(await readFile(join(root, 'count'), 'utf8')).toBe('1')
})
