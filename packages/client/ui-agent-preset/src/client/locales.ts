/** Locale bundles for the agent-preset hero chip, header label, and management section. */

import { guideEn, guideJa, guideEs, guideFr, guideDe, guideRu, guidePt, guideZh, type PresetGuideKey } from './guide-locales.ts'

/** Locale keys these surfaces render. */
export type AgentPresetSettingsKey =
  | PresetGuideKey
  | 'builtInGroup'
  | 'customGroup'
  | 'seatHint'
  | 'headerHint'
  | 'nav'
  | 'sectionIntro'
  | 'setDefault'
  | 'view'
  | 'presetStandardName'
  | 'presetStandardDescription'
  | 'presetPtcName'
  | 'presetPtcDescription'
  | 'presetMinimalName'
  | 'presetMinimalDescription'
  | 'presetCordisName'
  | 'presetCordisDescription'
  | 'inUse'
  | 'noDescription'
  | 'brokenBadge'
  | 'switchRefused'
  | 'standardUnavailable'
  | 'close'
  | 'creatorDraft'
  | 'createPlugin'
  | 'createPluginDescription'
  | 'createPluginChecking'
  | 'createPluginUnavailable'
  | 'createPluginMissing'

/** English copy. */
export const en: Record<AgentPresetSettingsKey, string> = {
  ...guideEn,
  builtInGroup: 'Built-in', customGroup: 'Custom',
  sectionIntro: 'Choose the agent’s tools and how it works. Use Standard mode for everyday tasks, or Creator mode to add capabilities to Ocean-Chat.',

  seatHint: 'Choose the agent preset for your new task',
  headerHint: 'The agent preset chosen when this task started',
  nav: 'Agent presets',

  setDefault: 'Set as new task default',
  view: 'View configuration',

  presetStandardName: 'Standard mode',
  presetStandardDescription:
    'Work with code, files, and information. Suitable for most tasks, with search, editing, terminal commands, and other tools available as needed.',
  presetPtcName: 'PTC mode',
  presetPtcDescription:
    'Includes all Standard mode capabilities. Better suited to tasks that call tools in batches and then filter, organize, deduplicate, count, or summarize the results.',
  presetMinimalName: 'Minimal mode',
  presetMinimalDescription:
    'The agent uses a terminal and image reading, with context compaction. Useful for testing and comparing its basic performance.',
  presetCordisName: 'Creator mode',
  presetCordisDescription:
    'Customize Ocean-Chat through conversation. Let the agent write plugins that add features or UI, or combine tools and prompts to create your own mode.',

  inUse: 'New task default',

  noDescription: 'No description.',
  brokenBadge: 'Failed to load',

  switchRefused: 'Could not switch to {name}: {reason}',
  standardUnavailable: 'Standard mode is unavailable. Restore it or choose another available mode.',

  close: 'Close',

  creatorDraft: 'Let the agent help me create a preset',
  createPlugin: 'Let the agent create a plugin',
  createPluginDescription: 'Enter Creator mode and make your own Ocean-Chat plugin',
  createPluginChecking: 'Checking whether Creator mode is available',
  createPluginUnavailable: 'Temporarily unavailable. Reopen this menu to retry',
  createPluginMissing: 'Creator mode is not included in this configuration',

}

/** Simplified Chinese copy. */
export const zh: Record<AgentPresetSettingsKey, string> = {
  ...guideZh,
  builtInGroup: '内置', customGroup: '自定义',
  sectionIntro: '选择 Agent 的工具和工作方式。日常任务用「标准模式」，扩展 Ocean-Chat 的能力用「创造模式」。',

  seatHint: '选择新任务使用的 Agent 预设',
  headerHint: '本任务的 Agent 预设，在任务开始时确定',
  nav: 'Agent 预设',

  setDefault: '设为新任务默认',
  view: '查看配置',

  presetStandardName: '标准模式',
  presetStandardDescription: '处理代码、文件和资料，适合大多数任务。Agent 会按需使用检索、编辑和终端等工具。',
  presetPtcName: 'PTC 模式',
  presetPtcDescription: '包含标准模式的所有能力，更适合批量调用工具，并对结果进行筛选、整理、去重、统计或汇总的任务。',
  presetMinimalName: '极简模式',
  presetMinimalDescription: 'Agent 使用终端和图片读取工具，并支持上下文压缩，适合测试和对比其基础表现。',
  presetCordisName: '创造模式',
  presetCordisDescription: '用对话定制 Ocean-Chat：让 Agent 编写插件，添加新功能或界面；也能组合工具和提示词，创建自己的模式。',

  inUse: '新任务默认',

  noDescription: '暂无描述。',
  brokenBadge: '加载失败',

  switchRefused: '无法切换到「{name}」：{reason}',
  standardUnavailable: '标准模式不可用，请恢复该模式或选择其他可用模式。',

  close: '关闭',

  creatorDraft: '让 Agent 帮我创建预设模式',
  createPlugin: '让 Agent 创建插件',
  createPluginDescription: '进入创造模式，制作属于你的 Ocean-Chat 插件',
  createPluginChecking: '正在确认创造模式是否可用',
  createPluginUnavailable: '暂时不可用，请重新打开菜单重试',
  createPluginMissing: '当前配置未提供创造模式',

}

// The resolution itself is the shared fold in `dsh-agent-preset-registry/display`,
// re-exported here so every surface in this plugin reads one path; the
// Settings plugin list inlines the same fold over this plugin's dictionaries.
export { isBuiltInPreset, presetDisplayText } from '@ocean/ocean-agent-preset-registry/display'
export type { PresetDisplaySource, PresetDisplayText } from '@ocean/ocean-agent-preset-registry/display'

/** Japanese copy, checked against the English keys. */
export const ja = {
  ...guideJa,
  'builtInGroup': '組み込み',
  'customGroup': 'カスタム',
  'sectionIntro': 'エージェントのツールと動作を選択します。日常的なタスクには標準モードを、Ocean-Chatに機能を追加するにはクリエイターモードを使用してください。',
  'seatHint': '新しいタスクのエージェントプリセットを選択',
  'headerHint': 'このタスクの開始時に選択されたエージェントプリセット',
  'nav': 'エージェントプリセット',
  'setDefault': '新しいタスクの既定に設定',
  'view': '設定を表示',
  'presetStandardName': '標準モード',
  'presetStandardDescription': 'コード、ファイル、情報を扱います。ほとんどのタスクに適しており、必要に応じて検索、編集、ターミナルコマンドなどのツールを利用できます。',
  'presetPtcName': 'PTCモード',
  'presetPtcDescription': '標準モードのすべての機能を含みます。ツールをまとめて呼び出し、その結果を絞り込み、整理、重複排除、集計、要約するタスクにより適しています。',
  'presetMinimalName': '最小構成モード',
  'presetMinimalDescription': 'エージェントはターミナルツールのみで作業します。基本性能のテストや比較に役立ちます。',
  'presetCordisName': 'クリエイターモード',
  'presetCordisDescription': '対話を通じてOcean-Chatをカスタマイズします。機能やUIを追加するプラグインの作成や、ツールとプロンプトを組み合わせた独自モードの作成をエージェントに依頼できます。',
  'inUse': '新しいタスクの既定',
  'noDescription': '説明はありません。',
  'brokenBadge': '読み込みに失敗しました',
  'switchRefused': '{name}に切り替えられませんでした: {reason}',
  'standardUnavailable': '標準モードは利用できません。復元するか、利用可能な別のモードを選択してください。',
  'close': '閉じる',
  'creatorDraft': 'エージェントにプリセットの作成を依頼',
  'createPlugin': 'エージェントにプラグインを作成してもらう',
  'createPluginDescription': 'クリエイターモードに入り、独自の Ocean-Chat プラグインを作成',
  'createPluginChecking': 'クリエイターモードが利用可能か確認中',
  'createPluginUnavailable': '一時的に利用できません。このメニューを開き直して再試行してください',
  'createPluginMissing': 'この構成にはクリエイターモードが含まれていません',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  ...guideEs,
  builtInGroup: 'Integrados', customGroup: 'Personalizados',
  sectionIntro: 'Elige las herramientas del agente y cómo trabaja. Usa el modo estándar para tareas cotidianas o el modo creador para añadir capacidades a Ocean-Chat.',

  seatHint: 'Elige el ajuste predefinido de agente para tu tarea nueva',
  headerHint: 'El ajuste predefinido de agente elegido al iniciar esta tarea',
  nav: 'Ajustes predefinidos de agente',

  setDefault: 'Usar por defecto en tareas nuevas',
  view: 'Ver configuración',

  presetStandardName: 'Modo estándar',
  presetStandardDescription:
    'Trabaja con código, archivos e información. Adecuado para la mayoría de tareas, con búsqueda, edición, comandos de terminal y otras herramientas disponibles según se necesiten.',
  presetPtcName: 'Modo PTC',
  presetPtcDescription:
    'Incluye todas las capacidades del modo estándar. Más adecuado para tareas que llaman a herramientas por lotes y luego filtran, organizan, eliminan duplicados, cuentan o resumen los resultados.',
  presetMinimalName: 'Modo mínimo',
  presetMinimalDescription:
    'El agente trabaja solo con una herramienta de terminal. Útil para probar y comparar su rendimiento básico.',
  presetCordisName: 'Modo creador',
  presetCordisDescription:
    'Personaliza Ocean-Chat mediante conversación. Deja que el agente escriba plugins que añadan funciones o interfaces, o combina herramientas y prompts para crear tu propio modo.',

  inUse: 'Predet.',

  noDescription: 'Sin descripción.',
  brokenBadge: 'No se pudo cargar',

  switchRefused: 'No se pudo cambiar a {name}: {reason}',
  standardUnavailable: 'El modo estándar no está disponible. Restáuralo o elige otro modo disponible.',

  close: 'Cerrar',

  creatorDraft: 'Que el agente me ayude a crear un ajuste predefinido',
  createPlugin: 'Deje que el agente cree un complemento',
  createPluginDescription: 'Ingrese al modo Creador y cree su propio complemento Ocean-Chat',
  createPluginChecking: 'Comprobando si el modo Creador está disponible',
  createPluginUnavailable: 'Temporalmente no disponible. Vuelve a abrir este menú para volver a intentarlo.',
  createPluginMissing: 'El modo creador no está incluido en esta configuración.',

} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  ...guideFr,
  builtInGroup: 'Intégrés', customGroup: 'Personnalisés',
  sectionIntro: 'Choisissez les outils de l’agent et sa façon de travailler. Utilisez le mode Standard pour les tâches courantes, ou le mode Créateur pour ajouter des fonctionnalités à Ocean-Chat.',

  seatHint: 'Choisir le préréglage d’agent pour votre nouvelle tâche',
  headerHint: 'Le préréglage d’agent choisi au démarrage de cette tâche',
  nav: 'Préréglages d’agent',

  setDefault: 'Définir par défaut pour les nouvelles tâches',
  view: 'Voir la configuration',

  presetStandardName: 'Mode Standard',
  presetStandardDescription:
    'Travaillez sur du code, des fichiers et des informations. Convient à la plupart des tâches, avec recherche, modification, commandes de terminal et autres outils disponibles selon les besoins.',
  presetPtcName: 'Mode PTC',
  presetPtcDescription:
    'Comprend toutes les fonctionnalités du mode Standard. Mieux adapté aux tâches qui appellent les outils par lots, puis filtrent, organisent, dédupliquent, comptent ou résument les résultats.',
  presetMinimalName: 'Mode Minimal',
  presetMinimalDescription:
    'L’agent travaille uniquement avec un outil de terminal. Utile pour tester et comparer ses performances de base.',
  presetCordisName: 'Mode Créateur',
  presetCordisDescription:
    'Personnalisez Ocean-Chat par la conversation. Laissez l’agent écrire des plugins qui ajoutent des fonctionnalités ou une interface, ou combiner outils et invites pour créer votre propre mode.',

  inUse: 'Par défaut',

  noDescription: 'Aucune description.',
  brokenBadge: 'Échec du chargement',

  switchRefused: 'Impossible de passer à {name} : {reason}',
  standardUnavailable: "Le mode standard n'est pas disponible. Restaurez-le ou choisissez un autre mode disponible.",

  close: 'Fermer',

  creatorDraft: 'Demander à l’agent de m’aider à créer un préréglage',
  createPlugin: "Laissez l'agent créer un plugin",
  createPluginDescription: 'Entrez en mode Créateur et créez votre propre plugin Ocean-Chat',
  createPluginChecking: 'Vérifier si le mode Créateur est disponible',
  createPluginUnavailable: 'Temporairement indisponible. Rouvrez ce menu pour réessayer',
  createPluginMissing: "Le mode Créateur n'est pas inclus dans cette configuration",

} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  ...guideDe,
  builtInGroup: 'Integriert', customGroup: 'Benutzerdefiniert',
  sectionIntro: 'Wähle die Werkzeuge des Agenten und seine Arbeitsweise. Verwende den Standard-Modus für alltägliche Aufgaben oder den Creator-Modus, um Ocean-Chat um Funktionen zu erweitern.',

  seatHint: 'Wähle die Agent-Voreinstellung für deine neue Aufgabe',
  headerHint: 'Die beim Start dieser Aufgabe gewählte Agent-Voreinstellung',
  nav: 'Agent-Voreinstellungen',

  setDefault: 'Als Standard für neue Aufgaben festlegen',
  view: 'Konfiguration anzeigen',

  presetStandardName: 'Standard-Modus',
  presetStandardDescription:
    'Arbeite mit Code, Dateien und Informationen. Für die meisten Aufgaben geeignet, mit Suche, Bearbeitung, Terminalbefehlen und weiteren Werkzeugen nach Bedarf.',
  presetPtcName: 'PTC-Modus',
  presetPtcDescription:
    'Enthält alle Funktionen des Standard-Modus. Besser für Aufgaben geeignet, die Werkzeuge stapelweise aufrufen und die Ergebnisse anschließend filtern, ordnen, deduplizieren, zählen oder zusammenfassen.',
  presetMinimalName: 'Minimal-Modus',
  presetMinimalDescription:
    'Der Agent arbeitet ausschließlich mit einem Terminalwerkzeug. Nützlich zum Testen und Vergleichen seiner grundlegenden Leistung.',
  presetCordisName: 'Creator-Modus',
  presetCordisDescription:
    'Passe Ocean-Chat im Gespräch an. Lass den Agenten Plugins schreiben, die Funktionen oder Benutzeroberflächen hinzufügen, oder Werkzeuge und Prompts zu deinem eigenen Modus kombinieren.',

  inUse: 'Vorgabe',

  noDescription: 'Keine Beschreibung.',
  brokenBadge: 'Laden fehlgeschlagen',

  switchRefused: 'Wechsel zu {name} nicht möglich: {reason}',
  standardUnavailable: 'Der Standardmodus ist nicht verfügbar. Stellen Sie es wieder her oder wählen Sie einen anderen verfügbaren Modus.',

  close: 'Schließen',

  creatorDraft: 'Der Agent soll mir beim Erstellen einer Voreinstellung helfen',
  createPlugin: 'Lassen Sie den Agenten ein Plugin erstellen',
  createPluginDescription: 'Wechseln Sie in den Erstellermodus und erstellen Sie Ihr eigenes Ocean-Chat-Plugin',
  createPluginChecking: 'Prüfen, ob der Creator-Modus verfügbar ist',
  createPluginUnavailable: 'Vorübergehend nicht verfügbar. Öffnen Sie dieses Menü erneut, um es erneut zu versuchen',
  createPluginMissing: 'Der Creator-Modus ist in dieser Konfiguration nicht enthalten',

} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  ...guideRu,
  builtInGroup: 'Встроенные', customGroup: 'Пользовательские',
  sectionIntro: 'Выберите инструменты агента и способ его работы. Для повседневных задач используйте стандартный режим, а для расширения Ocean-Chat — режим создания.',

  seatHint: 'Выберите пресет агента для новой задачи',
  headerHint: 'Пресет агента, выбранный при запуске этой задачи',
  nav: 'Пресеты агента',

  setDefault: 'По умолчанию для новых задач',
  view: 'Посмотреть конфигурацию',

  presetStandardName: 'Стандартный режим',
  presetStandardDescription:
    'Работа с кодом, файлами и информацией. Подходит для большинства задач: поиск, редактирование, команды терминала и другие инструменты доступны по мере необходимости.',
  presetPtcName: 'Режим PTC',
  presetPtcDescription:
    'Все возможности стандартного режима. Лучше подходит для задач с пакетным вызовом инструментов и последующей фильтрацией, упорядочиванием, удалением дубликатов, подсчётом или обобщением результатов.',
  presetMinimalName: 'Минимальный режим',
  presetMinimalDescription:
    'Агент работает только с инструментом терминала. Полезно для проверки и сравнения его базовых возможностей.',
  presetCordisName: 'Режим создания',
  presetCordisDescription:
    'Настраивайте Ocean-Chat через диалог. Поручите агенту написать плагины с новыми функциями или интерфейсом либо объединить инструменты и промпты в собственный режим.',

  inUse: 'По умолч.',

  noDescription: 'Нет описания.',
  brokenBadge: 'Не удалось загрузить',

  switchRefused: 'Не удалось переключиться на {name}: {reason}',
  standardUnavailable: 'Стандартный режим недоступен. Восстановите его или выберите другой доступный режим.',

  close: 'Закрыть',

  creatorDraft: 'Пусть агент поможет создать пресет',
  createPlugin: 'Позвольте агенту создать плагин',
  createPluginDescription: 'Войдите в режим Creator и создайте свой собственный плагин Ocean-Chat.',
  createPluginChecking: 'Проверка доступности режима Creator',
  createPluginUnavailable: 'Временно недоступен. Откройте это меню еще раз, чтобы повторить попытку.',
  createPluginMissing: 'Режим Creator не включен в эту конфигурацию.',

} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  ...guidePt,
  builtInGroup: 'Integradas', customGroup: 'Personalizadas',
  sectionIntro: 'Escolha as ferramentas do agente e como ele trabalha. Use o modo padrão para tarefas cotidianas ou o modo criador para adicionar capacidades ao Ocean-Chat.',

  seatHint: 'Escolha a predefinição de agente para sua nova tarefa',
  headerHint: 'A predefinição de agente escolhida quando esta tarefa começou',
  nav: 'Predefinições de agente',

  setDefault: 'Definir como padrão para novas tarefas',
  view: 'Ver configuração',

  presetStandardName: 'Modo padrão',
  presetStandardDescription:
    'Trabalhe com código, arquivos e informações. Adequado para a maioria das tarefas, com pesquisa, edição, comandos de terminal e outras ferramentas disponíveis conforme necessário.',
  presetPtcName: 'Modo PTC',
  presetPtcDescription:
    'Inclui todas as capacidades do modo padrão. Mais adequado para tarefas que chamam ferramentas em lote e depois filtram, organizam, removem duplicatas, contam ou resumem os resultados.',
  presetMinimalName: 'Modo mínimo',
  presetMinimalDescription:
    'O agente trabalha usando apenas uma ferramenta de terminal. Útil para testar e comparar seu desempenho básico.',
  presetCordisName: 'Modo criador',
  presetCordisDescription:
    'Personalize o Ocean-Chat por conversa. Deixe o agente escrever plugins que adicionem recursos ou interfaces, ou combine ferramentas e prompts para criar seu próprio modo.',

  inUse: 'Padrão',

  noDescription: 'Sem descrição.',
  brokenBadge: 'Falha ao carregar',

  switchRefused: 'Não foi possível mudar para {name}: {reason}',
  standardUnavailable: 'O modo padrão não está disponível. Restaure-o ou escolha outro modo disponível.',

  close: 'Fechar',

  creatorDraft: 'Deixar o agente me ajudar a criar uma predefinição',
  createPlugin: 'Deixe o agente criar um plugin',
  createPluginDescription: 'Entre no modo Criador e crie seu próprio plug-in Ocean-Chat',
  createPluginChecking: 'Verificando se o modo Criador está disponível',
  createPluginUnavailable: 'Temporariamente indisponível. Reabra este menu para tentar novamente',
  createPluginMissing: 'O modo criador não está incluído nesta configuração',

} satisfies Record<keyof typeof en, string>
