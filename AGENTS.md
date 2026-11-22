# AGENTS.md

Ocean is an all-plugin Cordis agent harness. Read [docs/architecture.md](docs/architecture.md) before changing `packages/`; follow [docs/AGENTS.md](docs/AGENTS.md) for documentation.

## Pre-stable APIs and released Session data

Public APIs are pre-stable; update every consumer. Follow [version/status](docs/session-format-status.md) and [type acknowledgements](docs/cookbook/reviewing-persistence-type-changes.md). Adjacent migration may add a version-named successor but never move, overwrite, or delete committed generations; predecessors imply neither fallback nor downgrade support. SQLite uses monotonic `SCHEMA_VERSION`.

Acknowledge [declared persistence-type changes](docs/cookbook/reviewing-persistence-type-changes.md).

Record each externally perceptible breaking change immediately in an [upgrade guide](.agents/skills/ocean-create-upgrade-guide/SKILL.md).

**Application launch.** Only `ocean` profiles launch supported Node apps; package bins, demos, and public SDK argv escapes are forbidden ([rule](docs/architecture.md#application-launch)).

## Repository layout

```
vendor/      Vendored Cordis (vendor/README.md)
packages/    @ocean/ocean-<pkg> workspaces at packages/<group>/<pkg>/
  core/                 agent/session API
  api/                  remote BFF
  typert/               type graphs
  llm/                  model providers
  shell/                command execution
  subprocess/           child-process management
  ssh/                  SSH execution providers
  terminal/             persistent terminals
  ptc-runtime/          PTC execution
  sandbox/              process confinement
  deliverables/         turn deliverables
  fs/                   filesystem access
  lsp/                  language servers
  skill/                skill loading
  web/                  search/fetch tools
  computer-use/         computer interaction
  browser-use/          browser interaction
  compaction/           context compaction
  context/              request context
  subagent/             delegated agents
  team/                 shared task coordination
  jobs/                 background jobs
  bundle/               profile bundles
  workflow/             workflow execution
  todo/                 todo_write tool
  plan/                 logged planning
  goal/                 session goals
  schedule/             scheduled follow-ups
  preset/               agent composition
  guard/                loop/tool guards
  extensions/           runtime self-modification
  session/              durable sessions
  session-query/        browsing/search/export
  attachment/           binary attachments
  spill/                output spill
  storage/              non-session storage
  workspace/            workspace entities
  feedback/             human feedback
  identity/             anonymous identity
  settings/             user settings
  credentials/          credentials/authorization
  acp/                  automation-only ACP
  interaction/          human interaction
  boot/                 application boot
  sdk/                  JSON-RPC SDK
  host/                 GUI host
  client/               GUI client
  mcp/                  external tools
  test-support/         test infrastructure
  util/                 zero-dependency utilities
python/      Python SDK/runtime (python/README.md)
native/      @deepseek-ai/node-addon-system source (native/README.md)
benchmarks/  performance gates
.agents/     Agent skills (.agents/skills/)
docs/        Documentation (docs/AGENTS.md)
scripts/     gates and generators
website/     VitePress documentation projection
```

Package groups: [packages/README.md](packages/README.md). Runtime packages need product use or an explicit [classification](scripts/product-package-policy.ts); `optional` packages ship as on-demand bundles, such as `@ocean/ocean-subagent-codex`.

## Commands

```sh
pnpm install            # pnpm workspaces, node >=24.9
pnpm run clean           # remove build outputs and safe residue from deleted packages
pnpm run test           # unit tests
pnpm run test:coverage  # CI coverage gate: per-file 100% on packages/*/*/src
pnpm run test:e2e       # real-API tests; self-skip without DEEPSEEK_API_KEY
pnpm run test:expected  # owner-local process expectations
pnpm run test:snapshot  # keyless recorded-session replay through shipped profiles; filter: -t <name>
pnpm run test:snapshot:record  # re-record expected outputs (needs key)
pnpm run typecheck
pnpm run lint
pnpm run duplication    # cross-file TypeScript clone detection
pnpm run build          # build:artifacts + build:check, concurrently
pnpm run build:artifacts # artifacts: tsc emits lib/types, tsdown bundles runtime, Web
pnpm run build:check    # typecheck aggregate tests/scripts against current build:artifacts output
pnpm run hygiene        # publint + workspace/package/dependency checks + NodeNext consumer check
pnpm run check:windows-wine  # ONLY when diagnosing a known Windows failure (needs wine); CI owns this signal
pnpm run doc-sync       # documentation gates (scripts/run-gates.ts)
pnpm run test:docs      # quick documentation checks (no build; doc-quick aggregate)
pnpm run website:build  # VitePress build (doubles as dead-link check)
pnpm ocean --profile headless "task"  # run one task from source (needs DEEPSEEK_API_KEY)
pnpm run demo:ptc -- "task"  # headless PTC mode run (needs key)
pnpm run dev:web | dev:desktop  # build:artifacts, then launch; Web also rebuilds client bundles on edits. start:web | start:desktop skip the build
make web|dev-web|desktop|dev-desktop|build  # the same commands; ARGS='--no-open' forwards options
```

### Host sandbox failures

If a required `gh`, `pnpm`, build, test, or generator command fails because the sandbox blocks credentials, network, IPC, watching, or nested `sandbox-exec`, retry unchanged with the narrowest host escalation. Require sandbox evidence; never bypass test failures or the product sandbox.

### Run relevant checks locally

Before pushing, follow [ocean-pre-push-checks](.agents/skills/ocean-pre-push-checks/SKILL.md); report only commands run. After `gh stack sync`, validate immediately; do not merge before checks pass.

- Match evidence to the surface: focused behavior tests, model/user-output snapshots, `doc-sync` for docs, built smokes for published paths, and real-API e2e for providers.
- Never default to the full suite or repeat a passing check for commit or push. CI owns exhaustive coverage and the platform matrix; rehearse all locally only by explicit request, for CI diagnosis, or for an irreducibly repository-wide change.
- `test:coverage`, not `test`, is the CI coverage gate ([why](docs/testing.md)).
- Develop with `build:artifacts`; before claiming completion, run `build:check` after the latest `build:artifacts`, or `build` ([layout](docs/development.md#typescript-project-layout)).
- **Web browser automation and GIF recording:** launch with `pnpm ocean web --patch apps/web/tests/pin-browse-picker.overlay.yml` to use the [in-page directory picker](apps/web/tests/pin-browse-picker.overlay.yml); omit this override only when testing native picker behavior explicitly.

## Secrets / .env

Windows packaging/signing: [required reading](apps/desktop/windows-signing/README.md).

Real-API tests/demos read `DEEPSEEK_API_KEY`, optional `DEEPSEEK_BASE_URL`, and root `.env`. cordis.yml allows `!!js` (never `!js`) under plugin `config` and entry `disabled`; other metadata stays literal, so conditional composition also uses overlays ([primer](docs/cordis-primer.md#loader-configuration)). Never commit credentials. CI e2e skips without a key; [testing.md](docs/testing.md) owns key policy.

## Conventions

- Packages use `@ocean/ocean-<name>`; vendor is [rescoped](docs/rescope.md) and `private: true`. Harness packages declare `@deepseek-ai/cordis` in `peerDependencies`/`devDependencies`. Workspace dependency sections use OCEAN `workspace:*`, vendor/native `workspace:~`.
- ESM everywhere (`"type": "module"`). Use package names across packages and `.ts` in local relative imports. Config subprocesses run built `lib/` under plain Node; source regressions use their declared launcher ([testing policy](docs/testing.md#test-subprocess-launch-modes)). The `ocean` CLI source launch runs through tsx's ESM-only hook (`node --import tsx/esm`); modules it reaches must stay ESM (no CJS-only exports). Raw/Web `cordis.yml` bare plugins must appear in their resolver manifest's `dependencies`; `verify-cordis-config` enforces it.
- **Registrations are effects**: every contribution goes through `ctx.effect()` / `ctx.on()`; a registry's `register()` returns the disposer, directly or through its documented registration handle.
- **Typed events use declaration merging** and merge-extensible maps. Event JSDoc needs `@mode` and payload `@param`. Public service methods document parameters and non-void returns. `SessionEventMap` members are required-on-read unless the envelope carries `ignorable: true`. Bump `SESSION_FORMAT_VERSION` only when existing discriminators cannot prevent unsafe interpretation; same-version changes require safe reader behavior.
- **Switch on discriminant tags.** Closed unions end in `assertNever`; merge-extensible unions fall through a documented default.
- **Waterfall listeners MUST call `next()`** to delegate; returning without it short-circuits the chain ([semantics](docs/cordis-primer.md#cordis-waterfall-semantics)).
- **Model-visible ⟺ logged**: anything that reaches a model request must be reconstructable from the session log; a new model-visible input requires a session event.
- **Session projections:** follow [ocean-session-projection](.agents/skills/ocean-session-projection/SKILL.md) when creating, extending, or reviewing one, or migrating a fold helper to one.
- **Plugins, not loop changes**: new behavior goes on documented extension points; changing `agent-loop` requires updating docs/architecture.md.
- **A capability seam comprises Service Definition / Service Provider / Consumer roles.** It is complete, never one role; split only when roles evolve independently ([glossary](docs/glossary.md#capability-seam)).
- **Prefer maintained dependencies over hand-rolling** when they genuinely delete owned code and tests.
- **Explicit > implicit at package boundaries**: defaulting is an explicit `resolve(request): Spec` step in the owning implementation, never a hidden `?? default` inside `run()` (the `ocean-shell` request/spec split is the template).
- **No hardcoded tunables in plugins**: deployment-varying choices are validated `Config` fields changeable from cordis.yml; a `DEFAULT_*` constant or test hook is not configurability. Protocol constants, external specs, and security invariants stay fixed.
- **Misconfiguration fails loud** at load when self-contained, otherwise at the earliest resolvable point; never silently skip a missing referent.
- **Opaque cross-boundary ids are branded** (`Branded<B>` from `ocean-brand`), never bare `string`.
- **Trust TypeScript at typed same-process boundaries.** Do not add runtime validation, fallback behavior, or hostile-input tests solely for values the static interface requires; validate at parser/config, queued, model/tool JSON, durable/file, worker, process, and wire boundaries.
- **No new assertions to `unknown`** (`as unknown` or `<unknown>`). Preserve or reduce the exact legacy baseline; use typed values or validation for replacements.
- **Source plane vs artifact plane, never mixed.** Static gates and tests resolve workspace imports through tsconfig `paths` to `src` and pass on a clean tree; gates consuming built `lib/` declare that dependency ([layout](docs/development.md#typescript-project-layout)).
- **Keep compiler faces explicit.** A package with both Host and Client programs exposes face-specific leaf configs and a solution-only root; repo-wide programs seed a face config, never the root solution ([layout](docs/development.md#typescript-project-layout)).
- **Error handling:** use typed, structured failures and localized, actionable reports. Coded errors and expected tool failures use `HarnessError`. Define handling ownership, containment, and failure guarantees; stop dependent work and visibly report untrusted state or unknown outcomes. Follow [ocean-error-handling](.agents/skills/ocean-error-handling/SKILL.md).
- **An empty `catch` names the error** and why; keep its `try` to one statement.
- **Keep comments local.** Do not restate code, expand unrelated comments, or explain distant behavior without local need ([rationale](.agents/skills/ocean-prose-standard/SKILL.md)).
- **Ban `prove` + `nance`**.
- **Prefer symmetry for parallel values**; unexplained asymmetry usually signals a missed extraction.
- **Tests describe behavior, not correctness.** Change obsolete behavior with its tests; explain why in the PR.
- **Official plugin artwork:** use [ocean-official-plugin-artwork](.agents/skills/ocean-official-plugin-artwork/SKILL.md) for official plugin icons; obtain designer approval before landing new glyphs.
- **Client UI copy is locale-owned.** Route product text through typed dictionaries and `t` or localized primitive props; `verify-client-ui-i18n` rejects hardcoded copy. English copy, including plugin titles, uses sentence case ([rule](.agents/skills/ocean-prose-standard/SKILL.md#required-coverage-by-prose-location)).
- **UI changes:** use [ocean-client-ui-ux](.agents/skills/ocean-client-ui-ux/SKILL.md) as the design and review entry point; load its references only as needed.
- **Testing policy** — [docs/testing.md](docs/testing.md). Every non-trivial model- or product-user-visible change updates a keyless recorded-session snapshot; [snapshot ownership](snapshots/AGENTS.md) reserves the top-level tree for session-driven cases and keeps other expected output owner-local. Fixtures replay on macOS/Linux; fix fixtures, not normalizers.
- **Design each tool's UI presentation up front.** Host presenters stay pure; Web cards derive from raw events and persisted result metadata ([cookbook](docs/cookbook/adding-a-tool.md)).
- **Plan unit, e2e, and snapshot coverage** for capability seams, lifecycle paths, and transcript output; include missing snapshot-harness support in the same change.
- **Both SDKs project the loop.** Agent-loop, session-lifecycle, and `SessionEventMap` changes update the TypeScript and Python SDK expected outputs in the same PR; `pnpm run test` covers neither ([surfaces](docs/testing.md#when-a-snapshot-test-is-required)).
- **Choose PR history deliberately.** Split independent changes and fix the introducing PR before propagation. Standalone/stack branches may merge-forward or rebase. Rewrites use `--force-with-lease`, abort on remote movement, never raw `--force`; preserve an in-progress merge-forward checkpoint before taking a newer base.
- **Labels:** one PR `kind/*`, all material `area/*`, and native Issue Type.
- **PR descriptions:** write and update every PR description with [ocean-pr-description](.agents/skills/ocean-pr-description/SKILL.md).
- TODO markers: `FIXME`/`TODO`/`XXX` by urgency ([semantics](docs/development.md)).
- Files end with exactly one trailing newline; `git diff --cached --check` (pre-commit) gates it.

## Defensive patterns

Read [docs/defensive-patterns/README.md](docs/defensive-patterns/README.md) before changing a package surface, remote service, client component or state, conversation or Session behavior, or lifecycle, concurrency, subprocess, and teardown code. Its [review principles](docs/defensive-patterns/README.md#why-these-rules) apply per artifact.

## Type safety and documentation

Everything compiles under `strict: true` with `noImplicitAny`; every remaining `any` explains why narrowing is infeasible. Every module and export has concise JSDoc for its non-obvious contract; function-like exports include `@param`/`@returns`, as enforced by `verify-export-jsdoc`. Heritage-declared members, plugin-protocol slots, and constructors keep their docs at the declaring Service Definition, protocol, or class.

Comments and docs state complete contracts and context, not reasoning transcripts. Use direct, concrete terms. Do not use metaphors. Before writing `contract`, `boundary`, or `shape`, ask whether a more exact term names the subject: write `response fields`, `JSON validation`, or `ESM exports` instead of `response shape`, `validation boundary`, or `module shape`. Keep `contract` for preconditions, postconditions, invariants, compatibility promises, and other obligations that callers, callees, implementers, providers, producers, or consumers rely on. Keep a literal process, wire, security, transaction, or lifecycle boundary. Do not narrate control flow or tests, preserve review history, or restate code. Keep behavior, failure, timing, ownership, and safe-use facts; link the rationale. Use [ocean-prose-standard](.agents/skills/ocean-prose-standard/SKILL.md) for decisions. Wire mechanically checkable invariants into an executed top-level gate and prove each changed acceptance path rejects an invalid case. Use narrow, justified exceptions instead of disabling a rule globally.

Docs accompany every code change: update affected README and JSDoc contracts together. Routine bilingual work follows [docs/AGENTS.md](docs/AGENTS.md); only explicit user invocation may run `ocean-translate-docs`. Current-state prose, one physical line per paragraph, one home per fact, and word budgets live there.

## Editing these instructions

`CLAUDE.md` symlinks `AGENTS.md` at root and `packages/`; edit the real file. Keep each rule self-contained while linking high-level docs. Condense when clarity survives; raise a `verify-doc-budgets` ceiling when the required content genuinely needs more space.

## Vendoring policy

`vendor/` packages are pinned source copies (manifest with upstream SHAs in [vendor/README.md](vendor/README.md)). Update via the sync procedure there; re-apply or retire the logged local modifications; rerun `pnpm run test && pnpm run build`.

## Универсальные правила работы агента

Правила ниже применимы к любому проекту. Проектные AGENTS.md имеют приоритет и уточняют их под конкретную кодовую базу.

### Неприкосновенные правила

1. Без лести и филлеров. Никаких «отличный вопрос», «вы абсолютно правы». Сразу ответ или действие.
2. Не соглашайся с неверной предпосылкой пользователя — скажи об этом до начала работы.
3. Никогда не выдумывай: ни пути к файлам, ни имена сущностей, ни формы API, ни результаты тестов. Не знаешь — прочитай файл, запусти команду или скажи «не знаю, проверю».
4. Запутался — остановись. Две равнозначные трактовки — спроси, не выбирай молча.
5. Трогай только то, что необходимо. Каждая изменённая строка должна выводиться из запроса. Никаких попутных рефакторингов и «заодно почистил».

### Перед написанием кода

- Сформулируй план в 1–2 предложениях; для нетривиального — нумерованный список шагов с проверкой для каждого.
- Прочитай файлы, которые будешь трогать, и файлы, которые их вызывают. Разведку — через субагентов, чтобы не засорять основной контекст.
- Следуй существующим паттернам кодовой базы, даже если в новом проекте сделал бы иначе.
- Озвучивай предположения явно, не прячь их в реализацию.
- Есть два подхода — покажи оба с трейдоффами (кроме тривиальных задач).

### Простота прежде всего

- Минимум кода, решающий поставленную задачу. Ничего спекулятивного.
- Никаких фич сверх запрошенного, абстракций для одноразового кода, незапрошенной конфигурируемости и хуков.
- Не обрабатывай невозможные сценарии — только реальные отказы.
- Решение на 200 строк можно сжать до 50 — перепиши до показа.
- «На будущее» — стоп. Будущая расширяемость — будущее решение.
- Удалять код предпочтительнее, чем добавлять.
- Тест: назвал бы сеньор этот diff переусложнённым? Если да — упрости.

### Хирургические изменения

- Не «улучшай» соседний код, комментарии, форматирование, импорты вне задачи.
- Не рефактори рабочий код только потому, что открыл файл.
- Не удаляй существующий мёртвый код без просьбы — упомяни в итогах.
- Убирай сирот, созданные твоими же правками (неиспользуемые импорты, переменные, функции).
- Точно соблюдай стиль проекта: отступы, кавычки, нейминг, раскладку файлов.
- Тест: каждая строка выводится из запроса; не выводится — откати.

### Исполнение от цели

- Переформулируй размытое в проверяемое: «добавь валидацию» → «схема + подключение к валидатору + тесты на невалидный ввод»; «почини баг» → «падающий тест, воспроизводящий симптом, затем сделать зелёным»; «отрефактори X» → «тесты проходят до и после, публичный API не изменился».
- Критерии успеха — до кода. Напиши проверку, запусти, прочитай вывод. Не заявляй успех без проверки.
- Упало — чини причину, а не тест.

### Инструменты и верификация

- Запускай код, а не гадай о нём. Есть тесты — гоняй.
- «Готово» по правдоподобному diff — нельзя. Правдоподобие ≠ корректность.
- Отлаживай корневую причину, а не симптом. Подавить ошибку — не значит починить.
- Читай логи, ошибки и стек-трейсы целиком.

### Гигиена сессии

- Контекст — ограничение. Длинная сессия с накопленными неудачами хуже свежей с точным промптом.
- После двух неудачных исправлений одного и того же — стоп, подведи итог и попроси сбросить сессию с более точным промптом.
- Субагенты для разведки, которая иначе засорит контекст десятками чтений файлов.
- Коммиты: тема < 72 символов, тело объясняет «почему», conventional commits.

### Стиль общения

- Прямо, не дипломатично. «Это не масштабируется, потому что X» лучше «интересный подход, но не думали ли вы…».
- Кратко по умолчанию: 2–3 абзаца, если не просят глубже.
- Есть чёткий ответ — дай. Нет — скажи об этом и дай трейдоффы.
- Без лишних буллетов, незваных заголовков и эмодзи.

### Когда спрашивать, когда действовать

- Спрашивай: две равнозначные трактовки, влияющие на результат; изменение общих контрактов/интерфейсов между модулями или сервисами; нужны креды, секреты или прод-ресурсы без доступа; цель пользователя и буквальный запрос противоречат.
- Действуй без спроса: тривиально и обратимо; неоднозначность снимается чтением кода или командой; пользователь уже отвечал на это в сессии.

### Цикл самоулучшения

- После ошибки агента: не хватало правила — добавь конкретное («всегда используй X для Y», не «будь осторожен с Y»); правило проигнорировано — ужесточь или подними выше.
- Периодически прореживай: «удаление этой строки приведёт к ошибке агента?» Если нет — удали.
