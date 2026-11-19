/** Curated plugin descriptions. The Host supplies install targets separately from this editorial list. */

/**
 * @typedef {object} MarketEntry
 * @property {string} name npm package name of the plugin's primary bundle; the key the plugin manager lists it under.
 * @property {string[]} [aliases] Alternate package names for a complete copy of the same plugin.
 * @property {string} version Version this catalogue expects; shown when the bundle is not installed and used to
 *   recognise a build that carries an older copy.
 * @property {Record<string, string>} title Localized card title, English fallback required.
 * @property {Record<string, string>} summary Localized one-liner, English fallback required.
 * @property {{ about: Record<string, string>, points: Record<string, string>[] }} details Localized popup copy: one
 *   paragraph and a short list of what the bundle does.
 * @property {boolean} [self] The market itself; its card carries no management actions.
 */

/** Catalogue order is display order. */
export const CATALOG = /** @type {readonly MarketEntry[]} */ ([
  {
    name: '@ocean/ocean-super-agent',
    version: '0.2.5',
    title: { en: 'Super Agent', ru: 'Super Agent' },
    summary: {
      en: 'Persistent developer task board: a shared board, a repository executor and the preset that runs issues end to end.',
      ru: 'Постоянная доска задач разработки: общая доска, исполнитель репозитория и пресет, проводящий задачу от issue до проверки.',
    },
    details: {
      about: {
        en: 'A task board that outlives the session: work stays on the board, and an executor picks an issue up in an isolated Git worktree, runs the repository checks and reports the result.',
        ru: 'Доска задач, которая живёт дольше сессии: работа остаётся на доске, а исполнитель берёт задачу в изолированном git-ворктри, прогоняет проверки репозитория и сообщает результат.',
      },
      points: [
        { en: 'Board shared between the Web panel and the agent', ru: 'Доска, общая для веб-панели и агента' },
        { en: 'One issue per worktree, with the repository checks as the acceptance gate', ru: 'Одна задача — один ворктри, приёмка по проверкам репозитория' },
        { en: 'Brings its own agent preset for end-to-end runs', ru: 'Свой пресет агента для сквозного прогона' },
      ],
    },
  },
  {
    name: '@ocean/ocean-remotion-studio',
    version: '1.0.0',
    title: { en: 'Remotion studio', ru: 'Remotion studio' },
    summary: {
      en: 'Reel studio: scaffold a Remotion project, preview it in Studio and render an MP4.',
      ru: 'Студия роликов: развернуть проект Remotion, посмотреть в Studio и отрендерить MP4.',
    },
    details: {
      about: {
        en: 'Bundles the reel skills with the tools they drive: a project is scaffolded from a template, previewed in Remotion Studio and rendered to a file without leaving the conversation.',
        ru: 'Поставляет навыки для роликов вместе с инструментами: проект разворачивается из шаблона, смотрится в Remotion Studio и рендерится в файл, не выходя из диалога.',
      },
      points: [
        { en: 'Template project scaffolded without running a script', ru: 'Проект из шаблона без запуска скриптов' },
        { en: 'Studio started as a managed child and served locally', ru: 'Studio запускается управляемым процессом локально' },
        { en: 'Render returns a job id, so a long encode never blocks', ru: 'Рендер возвращает id задачи и не блокирует диалог' },
      ],
    },
  },
  {
    name: '@local/ocean-adp',
    version: '1.0.0',
    title: { en: 'Agent Developer Patterns', ru: 'Паттерны разработки агентов' },
    summary: {
      en: 'Bundles the ocean-adp skill: pick a development phase, get one ready procedure for it.',
      ru: 'Поставляет навык ocean-adp: определяет фазу задачи и даёт готовую процедуру под неё.',
    },
    details: {
      about: {
        en: 'A dispatcher skill for non-trivial work: it names the phase you are in and hands over one self-contained procedure — plan, interview, TDD, hypothesis-driven debugging, review or handoff.',
        ru: 'Навык-диспетчер для нетривиальной работы: определяет фазу задачи и выдаёт одну самодостаточную процедуру — план, интервью, TDD, отладку через гипотезы, ревью или handoff.',
      },
      points: [
        { en: 'Phase → procedure, with a completion criterion for each', ru: 'Фаза → процедура, у каждой свой критерий завершения' },
        { en: 'Works from the bundle alone; extra skill sets are optional', ru: 'Работает из самого бандла; внешние наборы скиллов необязательны' },
        { en: 'Any project or user copy of the same name overrides it', ru: 'Проектная или пользовательская копия с тем же именем переопределяет его' },
      ],
    },
  },
  {
    name: '@ocean/ocean-browser-control',
    version: '1.0.0',
    title: { en: 'Browser control', ru: 'Управление браузером' },
    summary: {
      en: 'Session-owned tabs in a paired Chromium through a local relay, with a setup panel and an Ocean-branded extension.',
      ru: 'Вкладки сессии в привязанном Chromium через локальный релей, панель настройки и расширение под брендом Ocean.',
    },
    details: {
      about: {
        en: 'Gives each session its own tabs in a paired Chromium: navigation, snapshots and actions travel over a local relay, and the panel pairs the browser and accepts only the origins you allow.',
        ru: 'Даёт каждой сессии собственные вкладки в привязанном Chromium: навигация, снимки и действия идут через локальный релей, а панель привязывает браузер и принимает только разрешённые вами источники.',
      },
      points: [
        { en: 'Tabs belong to one session, not to the whole profile', ru: 'Вкладки принадлежат одной сессии, а не всему профилю' },
        { en: 'Allowed origins are an explicit allowlist', ru: 'Разрешённые источники — явный список' },
        { en: 'Ships the Ocean-branded Chrome extension fork', ru: 'В комплекте форк расширения Chrome под брендом Ocean' },
      ],
    },
  },
  {
    name: '@ocean/ocean-cua-bundle',
    aliases: ['@ocean/ocean-computer-use-bundle'],
    version: '1.0.0',
    title: { en: 'Computer Use', ru: 'Computer Use' },
    summary: {
      en: 'Desktop control on macOS, Windows and Linux AT-SPI: observe the screen and operate native applications.',
      ru: 'Управление рабочим столом на macOS, Windows и Linux AT-SPI: наблюдение за экраном и работа с нативными приложениями.',
    },
    details: {
      about: {
        en: 'Drives native applications: it reads windows and accessibility trees, then clicks, types and scrolls where the task says. Screen access and input are separate permissions, and both are requested from the system.',
        ru: 'Управляет нативными приложениями: читает окна и деревья доступности, затем кликает, печатает и прокручивает там, где требует задача. Доступ к экрану и вводу — разные разрешения, оба запрашиваются у системы.',
      },
      points: [
        { en: 'macOS accessibility and screen recording, Windows UIA, Linux AT-SPI', ru: 'macOS accessibility и запись экрана, Windows UIA, Linux AT-SPI' },
        { en: 'Typed, structured observations instead of blind coordinate clicks', ru: 'Структурированные наблюдения вместо слепых кликов по координатам' },
        { en: 'Permission prompts stay with the operating system', ru: 'Разрешения выдаются средствами системы' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-picker',
    version: '1.0.0',
    title: { en: 'Theme picker', ru: 'Выбор темы' },
    summary: {
      en: 'One page for every palette: switch themes from the bundle settings and the interface repaints immediately.',
      ru: 'Одна страница для всех палитр: тема переключается в настройках бандла, и интерфейс сразу перекрашивается.',
    },
    details: {
      about: {
        en: 'Embeds every palette under plugins/theme-* at build time, lists them on the bundle page in Plugins, and applies the choice through one override-token layer that is replaced on each switch.',
        ru: 'Встраивает все палитры из plugins/theme-* при сборке, показывает их на странице бандла в Plugins и применяет выбор через один слой override-токенов, который заменяется при каждом переключении.',
      },
      points: [
        { en: 'Every palette in one bundle instead of one bundle per palette', ru: 'Все палитры в одном бандле вместо бандла на палитру' },
        { en: 'Light and dark variants switch with Appearance', ru: 'Светлый и тёмный варианты следуют за «Оформлением»' },
        { en: 'The chosen layer replaces the previous one instead of stacking', ru: 'Выбранный слой заменяет предыдущий, а не наслаивается' },
      ],
    },
  },
  {
    name: '@ocean/ocean-codex',
    version: '0.1.0',
    title: { en: 'Codex', ru: 'Codex' },
    summary: {
      en: 'ChatGPT plan accounts as a native provider: OAuth sign-in, account catalog and model discovery.',
      ru: 'Аккаунты ChatGPT Plan как нативный провайдер: вход по OAuth, каталог аккаунта и обнаружение моделей.',
    },
    details: {
      about: {
        en: 'Registers ChatGPT plan accounts through the verified plan OAuth flow, reads the visible model catalog and routes inference through Ocean\'s native LLM services.',
        ru: 'Подключает аккаунты ChatGPT Plan через проверенный OAuth-поток, читает каталог видимых моделей и направляет инференс через нативные LLM-сервисы Ocean.',
      },
      points: [
        { en: 'Recoverable OAuth sign-in with PKCE, state and nonce', ru: 'Восстанавливаемый вход по OAuth с PKCE, state и nonce' },
        { en: 'Account model catalog with duplicate and hidden-row handling', ru: 'Каталог моделей аккаунта с обработкой дублей и скрытых строк' },
        { en: 'Usage link, never invented quota percentages', ru: 'Ссылка на Usage без выдуманных процентов квоты' },
      ],
    },
  },
  {
    name: '@ocean/ocean-experimental-auto-review',
    version: '1.0.0',
    title: { en: 'Auto review', ru: 'Авто-ревью' },
    summary: {
      en: 'Reviews each tool call against the user\'s request in the Auto preset before the loop continues.',
      ru: 'Проверяет каждый вызов инструмента на соответствие запросу пользователя в пресете Auto до продолжения цикла.',
    },
    details: {
      about: {
        en: 'Runs a review pass after a tool call: a mismatch between the request and what the tool is about to do can stop the loop and report the concern.',
        ru: 'Выполняет проверку после вызова инструмента: расхождение между запросом и тем, что делает инструмент, может остановить цикл и сообщить о проблеме.',
      },
      points: [
        { en: 'Works with the Auto agent preset', ru: 'Работает с пресетом агента Auto' },
        { en: 'Reviews the tool call against the active request', ru: 'Сверяет вызов инструмента с активным запросом' },
        { en: 'Offline tests cover allowed and refused calls', ru: 'Офлайн-тесты покрывают разрешённые и отклонённые вызовы' },
      ],
    },
  },
  {
    name: '@ocean/ocean-experimental-inspector-profile',
    version: '1.0.0',
    title: { en: 'Developer tools', ru: 'Инструменты разработчика' },
    summary: {
      en: 'Session and Chat inspectors, a CDP hub and per-turn context and cost statistics.',
      ru: 'Инспекторы сессий и Chat-узлов, CDP-hub и статистика контекста и стоимости по ходам.',
    },
    details: {
      about: {
        en: 'Adds the inspection surface used while developing Ocean plugins: raw session logs, Chat node inspection and per-turn context and cost figures. The CDP hub starts only when explicitly enabled.',
        ru: 'Добавляет инструменты для разработки плагинов Ocean: сырые логи сессий, инспекцию Chat-узлов и статистику контекста и стоимости по ходам. CDP-hub запускается только при явном включении.',
      },
      points: [
        { en: 'Session logs and Chat node inspection', ru: 'Логи сессий и инспекция Chat-узлов' },
        { en: 'Context and cost statistics per turn', ru: 'Статистика контекста и стоимости по ходам' },
        { en: 'CDP hub behind an explicit switch', ru: 'CDP-hub за явным переключателем' },
      ],
    },
  },
  {
    name: '@ocean/ocean-experimental-forge-bundle',
    version: '1.0.0',
    title: { en: 'Forge', ru: 'Forge' },
    summary: {
      en: 'Change-request panel and Git worktrees for Sessions, with GitHub through the CLI.',
      ru: 'Панель запросов на изменение и git-ворктри для сессий, GitHub через CLI.',
    },
    details: {
      about: {
        en: 'Turns a Session in a Git repository into a change request: a task gets its own worktree, the changes are prepared and GitHub is reached through the authenticated CLI.',
        ru: 'Превращает сессию в git-репозитории в запрос на изменение: задача получает собственный ворктри, изменения готовятся, а GitHub доступен через авторизованный CLI.',
      },
      points: [
        { en: 'One issue per Git worktree', ru: 'Одна задача — один git-ворктри' },
        { en: 'Change-request panel beside the Session', ru: 'Панель запроса на изменение рядом с сессией' },
        { en: 'GitHub operations through the authenticated CLI', ru: 'Операции GitHub через авторизованный CLI' },
      ],
    },
  },
  {
    name: '@ocean/ocean-experimental-session-titles-bundle',
    version: '1.0.0',
    title: { en: 'Session titles', ru: 'Заголовки сессий' },
    summary: {
      en: 'Session titles that follow every prompt instead of only the first one.',
      ru: 'Заголовки сессий, которые следуют за каждым промптом, а не только за первым.',
    },
    details: {
      about: {
        en: 'Replaces the core first-prompt title with a title refreshed from the conversation, so a session keeps a name that matches its current work.',
        ru: 'Заменяет базовый заголовок по первому промпту на заголовок, обновляемый по разговору, чтобы имя сессии соответствовало текущей работе.',
      },
      points: [
        { en: 'Titles follow every prompt, not only the first', ru: 'Заголовки следуют за каждым промптом, а не только за первым' },
        { en: 'Uses the configured language model', ru: 'Использует настроенную языковую модель' },
        { en: 'Offline provider tests cover refresh and fallback', ru: 'Офлайн-тесты провайдера покрывают обновление и fallback' },
      ],
    },
  },
  {
    name: '@ocean/ocean-experimental-voice-input-bundle',
    version: '1.0.0',
    title: { en: 'Voice input', ru: 'Голосовой ввод' },
    summary: {
      en: 'Voice input through a local SenseVoice runtime; model weights download on first use.',
      ru: 'Голосовой ввод через локальный runtime SenseVoice; веса модели скачиваются при первом использовании.',
    },
    details: {
      about: {
        en: 'Adds dictation to the composer with a locally managed SenseVoice process. Audio stays on the machine; the runtime and its weights are prepared on first use.',
        ru: 'Добавляет диктовку в композер с локально управляемым процессом SenseVoice. Аудио остаётся на машине; runtime и веса готовятся при первом использовании.',
      },
      points: [
        { en: 'Local speech-to-text with SenseVoice', ru: 'Локальное распознавание речи на SenseVoice' },
        { en: 'Audio never leaves the machine', ru: 'Аудио не покидает машину' },
        { en: 'Weights download on first use, not at install', ru: 'Веса скачиваются при первом использовании, а не при установке' },
      ],
    },
  },
  {
    name: '@ocean/ocean-plugin-market',
    version: '1.0.0',
    title: { en: 'Plugin market', ru: 'Маркет плагинов' },
    summary: {
      en: 'This market: one card per available plugin, with install, enable, remove and update.',
      ru: 'Этот маркет: одна карточка на доступный плагин, с установкой, включением, удалением и обновлением.',
    },
    details: {
      about: {
        en: 'The catalogue you are reading: it shows the plugins this file names plus every other manageable plugin the Host reports, one card per plugin; every action goes through the profile plugin manager, so it writes the same records the Plugins page writes.',
        ru: 'Каталог, который вы читаете: он показывает плагины из этого файла и остальные управляемые плагины, о которых сообщает Host, по одной карточке на плагин; все действия идут через менеджер плагинов профиля, то есть пишут те же записи, что и страница Plugins.',
      },
      points: [
        { en: 'Search across titles, descriptions and package names', ru: 'Поиск по названиям, описаниям и именам пакетов' },
        { en: 'Updates target the version this catalogue declares', ru: 'Обновление ставит версию, объявленную каталогом' },
        { en: 'No network requests and no third-party index', ru: 'Никаких сетевых запросов и чужих индексов' },
      ],
    },
    self: true,
  },
])
