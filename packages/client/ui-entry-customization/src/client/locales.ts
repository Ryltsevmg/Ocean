/** Copy for the More menu rows: navigation actions, and Creator draft prompts per region. */
export const en = {
  'pinTooltip': 'Pin',
  'pin': 'Pin {name}',
  install: 'Browse other plugins',
  create: 'Create your plugin',
  'createPrompt.sidebar': 'Create an Ocean-Chat plugin with a left sidebar entry.',
  'createPrompt.conversation': 'Create an Ocean-Chat conversation view plugin.',
  'createPrompt.rightbar': 'Create an Ocean-Chat plugin with a right sidebar entry.',
} as const

/** Chinese counterpart of the entry-customization dictionary. */
export const zh: Record<keyof typeof en, string> = {
  'pinTooltip': '固定',
  'pin': '固定{name}',
  install: '浏览更多插件',
  create: '创建你的插件',
  'createPrompt.sidebar': '创建一个带左侧栏入口的 Ocean-Chat 插件。',
  'createPrompt.conversation': '创建一个 Ocean-Chat 会话视图插件。',
  'createPrompt.rightbar': '创建一个带右侧栏入口的 Ocean-Chat 插件。',
}

/** Japanese copy, checked against the English keys. */
export const ja = {
  'pinTooltip': '固定',
  'pin': '{name}を固定',
  'install': '他のプラグインを探す',
  'create': 'プラグインを作成',
  'createPrompt.sidebar': '左サイドバーにエントリを持つ Ocean-Chat プラグインを作成します。',
  'createPrompt.conversation': 'Ocean-Chat 会話ビュープラグインを作成します。',
  'createPrompt.rightbar': '右サイドバーにエントリを持つ Ocean-Chat プラグインを作成します。',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  'pinTooltip': 'Fijar',
  'pin': 'Fijar {name}',
  install: 'Explorar otros complementos',
  create: 'Crea tu complemento',
  'createPrompt.sidebar': 'Cree un complemento Ocean-Chat con una entrada en la barra lateral izquierda.',
  'createPrompt.conversation': 'Cree un complemento de vista de conversación Ocean-Chat.',
  'createPrompt.rightbar': 'Cree un complemento Ocean-Chat con una entrada en la barra lateral derecha.',
} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  'pinTooltip': 'Épingler',
  'pin': 'Épingler {name}',
  install: "Parcourir d'autres plugins",
  create: 'Créez votre plugin',
  'createPrompt.sidebar': 'Créez un plugin Ocean-Chat avec une entrée dans la barre latérale gauche.',
  'createPrompt.conversation': "Créez un plugin d'affichage de conversation Ocean-Chat.",
  'createPrompt.rightbar': 'Créez un plugin Ocean-Chat avec une entrée dans la barre latérale droite.',
} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  'pinTooltip': 'Anheften',
  'pin': '{name} anheften',
  install: 'Durchsuchen Sie andere Plugins',
  create: 'Erstellen Sie Ihr Plugin',
  'createPrompt.sidebar': 'Erstellen Sie ein Ocean-Chat-Plugin mit einem Eintrag in der linken Seitenleiste.',
  'createPrompt.conversation': 'Erstellen Sie ein Ocean-Chat-Plugin für die Konversationsansicht.',
  'createPrompt.rightbar': 'Erstellen Sie ein Ocean-Chat-Plugin mit einem Eintrag in der rechten Seitenleiste.',
} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  'pinTooltip': 'Закрепить',
  'pin': 'Закрепить {name}',
  install: 'Просмотрите другие плагины',
  create: 'Создайте свой плагин',
  'createPrompt.sidebar': 'Создайте плагин Ocean-Chat с записью на левой боковой панели.',
  'createPrompt.conversation': 'Создайте плагин просмотра диалога Ocean-Chat.',
  'createPrompt.rightbar': 'Создайте плагин Ocean-Chat с записью на правой боковой панели.',
} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  'pinTooltip': 'Fixar',
  'pin': 'Fixar {name}',
  install: 'Procure outros plug-ins',
  create: 'Crie seu plug-in',
  'createPrompt.sidebar': 'Crie um plug-in Ocean-Chat com uma entrada na barra lateral esquerda.',
  'createPrompt.conversation': 'Crie um plug-in de visualização de conversa Ocean-Chat.',
  'createPrompt.rightbar': 'Crie um plug-in Ocean-Chat com uma entrada na barra lateral direita.',
} satisfies Record<keyof typeof en, string>
