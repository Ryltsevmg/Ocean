import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AGENTS_HOME_DIR_NAME,
  DEFAULT_AGENTS_HOME_DISPLAY,
  DEFAULT_OCEAN_HOME_DISPLAY,
  OCEAN_HOME_DIR_NAME,
  agentsHomeDisplay,
  canonicalizeWatchPath,
  defaultAgentsHome,
  defaultOceanHome,
  dshCachePath,
  oceanCachePath,
  oceanHomeDisplay,
  oceanHomePath,
  expandHomePath,
  resolveAgentsHome,
  resolveOceanHome,
} from '@ocean/ocean-home-paths'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('ocean path helpers', () => {
  it('keeps legacy home overrides while explicit Ocean overrides take precedence', () => {
    expect(resolveOceanHome(undefined, { DSH_HOME: '/legacy' })).toBe(resolve('/legacy'))
    expect(resolveOceanHome(undefined, { DSH_HOME: '/legacy', OCEAN_HOME: '/current' })).toBe(resolve('/current'))
    expect(resolveOceanHome(undefined, { DSH_HOME: '/legacy', OCEAN_HOME: '' })).toBe(defaultOceanHome())
    expect(resolveAgentsHome(undefined, { DSH_AGENTS_HOME: '/legacy-agents' })).toBe(resolve('/legacy-agents'))
    expect(resolveAgentsHome(undefined, { DSH_AGENTS_HOME: '/legacy', OCEAN_AGENTS_HOME: '/current' })).toBe(resolve('/current'))
  })
  it('owns the shared default OCEAN home directory name', () => {
    expect(OCEAN_HOME_DIR_NAME).toBe('.ocean')
    expect(DEFAULT_OCEAN_HOME_DISPLAY).toBe('~/.ocean')
    expect(defaultOceanHome()).toBe(join(homedir(), '.ocean'))
  })

  it('expands tilde paths without changing non-tilde paths', () => {
    expect(expandHomePath('~')).toBe(homedir())
    expect(expandHomePath('~/.ocean')).toBe(join(homedir(), '.ocean'))
    expect(expandHomePath('~\\.ocean')).toBe(join(homedir(), '.ocean'))
    expect(expandHomePath('/tmp/.ocean')).toBe('/tmp/.ocean')
    expect(expandHomePath('~other/.ocean')).toBe('~other/.ocean')
  })

  it('resolves explicit path before OCEAN_HOME and the default', () => {
    const envHome = join(homedir(), 'env-ocean')

    expect(resolveOceanHome('/tmp/explicit-ocean', { OCEAN_HOME: '~/env-ocean' })).toBe(resolve('/tmp/explicit-ocean'))
    expect(resolveOceanHome(undefined, { OCEAN_HOME: '~/env-ocean' })).toBe(envHome)
    expect(resolveOceanHome(undefined, {})).toBe(defaultOceanHome())
  })

  it('treats an empty or whitespace-only OCEAN_HOME as unset', () => {
    expect(resolveOceanHome(undefined, { OCEAN_HOME: '' })).toBe(defaultOceanHome())
    expect(resolveOceanHome(undefined, { OCEAN_HOME: '   ' })).toBe(defaultOceanHome())
  })

  it('joins child segments onto the resolved OCEAN_HOME', () => {
    vi.stubEnv('OCEAN_HOME', '~/env-ocean')
    expect(oceanHomePath()).toBe(join(homedir(), 'env-ocean'))
    expect(oceanHomePath('storages', 'cache')).toBe(join(homedir(), 'env-ocean', 'storages', 'cache'))
  })

  it('labels a resolved home by whether it is the default root', () => {
    expect(oceanHomeDisplay(resolve(defaultOceanHome()))).toBe('~/.ocean')
    expect(oceanHomeDisplay('/some/other/root')).toBe('$OCEAN_HOME')
  })

  it('owns the shared default agents home directory name', () => {
    expect(AGENTS_HOME_DIR_NAME).toBe('.agents')
    expect(DEFAULT_AGENTS_HOME_DISPLAY).toBe('~/.agents')
    expect(defaultAgentsHome()).toBe(join(homedir(), '.agents'))
  })

  it('resolves an explicit agents home before OCEAN_AGENTS_HOME and the default', () => {
    const envHome = join(homedir(), 'env-agents')

    expect(resolveAgentsHome('/tmp/explicit-agents', { OCEAN_AGENTS_HOME: '~/env-agents' })).toBe(resolve('/tmp/explicit-agents'))
    expect(resolveAgentsHome(undefined, { OCEAN_AGENTS_HOME: '~/env-agents' })).toBe(envHome)
    expect(resolveAgentsHome(undefined, {})).toBe(defaultAgentsHome())
  })

  it('treats an empty or whitespace-only OCEAN_AGENTS_HOME as unset', () => {
    expect(resolveAgentsHome(undefined, { OCEAN_AGENTS_HOME: '' })).toBe(defaultAgentsHome())
    expect(resolveAgentsHome(undefined, { OCEAN_AGENTS_HOME: '   ' })).toBe(defaultAgentsHome())
  })

  it('labels a resolved agents home by whether it is the default root', () => {
    expect(agentsHomeDisplay(resolve(defaultAgentsHome()))).toBe('~/.agents')
    expect(agentsHomeDisplay('/some/other/root')).toBe('$OCEAN_AGENTS_HOME')
  })

  it.each([
    [undefined, join(homedir(), '.ocean')],
    ['', join(homedir(), '.ocean')],
    ['   ', join(homedir(), '.ocean')],
    ['~/env-ocean', join(homedir(), 'env-ocean')],
    ['./relative-ocean', resolve('./relative-ocean')],
  ] as const)('resolves cache paths with OCEAN_HOME=%j', (home, expectedHome) => {
    vi.stubEnv('OCEAN_HOME', home)
    try {
      expect(oceanCachePath()).toBe(join(expectedHome, 'cache'))
      expect(oceanCachePath('models', 'index.json')).toBe(join(expectedHome, 'cache', 'models', 'index.json'))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('resolves configured cache homes before the environment', () => {
    vi.stubEnv('OCEAN_HOME', '~/env-ocean')
    try {
      expect(oceanCachePath({ oceanHome: '~/explicit-ocean' })).toBe(join(homedir(), 'explicit-ocean', 'cache'))
      expect(oceanCachePath({ oceanHome: './explicit-ocean' }, 'attachments', 'request-images'))
        .toBe(resolve('./explicit-ocean/cache/attachments/request-images'))
      expect(oceanCachePath({}, 'attachments')).toBe(join(homedir(), 'env-ocean', 'cache', 'attachments'))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('keeps the legacy cache helper on the same resolved home', () => {
    vi.stubEnv('OCEAN_HOME', '~/env-ocean')
    try {
      expect(dshCachePath()).toBe(join(homedir(), 'env-ocean', 'cache'))
      expect(dshCachePath('models', 'index.json')).toBe(join(homedir(), 'env-ocean', 'cache', 'models', 'index.json'))
      expect(dshCachePath({ dshHome: '~/explicit-ocean' })).toBe(join(homedir(), 'explicit-ocean', 'cache'))
      expect(dshCachePath({}, 'attachments')).toBe(join(homedir(), 'env-ocean', 'cache', 'attachments'))
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('canonicalizes a watcher ancestor while preserving a missing suffix', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ocean-watch-path-'))
    const target = join(root, 'target')
    const alias = join(root, 'alias')
    try {
      await mkdir(target)
      await symlink(target, alias, process.platform === 'win32' ? 'junction' : 'dir')
      await expect(canonicalizeWatchPath(alias)).resolves.toBe(await realpath(target))
      await expect(canonicalizeWatchPath(join(alias, 'later', 'config.yml'))).resolves.toBe(
        join(await realpath(target), 'later', 'config.yml'),
      )
      const file = join(root, 'file')
      await writeFile(file, 'not a directory')
      await expect(canonicalizeWatchPath(join(file, 'child'))).rejects.toMatchObject({ code: 'ENOTDIR' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
