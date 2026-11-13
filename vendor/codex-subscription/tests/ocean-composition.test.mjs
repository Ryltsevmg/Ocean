import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const script = String.raw`
import assert from 'node:assert/strict';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
const attempted = [];
const deny = () => { attempted.push('network'); throw new Error('offline composition: outbound network forbidden'); };
globalThis.fetch = deny;
net.Socket.prototype.connect = deny;
const root = process.env.OCEAN_SMOKE_ROOT;
const { runProfile } = await import(pathToFileURL(root + '/apps/cli/lib/profile-boot.js'));
const { createLaunchEnvironmentSnapshot } = await import(pathToFileURL(root + '/packages/util/launch-environment/lib/index.js'));
let ctx;
try {
  ({ ctx } = await runProfile({ profile: 'web', args: ['--no-open', '--port', '0'], patchFiles: [], environment: createLaunchEnvironmentSnapshot([{ source: 'process', values: { ...process.env } }]) }));
  const entries = [...ctx.loader.entries()];
  const plugin = entries.find(entry => entry.options.id === 'ocean-codex-subscription');
  assert.ok(plugin, 'bundled subscription row');
  assert.equal(plugin.fiber.state, 2, 'subscription host must activate');
  const modules = ctx.get('clientModules');
  assert.ok(modules, 'real client module registry');
  const roster = JSON.stringify(modules.graph());
  assert.ok(roster.includes('@ocean/ocean-codex-subscription'), 'subscription client in actual graph');
  const handler = ctx.get('connection').createSharedFetchHandler('/api');
  const call = async endpoint => {
    const method = 'codex-subscription/' + endpoint;
    const response = await handler.fetch(new Request('http://dsh.internal/api/' + method, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: 'offline-smoke', method, payload: {} }),
    }), { principal: { kind: 'owner' } });
    assert.equal(response.status, 200);
    return (await response.json()).result;
  };
  const status = await call('status');
  assert.equal(status.ok, true, 'real registered account status route');
  assert.equal(status.value.authenticated, false, 'clean profile stays signed out');
  const preferences = await call('preferences/status');
  assert.equal(preferences.ok, true);
  assert.equal(preferences.value.remoteControl, 'off');
  assert.equal(preferences.value.imageGeneration, false);
  assert.equal((await call('remote/enable')).error.code, 'unavailable');
  assert.equal((await call('runtime/install')).error.code, 'unavailable');
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(attempted.length, 0, 'signed-out boot/status must not attempt outbound network');
  console.log('OCEAN_COMPOSITION_ACTIVE');
} finally { if (ctx) await ctx.fiber.dispose(); }
console.log('OCEAN_COMPOSITION_DISPOSED');
`

test('real clean web profile composes bundled Ocean subscription offline', { skip: process.env.OCEAN_COMPOSITION_SMOKE !== '1', timeout: 90000 }, () => {
  const home = mkdtempSync(join(tmpdir(), 'ocean-subscription-smoke-'))
  for (const path of ['config', 'cache', 'data']) mkdirSync(join(home, path))
  try {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: home, timeout: 80000, encoding: 'utf8', maxBuffer: 200000,
      env: { PATH: process.env.PATH, HOME: home, DSH_HOME: join(home, '.ocean'), DSH_AGENTS_HOME: join(home, '.agents'), XDG_CONFIG_HOME: join(home, 'config'), XDG_CACHE_HOME: join(home, 'cache'), XDG_DATA_HOME: join(home, 'data'), DSH_TELEMETRY_DISABLED: '1', OCEAN_SMOKE_ROOT: root },
    })
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout.replace(/token=[^\s]+/gu, 'token=[redacted]')}\n${result.stderr}`)
    assert.match(result.stdout, /OCEAN_COMPOSITION_ACTIVE/u)
    assert.match(result.stdout, /OCEAN_COMPOSITION_DISPOSED/u)
  } finally { rmSync(home, { recursive: true, force: true }) }
})
