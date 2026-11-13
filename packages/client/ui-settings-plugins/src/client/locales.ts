/** Locale bundles for the built-in plugins settings section. */

/** Locale keys the section renders. */
export type PluginsSettingsLocaleKey = 'nav' | 'title' | 'intro' | 'tabs' | 'empty'

/** English copy. */
export const en: Record<PluginsSettingsLocaleKey, string> = {
  nav: 'Built-in plugins',
  title: 'Built-in plugins',
  intro: 'Inspect the plugins this deployment ships.',
  tabs: 'Plugin views',
  empty: 'This deployment exposes no plugin views.',
}

/** Simplified Chinese copy. */
export const zh: Record<PluginsSettingsLocaleKey, string> = {
  nav: '内置插件',
  title: '内置插件',
  intro: '查看内置部署的插件列表',
  tabs: '插件视图',
  empty: '本部署没有开放任何插件视图。',
}

/** Japanese copy, checked against the English keys. */
export const ja = {
  'nav': '組み込みプラグイン',
  'title': '組み込みプラグイン',
  'intro': 'このデプロイ環境に同梱されているプラグインを確認します。',
  'tabs': 'プラグインビュー',
  'empty': 'このデプロイ環境にはプラグインビューがありません。',
} satisfies Record<keyof typeof en, string>

/** Spanish dictionary, checked against the English keys. */
export const es = {
  nav: 'Plugins integrados',
  title: 'Plugins integrados',
  intro: 'Consulta los plugins incluidos en este despliegue.',
  tabs: 'Vistas de plugins',
  empty: 'Este despliegue no ofrece vistas de plugins.',
} satisfies Record<keyof typeof en, string>

/** French dictionary, checked against the English keys. */
export const fr = {
  nav: 'Plugins intégrés',
  title: 'Plugins intégrés',
  intro: 'Consultez les plugins fournis avec ce déploiement.',
  tabs: 'Vues des plugins',
  empty: 'Ce déploiement ne propose aucune vue de plugin.',
} satisfies Record<keyof typeof en, string>

/** German dictionary, checked against the English keys. */
export const de = {
  nav: 'Integrierte Plugins',
  title: 'Integrierte Plugins',
  intro: 'Sehen Sie sich die mit dieser Bereitstellung ausgelieferten Plugins an.',
  tabs: 'Plugin-Ansichten',
  empty: 'Diese Bereitstellung stellt keine Plugin-Ansichten bereit.',
} satisfies Record<keyof typeof en, string>

/** Russian dictionary, checked against the English keys. */
export const ru = {
  nav: 'Встроенные плагины',
  title: 'Встроенные плагины',
  intro: 'Просмотрите плагины, входящие в эту сборку.',
  tabs: 'Представления плагинов',
  empty: 'В этой среде нет представлений плагинов.',
} satisfies Record<keyof typeof en, string>

/** Portuguese dictionary, checked against the English keys. */
export const pt = {
  nav: 'Plugins integrados',
  title: 'Plugins integrados',
  intro: 'Confira os plugins incluídos nesta implantação.',
  tabs: 'Visualizações de plugins',
  empty: 'Esta implantação não disponibiliza visualizações de plugins.',
} satisfies Record<keyof typeof en, string>
