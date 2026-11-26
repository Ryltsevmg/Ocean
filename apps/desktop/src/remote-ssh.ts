/** Provision and launch an Ocean Host on a remote Linux machine over SSH. */

/** One command run on the remote machine, with its exit status and captured output. */
export interface RemoteSshRun {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
  readonly error?: Error
}

/** Steps a provisioning run reports, in order. */
export type RemoteSshStep = 'inspect' | 'download' | 'verify' | 'extract' | 'serve' | 'pair'

/** Progress of one provisioning run: which step is running, and the failure that ended it. */
export interface RemoteSshProgress {
  /** Step that just started or just finished. */
  readonly step: RemoteSshStep
  /** True when the step finished; false when it started. */
  readonly done: boolean
}

/** A remote machine the app can prepare and start. */
export interface RemoteSshTarget {
  /** OpenSSH destination as typed, such as `bigpc` or `user@host`. */
  readonly host: string
  /** Exact Ocean version to install; the archive must be published for it. */
  readonly version: string
  /** Machine architecture to install, from the remote `uname -m` probe. */
  readonly arch: 'x64' | 'arm64'
}

/** Failures a provisioning run reports without exposing remote output. */
export type RemoteSshErrorCode = 'DESKTOP_SSH_HOST_INVALID' | 'DESKTOP_SSH_UNREACHABLE' | 'DESKTOP_SSH_UNSUPPORTED'
  | 'DESKTOP_SSH_TOOLS_MISSING' | 'DESKTOP_SSH_DOWNLOAD_FAILED' | 'DESKTOP_SSH_CHECKSUM_FAILED'
  | 'DESKTOP_SSH_EXTRACT_FAILED' | 'DESKTOP_SSH_SERVE_FAILED' | 'DESKTOP_SSH_RELEASE_MISSING'
  | 'DESKTOP_SSH_PAIR_FAILED' | 'DESKTOP_SSH_ARCHIVE_OLD'

/** A provisioning failure carrying a classification and the step that produced it. */
export class RemoteSshError extends Error {
  readonly code: RemoteSshErrorCode
  readonly step: RemoteSshStep

  /**
   * @param code - Failure category for localized reporting.
   * @param step - Step that failed.
   * @param message - Secret-free diagnostic for the log.
   * @param options - Optional cause.
   */
  constructor(code: RemoteSshErrorCode, step: RemoteSshStep, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RemoteSshError'
    this.code = code
    this.step = step
  }
}

/** Test hook for the `ssh` executable; production runs the one found on `PATH`. */
export const remoteSsh: { run: (command: string, args: readonly string[]) => Promise<RemoteSshRun> } = {
  async run(command, args) {
    const { spawn } = await import('node:child_process')
    return await new Promise<RemoteSshRun>((resolvePromise) => {
      const child = spawn(command, [...args], { stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = ''
      let stderr = ''
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => { stdout += chunk })
      child.stderr.on('data', (chunk: string) => { stderr += chunk })
      child.on('error', (error) => { resolvePromise({ status: null, stdout, stderr, error }) })
      child.on('close', (status) => { resolvePromise({ status, stdout, stderr }) })
    })
  },
}

/** OpenSSH destination characters; anything else could smuggle another option or command. */
const DESTINATION = /^[A-Za-z0-9][A-Za-z0-9_.@-]*$/u

/** Release archive names and the machine architectures they cover. */
const ARCHITECTURES: Readonly<Record<string, 'x64' | 'arm64'>> = { x86_64: 'x64', amd64: 'x64', aarch64: 'arm64', arm64: 'arm64' }

/** Commands a provisioning run needs on the remote machine, and the probe for each. */
const TOOLS = ['curl', 'wget', 'tar', 'sha256sum'] as const

/** Where a prepared Host lives on the remote machine, relative to its home directory. */
const INSTALL_ROOT = '.ocean-server'

/** Base URL of the published release assets. */
const RELEASE_ROOT = 'https://github.com/Ryltsevmg/Ocean/releases/download'

/**
 * Validate an OpenSSH destination before it reaches an argument list.
 * @param host - Destination as typed by the user.
 * @returns The destination, unchanged.
 * @throws {RemoteSshError} When it is empty or carries characters OpenSSH would interpret.
 */
export function parseSshTarget(host: string): string {
  const trimmed = host.trim()
  if (trimmed === '' || trimmed.length > 255 || !DESTINATION.test(trimmed)) {
    throw new RemoteSshError('DESKTOP_SSH_HOST_INVALID', 'inspect', 'Ocean remote SSH: the destination is not a valid OpenSSH host')
  }
  return trimmed
}

/**
 * Archive name published for one version and architecture.
 * @param version - Exact Ocean version.
 * @param arch - Machine architecture.
 * @returns The release asset name.
 */
export function archiveName(version: string, arch: 'x64' | 'arm64'): string {
  return `ocean-${version}-linux-${arch}-unsigned.tar.gz`
}

/**
 * Release asset URLs for one version and architecture.
 * @param version - Exact Ocean version.
 * @param arch - Machine architecture.
 * @returns The archive URL and the checksum manifest URL beside it.
 */
export function releaseUrls(version: string, arch: 'x64' | 'arm64'): { archive: string; sums: string } {
  const base = `${RELEASE_ROOT}/v${version}`
  return { archive: `${base}/${archiveName(version, arch)}`, sums: `${base}/SHA256SUMS` }
}

/** HTTPS ports tried when the caller pins none; 443 first, so a machine that serves nothing keeps the familiar address. */
const SERVE_PORT_CANDIDATES: readonly number[] = [443, 8443, 9443, 10443]

/**
 * Read the HTTPS ports the machine's Tailscale already serves another site on, in
 * the shape the Host reads them: `Web` authorities, and `TCP` entries that are not
 * this Host's own HTTPS publications.
 * @param json - Output of `tailscale serve status --json`.
 * @returns Ports another site occupies; empty when the output cannot be read.
 */
export function servePortsInUse(json: string): Set<number> {
  const ports = new Set<number>()
  let parsed: unknown
  try { parsed = JSON.parse(json.trim() === '' ? '{}' : json) } catch (_error) {
    // Unreadable output says nothing about occupied ports; the Host reports its own refusal.
    return ports
  }
  if (typeof parsed !== 'object' || parsed === null) return ports
  const { Web: web, TCP: tcp } = parsed as { Web?: unknown; TCP?: unknown }
  if (typeof web === 'object' && web !== null) {
    for (const authority of Object.keys(web)) ports.add(portOfAuthority(authority))
  }
  if (typeof tcp === 'object' && tcp !== null) {
    for (const [key, entry] of Object.entries(tcp)) {
      const port = Number(key)
      // An HTTPS entry is this Host's own published port; a raw TCP forward is something else's.
      const https = typeof entry === 'object' && entry !== null && 'HTTPS' in entry && (entry as { HTTPS?: unknown }).HTTPS === true
      if (Number.isInteger(port) && !https) ports.add(port)
    }
  }
  return ports
}

/**
 * @param authority - `Web` key: a host name, with `:port` only when it is not 443.
 * @returns The HTTPS port that authority serves.
 */
function portOfAuthority(authority: string): number {
  const tail = authority.slice(authority.lastIndexOf(':') + 1)
  if (tail === authority) return 443
  const port = Number(tail)
  return Number.isInteger(port) ? port : 443
}

/**
 * Choose the HTTPS port to publish on.
 * @param requested - Port the caller pinned, or undefined to pick a free one.
 * @param inUse - Ports the machine's Tailscale already serves.
 * @returns The pinned port, else the first free candidate, else 443 for the Host to report.
 */
export function chooseServePort(requested: number | undefined, inUse: ReadonlySet<number>): number {
  if (requested !== undefined) return requested
  return SERVE_PORT_CANDIDATES.find(port => !inUse.has(port)) ?? 443
}

/** One provisioning run: the destination, the version, and the hook that reports progress. */
export interface RemoteSshRequest {
  readonly host: string
  readonly version: string
  /** Called when a step starts and again when it finishes. */
  readonly onProgress?: (progress: RemoteSshProgress) => void
  /** Cancels the run; a cancelled run stops at the next step boundary. */
  readonly signal?: AbortSignal
  /** Test hook: the executable that runs the command, `ssh` by default. */
  readonly command?: string
  /**
   * Tailscale HTTPS port to publish on, pinning it. Without it the provisioner
   * publishes on 443, or on the first free port when the machine already serves
   * that one: the Host refuses to replace another site rather than taking its
   * port.
   */
  readonly servePort?: number
}

/** Result of a completed run: the advertised address and a pairing link for a new device. */
export interface RemoteSshResult {
  readonly address: string
  /** Directory on the remote machine that holds this version, relative to its home. */
  readonly directory: string
  /** One-time `ocean://pair` link the Host minted for this app, with its expiry. */
  readonly link: string
  readonly expiresAt: string
}

/** Read the last nonempty line of a command's standard output. */
function lastLine(text: string): string {
  return text.trim().split(/\r?\n/u).filter(line => line !== '').at(-1) ?? ''
}

/** Refuse a step whose command did not succeed. */
function requireSuccess(run: RemoteSshRun, code: RemoteSshErrorCode, step: RemoteSshStep, what: string): void {
  if (run.error !== undefined || run.status !== 0) {
    throw new RemoteSshError(code, step, `Ocean remote SSH: ${what} failed with status ${String(run.status)}`, {
      ...run.error === undefined ? {} : { cause: run.error },
    })
  }
}

/**
 * Prepare and start a Host on a remote machine. Every step runs as one `sh -c`
 * script over SSH; the run stops at the first failure and reports which step
 * produced it, so the dialog can name the stage instead of a raw status.
 * @param request - destination, version, progress hook, cancellation, and test command.
 * @returns The advertised HTTPS address and the install directory.
 * @throws {RemoteSshError} When the destination is invalid, the machine is not a
 *   supported Linux target, a required tool is missing, or a step fails.
 */
export async function provisionRemoteHost(request: RemoteSshRequest): Promise<RemoteSshResult> {
  const host = parseSshTarget(request.host)
  const command = request.command ?? 'ssh'
  const run = async (step: RemoteSshStep, script: string, report = true): Promise<RemoteSshRun> => {
    if (report) request.onProgress?.({ step, done: false })
    request.signal?.throwIfAborted()
    // One argument after `--`: OpenSSH hands it to the remote shell verbatim, so its quoting survives.
    const result = await remoteSsh.run(command, ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', host, '--', script])
    request.signal?.throwIfAborted()
    return result
  }

  // One probe answers both questions the first step needs, so a slow link pays for it once.
  const inspected = await run('inspect', 'uname -s; uname -m; for tool in curl wget tar sha256sum; do command -v "$tool" || echo "missing:$tool"; done')
  requireSuccess(inspected, 'DESKTOP_SSH_UNREACHABLE', 'inspect', 'connecting to the remote machine')
  const lines = inspected.stdout.trim().split(/\r?\n/u).map(line => line.trim())
  /* v8 ignore next -- split always yields a first element, so this arm cannot run. */
  const operatingSystem = lines[0] ?? ''
  if (operatingSystem !== 'Linux') {
    throw new RemoteSshError('DESKTOP_SSH_UNSUPPORTED', 'inspect', `Ocean remote SSH: the remote machine reports ${JSON.stringify(operatingSystem)}, not Linux`)
  }
  const arch = ARCHITECTURES[lines[1] ?? '']
  if (arch === undefined) {
    throw new RemoteSshError('DESKTOP_SSH_UNSUPPORTED', 'inspect', `Ocean remote SSH: the remote architecture ${JSON.stringify(lines[1] ?? '')} has no published archive`)
  }
  const missing = TOOLS.filter(tool => lines.includes(`missing:${tool}`))
  if (missing.length === 0) {
    request.onProgress?.({ step: 'inspect', done: true })
  } else {
    // A downloader is interchangeable, so only the absence of both is fatal.
    const fatal = missing.filter(tool => tool !== 'curl' && tool !== 'wget')
    if (fatal.length > 0 || missing.length === 2) {
      throw new RemoteSshError('DESKTOP_SSH_TOOLS_MISSING', 'inspect', `Ocean remote SSH: the remote machine lacks ${missing.join(', ')}`)
    }
    request.onProgress?.({ step: 'inspect', done: true })
  }

  const urls = releaseUrls(request.version, arch)
  const directory = `${INSTALL_ROOT}/${request.version}`
  const downloader = missing.includes('curl')
    ? `wget -q -O "$archive" ${JSON.stringify(urls.archive)}`
    : `curl -fsSL -o "$archive" ${JSON.stringify(urls.archive)}`
  const fetch = await run('download', [
    'set -e',
    `mkdir -p "$HOME/${directory}"`,
    'archive="$HOME/.ocean-server/download.tar.gz"',
    'sums="$HOME/.ocean-server/SHA256SUMS"',
    downloader,
    missing.includes('curl') ? `wget -q -O "$sums" ${JSON.stringify(urls.sums)}` : `curl -fsSL -o "$sums" ${JSON.stringify(urls.sums)}`,
  ].join('\n'))
  if (fetch.error !== undefined || fetch.status !== 0) {
    // A missing release asset is the common cause, so it is reported apart from a network failure.
    const missingRelease = /404|not found|ERROR 404/iu.test(fetch.stderr)
    throw new RemoteSshError(missingRelease ? 'DESKTOP_SSH_RELEASE_MISSING' : 'DESKTOP_SSH_DOWNLOAD_FAILED', 'download',
      `Ocean remote SSH: downloading ${archiveName(request.version, arch)} failed with status ${String(fetch.status)}`)
  }
  request.onProgress?.({ step: 'download', done: true })

  const verified = await run('verify', [
    'set -e',
    'cd "$HOME/.ocean-server"',
    `expected=$(grep ${JSON.stringify(` ${archiveName(request.version, arch)}`)} SHA256SUMS | cut -d" " -f1)`,
    'test -n "$expected"',
    'actual=$(sha256sum download.tar.gz | cut -d" " -f1)',
    'test "$expected" = "$actual"',
  ].join('\n'))
  requireSuccess(verified, 'DESKTOP_SSH_CHECKSUM_FAILED', 'verify', 'verifying the downloaded archive')
  request.onProgress?.({ step: 'verify', done: true })

  const extracted = await run('extract', [
    'set -e',
    `rm -rf "$HOME/${directory}"`,
    `mkdir -p "$HOME/${directory}"`,
    `tar -xzf "$HOME/.ocean-server/download.tar.gz" -C "$HOME/${directory}" --strip-components=1`,
    `test -x "$HOME/${directory}/resources/runtime/cli/bin/ocean"`,
  ].join('\n'))
  requireSuccess(extracted, 'DESKTOP_SSH_EXTRACT_FAILED', 'extract', 'unpacking the archive')

  // A published archive older than this app lacks the flags used below; naming that is more useful
  // than an unknown-option line from the Host's log.
  // Part of the extraction step: it reads what the archive can do, so it reports no step of its own.
  const capabilities = await run('extract', `"$HOME/${directory}/resources/runtime/cli/bin/ocean" serve --help`, false)
  requireSuccess(capabilities, 'DESKTOP_SSH_EXTRACT_FAILED', 'extract', 'reading the archive\'s serve options')
  if (!capabilities.stdout.includes('--tailscale-serve')) {
    throw new RemoteSshError('DESKTOP_SSH_ARCHIVE_OLD', 'extract',
      `Ocean remote SSH: the ${request.version} archive predates --tailscale-serve`)
  }
  request.onProgress?.({ step: 'extract', done: true })

  // The Host is started detached from this connection: a dropped SSH session must not stop it.
  // `tailscale serve` needs root unless the account is an operator, and a node that already serves a
  // path allows only root to change that configuration, so the mapping goes through a wrapper that
  // falls back to passwordless sudo. The administrator socket directory must be private to this user.
  const prepared = await run('serve', [
    'set -e',
    'cd "$HOME"',
    'root="$HOME/.ocean-server"',
    'mkdir -p "$root/run"',
    'chmod 700 "$root" "$root/run"',
    'wrapper="$root/run/tailscale-ocean"',
    'printf "%s\\n" "#!/bin/sh" "if tailscale \\"\\$@\\" 2>/dev/null; then exit 0; fi"'
      + ' "exec sudo -n /usr/bin/tailscale \\"\\$@\\"" > "$wrapper"',
    'chmod 700 "$wrapper"',
  ].join('\n'), false)
  requireSuccess(prepared, 'DESKTOP_SSH_SERVE_FAILED', 'serve', 'preparing the Tailscale command')

  // Another site may already hold 443; the Host refuses to replace it, so the port is chosen here.
  const status = await run('serve', '"$HOME/.ocean-server/run/tailscale-ocean" serve status --json', false)
  const httpsPort = chooseServePort(request.servePort, servePortsInUse(status.stdout))

  const started = await run('serve', [
    'set -e',
    'cd "$HOME"',
    'root="$HOME/.ocean-server"',
    'log="$root/serve.log"',
    ': > "$log"',
    'wrapper="$root/run/tailscale-ocean"',
    // A Host this provisioner started earlier still owns the administrator socket and refuses to share it.
    'if [ -f "$root/serve.pid" ]; then',
    '  previous=$(cat "$root/serve.pid")',
    '  if kill -0 "$previous" 2>/dev/null; then',
    '    kill "$previous" 2>/dev/null || true',
    '    i=0',
    '    while kill -0 "$previous" 2>/dev/null && [ $i -lt 20 ]; do sleep 1; i=$((i + 1)); done',
    '  fi',
    '  rm -f "$root/serve.pid"',
    'fi',
    'rm -f "$root/run/admin.sock"',
    `setsid nohup "$HOME/${directory}/resources/runtime/cli/bin/ocean" serve --tailscale-serve`
      + ` --tailscale-serve-port ${String(httpsPort)} --tailscale-command "$wrapper" --port 0`
      + ' --device-admin-socket "$root/run/admin.sock" > "$log" 2>&1 < /dev/null &',
    'echo $! > "$root/serve.pid"',
    'i=0',
    'while [ $i -lt 120 ]; do',
    '  sleep 1',
    '  if grep -q "ocean serve:" "$log"; then grep "ocean serve:" "$log" | tail -1; exit 0; fi',
    '  if ! kill -0 "$(cat "$root/serve.pid")" 2>/dev/null; then tail -20 "$log" >&2; exit 1; fi',
    '  i=$((i + 1))',
    'done',
    'tail -20 "$log" >&2',
    'exit 1',
  ].join('\n'))
  if (started.error !== undefined || started.status !== 0) {
    // The Host's own last lines say why, and the wrapper keeps them free of credentials.
    const diagnostic = lastLine(started.stderr)
    throw new RemoteSshError('DESKTOP_SSH_SERVE_FAILED', 'serve',
      `Ocean remote SSH: the Host did not report a ready address${diagnostic === '' ? '' : `: ${diagnostic}`}`)
  }
  const address = lastLine(started.stdout).replace(/^ocean serve:\s*/u, '').trim()
  if (!address.startsWith('https://')) {
    throw new RemoteSshError('DESKTOP_SSH_SERVE_FAILED', 'serve', `Ocean remote SSH: the Host reported ${JSON.stringify(address)}, not an HTTPS address`)
  }
  request.onProgress?.({ step: 'serve', done: true })

  // A new device is minted here rather than typed: the Host's own administrator socket is local to it,
  // so SSH is the only way to ask without a token that does not exist yet.
  const paired = await run('pair', [
    'set -e',
    `"$HOME/${directory}/resources/runtime/cli/bin/ocean" remote-device`
      + ' --socket "$HOME/.ocean-server/run/admin.sock" pair desktop --ttl 600',
  ].join('\n'))
  if (paired.error !== undefined || paired.status !== 0) {
    throw new RemoteSshError('DESKTOP_SSH_PAIR_FAILED', 'pair', 'Ocean remote SSH: the Host did not mint a pairing link')
  }
  let issued: { link?: unknown; expiresAt?: unknown }
  try {
    issued = JSON.parse(lastLine(paired.stdout)) as { link?: unknown; expiresAt?: unknown }
  } catch (cause) {
    throw new RemoteSshError('DESKTOP_SSH_PAIR_FAILED', 'pair', 'Ocean remote SSH: the pairing reply is not JSON', { cause })
  }
  if (typeof issued.link !== 'string' || typeof issued.expiresAt !== 'string') {
    throw new RemoteSshError('DESKTOP_SSH_PAIR_FAILED', 'pair', 'Ocean remote SSH: the pairing reply has no link')
  }
  request.onProgress?.({ step: 'pair', done: true })
  return { address, directory, link: issued.link, expiresAt: issued.expiresAt }
}
