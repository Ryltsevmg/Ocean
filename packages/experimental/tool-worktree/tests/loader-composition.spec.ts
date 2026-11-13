import { executeToolFixture } from '@ocean/ocean-tool-testkit'
import * as NativeToolExecutor from '@ocean/ocean-tool-executor-native'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry from '@ocean/ocean-agent'
import AgentLoop from '@ocean/ocean-agent-loop'
import LocalFileSystem from '@ocean/ocean-fs-local'
import LlmRuntime, { ToolCallId } from '@ocean/ocean-llm'
import LocalSandbox from '@ocean/ocean-sandbox-local'
import SandboxPolicyService from '@ocean/ocean-sandbox-policy'
import SessionStore, { SessionId } from '@ocean/ocean-session'
import SessionProjectionRegistry from '@ocean/ocean-session-projection'
import LocalSubprocessRuntime from '@ocean/ocean-subprocess-local'
import SystemPrompt from '@ocean/ocean-system-prompt'
import ToolRuntime from '@ocean/ocean-tools'
import WorkingDirectoryService from '@ocean/ocean-working-directory'
import WorktreeService from '@ocean/ocean-experimental-worktree'
import * as ToolWorktree from '../src/index.ts'

const exec = promisify(execFile)
let context: Context | undefined
let root: string | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('worktree tool through real Loader composition', () => {
  it('creates and enters a new checkout, reports canonical fields, and unregisters on disposal', async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-worktree-loader-')))
    const repository = join(root, 'repo')
    await mkdir(repository)
    const git = (...args: string[]) => exec('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
      cwd: repository,
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '', GIT_CONFIG_PARAMETERS: '', GIT_CONFIG_COUNT: '0', GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_INDEX_FILE: undefined },
    })
    await git('init', '-b', 'main')
    await git('config', 'core.autocrlf', 'false')
    await writeFile(join(repository, 'file.txt'), 'committed\n')
    await git('add', 'file.txt')
    await git('-c', 'user.name=Worktree fixture', '-c', 'user.email=worktree@example.invalid', '-c', 'commit.gpgSign=false', 'commit', '-m', 'initial')
    const baseCommit = (await git('rev-parse', 'HEAD')).stdout.trim()

    const modules = new Map<string, unknown>([
      ['@ocean/ocean-agent', AgentRegistry],
      ['@ocean/ocean-session', SessionStore],
      ['@ocean/ocean-session-projection', SessionProjectionRegistry],

      ['@ocean/ocean-system-prompt', SystemPrompt],
      ['@ocean/ocean-llm', LlmRuntime],
      ['@ocean/ocean-tools', ToolRuntime],
      ['@ocean/ocean-tool-executor-native', NativeToolExecutor],
      ['@ocean/ocean-fs-local', LocalFileSystem],
      ['@ocean/ocean-subprocess-local', LocalSubprocessRuntime],
      ['@ocean/ocean-sandbox-local', LocalSandbox],
      ['@ocean/ocean-sandbox-policy', SandboxPolicyService],
      ['@ocean/ocean-working-directory', WorkingDirectoryService],
      ['@ocean/ocean-experimental-worktree', WorktreeService],
      ['@ocean/ocean-experimental-tool-worktree', ToolWorktree],
      ['@ocean/ocean-agent-loop', AgentLoop],
    ])
    const config = [...modules.keys()].flatMap(name => [
      `- name: 'cordis:${name}'`,
      ...name === '@ocean/ocean-sandbox-policy' ? ['  config:', '    mode: danger-full-access'] : [],
      ...name === '@ocean/ocean-agent-loop' ? ['  config:', '    agents: []'] : [],
    ]).join('\n') + '\n'
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, config)
    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    for (const [specifier, plugin] of modules) context.loader.builtins[specifier] = plugin
    await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await context.loader.await()

    const agent = await context.agentLoop.create(SessionId('worktree-loader'), {}, { cwd: repository })
    const invoke = (name: string, agentValue = agent) => executeToolFixture(context!, {
      name: 'create_worktree', callId: ToolCallId(name), arguments: { name }, agent: agentValue, signal: new AbortController().signal,
    })
    const result = await invoke('new-checkout')
    const path = join(repository, '.agents/worktrees/new-checkout')
    expect(result.isError).not.toBe(true)
    expect(result.value).toEqual({ path, branch: 'new-checkout', baseCommit, repositoryRoot: repository })
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(result.value) }])
    expect(context.workingDirectory.get(agent.session)).toBe(path)
    expect(await readFile(join(path, 'file.txt'), 'utf8')).toBe('committed\n')

    const failure = await executeToolFixture(context, {
      name: 'create_worktree', callId: ToolCallId('no-agent'), arguments: {}, signal: new AbortController().signal,
    })
    expect(failure.isError).toBe(true)
    expect(failure.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n')).toContain('requires a calling agent')
    expect(context.tools.get('create_worktree')!.presentCall!({ name: 'named' })).toEqual({ card: 'generic', title: 'create_worktree', rawInput: { name: 'named' } })
    const entry = [...context.loader.entries()].find(candidate => candidate.options.name === 'cordis:@ocean/ocean-experimental-tool-worktree')
    await entry!.fiber!.dispose()
    expect(context.tools.schemas().some(tool => tool.name === 'create_worktree')).toBe(false)
  })
})
