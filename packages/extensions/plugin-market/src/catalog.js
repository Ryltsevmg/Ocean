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
    name: '@local/ocean-theme-ayu',
    version: '0.1.0',
    title: { en: 'Ayu theme', ru: 'Тема «Ayu»' },
    summary: {
      en: 'The official Ayu palette: paper-light surfaces in light mode, blue-black in dark, with the ayu orange accent.',
      ru: 'Официальная палитра Ayu: бумажные поверхности в светлой схеме, сине-чёрные в тёмной, акцент — оранжевый ayu.',
    },
    details: {
      about: {
        en: 'Light mode follows Ayu Light and dark mode Ayu Dark from the ayu-colors project, with the ayu orange as the single accent. The orange is darkened in the light scheme until it passes the contrast gate.',
        ru: 'Светлая схема повторяет Ayu Light, тёмная — Ayu Dark из проекта ayu-colors, единственный акцент — оранжевый ayu. В светлой схеме он затемняется, пока не пройдёт проверку контраста.',
      },
      points: [
        { en: 'Ayu Light and Ayu Dark from one palette', ru: 'Ayu Light и Ayu Dark из одной палитры' },
        { en: 'Orange accent checked against both surfaces', ru: 'Оранжевый акцент проверен на обеих поверхностях' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-catppuccin',
    version: '0.1.0',
    title: { en: 'Catppuccin theme', ru: 'Тема «Catppuccin»' },
    summary: {
      en: 'Catppuccin Latte in light mode and Mocha in dark, with the mauve accent and pastel tones.',
      ru: 'Catppuccin Latte в светлой схеме и Mocha в тёмной, акцент — mauve и пастельные тона.',
    },
    details: {
      about: {
        en: 'Dark mode uses the Mocha surfaces and text, light mode uses Latte, and mauve carries the accent. Layout and semantic state colors stay as they are.',
        ru: 'Тёмная схема использует поверхности и текст Mocha, светлая — Latte, акцент несёт mauve. Вёрстка и семантические цвета состояний не меняются.',
      },
      points: [
        { en: 'Mocha and Latte from the official palette', ru: 'Mocha и Latte из официальной палитры' },
        { en: 'Mauve accent in both schemes', ru: 'Акцент mauve в обеих схемах' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-cobalt2',
    version: '0.1.0',
    title: { en: 'Cobalt2 theme', ru: 'Тема «Cobalt2»' },
    summary: {
      en: 'Cobalt2 deepest-blue surfaces with the yellow #FFC600 accent, plus a light scheme from the same family.',
      ru: 'Глубокие синие поверхности Cobalt2 с жёлтым акцентом #FFC600 и светлая схема из того же семейства.',
    },
    details: {
      about: {
        en: 'Dark mode reproduces the Cobalt2 editor: the #193549 canvas, the #15232D sidebar and the #FFC600 accent. Light mode derives from the same cobalt family instead of inventing a new hue.',
        ru: 'Тёмная схема повторяет редактор Cobalt2: полотно #193549, сайдбар #15232D и акцент #FFC600. Светлая выведена из того же кобальтового семейства, а не из нового оттенка.',
      },
      points: [
        { en: 'Cobalt2 canvas and sidebar values', ru: 'Полотно и сайдбар Cobalt2' },
        { en: 'Yellow accent at the contrast gate', ru: 'Жёлтый акцент проходит порог контраста' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-darcula',
    version: '0.1.0',
    title: { en: 'Darcula theme', ru: 'Тема «Darcula»' },
    summary: {
      en: 'JetBrains Darcula in dark mode and IntelliJ Light in light, with the Darcula keyword orange accent.',
      ru: 'JetBrains Darcula в тёмной схеме и IntelliJ Light в светлой, акцент — оранжевый Darcula.',
    },
    details: {
      about: {
        en: 'Dark mode takes Darcula charcoal surfaces (#2B2B2B editor, #3C3F41 panels); light mode takes IntelliJ Light. The Darcula keyword orange is the accent in both schemes.',
        ru: 'Тёмная схема берёт угольные поверхности Darcula (#2B2B2B редактор, #3C3F41 панели), светлая — IntelliJ Light. Акцент в обеих схемах — оранжевый Darcula.',
      },
      points: [
        { en: 'Two JetBrains IDE palettes, one bundle', ru: 'Две палитры JetBrains IDE в одном бандле' },
        { en: 'Keyword orange as the interface accent', ru: 'Оранжевый из подсветки как акцент интерфейса' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-everforest',
    version: '0.1.0',
    title: { en: 'Everforest theme', ru: 'Тема «Everforest»' },
    summary: {
      en: 'Everforest at medium background: bg0…bg5 surfaces and the warm green accent.',
      ru: 'Everforest при средней яркости: поверхности bg0…bg5 и тёплый зелёный акцент.',
    },
    details: {
      about: {
        en: 'Dark mode uses the bg0…bg5 ramp with the warm foreground text, light mode uses the mirrored light ramp, and the theme green carries the accent.',
        ru: 'Тёмная схема использует рампу bg0…bg5 с тёплым текстом, светлая — зеркальную светлую рампу, акцент несёт зелёный темы.',
      },
      points: [
        { en: 'Medium-contrast Everforest background', ru: 'Средний контраст фона Everforest' },
        { en: 'Warm green accent', ru: 'Тёплый зелёный акцент' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-flexoki',
    version: '0.1.0',
    title: { en: 'Flexoki theme', ru: 'Тема «Flexoki»' },
    summary: {
      en: 'Steph Ango\'s Flexoki: paper base tones with black ink in light, ink base tones with base-200 text in dark.',
      ru: 'Flexoki Стефа Анго: бумажные базовые тона с чёрным текстом в светлой схеме, чернильные с текстом base-200 в тёмной.',
    },
    details: {
      about: {
        en: 'The light scheme takes the paper base tones and black ink text, the dark scheme the ink base tones and base-200 text, following the official palette and its VS Code port.',
        ru: 'Светлая схема берёт бумажные базовые тона и чёрный текст, тёмная — чернильные базовые тона и текст base-200, как в официальной палитре и её порте для VS Code.',
      },
      points: [
        { en: 'Paper and ink bases from the official palette', ru: 'Бумажная и чернильная основы из официальной палитры' },
        { en: 'Text steps taken from the palette, not mixed', ru: 'Ступени текста взяты из палитры, а не смешаны' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-gruvbox',
    version: '0.1.0',
    title: { en: 'Gruvbox theme', ru: 'Тема «Gruvbox»' },
    summary: {
      en: 'Gruvbox at medium contrast: dark0…dark4 surfaces, light text, yellow accent, retro tones.',
      ru: 'Gruvbox при среднем контрасте: поверхности dark0…dark4, светлый текст, жёлтый акцент, ретро-тона.',
    },
    details: {
      about: {
        en: 'Dark mode uses dark0…dark4 surfaces and light0…light4 text, light mode the mirrored light ramp, with yellow as the accent.',
        ru: 'Тёмная схема использует поверхности dark0…dark4 и текст light0…light4, светлая — зеркальную светлую рампу, акцент — жёлтый.',
      },
      points: [
        { en: 'Medium-contrast Gruvbox ramp', ru: 'Рампа Gruvbox среднего контраста' },
        { en: 'Yellow accent checked in both schemes', ru: 'Жёлтый акцент проверен в обеих схемах' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-horizon',
    version: '0.1.0',
    title: { en: 'Horizon theme', ru: 'Тема «Horizon»' },
    summary: {
      en: 'Horizon warm dark canvas #1C1E26 with the red accent, plus a light scheme from the same warm family.',
      ru: 'Тёплое тёмное полотно Horizon #1C1E26 с красным акцентом и светлая схема из того же тёплого семейства.',
    },
    details: {
      about: {
        en: 'Dark mode reproduces the Horizon editor: the #1C1E26 canvas, the #232530 widget layer and the red accent. Light mode derives from the same warm family.',
        ru: 'Тёмная схема повторяет редактор Horizon: полотно #1C1E26, слой виджетов #232530 и красный акцент. Светлая выведена из того же тёплого семейства.',
      },
      points: [
        { en: 'Warm canvas and widget layers', ru: 'Тёплое полотно и слои виджетов' },
        { en: 'Red accent at the contrast gate', ru: 'Красный акцент проходит порог контраста' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-jellybeans',
    version: '0.1.0',
    title: { en: 'Jellybeans theme', ru: 'Тема «Jellybeans»' },
    summary: {
      en: 'Jellybeans dark grey #151515 canvas, warm #E8E8D3 text and the statement blue #8197BF accent.',
      ru: 'Тёмно-серое полотно Jellybeans #151515, тёплый текст #E8E8D3 и акцент statement blue #8197BF.',
    },
    details: {
      about: {
        en: 'Dark mode uses the #151515 canvas and the warm #E8E8D3 text, with #8197BF as the single interface accent; light mode derives from the same warm grey family.',
        ru: 'Тёмная схема использует полотно #151515 и тёплый текст #E8E8D3, единственный акцент — #8197BF; светлая выведена из того же тёплого серого семейства.',
      },
      points: [
        { en: 'Warm grey canvas with warm text', ru: 'Тёплое серое полотно с тёплым текстом' },
        { en: 'One statement blue for the interface', ru: 'Один синий акцент statement blue' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-kanagawa',
    version: '0.1.0',
    title: { en: 'Kanagawa theme', ru: 'Тема «Kanagawa»' },
    summary: {
      en: 'Kanagawa Wave in dark mode and Lotus in light, with the crystal blue accent.',
      ru: 'Kanagawa Wave в тёмной схеме и Lotus в светлой, акцент — crystal blue.',
    },
    details: {
      about: {
        en: 'Dark mode follows the Wave scheme with sumi-ink surfaces and fujiWhite text; light mode follows Lotus with warm paper surfaces and lotusInk text. Crystal blue carries the accent.',
        ru: 'Тёмная схема следует Wave: чернильные поверхности sumi и текст fujiWhite; светлая — Lotus: тёплая бумага и текст lotusInk. Акцент несёт crystal blue.',
      },
      points: [
        { en: 'Wave and Lotus from rebelot/kanagawa.nvim', ru: 'Wave и Lotus из rebelot/kanagawa.nvim' },
        { en: 'Crystal blue accent', ru: 'Акцент crystal blue' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-mariana',
    version: '0.1.0',
    title: { en: 'Mariana theme', ru: 'Тема «Mariana»' },
    summary: {
      en: 'Sublime Text\'s Mariana in dark mode and Breakers in light, with a blue accent.',
      ru: 'Mariana из Sublime Text в тёмной схеме и Breakers в светлой, акцент — синий.',
    },
    details: {
      about: {
        en: 'Dark mode takes Mariana (#303841) and light mode Breakers (#FCFDFD), using the exact hex conversions of the official HSL variables.',
        ru: 'Тёмная схема берёт Mariana (#303841), светлая — Breakers (#FCFDFD), с точными hex-значениями официальных HSL-переменных.',
      },
      points: [
        { en: 'Official Sublime Text schemes', ru: 'Официальные схемы Sublime Text' },
        { en: 'Blue accent in both schemes', ru: 'Синий акцент в обеих схемах' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-material',
    version: '0.1.0',
    title: { en: 'Material theme', ru: 'Тема «Material»' },
    summary: {
      en: 'Material Lighter in light mode and Palenight in dark, with the Material teal accent.',
      ru: 'Material Lighter в светлой схеме и Palenight в тёмной, акцент — бирюзовый Material.',
    },
    details: {
      about: {
        en: 'Light mode follows Material Lighter, dark mode Material Palenight with its indigo-blue surfaces and #BABED8 text. The accent is #80CBC4, deepened to the Material teal 700 step in light mode until it passes the gate.',
        ru: 'Светлая схема следует Material Lighter, тёмная — Material Palenight с индиго-синими поверхностями и текстом #BABED8. Акцент — #80CBC4, в светлой схеме углублён до teal 700, пока не пройдёт порог.',
      },
      points: [
        { en: 'Lighter and Palenight variants', ru: 'Варианты Lighter и Palenight' },
        { en: 'Teal accent with a light-scheme step', ru: 'Бирюзовый акцент со ступенью для светлой схемы' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-modus',
    version: '0.1.0',
    title: { en: 'Modus theme', ru: 'Тема «Modus»' },
    summary: {
      en: 'Protesilaos Stavrou\'s Modus Operandi in light mode and Modus Vivendi in dark, keeping the AAA contrast character.',
      ru: 'Modus Operandi Протесилая Ставру в светлой схеме и Modus Vivendi в тёмной с сохранением контраста AAA.',
    },
    details: {
      about: {
        en: 'Modus Operandi paints the white-background light scheme, Modus Vivendi the black-background dark one, keeping the WCAG AAA contrast of the upstream palettes.',
        ru: 'Modus Operandi окрашивает светлую схему с белым фоном, Modus Vivendi — тёмную с чёрным, сохраняя контраст WCAG AAA исходных палитр.',
      },
      points: [
        { en: 'Operandi and Vivendi from one project', ru: 'Operandi и Vivendi из одного проекта' },
        { en: 'WCAG AAA contrast preserved', ru: 'Контраст WCAG AAA сохранён' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-monokai',
    version: '0.1.0',
    title: { en: 'Monokai theme', ru: 'Тема «Monokai»' },
    summary: {
      en: 'Classic Monokai #272822 canvas with yellow, pink and green accents; the light scheme derives from the same family.',
      ru: 'Классическое полотно Monokai #272822 с жёлтым, розовым и зелёным акцентами; светлая схема выведена из того же семейства.',
    },
    details: {
      about: {
        en: 'Dark mode reproduces the Sublime Text Monokai canvas #272822 and ink #f8f8f2 with its syntax accents; light mode derives from the same family.',
        ru: 'Тёмная схема повторяет полотно Sublime Text Monokai #272822 и чернила #f8f8f2 с синтаксическими акцентами; светлая выведена из того же семейства.',
      },
      points: [
        { en: 'Classic #272822 canvas', ru: 'Классическое полотно #272822' },
        { en: 'Yellow, pink and green accents', ru: 'Жёлтый, розовый и зелёный акценты' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-night-owl',
    version: '0.1.0',
    title: { en: 'Night Owl theme', ru: 'Тема «Night Owl»' },
    summary: {
      en: 'Sarah Drasner\'s Night Owl in dark mode and Light Owl in light, with the theme blue accent.',
      ru: 'Night Owl Сары Драснер в тёмной схеме и Light Owl в светлой, акцент — синий темы.',
    },
    details: {
      about: {
        en: 'Dark mode uses Night Owl deep blue surfaces with #D6DEEB text, light mode the official Light Owl counterpart. The blue carries the accent and the cyan adds the activity shimmer.',
        ru: 'Тёмная схема использует глубокие синие поверхности Night Owl с текстом #D6DEEB, светлая — официальный Light Owl. Синий несёт акцент, циан добавляет отблеск активности.',
      },
      points: [
        { en: 'Night Owl and Light Owl', ru: 'Night Owl и Light Owl' },
        { en: 'Blue accent with the cyan shimmer', ru: 'Синий акцент с циановым отблеском' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-oxocarbon',
    version: '0.1.0',
    title: { en: 'Oxocarbon theme', ru: 'Тема «Oxocarbon»' },
    summary: {
      en: 'Oxocarbon from nyoom-engineering, inspired by IBM Carbon: official base00…base15 hexes plus a light mode from the light base.',
      ru: 'Oxocarbon от nyoom-engineering по мотивам IBM Carbon: официальные hex base00…base15 и светлая схема из светлой основы.',
    },
    details: {
      about: {
        en: 'Dark mode uses the official base00…base15 values; light mode is built from the official light base plus the Carbon grey steps.',
        ru: 'Тёмная схема использует официальные значения base00…base15; светлая построена из официальной светлой основы и серых ступеней Carbon.',
      },
      points: [
        { en: 'Official base ramp from the palette', ru: 'Официальная базовая рампа палитры' },
        { en: 'Light scheme from the light base', ru: 'Светлая схема из светлой основы' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-papercolor',
    version: '0.1.0',
    title: { en: 'PaperColor theme', ru: 'Тема «PaperColor»' },
    summary: {
      en: 'Nikyle Nguyen\'s PaperColor default variant: #eeeeee paper in light mode and #1c1c1c charcoal in dark.',
      ru: 'Вариант по умолчанию PaperColor Никайла Нгуена: бумага #eeeeee в светлой схеме и уголь #1c1c1c в тёмной.',
    },
    details: {
      about: {
        en: 'Light mode uses the #eeeeee paper canvas with #444444 ink, dark mode the #1c1c1c charcoal canvas with #d0d0d0 ink; the theme blue carries the accent.',
        ru: 'Светлая схема использует бумажное полотно #eeeeee с текстом #444444, тёмная — угольное #1c1c1c с текстом #d0d0d0; акцент несёт синий темы.',
      },
      points: [
        { en: 'Paper and charcoal canvases', ru: 'Бумажное и угольное полотна' },
        { en: 'Blue accent from the theme', ru: 'Синий акцент из темы' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-rose-pine',
    version: '0.1.0',
    title: { en: 'Rosé Pine theme', ru: 'Тема «Rosé Pine»' },
    summary: {
      en: 'Rosé Pine main in dark mode and Dawn in light, with the iris accent and a rose-tinted user bubble.',
      ru: 'Rosé Pine main в тёмной схеме и Dawn в светлой, акцент — iris и розовый пузырь пользователя.',
    },
    details: {
      about: {
        en: 'Dark mode uses the main variant base, surface, overlay and text; light mode uses Dawn. Iris carries the accent and the user bubble takes a rose tint.',
        ru: 'Тёмная схема использует base, surface, overlay и текст варианта main; светлая — Dawn. Акцент несёт iris, пузырь пользователя получает розовый оттенок.',
      },
      points: [
        { en: 'Main and Dawn variants', ru: 'Варианты main и Dawn' },
        { en: 'Iris accent and rose user bubble', ru: 'Акцент iris и розовый пузырь пользователя' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-seoul256',
    version: '0.1.0',
    title: { en: 'Seoul256 theme', ru: 'Тема «Seoul256»' },
    summary: {
      en: 'Junegunn Choi\'s seoul256: a muted grey canvas with calm blue and green accents.',
      ru: 'seoul256 Джунгана Чхве: приглушённое серое полотно с спокойными синим и зелёным акцентами.',
    },
    details: {
      about: {
        en: 'Uses the default 256-colour map of seoul256 from junegunn/seoul256.vim: a muted grey canvas with calm blue and green accents.',
        ru: 'Использует карту 256 цветов по умолчанию из junegunn/seoul256.vim: приглушённое серое полотно с спокойными синим и зелёным акцентами.',
      },
      points: [
        { en: 'Muted grey canvas', ru: 'Приглушённое серое полотно' },
        { en: 'Calm blue and green accents', ru: 'Спокойные синий и зелёный акценты' },
        { en: 'Switching the bundle off returns the stock palette', ru: 'Выключение возвращает штатную палитру' },
      ],
    },
  },
  {
    name: '@local/ocean-theme-synthwave',
    version: '0.1.0',
    title: { en: 'SynthWave \'84 theme', ru: 'Тема «SynthWave \'84»' },
    summary: {
      en: 'SynthWave 84 deep purple #262335 canvas with the neon magenta #FF7EDB accent.',
      ru: 'Глубокое фиолетовое полотно SynthWave 84 #262335 с неоновым пурпурным акцентом #FF7EDB.',
    },
    details: {
      about: {
        en: 'Dark mode reproduces the SynthWave 84 editor: the #262335 canvas, the #241B2F sidebar and the #FF7EDB neon accent. Light mode derives from the same purple family.',
        ru: 'Тёмная схема повторяет редактор SynthWave 84: полотно #262335, сайдбар #241B2F и неоновый акцент #FF7EDB. Светлая выведена из того же фиолетового семейства.',
      },
      points: [
        { en: 'Deep purple canvas and sidebar', ru: 'Глубокое фиолетовое полотно и сайдбар' },
        { en: 'Neon magenta accent', ru: 'Неоновый пурпурный акцент' },
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
