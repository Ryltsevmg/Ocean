/** Provisioning a remote Host: what each step asks the machine, and how failures are classified. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import {
  archiveName, chooseServePort, parseSshTarget, provisionRemoteHost, releaseUrls, remoteSsh, RemoteSshError,
  servePortsInUse, type RemoteSshRun,
} from '../src/remote-ssh.ts'

const original = remoteSsh.run
let calls: { command: string; args: readonly string[] }[] = []
let scripts: string[] = []

afterEach(() => {
  remoteSsh.run = original
  calls = []
  scripts = []
})

/** Answer each invocation with the next reply; the last reply repeats. */
function script(...replies: Partial<RemoteSshRun>[]): void {
  calls = []
  scripts = []
  remoteSsh.run = async (command, args) => {
    calls.push({ command, args })
    scripts.push(args.at(-1) ?? '')
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)] ?? {}
    return { status: 0, stdout: '', stderr: '', ...reply }
  }
}

const READY = { status: 0, stdout: 'ocean serve: https://bigpc.tail71ee4f.ts.net/\n', stderr: '' }
const CAPS = { status: 0, stdout: 'Usage: ocean serve [options]\n  --tailscale-serve\n', stderr: '' }
const PAIRED = { status: 0, stdout: '{"link":"ocean://pair?host=https%3A%2F%2Fbigpc.tail71ee4f.ts.net%2F&label=desktop#g","expiresAt":"2026-11-24T00:00:00.000Z"}\n', stderr: '' }
const LINUX = { status: 0, stdout: 'Linux\nx86_64\n/usr/bin/curl\n/usr/bin/tar\n/usr/bin/sha256sum\n', stderr: '' }

it('refuses a destination OpenSSH could read as another option or command', () => {
  expect(parseSshTarget('  bigpc  ')).toBe('bigpc')
  expect(parseSshTarget('user@host.example')).toBe('user@host.example')
  for (const bad of ['', '   ', '-oProxyCommand=sh', 'host;rm -rf /', 'host name', 'a'.repeat(256)]) {
    expect(() => parseSshTarget(bad)).toThrow(RemoteSshError)
  }
  expect(() => parseSshTarget('host name')).toThrow('not a valid OpenSSH host')
})

it('names the archive and its checksum manifest for one version and architecture', () => {
  expect(archiveName('1.0.0', 'x64')).toBe('ocean-1.0.0-linux-x64-unsigned.tar.gz')
  expect(archiveName('1.0.0', 'arm64')).toBe('ocean-1.0.0-linux-arm64-unsigned.tar.gz')
  expect(releaseUrls('1.0.0', 'x64')).toEqual({
    archive: 'https://github.com/Ryltsevmg/Ocean/releases/download/v1.0.0/ocean-1.0.0-linux-x64-unsigned.tar.gz',
    sums: 'https://github.com/Ryltsevmg/Ocean/releases/download/v1.0.0/SHA256SUMS',
  })
})

it('prepares and starts a Host, reporting every step and returning the advertised address', async () => {
  script(LINUX, {}, {}, {}, CAPS, {}, {}, READY, PAIRED)
  const steps: string[] = []
  const result = await provisionRemoteHost({
    host: 'bigpc', version: '1.0.0', onProgress: (progress) => { steps.push(`${progress.step}:${String(progress.done)}`) },
  })
  expect(result).toEqual({
    address: 'https://bigpc.tail71ee4f.ts.net/',
    directory: '.ocean-server/1.0.0',
    link: 'ocean://pair?host=https%3A%2F%2Fbigpc.tail71ee4f.ts.net%2F&label=desktop#g',
    expiresAt: '2026-11-24T00:00:00.000Z',
  })
  expect(steps).toEqual([
    'inspect:false', 'inspect:true', 'download:false', 'download:true', 'verify:false', 'verify:true',
    'extract:false', 'extract:true', 'serve:false', 'serve:true', 'pair:false', 'pair:true',
  ])
  // Every invocation is non-interactive and pinned to this destination, and the remote side runs one sh script.
  for (const call of calls) {
    expect(call.command).toBe('ssh')
    expect(call.args.slice(0, 4)).toEqual(['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new'])
    expect(call.args[4]).toBe('bigpc')
    expect(call.args[5]).toBe('--')
  }
  expect(calls[0]!.args[6]).toContain('uname -s')
  expect(scripts[1]).toContain('curl -fsSL -o "$archive"')
  expect(scripts[2]).toContain('sha256sum download.tar.gz')
  expect(scripts[3]).toContain('--strip-components=1')
  expect(scripts[4]).toContain('serve --help')
  expect(scripts[7]).toContain('--tailscale-serve')
  expect(scripts[7]).toContain('--tailscale-serve-port 443')
  // The mapping runs through a wrapper that falls back to passwordless sudo, and the socket directory is private.
  expect(scripts[5]).toContain('chmod 700 "$root" "$root/run"')
  expect(scripts[5]).toContain('sudo -n /usr/bin/tailscale')
  expect(scripts[7]).toContain('--tailscale-command "$wrapper"')
  expect(scripts[7]).toContain('--device-admin-socket')
  // The new device is minted on the Host itself, because no token exists yet.
  expect(scripts[8]).toContain('pair desktop --ttl 600')
})

it('uses wget when the machine has no curl', async () => {
  script({ ...LINUX, stdout: 'Linux\nx86_64\nmissing:curl\n/usr/bin/tar\n/usr/bin/sha256sum\n' }, {}, {}, {}, CAPS, {}, {}, READY, PAIRED)
  await provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })
  expect(scripts[1]).toContain('wget -q -O "$archive"')
  expect(scripts[1]).toContain('wget -q -O "$sums"')
  expect(scripts[1]).not.toContain('curl')
})

it('accepts arm64 and the vendor spellings of both architectures', async () => {
  for (const [reported, arch] of [['aarch64', 'arm64'], ['arm64', 'arm64'], ['amd64', 'x64']] as const) {
    script({ ...LINUX, stdout: `Linux\n${reported}\n/usr/bin/curl\n/usr/bin/tar\n/usr/bin/sha256sum\n` }, {}, {}, {}, CAPS, {}, {}, READY, PAIRED)
    await provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })
    expect(scripts[1]).toContain(`linux-${arch}-unsigned`)
  }
})

it('refuses a machine that is not a supported Linux target', async () => {
  script({ stdout: 'Darwin\narm64\n/usr/bin/curl\n/usr/bin/tar\n/usr/bin/sha256sum\n' })
  await expect(provisionRemoteHost({ host: 'mac', version: '1.0.0' })).rejects.toMatchObject({
    code: 'DESKTOP_SSH_UNSUPPORTED', step: 'inspect',
  })
  script({ stdout: 'Linux\nriscv64\n/usr/bin/curl\n/usr/bin/tar\n/usr/bin/sha256sum\n' })
  await expect(provisionRemoteHost({ host: 'odd', version: '1.0.0' })).rejects.toMatchObject({ code: 'DESKTOP_SSH_UNSUPPORTED' })
  // A silent machine is unsupported rather than unreachable: the probe itself succeeded.
  script({ stdout: '' })
  await expect(provisionRemoteHost({ host: 'quiet', version: '1.0.0' })).rejects.toMatchObject({ code: 'DESKTOP_SSH_UNSUPPORTED' })
  // A kernel line without an architecture line names the missing architecture, not a crash.
  script({ stdout: 'Linux' })
  await expect(provisionRemoteHost({ host: 'bare', version: '1.0.0' })).rejects.toMatchObject({ code: 'DESKTOP_SSH_UNSUPPORTED' })
})

it.each([
  { description: 'tar', probe: 'Linux\nx86_64\n/usr/bin/curl\nmissing:tar\n/usr/bin/sha256sum\n' },
  { description: 'both downloaders', probe: 'Linux\nx86_64\nmissing:curl\nmissing:wget\n/usr/bin/tar\n/usr/bin/sha256sum\n' },
])('refuses a machine without $description', async ({ probe }) => {
  script({ stdout: probe })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({
    code: 'DESKTOP_SSH_TOOLS_MISSING', step: 'inspect',
  })
})

it('reports an unreachable machine apart from a refused one', async () => {
  script({ status: null, error: new Error('ssh: connect to host bigpc port 22: No route to host') })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({
    code: 'DESKTOP_SSH_UNREACHABLE', step: 'inspect',
  })
  script({ status: 255, stderr: 'Permission denied (publickey)' })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({ code: 'DESKTOP_SSH_UNREACHABLE' })
})

it('separates a version that was never published from a failed download', async () => {
  script(LINUX, { status: 22, stderr: 'curl: (22) The requested URL returned error: 404' })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.1' })).rejects.toMatchObject({
    code: 'DESKTOP_SSH_RELEASE_MISSING', step: 'download',
  })
  script(LINUX, { status: 6, stderr: 'curl: (6) Could not resolve host' })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({ code: 'DESKTOP_SSH_DOWNLOAD_FAILED' })
  script(LINUX, { status: null, error: new Error('spawn failed') })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({ code: 'DESKTOP_SSH_DOWNLOAD_FAILED' })
})

it('refuses an archive whose checksum does not match the published manifest', async () => {
  script(LINUX, {}, { status: 1 })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({
    code: 'DESKTOP_SSH_CHECKSUM_FAILED', step: 'verify',
  })
})

it('reports a failed extraction and a Host that never became ready', async () => {
  script(LINUX, {}, {}, { status: 2, stderr: 'tar: not a gzip file' })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({
    code: 'DESKTOP_SSH_EXTRACT_FAILED', step: 'extract',
  })
  script(LINUX, {}, {}, {}, CAPS, {}, {}, { status: 1, stderr: 'TailscaleServeError: could not publish\n' })
  const refused = await provisionRemoteHost({ host: 'bigpc', version: '1.0.0' }).catch((error: unknown) => error)
  // The Host's own last line explains the refusal, so the dialog can name it.
  expect(refused).toMatchObject({ code: 'DESKTOP_SSH_SERVE_FAILED', step: 'serve' })
  expect((refused as Error).message).toContain('could not publish')
  script(LINUX, {}, {}, {}, CAPS, {}, {}, { status: null, error: new Error('connection closed') })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({ code: 'DESKTOP_SSH_SERVE_FAILED' })
})

it('refuses a ready line that is not an HTTPS address', async () => {
  script(LINUX, {}, {}, {}, CAPS, { stdout: 'ocean serve: http://127.0.0.1:3080/\n' })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({ code: 'DESKTOP_SSH_SERVE_FAILED' })
  script(LINUX, {}, {}, {}, CAPS, { stdout: 'something else entirely\n' })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({ code: 'DESKTOP_SSH_SERVE_FAILED' })
  script(LINUX, {}, {}, {}, CAPS, { stdout: '' })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({ code: 'DESKTOP_SSH_SERVE_FAILED' })
  // Trailing blank lines do not hide the ready line.
  script(LINUX, {}, {}, {}, CAPS, {}, {}, { stdout: 'ocean serve: https://bigpc.tail71ee4f.ts.net/\n\n' }, PAIRED)
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).resolves.toMatchObject({ address: 'https://bigpc.tail71ee4f.ts.net/' })
})

it('stops at the next step boundary when the caller cancels', async () => {
  script(LINUX, {}, {}, {}, CAPS, {}, {}, READY, PAIRED)
  const cancel = new AbortController()
  cancel.abort(new Error('cancelled by caller'))
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0', signal: cancel.signal }))
    .rejects.toThrow('cancelled by caller')
  expect(calls).toHaveLength(0)
})

it('stops after a step finishes when cancellation arrives mid-run', async () => {
  const cancel = new AbortController()
  let finished = 0
  remoteSsh.run = async () => {
    finished += 1
    if (finished === 2) cancel.abort(new Error('cancelled after inspect'))
    return { status: 0, stdout: finished === 1 ? LINUX.stdout : '', stderr: '' }
  }
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0', signal: cancel.signal }))
    .rejects.toThrow('cancelled after inspect')
  expect(finished).toBe(2)
})

it('runs the real ssh binary through the production hook and reports a missing one', async () => {
  const result = await original('/nonexistent/ssh', ['-V'])
  expect(result.error).toBeInstanceOf(Error)
  expect(result.status).toBeNull()
})

it('runs a real executable through the production hook', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ocean-ssh-'))
  try {
    const executable = join(directory, 'fake-ssh')
    writeFileSync(executable, '#!/bin/sh\necho "out:$1"\necho "err" >&2\nexit 4\n', { mode: 0o755 })
    expect(await original(executable, ['first'])).toEqual({ status: 4, stdout: 'out:first\n', stderr: 'err\n' })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

it('keeps the destination out of the remote script, so a host name cannot alter it', async () => {
  script(LINUX, {}, {}, {}, CAPS, {}, {}, READY, PAIRED)
  await provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })
  for (const script of scripts) expect(script).not.toContain('bigpc')
  expect(vi.isMockFunction(remoteSsh.run)).toBe(false)
})

it('reports a Host that cannot mint a pairing link', async () => {
  script(LINUX, {}, {}, {}, CAPS, {}, {}, READY, { status: 1, stderr: 'admin socket refused' })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({
    code: 'DESKTOP_SSH_PAIR_FAILED', step: 'pair',
  })
  script(LINUX, {}, {}, {}, CAPS, {}, {}, READY, { stdout: 'not json' })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({ code: 'DESKTOP_SSH_PAIR_FAILED' })
  script(LINUX, {}, {}, {}, CAPS, {}, {}, READY, { stdout: '{"expiresAt":"soon"}' })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({ code: 'DESKTOP_SSH_PAIR_FAILED' })
})

it('reads the HTTPS ports a machine already serves from the Host\'s own status shape', () => {
  const json = JSON.stringify({
    Web: {
      'bigpc.tail71ee4f.ts.net': { Handlers: { '/': { Proxy: 'http://100.72.163.58:49374' } } },
      'bigpc.tail71ee4f.ts.net:8443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:3080' } } },
      'other.tail71ee4f.ts.net:10443': { Handlers: {} },
    },
    TCP: { '2222': { TCPForward: '127.0.0.1:22' }, '9443': { HTTPS: true } },
  })
  // An HTTPS entry is this Host's own publication, not another site's claim on the port.
  expect([...servePortsInUse(json)].sort((left, right) => left - right)).toEqual([443, 2222, 8443, 10443])
  // Unreadable or empty output says nothing about occupied ports.
  expect(servePortsInUse('not json').size).toBe(0)
  expect(servePortsInUse('').size).toBe(0)
  expect(servePortsInUse('null').size).toBe(0)
})

it('chooses a free port, keeping 443 when the machine serves nothing there', () => {
  expect(chooseServePort(undefined, new Set())).toBe(443)
  expect(chooseServePort(undefined, new Set([443]))).toBe(8443)
  expect(chooseServePort(undefined, new Set([443, 8443, 9443]))).toBe(10443)
  // A pinned port is honoured even when it is taken: the Host reports the refusal.
  expect(chooseServePort(9443, new Set([9443]))).toBe(9443)
})

it('publishes on a free port when another site already holds 443', async () => {
  const status = { status: 0, stdout: JSON.stringify({ Web: { 'bigpc.tail71ee4f.ts.net': { Handlers: {} } } }), stderr: '' }
  script(LINUX, {}, {}, {}, CAPS, {}, status, { ...READY, stdout: 'ocean serve: https://bigpc.tail71ee4f.ts.net:8443/\n' }, PAIRED)
  const result = await provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })
  expect(scripts[7]).toContain('--tailscale-serve-port 8443')
  expect(result.address).toBe('https://bigpc.tail71ee4f.ts.net:8443/')
})

it('stops the Host an earlier run started, which still owns the administrator socket', async () => {
  script(LINUX, {}, {}, {}, CAPS, {}, {}, READY, PAIRED)
  await provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })
  // The Host refuses to share an existing socket, so the previous process and its socket go first.
  expect(scripts[7]).toContain('kill "$previous"')
  expect(scripts[7]).toContain('rm -f "$root/run/admin.sock"')
})

it('stops waiting as soon as the Host process dies, instead of the whole two minutes', async () => {
  const dead = {
    status: 1,
    stderr: 'TailscaleServeError: --tailscale-serve found port 443 already used\n',
  }
  script(LINUX, {}, {}, {}, CAPS, {}, {}, dead)
  const refused = await provisionRemoteHost({ host: 'bigpc', version: '1.0.0' }).catch((error: unknown) => error)
  expect(refused).toMatchObject({ code: 'DESKTOP_SSH_SERVE_FAILED', step: 'serve' })
  // The start script no longer sleeps the full budget when the process is gone.
  expect(scripts[7]).toContain('kill -0')
})

it('publishes on the Tailscale port it was given, so an occupied 443 is not replaced', async () => {
  script(LINUX, {}, {}, {}, CAPS, {}, {}, READY, PAIRED)
  await provisionRemoteHost({ host: 'bigpc', version: '1.0.0', servePort: 8444 })
  expect(scripts[7]).toContain('--tailscale-serve-port 8444')
})

it('refuses an archive older than this app, instead of reporting an unknown option', async () => {
  script(LINUX, {}, {}, { stdout: 'Usage: ocean serve [options]\n  --public-url <url>\n' })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({
    code: 'DESKTOP_SSH_ARCHIVE_OLD', step: 'extract',
  })
  script(LINUX, {}, {}, { status: 1, stderr: 'Cannot find module' })
  await expect(provisionRemoteHost({ host: 'bigpc', version: '1.0.0' })).rejects.toMatchObject({
    code: 'DESKTOP_SSH_EXTRACT_FAILED', step: 'extract',
  })
})
