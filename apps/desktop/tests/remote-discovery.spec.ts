/** Machine discovery reads OpenSSH files and Tailscale peers, and asks each peer which Host it runs. */
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, onTestFinished, vi } from 'vitest'
import { DeviceClientError, type HostEpoch, type HostId, type HostIdentity } from '@ocean/ocean-client-connection/device'
import {
  discoverHosts, parseKnownHosts, parseSshConfig, parseTailscaleStatus, readSshTargets, readTailscalePeers, type DiscoveryRun,
} from '../src/remote-discovery.ts'
import { SERVE_PORT_CANDIDATES } from '../src/remote-ssh.ts'

const identity = (id: string): HostIdentity => ({ id: id as HostId, epoch: 'launch' as HostEpoch })

async function homeWithSsh(files: Record<string, string>): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'ocean-discovery-'))
  onTestFinished(() => { void rm(home, { recursive: true, force: true }) })
  await mkdir(join(home, '.ssh'))
  for (const [name, text] of Object.entries(files)) await writeFile(join(home, '.ssh', name), text)
  return home
}

it('reads Host aliases with their HostName and skips patterns, Match blocks, and Include', () => {
  const config = [
    '# Ocean fixtures',
    'Host *',
    '  ServerAliveInterval 30',
    'Include ~/.ssh/work.conf',
    'Host bigpc bigpc-ssh',
    '  HostName bigpc.tail71ee4f.ts.net',
    '  User ocean',
    'Host *.corp.example.com',
    '  HostName wildcard.internal',
    'Host dev',
    '    hostname = dev.internal',
    'Match host foo',
    '  HostName ignored.internal',
    'Host=equals',
    'HostName=equals.internal',
    '',
  ].join('\n')
  expect(parseSshConfig(config)).toEqual([
    { host: 'bigpc', hostName: 'bigpc.tail71ee4f.ts.net' },
    { host: 'bigpc-ssh', hostName: 'bigpc.tail71ee4f.ts.net' },
    { host: 'dev', hostName: 'dev.internal' },
    { host: 'equals', hostName: 'equals.internal' },
  ])
})

it('reads known_hosts names, dropping hashes, markers, patterns, and ports', () => {
  const known = [
    '|1|Y1V5cGFwaW5nLnRlc3Q=|hXGwM3sQYwqXyY= ssh-ed25519 AAAAC3NzaC1lZDI1NTE5',
    '[bigpc.tail71ee4f.ts.net]:2222 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5',
    'github.com,140.82.121.4 ssh-rsa AAAAB3NzaC1yc2E',
    '*.example.com ssh-rsa AAAAB3NzaC1yc2E',
    '@cert-authority *.corp.example.com ssh-rsa AAAAB3NzaC1yc2E',
    '# a comment',
    '',
    'plain.example ssh-rsa AAAAB3NzaC1yc2E',
  ].join('\n')
  expect(parseKnownHosts(known)).toEqual(['bigpc.tail71ee4f.ts.net', 'github.com', 'plain.example'])
})

it('lists only the online peers of a Tailscale status, without this machine and without the trailing dot', () => {
  const status = JSON.stringify({
    Version: '1.80.0', BackendState: 'Running',
    Self: { ID: 'nSelfAAA', HostName: 'macbook-air', DNSName: 'macbook-air.tail71ee4f.ts.net.', Online: true },
    Peer: {
      nSelfAAA: { ID: 'nSelfAAA', DNSName: 'macbook-air.tail71ee4f.ts.net.', Online: true },
      nBigpcBBB: { ID: 'nBigpcBBB', DNSName: 'bigpc.tail71ee4f.ts.net.', Online: true },
      nOfflineCC: { ID: 'nOfflineCC', DNSName: 'old.tail71ee4f.ts.net.', Online: false },
      nStringDDD: { ID: 'nStringDDD', DNSName: 'odd.tail71ee4f.ts.net.', Online: 'true' },
      nTagEEE: { ID: 'nTagEEE', DNSName: '', Online: true },
    },
  })
  expect(parseTailscaleStatus(status)).toEqual([{ name: 'bigpc.tail71ee4f.ts.net' }])
  expect(parseTailscaleStatus('tailscaled is not running')).toEqual([])
  expect(parseTailscaleStatus('[]')).toEqual([])
})

it('lists the SSH destinations of a home directory once each, and nothing without the files', async () => {
  const empty = await mkdtemp(join(tmpdir(), 'ocean-discovery-empty-'))
  onTestFinished(() => { void rm(empty, { recursive: true, force: true }) })
  expect(await readSshTargets(empty)).toEqual([])
  const home = await homeWithSsh({
    config: 'Host bigpc\n  HostName bigpc.tail71ee4f.ts.net\nHost dev\n',
    'known_hosts': 'bigpc.tail71ee4f.ts.net,100.101.102.103 ssh-ed25519 AAAA\n[::1]:2222 ssh-rsa AAAA\nplain.example ssh-rsa AAAA\n',
  })
  expect(await readSshTargets(home)).toEqual([
    { host: 'bigpc', label: 'bigpc', hostName: 'bigpc.tail71ee4f.ts.net' },
    { host: 'dev', label: 'dev', hostName: 'dev' },
    { host: 'plain.example', label: 'plain.example', hostName: 'plain.example' },
  ])
})

const status = JSON.stringify({
  Self: { ID: 'nSelf' }, Peer: { nBigpc: { DNSName: 'bigpc.tail71ee4f.ts.net.', Online: true } },
})

it('reads the peers through the Tailscale CLI on PATH', async () => {
  const run = vi.fn<DiscoveryRun>(async () => ({ status: 0, stdout: status }))
  expect(await readTailscalePeers(run, 'linux')).toEqual([{ name: 'bigpc.tail71ee4f.ts.net' }])
  expect(run.mock.calls).toEqual([['tailscale', ['status', '--json']]])
})

it('falls back to the macOS app bundle when the CLI on PATH is missing, and reports an unresponsive Tailscale', async () => {
  const run = vi.fn<DiscoveryRun>(async command => command === 'tailscale'
    ? { status: null, stdout: '' }
    : { status: 0, stdout: status })
  expect(await readTailscalePeers(run, 'darwin')).toEqual([{ name: 'bigpc.tail71ee4f.ts.net' }])
  expect(run.mock.calls.map(([command]) => command)).toEqual(['tailscale', '/Applications/Tailscale.app/Contents/MacOS/Tailscale'])
  expect(await readTailscalePeers(vi.fn<DiscoveryRun>(async () => ({ status: 1, stdout: '' })), 'darwin'))
    .toEqual({ kind: 'unavailable' })
  expect(await readTailscalePeers(vi.fn<DiscoveryRun>(async () => { throw new Error('spawn tailscale ENOENT') }), 'linux'))
    .toEqual({ kind: 'unavailable' })
})

it('takes the first candidate port that answers as a Host, in parallel across peers', async () => {
  const probed: string[] = []
  const probe = vi.fn(async (route: string) => {
    probed.push(route)
    const url = new URL(route)
    if (url.hostname === 'bigpc.tail71ee4f.ts.net' && url.port === String(SERVE_PORT_CANDIDATES[2])) return identity('host-bigpc')
    if (url.hostname === 'air.tail71ee4f.ts.net' && url.port === '') return identity('host-air')
    throw new DeviceClientError('DEVICE_CONNECTION_FAILED', 'refused')
  })
  const peers = [{ name: 'bigpc.tail71ee4f.ts.net' }, { name: 'air.tail71ee4f.ts.net' }, { name: 'silent.tail71ee4f.ts.net' }]
  expect(await discoverHosts({ peers, ports: SERVE_PORT_CANDIDATES, probe })).toEqual([
    { address: 'https://bigpc.tail71ee4f.ts.net:9443/', hostId: 'host-bigpc' },
    { address: 'https://air.tail71ee4f.ts.net/', hostId: 'host-air' },
  ])
  // Every peer is asked on the first port before any peer is asked on its second.
  expect(probed.slice(0, 3).map(route => new URL(route).port)).toEqual(['', '', ''])
  expect(probed.filter(route => route.includes('silent.tail71ee4f.ts.net'))).toHaveLength(SERVE_PORT_CANDIDATES.length)
})

it('stops asking when the discovery is cancelled', async () => {
  const controller = new AbortController()
  const probe = vi.fn(async (_route: string, signal: AbortSignal) => {
    controller.abort()
    signal.throwIfAborted()
    return identity('never')
  })
  expect(await discoverHosts({ peers: [{ name: 'bigpc.tail71ee4f.ts.net' }], ports: SERVE_PORT_CANDIDATES, probe, signal: controller.signal })).toEqual([])
  expect(probe).toHaveBeenCalledOnce()
})
