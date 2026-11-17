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
    name: '@local/ocean-theme-abyss',
    version: '0.1.0',
    title: { en: 'Abyss theme', ru: 'Тема «Abyss»' },
    summary: {
      en: 'A deep cold palette over the built-in light and dark schemes: teal accent, blue-green surfaces.',
      ru: 'Глубокая холодная палитра поверх штатных светлой и тёмной схем: бирюзовый акцент и сине-зелёные поверхности.',
    },
    details: {
      about: {
        en: 'Repaints the interface without changing its layout: backgrounds, cards, text and hairlines take a blue-green cast, the accent turns teal, and Appearance keeps choosing light, dark or system.',
        ru: 'Перекрашивает интерфейс, не меняя вёрстку: фон, карточки, текст и тонкие границы получают сине-зелёный оттенок, акцент становится бирюзовым, а «Оформление» по-прежнему выбирает светлую, тёмную или системную схему.',
      },
      points: [
        { en: 'Follows light, dark and system instead of replacing the preference', ru: 'Следует светлой, тёмной и системной схеме, а не подменяет выбор' },
        { en: 'Contrast of text and accent is checked in both schemes', ru: 'Контраст текста и акцента проверяется в обеих схемах' },
        { en: 'Turning the bundle off restores the stock palette', ru: 'Выключение бандла возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-one-dark',
    version: '0.1.0',
    title: { en: 'One Dark / One Light', ru: 'One Dark / One Light' },
    summary: {
      en: "Atom's One Dark Pro and One Light for Ocean: graphite surfaces, blue accent, warm syntax colors.",
      ru: 'One Dark Pro и One Light в Ocean: графитовые поверхности, синий акцент, тёплые синтаксические цвета.',
    },
    details: {
      about: {
        en: 'The light scheme paints One Light and the dark scheme One Dark Pro, so Appearance keeps switching between the two variants of one editor theme instead of being replaced by a fixed palette.',
        ru: 'Светлая схема рисуется One Light, тёмная — One Dark Pro: «Оформление» переключает варианты одной темы редактора, а не подменяется фиксированной палитрой.',
      },
      points: [
        { en: 'One Light for the light scheme, One Dark Pro for the dark one', ru: 'One Light для светлой схемы, One Dark Pro для тёмной' },
        { en: 'Graphite panels and the theme blue accent', ru: 'Графитовые панели и синий акцент темы' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-dracula',
    version: '0.1.0',
    title: { en: 'Dracula / Alucard', ru: 'Dracula / Alucard' },
    summary: {
      en: "Dracula's violet-accented palette with the official Alucard light counterpart.",
      ru: 'Палитра Dracula с фиолетовым акцентом и официальная светлая пара Alucard.',
    },
    details: {
      about: {
        en: 'Dark mode reproduces the Dracula editor theme — #282A36 surfaces, violet accents and cyan links — and light mode uses Alucard, the official light counterpart, so Appearance switches between the pair.',
        ru: 'Тёмная схема повторяет тему редактора Dracula — поверхности #282A36, фиолетовые акценты и голубые ссылки, — а светлая берёт Alucard, официальную светлую пару, поэтому «Оформление» переключает два варианта одной темы.',
      },
      points: [
        { en: 'Dracula in the dark scheme, Alucard in the light one', ru: 'Dracula в тёмной схеме, Alucard в светлой' },
        { en: 'Violet accent and cyan links from the specification', ru: 'Фиолетовый акцент и голубые ссылки из спецификации' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-github',
    version: '0.1.0',
    title: { en: 'GitHub Light / GitHub Dark', ru: 'GitHub Light / GitHub Dark' },
    summary: {
      en: "GitHub's Primer colors: the white light theme, the deep blue-black dark theme and one blue accent.",
      ru: 'Цвета GitHub Primer: белая светлая тема, чернильно-синяя тёмная и единый синий акцент.',
    },
    details: {
      about: {
        en: "Reproduces GitHub's own VS Code theme built on Primer: a white canvas in light mode, the #0D1117 canvas in dark mode, and the blue accent for links, activity and the right-panel flash.",
        ru: 'Повторяет собственную тему GitHub для VS Code на палитре Primer: белое полотно в светлой схеме, полотно #0D1117 в тёмной и синий акцент для ссылок, активности и вспышки правой панели.',
      },
      points: [
        { en: 'Primer light and dark canvases', ru: 'Светлое и тёмное полотно Primer' },
        { en: 'One blue accent for links and activity', ru: 'Единый синий акцент для ссылок и активности' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-solarized',
    version: '0.1.0',
    title: { en: 'Solarized Light / Solarized Dark', ru: 'Solarized Light / Solarized Dark' },
    summary: {
      en: "Ethan Schoonover's Solarized: warm paper and deep teal surfaces with the classic eight accents.",
      ru: 'Solarized Итана Шунова: тёплая бумага и глубокие бирюзовые поверхности, классические восемь акцентов.',
    },
    details: {
      about: {
        en: 'The light scheme uses the official Solarized light rebase, the dark scheme the classic base03 palette, with #268BD2 as the single interface accent. Body text keeps Solarized deliberately soft contrast.',
        ru: 'Светлая схема использует официальный светлый пересчёт Solarized, тёмная — классическую палитру base03, а единственный акцент интерфейса — #268BD2. Основной текст сохраняет намеренно мягкий контраст Solarized.',
      },
      points: [
        { en: 'Warm paper in light mode, deep teal in dark mode', ru: 'Тёплая бумага в светлой схеме, глубокий бирюзовый в тёмной' },
        { en: 'The classic eight accents with one interface accent', ru: 'Классические восемь акцентов и один акцент интерфейса' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-nord',
    version: '0.1.0',
    title: { en: 'Nord', ru: 'Nord' },
    summary: {
      en: 'Arctic Nord: Polar Night surfaces, the Frost accent and the official Aurora colors.',
      ru: 'Арктическая Nord: поверхности Polar Night, акцент Frost и официальные цвета Aurora.',
    },
    details: {
      about: {
        en: 'The dark scheme is the official Nord theme; Nord ships no light theme, so the light scheme is built from the same sixteen colors as its styleguide prescribes — Snow Storm surfaces, Polar Night text, and the Frost accent moved to nord10 for legibility.',
        ru: 'Тёмная схема — официальная тема Nord; собственной светлой темы у Nord нет, поэтому светлая собрана из тех же шестнадцати цветов по правилам стайлгайда: поверхности Snow Storm, текст Polar Night, акцент Frost сдвинут в nord10 ради читаемости.',
      },
      points: [
        { en: 'Official Polar Night and Snow Storm surfaces', ru: 'Официальные поверхности Polar Night и Snow Storm' },
        { en: 'Frost accent and the Aurora state colors', ru: 'Акцент Frost и цвета состояний Aurora' },
        { en: 'The light scheme is derived from the same palette, not invented', ru: 'Светлая схема выведена из той же палитры, а не придумана' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-tokyo-night',
    version: '0.1.0',
    title: { en: 'Tokyo Night', ru: 'Tokyo Night' },
    summary: {
      en: "Tokyo Night's midnight blues and neon accents, with the official Day palette in light mode.",
      ru: 'Полуночные синие тона и неоновые акценты Tokyo Night с официальной дневной палитрой.',
    },
    details: {
      about: {
        en: 'Dark mode reproduces the Tokyo Night editor theme — the #1A1B26 canvas and its blue, green and magenta accents — and light mode uses the official Tokyo Night Day palette from the same project.',
        ru: 'Тёмная схема повторяет тему редактора Tokyo Night — полотно #1A1B26 и его синие, зелёные и пурпурные акценты, — а светлая использует официальную палитру Tokyo Night Day из того же проекта.',
      },
      points: [
        { en: 'Midnight-blue canvas and neon accents', ru: 'Полуночно-синее полотно и неоновые акценты' },
        { en: 'The official Day palette for light mode', ru: 'Официальная дневная палитра для светлой схемы' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
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
