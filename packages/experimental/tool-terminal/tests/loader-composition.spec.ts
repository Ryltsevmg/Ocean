import { executeToolFixture } from '@ocean/ocean-tool-testkit'
import * as NativeToolExecutor from '@ocean/ocean-tool-executor-native'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { unsupportedModel, provideWorkingDirectoryFixture, unsupportedInbox } from '@ocean/ocean-agent-loop-testkit'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { ToolCallId } from '@ocean/ocean-llm'
import { Session, SessionId } from '@ocean/ocean-session'
import AgentRegistry from '@ocean/ocean-agent'
import type { Agent } from '@ocean/ocean-agent'
import SystemPrompt from '@ocean/ocean-system-prompt'
import ToolRuntime from '@ocean/ocean-tools'
import TerminalSessionService from '@ocean/ocean-terminal'
import SandboxProvider from '@ocean/ocean-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@ocean/ocean-sandbox'
import SandboxPolicyService from '@ocean/ocean-sandbox-policy'
import SessionProjectionRegistry from '@ocean/ocean-session-projection'
import LocalSubprocessRuntime from '@ocean/ocean-subprocess-local'
import * as TerminalLocal from '@ocean/ocean-terminal-bash'
import * as ToolPty from '@ocean/ocean-tool-terminal'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

class PassthroughSandbox extends SandboxProvider {
  async confine(argv: readonly string[], _policy: SandboxPolicy): Promise<ConfinedArgv> {
    return { argv: [...argv], enforcement: 'full', denialSignatures: [], runnerFailureRules: [] }
  }
}

async function agent(ctx: Context): Promise<Agent> {
  const scope = ctx.plugin(() => {})
  const id = SessionId('pty-loader-agent')
  const session = Session.create(id)
  const value: Agent = {
    id, options: {}, session, model: unsupportedModel(),
    inbox: unsupportedInbox(),
    status: 'idle',
    ctx: scope.ctx,
    send: () => {},
    followup: () => {}, steer: () => {}, inject: () => {}, cancel() {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  await ctx.agents.register(value)
  return value
}

function resultText(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

const suite = process.platform === 'linux' || process.platform === 'darwin' ? describe : describe.skip

suite('terminal real Loader composition through cordis.yml', () => {
  it('boots cordis.yml and preserves shell state across real tool calls', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-pty-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@ocean/ocean-agent'",
      "- name: '@ocean/ocean-system-prompt'",
      "- name: '@ocean/ocean-tools'",
      "- name: '@ocean/ocean-tool-executor-native'",
      "- name: '@ocean/ocean-terminal'",
      "- name: '@ocean/ocean-test-sandbox'",
      "- name: '@ocean/ocean-session-projection'",
      "- name: '@ocean/ocean-sandbox-policy'",
      '  config:',
      '    mode: danger-full-access',
      `    workspaceRoot: ${JSON.stringify(root)}`,
      "- name: '@ocean/ocean-subprocess-local'",
      "- name: '@ocean/ocean-terminal-bash'",
      '  config:',
      '    pollIntervalMs: 10',
      '    exactProbeAfterMs: 20',
      '    idleSilenceMs: 250',
      '    handoffGraceMs: 250',
      '    timeoutMs: 2000',
      '    disposeGraceMs: 500',
      "- name: '@ocean/ocean-tool-terminal'",
      '',
    ].join('\n'))

    context = new Context()

    provideWorkingDirectoryFixture(context)
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@ocean/ocean-agent', AgentRegistry],
      ['@ocean/ocean-system-prompt', SystemPrompt],
      ['@ocean/ocean-tools', ToolRuntime],
      ['@ocean/ocean-tool-executor-native', NativeToolExecutor],
      ['@ocean/ocean-terminal', TerminalSessionService],
      ['@ocean/ocean-test-sandbox', PassthroughSandbox],
      ['@ocean/ocean-session-projection', SessionProjectionRegistry],
      ['@ocean/ocean-sandbox-policy', SandboxPolicyService],
      ['@ocean/ocean-subprocess-local', LocalSubprocessRuntime],
      ['@ocean/ocean-terminal-bash', TerminalLocal],
      ['@ocean/ocean-tool-terminal', ToolPty],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await context.loader.await()

    const owner = await agent(context)
    const signal = new AbortController().signal
    const spawn = await executeToolFixture(context, {
      signal, callId: ToolCallId('spawn'), name: 'terminal_open', arguments: { type: 'shell', name: 'main', cwd: root }, agent: owner,
    })
    expect(resultText(spawn)).toContain('started terminal session pty-1 (main)')

    await executeToolFixture(context, {
      signal, callId: ToolCallId('state'), name: 'terminal_send', arguments: { sessionId: 'pty-1', text: 'export KEEP=loader; cd /' }, agent: owner,
    })
    const read = await executeToolFixture(context, {
      signal, callId: ToolCallId('read'), name: 'terminal_send', arguments: { sessionId: 'pty-1', text: 'printf "cwd=%s keep=%s\\n" "$PWD" "$KEEP"' }, agent: owner,
    })
    expect(resultText(read)).toContain('cwd=/ keep=loader')
    expect(context.terminals.list(owner)).toHaveLength(1)
  }, 15_000)
})
