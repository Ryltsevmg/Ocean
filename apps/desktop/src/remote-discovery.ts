/** Machines the connection window lists: OpenSSH destinations, and Tailscale peers that run a Host. */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ROUTE_PROBE_TIMEOUT_MS, type RouteProbe } from './remote-routes.ts'
import { remoteSsh, SSH_DESTINATION } from './remote-ssh.ts'

/** One `Host` block of an OpenSSH configuration file. */
export interface SshConfigHost {
  /** Alias typed after `ssh`. */
  readonly host: string
  /** Machine the alias connects to: the block's first `HostName`, else the alias. */
  readonly hostName: string
}

/** An OpenSSH destination the connection window can offer. */
export interface SshTarget {
  /** Destination passed to `ssh`: a `Host` alias or a `known_hosts` name. */
  readonly host: string
  /** Caption the list shows. */
  readonly label: string
  /** Machine the destination connects to, for recognizing an already paired machine. */
  readonly hostName: string
}

/** A Tailscale peer the discovery can probe. */
export interface TailscalePeer {
  /** MagicDNS name without its trailing dot; it resolves only inside the tailnet. */
  readonly name: string
}

/** Either the online peers, or the fact that the Tailscale CLI did not answer. */
export type TailscalePeers = readonly TailscalePeer[] | { readonly kind: 'unavailable' }

/** A Tailscale peer that answered as a Host. */
export interface DiscoveredHost {
  /** HTTPS route that answered, on the first candidate port that did. */
  readonly address: string
  /** Identity the Host reported. */
  readonly hostId: string
}

/** Runs one command and captures its output; the provisioning hook is the production runner. */
export type DiscoveryRun = (command: string, args: readonly string[]) => Promise<{
  readonly status: number | null
  readonly stdout: string
}>

/** One discovery pass, as the connection window receives it. */
export interface RemoteDiscovery {
  readonly kind: 'discovered'
  /** OpenSSH destinations that do not reach a saved machine. */
  readonly ssh: readonly { readonly host: string; readonly label: string }[]
  /** Tailscale peers running a Host; `known` when a saved machine owns that identity. */
  readonly tailscale: readonly { readonly address: string; readonly hostId: string; readonly known: boolean }[]
  /** False when the Tailscale CLI did not answer, so no peer was looked up. */
  readonly tailscaleAvailable: boolean
}

/** The Tailscale CLI on `PATH`; the macOS app bundle ships its own copy. */
const TAILSCALE = 'tailscale'
const TAILSCALE_MACOS_APP = '/Applications/Tailscale.app/Contents/MacOS/Tailscale'

/** One `Host` block entry while it is still being read. */
type BlockEntry = { host: string; hostName: string }

/**
 * Read the `Host` blocks of an OpenSSH configuration. `Include` is not followed, a `Match` block
 * ends the open `Host` block, and aliases with a pattern character are skipped.
 * @param text - Contents of `~/.ssh/config`.
 * @returns One entry per plain alias, in file order.
 */
export function parseSshConfig(text: string): SshConfigHost[] {
  const hosts: BlockEntry[] = []
  let block: BlockEntry[] | undefined
  let named = false
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const [keyword = '', ...args] = line.replace(/^(\S+?)\s*=\s*/u, '$1 ').split(/\s+/u)
    const directive = keyword.toLowerCase()
    if (directive === 'host' || directive === 'match') {
      block = undefined
      named = false
      if (directive !== 'host') continue
      block = []
      for (const alias of args) {
        if (/[*?!]/u.test(alias)) continue
        const entry: BlockEntry = { host: alias, hostName: alias }
        hosts.push(entry)
        block.push(entry)
      }
      continue
    }
    const name = args[0]
    if (directive === 'hostname' && block !== undefined && !named && name !== undefined) {
      for (const entry of block) entry.hostName = name
      named = true
    }
  }
  return hosts
}

/**
 * Read the host names of a `known_hosts` file: the first name of each first field, with hashed
 * entries, marker lines, and patterns skipped, and `[host]:port` reduced to the host.
 * @param text - Contents of `~/.ssh/known_hosts`.
 * @returns Host names in file order, duplicates kept.
 */
export function parseKnownHosts(text: string): string[] {
  const names: string[] = []
  for (const raw of text.split(/\r?\n/u)) {
    const field = raw.trim().split(/\s+/u)[0]
    if (field === undefined || field === '' || /^[@#|]/u.test(field)) continue
    const name = field.split(',')[0]?.replace(/^\[([^\]]+)\]:\d+$/u, '$1')
    if (name !== undefined && name !== '' && !/[*?!,]/u.test(name)) names.push(name)
  }
  return names
}

/**
 * Read the online peers of a `tailscale status --json` reply. This machine is excluded, and each
 * peer's `DNSName` loses its trailing dot.
 * @param json - Standard output of `tailscale status --json`.
 * @returns Online peers, or none when the reply cannot be read.
 */
export function parseTailscaleStatus(json: string): TailscalePeer[] {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch (_error) {
    // Unreadable output names no peers; the window lists what it has.
    return []
  }
  if (typeof parsed !== 'object' || parsed === null) return []
  const { Self, Peer } = parsed as { Self?: { ID?: unknown } | null; Peer?: unknown }
  const self = typeof Self === 'object' && Self !== null ? Self.ID : undefined
  const peers: TailscalePeer[] = []
  if (typeof Peer !== 'object' || Peer === null) return peers
  for (const [id, entry] of Object.entries(Peer)) {
    if (typeof entry !== 'object' || entry === null) continue
    const { DNSName, Online, ID } = entry as { DNSName?: unknown; Online?: unknown; ID?: unknown }
    if (id === self || ID === self || Online !== true || typeof DNSName !== 'string') continue
    const name = DNSName.replace(/\.$/u, '')
    if (name !== '') peers.push({ name })
  }
  return peers
}

/**
 * Read the text of a file under the user's home, if it exists and can be read.
 * @param path - File to read.
 * @returns Its text, or an empty string when it is missing or unreadable.
 */
async function readText(path: string): Promise<string> {
  try { return await readFile(path, 'utf8') } catch (_error) {
    // A missing or unreadable file lists nothing; the user can still type a destination.
    return ''
  }
}

/**
 * List the OpenSSH destinations of a home directory: the `Host` aliases of `.ssh/config`, then the
 * names of `.ssh/known_hosts` that neither an alias nor a `HostName` already names. Names that
 * are not valid destinations are skipped.
 * @param homeDir - Home directory whose `.ssh` is read.
 * @returns Destinations in file order, each once.
 */
export async function readSshTargets(homeDir: string): Promise<SshTarget[]> {
  const [config, known] = await Promise.all([
    readText(join(homeDir, '.ssh', 'config')).then(parseSshConfig),
    readText(join(homeDir, '.ssh', 'known_hosts')).then(parseKnownHosts),
  ])
  const targets = new Map<string, SshTarget>()
  const named = new Set<string>()
  for (const entry of config) {
    targets.set(entry.host.toLowerCase(), { host: entry.host, label: entry.host, hostName: entry.hostName })
    named.add(entry.hostName.toLowerCase())
  }
  for (const name of known) {
    const key = name.toLowerCase()
    if (SSH_DESTINATION.test(name) && !targets.has(key) && !named.has(key)) targets.set(key, { host: name, label: name, hostName: name })
  }
  return [...targets.values()]
}

/**
 * Ask the Tailscale CLI for the online peers. On macOS the app bundle's copy is tried when the
 * one on `PATH` did not answer.
 * @param run - Command runner; production uses the provisioning hook.
 * @param platform - Platform that decides whether the macOS app bundle is tried.
 * @returns The online peers, or `unavailable` when no copy of the CLI answered.
 */
export async function readTailscalePeers(
  run: DiscoveryRun = remoteSsh.run,
  platform: NodeJS.Platform = process.platform,
): Promise<TailscalePeers> {
  for (const command of platform === 'darwin' ? [TAILSCALE, TAILSCALE_MACOS_APP] : [TAILSCALE]) {
    let result: Awaited<ReturnType<DiscoveryRun>>
    try { result = await run(command, ['status', '--json']) } catch (_error) {
      // A runner that refuses the command says as little as one that fails to start it.
      continue
    }
    if (result.status === 0) return parseTailscaleStatus(result.stdout)
  }
  return { kind: 'unavailable' }
}

/**
 * Find which Tailscale peers run a Host: every peer is asked in parallel, each on the candidate
 * ports in order, and the first port that answers as a Host names the address.
 * @param options - Peers, ports, the credential-free probe, and cancellation of the whole pass.
 * @returns One address and identity per peer that answered.
 */
export async function discoverHosts(options: {
  readonly peers: readonly TailscalePeer[]
  /** HTTPS ports tried in order for each peer. */
  readonly ports: readonly number[]
  /** Credential-free identity check of one route. */
  readonly probe: RouteProbe
  /** Cancellation of the whole pass. */
  readonly signal?: AbortSignal
}): Promise<DiscoveredHost[]> {
  const { peers, ports, probe, signal } = options
  const found = await Promise.all(peers.map(async (peer): Promise<DiscoveredHost | undefined> => {
    for (const port of ports) {
      if (signal?.aborted) return undefined
      const address = `https://${peer.name}${port === 443 ? '' : `:${String(port)}`}/`
      const timeout = AbortSignal.timeout(ROUTE_PROBE_TIMEOUT_MS)
      try {
        const identity = await probe(address, signal === undefined ? timeout : AbortSignal.any([signal, timeout]))
        return { address, hostId: identity.id }
      } catch (_error) {
        // A closed port, or a server that is not a Host, leaves the next candidate port to answer.
      }
    }
    return undefined
  }))
  return found.filter((host): host is DiscoveredHost => host !== undefined)
}
