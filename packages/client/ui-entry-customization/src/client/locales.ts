/** Copy for the More menu rows: navigation actions, and Creator draft prompts per region. */
export const en = {
  install: 'Browse other plugins',
  create: 'Create your plugin',
  'createPrompt.conversation': 'Create an Ocean conversation view plugin.',
  'createPrompt.rightbar': 'Create an Ocean plugin with a right sidebar entry.',
} as const

/** Chinese counterpart of the entry-customization dictionary. */
export const zh: Record<keyof typeof en, string> = {
  install: '浏览更多插件',
  create: '创建你的插件',
  'createPrompt.conversation': '创建一个 Ocean 会话视图插件。',
  'createPrompt.rightbar': '创建一个带右侧栏入口的 Ocean 插件。',
}

/** Japanese copy, checked against the English keys. */
export const ja = {
  'install': '他のプラグインを探す',
  'create': 'プラグインを作成',
  'createPrompt.conversation': 'Ocean 会話ビュープラグインを作成します。',
  'createPrompt.rightbar': '右サイドバーにエントリを持つ Ocean プラグインを作成します。',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  install: 'Explorar otros complementos',
  create: 'Crea tu complemento',
  'createPrompt.conversation': 'Cree un complemento de vista de conversación Ocean.',
  'createPrompt.rightbar': 'Cree un complemento Ocean con una entrada en la barra lateral derecha.',
} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  install: "Parcourir d'autres plugins",
  create: 'Créez votre plugin',
  'createPrompt.conversation': "Créez un plugin d'affichage de conversation Ocean.",
  'createPrompt.rightbar': 'Créez un plugin Ocean avec une entrée dans la barre latérale droite.',
} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  install: 'Durchsuchen Sie andere Plugins',
  create: 'Erstellen Sie Ihr Plugin',
  'createPrompt.conversation': 'Erstellen Sie ein Ocean-Plugin für die Konversationsansicht.',
  'createPrompt.rightbar': 'Erstellen Sie ein Ocean-Plugin mit einem Eintrag in der rechten Seitenleiste.',
} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  install: 'Просмотрите другие плагины',
  create: 'Создайте свой плагин',
  'createPrompt.conversation': 'Создайте плагин просмотра диалога Ocean.',
  'createPrompt.rightbar': 'Создайте плагин Ocean с записью на правой боковой панели.',
} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  install: 'Procure outros plug-ins',
  create: 'Crie seu plug-in',
  'createPrompt.conversation': 'Crie um plug-in de visualização de conversa Ocean.',
  'createPrompt.rightbar': 'Crie um plug-in Ocean com uma entrada na barra lateral direita.',
} satisfies Record<keyof typeof en, string>
