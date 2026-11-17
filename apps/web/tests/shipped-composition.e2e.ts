import { executeToolFixture, executeModelToolFixture } from '@ocean/ocean-tool-testkit'
// Boots the shipped Web composition over the built dist this lane already uses
// and asserts its catalog, defaults, and Loader lifecycle. Browser scenarios in
// this lane own visual behavior.
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it } from 'vitest'
import { ToolCallId } from '@ocean/ocean-llm'
import { canonicalPath, writableRoots } from '@ocean/ocean-sandbox'
import { SessionId } from '@ocean/ocean-session'
// These imports carry the tools/sandboxPolicy/approval Context merges.
import { RUN_CODE_NAME } from '@ocean/ocean-tools'
import type {} from '@ocean/ocean-sandbox-policy'
import type {} from '@ocean/ocean-user-approval'
import type {} from '@ocean/ocean-permission-presets'
import type {} from '@ocean/ocean-agent-preset-registry'
import type {} from '@ocean/ocean-commands'
import type {} from '@ocean/ocean-system-prompt'
import type {} from '@ocean/ocean-terminal'
import { launchWebScaffold, type WebScaffold } from './scaffold.ts'

const FILE_REFERENCE_PROMPT = fileURLToPath(new URL(
  './expected/web-runtime-context/file-reference-prompt.expected.md', import.meta.url,
))

/**
 * The catalog the shipped Web composition puts in front of the model, minus the
 * ripgrep-dependent pair below. The absences are deliberate, not incidental
 * gaps: the `cordis_*` toolset executes model-written JavaScript that no
 * sandbox row confines, and `mcp_*` servers spawn outside `ctx.shell`.
 * `web_fetch` is present because it adds no network reach beyond the
 * mounted shell tools. The composition and its sources are declared by the
 * shipped bundle patches.
 */
const EXPECTED_TOOLS = [
  'ask_user_question',
  'bash',
  'create_goal',
  'edit',
  'exit_plan_mode',
  'get_goal',
  'job_kill',
  'job_list',
  'job_output',
  'list_agents',
  'list_subagent_models',
  'office_convert',
  'office_recalculate',
  'office_render',
  'plugin_manager',
  'present',
  'read',
  'read_image',
  'schedule_create',
  'schedule_edit',
  'schedule_list',
  'schedule_view',
  'send_message',
  'skill',
  'subagent',
  'subagent_fork',
  'team_task_create',
  'team_task_get',
  'team_task_list',
  'team_task_update',
  'todo_write',
  'update_goal',
  'wait_agent',
  'web_fetch',
  'web_search',
  'workflow',
  'working_directory',
  'write',
]

/**
 * `glob` and `grep` come from `ocean-tool-fs-search`, which spawns the PACKAGED
 * ripgrep binary (`@vscode/ripgrep`) through the subprocess seam, so the pair
 * is always present on every host — asserted as fixed members, not a host
 * dependency.
 */
const RIPGREP_TOOLS = ['glob', 'grep']

let scaffold: WebScaffold | undefined

afterEach(async () => {
  try {
    await scaffold?.close()
  } finally {
    scaffold = undefined
  }
})

it('assembles the shipped Web transport, catalog, guidance, and defaults', async () => {
  scaffold = await launchWebScaffold({ deepSeekMissingCredential: true })
  const ctx = scaffold.ctx
  expect(ctx.llm.listProviders().some(provider => provider.id === 'deepseek-messages')).toBe(false)
  expect(ctx.agentDefaultModel.currentSelection()).toEqual({ provider: 'deepseek-official', model: 'deepseek-flash' })
  const index = await fetch(`http://127.0.0.1:${String(ctx.webServer.port)}`, {
    headers: { 'accept-encoding': 'gzip' },
  })
  expect(index.headers.get('content-encoding')).toBe('gzip')
  expect(index.headers.get('vary')).toContain('Accept-Encoding')
  await index.body?.cancel()
  expect(ctx.llm.providerRetryPolicy('deepseek-official')).toMatchInlineSnapshot(`
    {
      "initialDelayMs": 500,
      "jitterRatio": 0.1,
      "maxDelayMs": 10000,
      "maxRetries": 5,
      "mode": "normal",
      "retryableCodes": [
        "EMPTY_RESPONSE",
        "RATE_LIMIT",
        "SERVER",
        "TIMEOUT",
        "TRANSPORT",
      ],
    }
  `)
  await ctx.settings.update('llm-deepseek', {
    retryPolicy: { mode: 'always', maxRetries: 5 },
  })
  expect(ctx.llm.providerRetryPolicy('deepseek-official')).toMatchInlineSnapshot(`
    {
      "initialDelayMs": 500,
      "jitterRatio": 0.1,
      "maxDelayMs": 10000,
      "mode": "always",
    }
  `)
  await ctx.settings.update('llm-pi-ai', {
    providers: {
      openai: {},
      anthropic: { retryPolicy: { mode: 'always' } },
    },
  })
  expect(ctx.llm.providerRetryPolicy('openai')).toMatchInlineSnapshot(`
    {
      "initialDelayMs": 500,
      "jitterRatio": 0.1,
      "maxDelayMs": 10000,
      "maxRetries": 5,
      "mode": "normal",
      "retryableCodes": [
        "EMPTY_RESPONSE",
        "RATE_LIMIT",
        "SERVER",
        "TIMEOUT",
        "TRANSPORT",
      ],
    }
  `)
  expect(ctx.llm.providerRetryPolicy('anthropic')).toMatchInlineSnapshot(`
    {
      "initialDelayMs": 500,
      "jitterRatio": 0.1,
      "maxDelayMs": 10000,
      "mode": "always",
    }
  `)
  // Directory and conditional Team tools are global; presets supply the remaining registrations.
  expect(ctx.tools.schemas().map(schema => schema.name)).toEqual([
    'working_directory', 'team_task_create', 'team_task_list', 'team_task_get', 'team_task_update',
  ])
  const handle = await ctx.agents.create({
    sessionId: SessionId('shipped-composition'),
    setup: agentCtx => ctx.agentPresets.mount(agentCtx).then(() => undefined),
  })
  try {
    const names = ctx.tools.schemas(handle.agent).map(schema => schema.name).sort()
    expect(names.filter(name => !RIPGREP_TOOLS.includes(name))).toEqual(EXPECTED_TOOLS)
    // The packaged ripgrep binary ships with the dependency, so the pair is a
    // fixed roster member on every host.
    expect(names.filter(name => RIPGREP_TOOLS.includes(name))).toEqual(RIPGREP_TOOLS)
    const fileReferenceSection = (await ctx.systemPrompt.assemble({ scope: handle.agent })).sections
      .find(section => section.name === 'ui:deliverable-file-references')
    expect(fileReferenceSection?.text).toBe(readFileSync(FILE_REFERENCE_PROMPT, 'utf8').trimEnd())
  } finally {
    await handle.dispose()
  }
  // `workspace-write` is not "the workspace and nothing else": the shared roots
  // helper always admits the temp directories too. Pinning it against an
  // explicit mode keeps the claim independent of this surface's default, and
  // keeps a future sandbox-confinement test from being run inside /tmp — where an
  // "escape" write succeeds by design and reads as a sandbox failure.
  expect(writableRoots(scaffold.ctx.sandboxPolicy.resolve({ mode: 'workspace-write' }))).toEqual(
    expect.arrayContaining([canonicalPath('/tmp'), canonicalPath(tmpdir())]),
  )
  expect(scaffold.ctx.sandboxPolicy.defaultMode).toBe('workspace-write')
  expect(scaffold.ctx.approval.config.policy).toBe('ask')
  expect(scaffold.ctx.permissionPresets.defaultPreset).toBe('workspace-write')
  expect(scaffold.ctx.permissionPresets.names).toEqual([
    'read-only',
    'workspace-write',
    'danger-full-access',
  ])
  const commandHandle = await scaffold.ctx.agents.create({
    sessionId: SessionId('shipped-command-catalog'),
    meta: { cwd: scaffold.workspaceCwd },
    agentOptions: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
  })
  try {
    expect(scaffold.ctx.commands.list(commandHandle.agent)).toContainEqual({
      definitionId: '@ocean/ocean-command-feedback',
      name: 'feedback',
      description: 'Record feedback about this session',
      input: { hint: '<text>' },
    })
  } finally {
    await commandHandle.dispose()
  }
}, 120_000)

it('ships PTC with run_code but without the general workflow SDK binding', async () => {
  scaffold = await launchWebScaffold({ deepSeekMissingCredential: true })
  const ctx = scaffold.ctx
  const handle = await ctx.agents.create({
    sessionId: SessionId('shipped-ptc-composition'),
    setup: agentCtx => ctx.agentPresets.mount(agentCtx, 'ptc').then(() => undefined),
  })
  try {
    const assembly = await ctx.systemPrompt.assemble({ scope: handle.agent })
    expect(assembly.tools.map(tool => tool.name)).toEqual([RUN_CODE_NAME])
    const sdk = assembly.sections.find(section => section.name === 'tools:sdk')?.text ?? ''
    expect(sdk).not.toContain('  workflow: {')
  } finally {
    await handle.dispose()
  }
}, 120_000)

it('lets a preset producer reach the background-job registry', async () => {
  scaffold = await launchWebScaffold()
  const ctx = scaffold.ctx
  const handle = await ctx.agents.create({
    sessionId: SessionId('shipped-background-job'),
    meta: { cwd: scaffold.workspaceCwd },
    setup: agentCtx => ctx.agentPresets.mount(agentCtx).then(() => undefined),
  })
  try {
    const signal = new AbortController().signal
    // `tool-bash` is a preset row and `tasks` is a host registry; the producer
    // resolves it with `ctx.get`, so a registry hidden behind a preset realm
    // fails here — with every task control still listed in the catalog above.
    const started = await executeModelToolFixture(ctx, {
      signal,
      callId: ToolCallId('shipped-bash-background'),
      name: 'bash',
      arguments: {
        command: 'printf SHIPPED_BACKGROUND_OK',
        description: 'shipped background probe',
        run_in_background: true,
      },
      agent: handle.agent,
    })
    const reported = started.content.map(block => block.type === 'text' ? block.text : '').join('')
    const matched = /^started background job (bash-[0-9a-f]{16})$/.exec(reported)
    if (matched === null) throw new Error(`background bash reported no job id: ${reported}`)
    const jobId = matched[1]
    expect({ isError: started.isError, content: started.content }).toEqual({
      isError: false,
      content: [{ type: 'text', text: `started background job ${jobId}` }],
    })

    // The controller reads what the producer started: same registry, one
    // owner. A per-preset registry would list nothing here even on success.
    const listed = await executeToolFixture(ctx, {
      signal,
      callId: ToolCallId('shipped-task-list'),
      name: 'job_list',
      arguments: {},
      agent: handle.agent,
    })
    expect(listed.isError).toBe(false)
    expect(listed.content).toHaveLength(1)
    expect(listed.content[0]?.type === 'text' ? listed.content[0].text : '').toContain(`${jobId} [bash]`)

    // The full round trip: the output a host-plane producer wrote is collected
    // through a preset-plane control, which is the linkage the realm severed.
    const collected = await executeToolFixture(ctx, {
      signal,
      callId: ToolCallId('shipped-task-output'),
      name: 'job_output',
      arguments: { job_id: jobId, wait: true },
      agent: handle.agent,
    })
    expect(collected.isError).toBe(false)
    expect(collected.content).toEqual([
      { type: 'text', text: expect.stringContaining('SHIPPED_BACKGROUND_OK') as unknown as string },
    ])
  } finally {
    await handle.dispose()
  }
}, 120_000)
