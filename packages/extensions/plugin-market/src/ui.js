import { filterCards } from './view.js'

/**
 * Browser half of the market: the «Каталог» tab on the Plugins page.
 * React comes from the module loader; every management action is delegated to
 * the controller, which calls the Host's `pluginManager` Remote.
 */

/** Inline presentation; the page owns the scroll container and header chrome. */
const styles = {
  root: { display: 'flex', flexDirection: 'column', gap: 14 },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: 600, margin: '0 0 4px' },
  hint: { fontSize: 12, lineHeight: 1.45, opacity: 0.68, margin: '0 0 6px', maxWidth: 520 },
  note: { fontSize: 12, lineHeight: 1.45, opacity: 0.68, margin: '6px 0 0' },
  paragraph: { fontSize: 13, lineHeight: 1.6, margin: '8px 0 0' },
  error: { fontSize: 12, lineHeight: 1.45, color: 'var(--dsw-alias-text-danger, #d1574a)', margin: '6px 0 0' },
  toolbar: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  search: {
    fontSize: 12, padding: '5px 10px', borderRadius: 7, minWidth: 240,
    border: '1px solid var(--dsw-alias-border-subtle, rgba(128,128,128,0.35))',
    background: 'transparent', color: 'inherit',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px',
    border: '1px solid var(--dsw-alias-border-subtle, rgba(128,128,128,0.25))', borderRadius: 10,
  },
  cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardTitle: { fontSize: 13, fontWeight: 600, margin: 0 },
  badge: {
    fontSize: 11, padding: '2px 7px', borderRadius: 999,
    border: '1px solid var(--dsw-alias-border-subtle, rgba(128,128,128,0.3))', opacity: 0.8, whiteSpace: 'nowrap',
  },
  summary: { fontSize: 12, lineHeight: 1.5, margin: 0, opacity: 0.8 },
  meta: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, opacity: 0.6, flexWrap: 'wrap' },
  name: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  button: {
    fontSize: 12, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
    border: '1px solid var(--dsw-alias-border-subtle, rgba(128,128,128,0.35))',
    background: 'transparent', color: 'inherit',
  },
  danger: {
    fontSize: 12, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
    border: '1px solid var(--dsw-alias-border-danger, rgba(209,87,74,0.55))',
    background: 'transparent', color: 'var(--dsw-alias-text-danger, #d1574a)',
  },
  link: { fontSize: 12, padding: '4px 2px', border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.75, color: 'inherit' },
  overlay: {
    position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.45)', padding: 24, zIndex: 40,
  },
  dialog: {
    width: 'min(560px, 100%)', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
    padding: '18px 20px', borderRadius: 12, background: 'var(--dsw-alias-bg-layer-1, #13212A)',
    border: '1px solid var(--dsw-alias-border-subtle, rgba(128,128,128,0.3))', boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
  },
  dialogHead: { display: 'flex', alignItems: 'center', gap: 10 },
  dialogTitle: { fontSize: 16, fontWeight: 600, margin: 0, flex: 1 },
  subhead: { fontSize: 12, fontWeight: 600, margin: '10px 0 4px', opacity: 0.8 },
  bullets: { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 },
  bullet: { fontSize: 12, lineHeight: 1.5, opacity: 0.85 },

}

/** Button copy per action kind. */
const ACTION_COPY = { install: 'install', enable: 'enable', disable: 'disable', remove: 'remove', update: 'update', open: 'open' }

/**
 * @param {object} React the module loader's React.
 * @returns {Function} the tab component.
 */
export function createMarketTab(React) {
  const h = React.createElement

  /** One row of management buttons; the removal keeps its own two-step confirmation. */
  function CardActions(props) {
    const { card, t, state, market, install, openPackage, onDetails } = props
    const [confirming, setConfirming] = React.useState(false)
    const busy = state.busy !== undefined && state.busy.name === card.name

    const buttons = card.actions.map((action) => {
      if (action.kind === 'remove' && confirming) {
        return h('span', { key: 'confirm', style: styles.actions },
          h('button', { style: styles.danger, onClick: () => { setConfirming(false); void market.remove(card.name) } }, t('confirm')),
          h('button', { style: styles.button, onClick: () => { setConfirming(false) } }, t('cancel')),
        )
      }
      const onActivate = () => {
        if (action.kind === 'install') install({ spec: card.spec, title: card.title, version: card.version })
        else if (action.kind === 'enable' || action.kind === 'disable') void market.setEnabled(card.name, action.kind === 'enable')
        else if (action.kind === 'update') void market.update(card.name, action.version)
        else if (action.kind === 'open') openPackage(card.name)
        else if (action.kind === 'remove') setConfirming(true)
      }
      const label = action.kind === 'update' && action.version !== undefined
        ? `${t('update')} ${action.version}`
        : t(ACTION_COPY[action.kind])
      return h('button', {
        key: action.kind,
        style: action.kind === 'remove' ? styles.danger : action.kind === 'open' ? styles.link : styles.button,
        disabled: busy,
        onClick: onActivate,
      }, label)
    })

    return h('div', { style: styles.actions },
      onDetails === undefined ? null : h('button', { style: styles.link, onClick: onDetails }, t('details')),
      buttons,
    )
  }

  /** The popup: what the card shows plus the curated long description. */
  function DetailsDialog(props) {
    const { card, t, onClose } = props
    React.useEffect(() => {
      const onKey = event => { if (event.key === 'Escape') onClose() }
      window.addEventListener('keydown', onKey)
      return () => { window.removeEventListener('keydown', onKey) }
    }, [onClose])
    return h('div', {
      style: styles.overlay,
      onClick: event => { if (event.target === event.currentTarget) onClose() },
    },
    h('div', { style: styles.dialog, role: 'dialog', 'aria-modal': 'true', 'aria-label': card.title },
      h('div', { style: styles.dialogHead },
        h('h2', { style: styles.dialogTitle }, card.title),
        h('span', { style: styles.badge }, t(card.badge)),
        h('button', { style: styles.link, onClick: onClose, 'aria-label': t('close') }, '×'),
      ),
      h('div', { style: styles.meta },
        h('span', { style: styles.name }, card.name),
        h('span', null, `${t('versionLabel')}: ${card.version ?? '—'}`),
      ),
      h('p', { style: styles.summary }, card.summary),
      card.about.length === 0 ? null : h('p', { style: styles.paragraph }, card.about),
      card.points.length === 0 ? null : h('div', null,
        h('h3', { style: styles.subhead }, t('whatItDoes')),
        h('ul', { style: styles.bullets }, card.points.map((point, index) => h('li', { key: index, style: styles.bullet }, point))),
      ),
      card.note === undefined ? null : h('p', { style: styles.note }, t(card.note)),
      card.error === undefined ? null : h('p', { style: styles.error }, card.error),
      h(CardActions, { ...props }),
    ))
  }

  /** One card: state badge, versions, note, and the management actions. */
  function Card(props) {
    const { card, t, state, market, install, openPackage, onDetails } = props
    const busy = state.busy !== undefined && state.busy.name === card.name
    return h('article', { style: styles.card },
      h('div', { style: styles.cardHead },
        h('h3', { style: styles.cardTitle }, card.title),
        h('span', { style: styles.badge }, t(card.badge)),
      ),
      h('p', { style: styles.summary }, card.summary),
      h('div', { style: styles.meta },
        h('span', { style: styles.name }, card.name),
        h('span', null, `${t('versionLabel')}: ${card.version ?? '—'}`),
        busy ? h('span', null, t('loading')) : null,
      ),
      card.note === undefined ? null : h('p', { style: styles.note }, t(card.note)),
      card.error === undefined ? null : h('p', { style: styles.error }, card.error),
      h(CardActions, { card, t, state, market, install, openPackage, onDetails }),
    )
  }

  /** The tab itself: search, header controls, the counters, and one card per entry. */
  function MarketTab(props) {
    const { market, t, install, openPackage } = props
    const state = React.useSyncExternalStore(market.subscribe, market.getSnapshot)
    const [query, setQuery] = React.useState('')
    const [openDetails, setOpenDetails] = React.useState(undefined)
    React.useEffect(() => { void market.load() }, [market])

    if (state.status === 'loading' && state.cards.length === 0) return h('p', { style: styles.note }, t('loading'))
    if (state.status === 'error') {
      return h('div', null,
        h('p', { style: styles.error }, state.error),
        h('button', { style: styles.button, onClick: () => { void market.load() } }, t('retry')),
      )
    }
    if (state.cards.length === 0) return h('p', { style: styles.note }, t('empty'))

    const visible = filterCards(state.cards, query)
    return h('div', { style: styles.root },
      h('div', { style: styles.head },
        h('div', null,
          h('h2', { style: styles.title }, t('title')),
          h('p', { style: styles.hint }, t('hint')),
          h('p', { style: styles.note },
            `${t('installedLabel')}: ${state.counts.installed} / ${state.counts.total} · ${t('enabledLabel')}: ${state.counts.enabled}`
            + (query.trim().length === 0 ? '' : ` · ${t('foundLabel')}: ${visible.length}`)),
        ),
        h('div', { style: styles.toolbar },
          h('input', {
            type: 'search',
            style: styles.search,
            value: query,
            placeholder: t('searchPlaceholder'),
            'aria-label': t('search'),
            onChange: event => setQuery(event.target.value),
          }),
          h('button', { style: styles.button, disabled: state.status === 'loading', onClick: () => { void market.load() } }, t('refresh')),
        ),
      ),
      state.error === undefined ? null : h('p', { style: styles.error }, state.error),
      visible.length === 0
        ? h('p', { style: styles.note }, t('noMatches'))
        : h('div', { style: styles.list }, visible.map(card => h(Card, {
          key: card.name, card, t, state, market, install, openPackage, onDetails: () => { setOpenDetails(card) },
        }))),
      openDetails === undefined ? null : h(DetailsDialog, {
        card: openDetails, t, state, market, install, openPackage, onClose: () => { setOpenDetails(undefined) },
      }),
    )
  }

  return { MarketTab }
}
