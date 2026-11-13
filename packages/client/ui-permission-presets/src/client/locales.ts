/** `settings.permission` namespace dictionaries (the Permission row's copy). */

/** Locale namespace shared by both current-session permission pickers. */
export const PERMISSION_ACCESS_NS = 'permission.access'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '权限',
  'description': '选择新会话的默认权限模式',
  'loading': '加载中',
  'unavailable': '不可用',
  'preset.readOnly': '仅可查看',
  'preset.workspaceWrite': '工作区内修改',
  'preset.fullAccess': '完全权限',
  'confirm.title': '确认启用完全权限？',
  'confirm.description': '启用完全权限后，新会话将减少确认步骤，并且可以直接执行更多操作，包括敏感操作、文件修改或外部命令。仅建议在你信任后续任务时使用。',
  'confirm.acknowledge': '我已了解风险，并愿意继续',
  'confirm.cancel': '取消',
  'confirm.enable': '启用完全权限',
} satisfies Record<string, string>

/** The settings.permission namespace key union. */
export type PermissionSettingsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'title': 'Permission',
  'description': 'Choose the default permission mode for new sessions',
  'loading': 'Loading',
  'unavailable': 'Unavailable',
  'preset.readOnly': 'Read Only',
  'preset.workspaceWrite': 'Workspace Write',
  'preset.fullAccess': 'Full access',
  'confirm.title': 'Enable Full access?',
  'confirm.description': 'Full access lets new sessions reduce confirmation steps and perform more actions directly, including sensitive operations, file changes, or external commands. Only use it when you trust subsequent tasks.',
  'confirm.acknowledge': 'I understand the risks and want to continue',
  'confirm.cancel': 'Cancel',
  'confirm.enable': 'Enable Full access',
} satisfies Record<PermissionSettingsKey, string>

/** Simplified Chinese dictionary for the current-session popup gate. */
export const accessZh = {
  'mode': '访问模式，当前：{name}',
  'close': '关闭',
  'preset.readOnly': '仅可查看',
  'preset.workspaceWrite': '工作区内修改',
  'preset.fullAccess': '完全权限',
  'confirm.title': '确认启用完全权限？',
  'confirm.description': '启用完全权限后，智能体将减少确认步骤，并且可以直接执行更多操作，包括敏感操作、文件修改或外部命令。仅建议在你信任当前任务时使用。',
  'confirm.acknowledge': '我已了解风险，并愿意继续',
  'confirm.cancel': '取消',
  'confirm.enable': '启用完全权限',
  'auto.label': '自动审查',
  'auto.badge': 'EXP',
  'auto.description': '无沙箱运行；每次原生工具调用和 PTC 内层调用前由同一模型进行实验性审查。',
  'auto.confirm.title': '确认启用自动审查（实验）？',
  'auto.confirm.description': '自动审查不使用沙箱。每次原生工具调用和 PTC 内层调用前，都会由与当前 agent 相同的模型进行审查；审查拒绝的调用由你批准或拒绝。此功能仍属实验性，可能误放行或误拒绝，并会消耗额外 token。',
  'auto.confirm.acknowledge': '我已了解这些风险，并愿意继续',
  'auto.confirm.enable': '启用自动审查',
} satisfies Record<string, string>

/** Current-session popup-gate key union. */
export type PermissionAccessKey = keyof typeof accessZh

/** English dictionary for the current-session popup gate. */
export const accessEn = {
  'mode': 'Access mode, current: {name}',
  'close': 'Close',
  'preset.readOnly': 'Read Only',
  'preset.workspaceWrite': 'Workspace Write',
  'preset.fullAccess': 'Full access',
  'confirm.title': 'Enable Full access?',
  'confirm.description': 'Full access reduces confirmation steps and lets the agent perform more actions directly, including sensitive operations, file changes, or external commands. Only use it when you trust the current task.',
  'confirm.acknowledge': 'I understand the risks and want to continue',
  'confirm.cancel': 'Cancel',
  'confirm.enable': 'Enable Full access',
  'auto.label': 'Auto review',
  'auto.badge': 'EXP',
  'auto.description': 'Run without a sandbox after an experimental same-model review of every native tool call and PTC inner call.',
  'auto.confirm.title': 'Enable Auto review (experimental)?',
  'auto.confirm.description': 'Auto review runs without a sandbox. Before every native tool call and PTC inner call, the same model as the current agent reviews whether to allow it; you approve or reject each call it denies. This feature is experimental, can falsely allow or deny actions, and uses additional tokens.',
  'auto.confirm.acknowledge': 'I understand these risks and want to continue',
  'auto.confirm.enable': 'Enable Auto review',
} satisfies Record<PermissionAccessKey, string>

/** Japanese copy, checked against the English keys. */
export const ja = {
  'title': '権限',
  'description': '新しいセッションで使用する既定の権限モードを選択します',
  'loading': '読み込み中',
  'unavailable': '利用不可',
  'preset.readOnly': '読み取り専用',
  'preset.workspaceWrite': 'ワークスペースへの書き込み',
  'preset.fullAccess': 'フルアクセス',
  'confirm.title': 'フルアクセスを有効にしますか？',
  'confirm.description': 'フルアクセスを有効にすると、新しいセッションでの確認手順が減り、慎重な扱いを要する操作、ファイルの変更、外部コマンドの実行など、より多くの操作を直接実行できるようになります。今後のタスクを信頼できる場合にのみ使用してください。',
  'confirm.acknowledge': 'リスクを理解したうえで続行します',
  'confirm.cancel': 'キャンセル',
  'confirm.enable': 'フルアクセスを有効にする',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  'title': 'Permisos',
  'description': 'Elige el modo de permisos predeterminado para las sesiones nuevas',
  'loading': 'Cargando',
  'unavailable': 'No disponible',
  'preset.readOnly': 'Solo lectura',
  'preset.workspaceWrite': 'Escritura en el espacio de trabajo',
  'preset.fullAccess': 'Acceso completo',
  'confirm.title': '¿Activar el acceso completo?',
  'confirm.description': 'El acceso completo permite que las sesiones nuevas reduzcan los pasos de confirmación y realicen más acciones directamente, incluidas operaciones sensibles, cambios en archivos o comandos externos. Úsalo solo si confías en las tareas posteriores.',
  'confirm.acknowledge': 'Entiendo los riesgos y quiero continuar',
  'confirm.cancel': 'Cancelar',
  'confirm.enable': 'Activar el acceso completo',
} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  'title': 'Autorisations',
  'description': 'Choisissez le mode d’autorisation par défaut pour les nouvelles sessions',
  'loading': 'Chargement',
  'unavailable': 'Indisponible',
  'preset.readOnly': 'Lecture seule',
  'preset.workspaceWrite': 'Écriture dans l’espace de travail',
  'preset.fullAccess': 'Accès complet',
  'confirm.title': 'Activer l’accès complet ?',
  'confirm.description': 'L’accès complet permet aux nouvelles sessions de réduire les étapes de confirmation et d’effectuer davantage d’actions directement, notamment des opérations sensibles, des modifications de fichiers ou des commandes externes. Utilisez-le uniquement si vous faites confiance aux tâches à venir.',
  'confirm.acknowledge': 'Je comprends les risques et souhaite continuer',
  'confirm.cancel': 'Annuler',
  'confirm.enable': 'Activer l’accès complet',
} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  'title': 'Berechtigung',
  'description': 'Wähle den standardmäßigen Berechtigungsmodus für neue Sitzungen',
  'loading': 'Wird geladen',
  'unavailable': 'Nicht verfügbar',
  'preset.readOnly': 'Nur lesen',
  'preset.workspaceWrite': 'Im Arbeitsbereich schreiben',
  'preset.fullAccess': 'Vollzugriff',
  'confirm.title': 'Vollzugriff aktivieren?',
  'confirm.description': 'Mit Vollzugriff können neue Sitzungen weniger Bestätigungsschritte erfordern und mehr Aktionen direkt ausführen, einschließlich sensibler Vorgänge, Dateiänderungen oder externer Befehle. Verwende ihn nur, wenn du den nachfolgenden Aufgaben vertraust.',
  'confirm.acknowledge': 'Ich verstehe die Risiken und möchte fortfahren',
  'confirm.cancel': 'Abbrechen',
  'confirm.enable': 'Vollzugriff aktivieren',
} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  'title': 'Разрешения',
  'description': 'Выберите режим разрешений по умолчанию для новых сессий',
  'loading': 'Загрузка',
  'unavailable': 'Недоступно',
  'preset.readOnly': 'Только чтение',
  'preset.workspaceWrite': 'Запись в рабочую область',
  'preset.fullAccess': 'Полный доступ',
  'confirm.title': 'Включить полный доступ?',
  'confirm.description': 'Полный доступ сокращает число подтверждений в новых сессиях и позволяет выполнять больше действий напрямую, включая чувствительные операции, изменение файлов и внешние команды. Используйте его, только если доверяете последующим задачам.',
  'confirm.acknowledge': 'Я понимаю риски и хочу продолжить',
  'confirm.cancel': 'Отмена',
  'confirm.enable': 'Включить полный доступ',
} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  'title': 'Permissão',
  'description': 'Escolha o modo de permissão padrão para novas sessões',
  'loading': 'Carregando',
  'unavailable': 'Indisponível',
  'preset.readOnly': 'Somente leitura',
  'preset.workspaceWrite': 'Escrita no espaço de trabalho',
  'preset.fullAccess': 'Acesso total',
  'confirm.title': 'Ativar acesso total?',
  'confirm.description': 'O acesso total permite que novas sessões reduzam as etapas de confirmação e executem mais ações diretamente, incluindo operações sensíveis, alterações em arquivos ou comandos externos. Use apenas se você confiar nas tarefas seguintes.',
  'confirm.acknowledge': 'Entendo os riscos e quero continuar',
  'confirm.cancel': 'Cancelar',
  'confirm.enable': 'Ativar acesso total',
} satisfies Record<keyof typeof en, string>

/** Japanese copy, checked against the English keys. */
export const accessJa = {
  'mode': 'アクセスモード（現在: {name}）',
  'close': '閉じる',
  'preset.readOnly': '読み取り専用',
  'preset.workspaceWrite': 'ワークスペースへの書き込み',
  'preset.fullAccess': 'フルアクセス',
  'confirm.title': 'フルアクセスを有効にしますか？',
  'confirm.description': 'フルアクセスを有効にすると、確認手順が減り、エージェントが慎重な扱いを要する操作、ファイルの変更、外部コマンドの実行など、より多くの操作を直接実行できるようになります。現在のタスクを信頼できる場合にのみ使用してください。',
  'confirm.acknowledge': 'リスクを理解したうえで続行します',
  'confirm.cancel': 'キャンセル',
  'confirm.enable': 'フルアクセスを有効にする',
  'auto.label': '自動レビュー',
  'auto.badge': 'EXP',
  'auto.description': 'ネイティブツールの各呼び出しとPTC内部の各呼び出しを同じモデルでレビューした後、サンドボックスなしで実行します。この機能は試験的なものです。',
  'auto.confirm.title': '自動レビュー（試験的機能）を有効にしますか？',
  'auto.confirm.description': '自動レビューでは、サンドボックスなしで実行されます。ネイティブツールの各呼び出しとPTC内部の各呼び出しの前に、現在のエージェントと同じモデルが実行を許可するかどうかをレビューします。モデルが拒否した呼び出しのみ、ユーザーが個別に承認または拒否します。この機能は試験的なものであり、操作を誤って許可または拒否する可能性があり、追加のトークンを消費します。',
  'auto.confirm.acknowledge': 'これらのリスクを理解したうえで続行します',
  'auto.confirm.enable': '自動レビューを有効にする',
} satisfies Record<keyof typeof accessEn, string>

/** Spanish dictionary, checked against the English keys. */
export const accessEs = {
  'mode': 'Modo de acceso actual: {name}',
  'close': 'Cerrar',
  'preset.readOnly': 'Solo lectura',
  'preset.workspaceWrite': 'Escritura en el espacio de trabajo',
  'preset.fullAccess': 'Acceso completo',
  'confirm.title': '¿Activar el acceso completo?',
  'confirm.description': 'El acceso completo reduce los pasos de confirmación y permite que el agente realice más acciones directamente, incluidas operaciones sensibles, cambios en archivos o comandos externos. Úsalo solo si confías en la tarea actual.',
  'confirm.acknowledge': 'Entiendo los riesgos y quiero continuar',
  'confirm.cancel': 'Cancelar',
  'confirm.enable': 'Activar el acceso completo',
  'auto.label': 'Revisión automática',
  'auto.badge': 'EXP',
  'auto.description': 'Ejecutar sin un entorno aislado tras una revisión experimental, por el mismo modelo, de cada llamada a una herramienta nativa y cada llamada interna de PTC.',
  'auto.confirm.title': '¿Activar la revisión automática (experimental)?',
  'auto.confirm.description': 'La revisión automática se ejecuta sin un entorno aislado. Antes de cada llamada a una herramienta nativa y cada llamada interna de PTC, el mismo modelo que usa el agente actual revisa si debe permitirla; tú apruebas o rechazas cada llamada que el modelo deniega. Esta función es experimental, puede permitir o denegar acciones por error y consume tokens adicionales.',
  'auto.confirm.acknowledge': 'Entiendo estos riesgos y quiero continuar',
  'auto.confirm.enable': 'Activar la revisión automática',
} satisfies typeof accessEn

/** French dictionary, checked against the English keys. */
export const accessFr = {
  'mode': 'Mode d’accès actuel : {name}',
  'close': 'Fermer',
  'preset.readOnly': 'Lecture seule',
  'preset.workspaceWrite': 'Écriture dans l’espace de travail',
  'preset.fullAccess': 'Accès complet',
  'confirm.title': 'Activer l’accès complet ?',
  'confirm.description': 'L’accès complet réduit les étapes de confirmation et permet à l’agent d’effectuer davantage d’actions directement, notamment des opérations sensibles, des modifications de fichiers ou des commandes externes. Utilisez-le uniquement si vous faites confiance à la tâche en cours.',
  'confirm.acknowledge': 'Je comprends les risques et souhaite continuer',
  'confirm.cancel': 'Annuler',
  'confirm.enable': 'Activer l’accès complet',
  'auto.label': 'Revue automatique',
  'auto.badge': 'EXP',
  'auto.description': 'Exécution sans bac à sable après une revue expérimentale, par le même modèle, de chaque appel d’outil natif et de chaque appel interne PTC.',
  'auto.confirm.title': 'Activer la revue automatique (expérimentale) ?',
  'auto.confirm.description': 'La revue automatique s’exécute sans bac à sable. Avant chaque appel d’outil natif et chaque appel interne PTC, le même modèle que celui de l’agent actuel examine s’il faut l’autoriser ; vous approuvez ou rejetez chaque appel qu’il refuse. Cette fonctionnalité est expérimentale, peut autoriser ou refuser des actions à tort et consomme des jetons supplémentaires.',
  'auto.confirm.acknowledge': 'Je comprends ces risques et souhaite continuer',
  'auto.confirm.enable': 'Activer la revue automatique',
} satisfies typeof accessEn

/** German dictionary, checked against the English keys. */
export const accessDe = {
  'mode': 'Zugriffsmodus, aktuell: {name}',
  'close': 'Schließen',
  'preset.readOnly': 'Nur lesen',
  'preset.workspaceWrite': 'Im Arbeitsbereich schreiben',
  'preset.fullAccess': 'Vollzugriff',
  'confirm.title': 'Vollzugriff aktivieren?',
  'confirm.description': 'Vollzugriff reduziert Bestätigungsschritte und lässt den Agenten mehr Aktionen direkt ausführen, einschließlich sensibler Vorgänge, Dateiänderungen oder externer Befehle. Verwende ihn nur, wenn du der aktuellen Aufgabe vertraust.',
  'confirm.acknowledge': 'Ich verstehe die Risiken und möchte fortfahren',
  'confirm.cancel': 'Abbrechen',
  'confirm.enable': 'Vollzugriff aktivieren',
  'auto.label': 'Automatische Prüfung',
  'auto.badge': 'EXP',
  'auto.description': 'Ausführung ohne Sandbox nach einer experimentellen Prüfung jedes nativen Tool-Aufrufs und jedes inneren PTC-Aufrufs durch dasselbe Modell wie das des Agenten.',
  'auto.confirm.title': 'Automatische Prüfung aktivieren (experimentell)?',
  'auto.confirm.description': 'Die automatische Prüfung läuft ohne Sandbox. Vor jedem nativen Tool-Aufruf und jedem inneren PTC-Aufruf prüft dasselbe Modell wie das des aktuellen Agenten, ob der Aufruf erlaubt werden soll; jeden vom Modell abgelehnten Aufruf gibst du frei oder lehnst ihn ab. Diese Funktion ist experimentell, kann Aktionen fälschlicherweise erlauben oder ablehnen und verbraucht zusätzliche Tokens.',
  'auto.confirm.acknowledge': 'Ich verstehe diese Risiken und möchte fortfahren',
  'auto.confirm.enable': 'Automatische Prüfung aktivieren',
} satisfies typeof accessEn

/** Russian dictionary, checked against the English keys. */
export const accessRu = {
  'mode': 'Режим доступа, сейчас: {name}',
  'close': 'Закрыть',
  'preset.readOnly': 'Только чтение',
  'preset.workspaceWrite': 'Запись в рабочую область',
  'preset.fullAccess': 'Полный доступ',
  'confirm.title': 'Включить полный доступ?',
  'confirm.description': 'Полный доступ сокращает число подтверждений и позволяет агенту выполнять больше действий напрямую, включая чувствительные операции, изменение файлов и внешние команды. Используйте его, только если доверяете текущей задаче.',
  'confirm.acknowledge': 'Я понимаю риски и хочу продолжить',
  'confirm.cancel': 'Отмена',
  'confirm.enable': 'Включить полный доступ',
  'auto.label': 'Автопроверка',
  'auto.badge': 'EXP',
  'auto.description': 'Работа без песочницы с экспериментальной проверкой каждого прямого вызова инструмента и каждого вложенного вызова PTC той же моделью, что и у текущего агента.',
  'auto.confirm.title': 'Включить автопроверку (экспериментально)?',
  'auto.confirm.description': 'Автопроверка работает без песочницы. Перед каждым прямым вызовом инструмента и каждым вложенным вызовом PTC та же модель, что и у текущего агента, решает, разрешить ли его; вы разрешаете или отклоняете каждый вызов, запрещённый моделью. Функция экспериментальная: она может ошибочно разрешать или запрещать действия и расходует дополнительные токены.',
  'auto.confirm.acknowledge': 'Я понимаю эти риски и хочу продолжить',
  'auto.confirm.enable': 'Включить автопроверку',
} satisfies typeof accessEn

/** Portuguese dictionary, checked against the English keys. */
export const accessPt = {
  'mode': 'Modo de acesso, atual: {name}',
  'close': 'Fechar',
  'preset.readOnly': 'Somente leitura',
  'preset.workspaceWrite': 'Escrita no espaço de trabalho',
  'preset.fullAccess': 'Acesso total',
  'confirm.title': 'Ativar acesso total?',
  'confirm.description': 'O acesso total reduz as etapas de confirmação e permite que o agente execute mais ações diretamente, incluindo operações sensíveis, alterações em arquivos ou comandos externos. Use apenas se você confiar na tarefa atual.',
  'confirm.acknowledge': 'Entendo os riscos e quero continuar',
  'confirm.cancel': 'Cancelar',
  'confirm.enable': 'Ativar acesso total',
  'auto.label': 'Revisão automática',
  'auto.badge': 'EXP',
  'auto.description': 'Executa sem sandbox após uma revisão experimental, pelo mesmo modelo, de cada chamada de ferramenta nativa e de cada chamada interna de PTC.',
  'auto.confirm.title': 'Ativar revisão automática (experimental)?',
  'auto.confirm.description': 'A revisão automática executa sem sandbox. Antes de cada chamada de ferramenta nativa e de cada chamada interna de PTC, o mesmo modelo do agente atual avalia se deve permiti-la; você aprova ou rejeita cada chamada que ele negar. Este recurso é experimental, pode permitir ou negar ações por engano e consome tokens adicionais.',
  'auto.confirm.acknowledge': 'Entendo esses riscos e quero continuar',
  'auto.confirm.enable': 'Ativar revisão automática',
} satisfies typeof accessEn
