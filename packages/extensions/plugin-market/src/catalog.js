/**
 * The curated catalogue of this market. Only entries listed here are shown:
 * the market is ours, not a public index, and an installed bundle outside this
 * list stays on the page's own Installed tab.
 *
 * A bundle the running build carries is installed and removed through the
 * profile's bundle selection, so it needs no `spec`. `spec` is the fallback the
 * page's install dialog accepts (a package name, a Git address, a tarball, or
 * an absolute path) and is used only when the build does not carry the bundle;
 * an entry with neither is reported as unavailable instead of offered as an
 * install that cannot work.
 */

/**
 * @typedef {object} MarketEntry
 * @property {string} name npm package name of the bundle; the key the plugin manager lists it under.
 * @property {string} version Version this catalogue expects; shown when the bundle is not installed and used to
 *   recognise a build that carries an older copy.
 * @property {Record<string, string>} title Localized card title, English fallback required.
 * @property {Record<string, string>} summary Localized one-liner, English fallback required.
 * @property {{ about: Record<string, string>, points: Record<string, string>[] }} details Localized popup copy: one
 *   paragraph and a short list of what the bundle does.
 * @property {string} [spec] Fallback install spec for a build that does not carry the bundle.
 * @property {boolean} [self] The market itself; its card carries no management actions.
 */

/** Catalogue order is display order. */
export const CATALOG = /** @type {readonly MarketEntry[]} */ ([
  {
    name: '@ocean/ocean-super-agent',
    version: '0.3.1',
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
    version: '0.1.0',
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
    version: '0.3.5',
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
    name: '@ocean/ocean-computer-use-bundle',
    version: '0.2.2',
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
    version: '0.1.0',
    title: { en: 'Theme picker', ru: 'Выбор темы' },
    summary: {
      en: 'One plugin with every palette: pick a theme in its settings and it applies immediately.',
      ru: 'Один плагин-выборщик тем Ocean: все палитры воркспейса в одном списке с мгновенным переключением.',
    },
    details: {
      about: {
        en: 'Replaces the one-bundle-per-palette arrangement: every palette is embedded in this bundle, its page in Plugins lists them with a two-mode preview, and the choice repaints the alias-token layer above the active light or dark scheme.',
        ru: 'Заменяет отдельные бандлы палитр: все палитры встроены в этот бандл, его страница в «Плагинах» показывает их список с превью обеих схем, а выбор перекрашивает слой alias-токенов поверх активной светлой или тёмной схемы.',
      },
      points: [
        { en: 'All palettes in one list, applied on selection', ru: 'Все палитры одним списком, применение сразу при выборе' },
        { en: 'Appearance keeps choosing light, dark or system', ru: '«Оформление» по-прежнему выбирает светлую, тёмную или системную схему' },
        { en: 'One override layer: switching replaces, never stacks', ru: 'Один слой переопределения: переключение заменяет, а не наслаивает' },
      ],
    },
  },
  {
    name: '@ocean/ocean-plugin-market',
    version: '1.0.0',
    title: { en: 'Plugin market', ru: 'Маркет плагинов' },
    summary: {
      en: 'This market: the curated list of its bundles with install, remove and update.',
      ru: 'Этот маркет: отобранный список его бандлов с установкой, удалением и обновлением.',
    },
    details: {
      about: {
        en: 'The catalogue you are reading: it lists only the bundles named in its own catalog file, and every action goes through the profile plugin manager, so it writes the same records the Plugins page writes.',
        ru: 'Каталог, который вы читаете: он показывает только бандлы из собственного файла каталога, а все действия идут через менеджер плагинов профиля, то есть пишут те же записи, что и страница Plugins.',
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
