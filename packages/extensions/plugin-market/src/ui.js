/** Plugin catalogue tab and its live details. The Plugins page owns installation dialogs. */
import { filterCards } from './view.js'

const border = '1px solid var(--dsw-alias-border-l2)'
const errorInk = 'var(--dsw-alias-state-error-primary)'
const button = { fontSize: 12, padding: '4px 10px', borderRadius: 7, border, background: 'transparent', color: 'inherit' }
const styles = {
  root: { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: 500, margin: '0 0 4px' },
  hint: { fontSize: 12, lineHeight: 1.45, opacity: 0.75, margin: '0 0 6px' },
  note: { fontSize: 12, lineHeight: 1.45, margin: '6px 0 0', overflowWrap: 'anywhere' },
  paragraph: { fontSize: 13, lineHeight: 1.6, margin: '8px 0 0' },
  error: { fontSize: 12, lineHeight: 1.45, color: errorInk, margin: '6px 0 0', overflowWrap: 'anywhere' },
  toolbar: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', minWidth: 0, maxWidth: '100%' },
  search: { fontSize: 12, padding: '5px 10px', borderRadius: 7, width: 240, maxWidth: '100%', border, background: 'transparent', color: 'inherit' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', border, borderRadius: 10, minWidth: 0 },
  cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px 10px', flexWrap: 'wrap' },
  cardTitle: { fontSize: 13, fontWeight: 500, margin: 0, minWidth: 0, overflowWrap: 'anywhere' },
  badge: { fontSize: 11, padding: '2px 7px', borderRadius: 999, border },
  summary: { fontSize: 12, lineHeight: 1.5, margin: 0, overflowWrap: 'anywhere' },
  meta: { display: 'flex', alignItems: 'center', gap: '4px 12px', fontSize: 11, flexWrap: 'wrap', overflowWrap: 'anywhere', minWidth: 0 },
  name: { fontFamily: 'ui-monospace, monospace', minWidth: 0 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  button,
  danger: { ...button, color: errorInk },
  link: { ...button, borderColor: 'transparent', paddingInline: 4 },
  subhead: { fontSize: 13, fontWeight: 500, margin: '10px 0 4px' },
  bullets: { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 },
  bullet: { fontSize: 12, lineHeight: 1.5 },
}

/**
 * Build the catalogue tab using the shared modal.
 * @param {object} React the shared React instance.
 * @param {Function} Modal the shared client modal.
 * @param {string} [dialogClass] the scrollable details styling when assembled by the Client bundler.
 * @returns {{ MarketTab: Function }} the catalogue tab component.
 */
export function createMarketTab(React, Modal, dialogClass) {
  const h = React.createElement

  /** Remove confirmation applies only to the currently rendered bundle identity. */
  function CardActions({ card, t, state, actions, openInstall, installOfficial, openPackage, onDetails }) {
    const [confirming, setConfirming] = React.useState(false)
    const focusNext = React.useRef(false)
    const removeControl = React.useRef(null)
    React.useLayoutEffect(() => {
      if (focusNext.current) removeControl.current?.focus()
      focusNext.current = false
    }, [confirming])
    function showConfirmation(next) {
      focusNext.current = true
      setConfirming(next)
    }
    const busy = state.busy !== undefined
    return h('div', { style: styles.actions },
      onDetails === undefined ? null : h('button', { type: 'button', style: styles.link, onClick: onDetails }, t('details')),
      card.actions.map(action => {
        if (action.kind === 'remove' && confirming) {
          return h('span', { key: 'remove', style: styles.actions },
            h('button', { type: 'button', style: styles.danger, disabled: busy, onClick: () => {
              showConfirmation(false)
              void actions.remove(card.name)
            } }, t('confirm')),
            h('button', { ref: removeControl, type: 'button', style: styles.button, onClick: () => showConfirmation(false) }, t('cancel')),
          )
        }
        const activate = () => {
          if (busy && action.kind !== 'open') return
          switch (action.kind) {
            case 'installForm': openInstall(action.spec); break
            case 'installOfficial': installOfficial(card.name); break
            case 'enable': case 'disable': void actions.setEnabled(card.name, action.kind === 'enable'); break
            case 'update': void actions.update(card.name, action.version); break
            case 'open': openPackage(card.name); break
            case 'remove': showConfirmation(true); break
          }
        }
        const label = action.kind === 'update' ? `${t('update')} ${action.version}`
          : action.kind === 'installOfficial' ? t('install') : t(action.kind)
        const toggle = action.kind === 'enable' || action.kind === 'disable'
        return h('button', { type: 'button', key: toggle ? 'toggle' : action.kind,
          ref: action.kind === 'remove' ? removeControl : undefined,
          style: action.kind === 'remove' ? styles.danger : action.kind === 'open' ? styles.link : styles.button,
          'aria-disabled': busy && toggle ? true : undefined,
          disabled: busy && !toggle && action.kind !== 'open', onClick: activate,
        }, label)
      }),
    )
  }

  /** A settled change remains visible on the page and in open details. */
  function ChangeNotice({ notice, t }) {
    if (notice === undefined) return null
    const failed = notice.title === 'failed' || notice.title === 'transportError'
    return h('p', { role: failed ? 'alert' : 'status', style: failed ? styles.error : styles.note },
      t(notice.title), notice.diagnostic === undefined ? null : ` (${notice.diagnostic})`)
  }

  function BundleMeta({ card, t, pending }) {
    return h('div', { style: styles.meta },
      h('span', { style: styles.name }, card.name),
      h('span', null, `${t('versionLabel')}: ${card.version ?? t('unknownVersion')}`),
      pending ? h('span', { role: 'status' }, t('loading')) : null,
    )
  }

  function CardNotes({ card, t }) {
    return h(React.Fragment, null,
      card.note === undefined ? null : h('p', { style: styles.note }, t(card.note)),
      card.error === undefined ? null : h('p', { style: styles.error }, card.error),
    )
  }

  function DetailsDialog({ card, t, state, onClose, openInstall, installOfficial, openPackage, ...rest }) {
    if (card === undefined) return null
    function leave(next) {
      onClose()
      next()
    }
    return h(Modal, {
      open: true, onClose, title: card.title, closeLabel: t('close'), className: dialogClass,
      footer: h(CardActions, {
        ...rest, card, t, state, key: card.name,
        openInstall: spec => leave(() => openInstall(spec)),
        installOfficial: name => leave(() => installOfficial(name)),
        openPackage: name => leave(() => openPackage(name)),
      }),
    },
    h('span', { style: styles.badge }, t(card.badge)),
    h(BundleMeta, { card, t, pending: state.busy?.name === card.name }),
    h('p', { style: styles.summary }, card.summary),
    card.about.length === 0 ? null : h('p', { style: styles.paragraph }, card.about),
    card.points.length === 0 ? null : h('div', null,
      h('h3', { style: styles.subhead }, t('whatItDoes')),
      h('ul', { style: styles.bullets }, card.points.map(point => h('li', { key: point, style: styles.bullet }, point))),
    ),
    h(CardNotes, { card, t }), h(ChangeNotice, { notice: state.notice, t }))
  }

  function Card({ card, t, state, ...rest }) {
    return h('article', { style: styles.card },
      h('div', { style: styles.cardHead }, h('h3', { style: styles.cardTitle }, card.title), h('span', { style: styles.badge }, t(card.badge))),
      h('p', { style: styles.summary }, card.summary),
      h(BundleMeta, { card, t, pending: state.busy?.name === card.name }),
      h(CardNotes, { card, t }),
      h(CardActions, { ...rest, card, t, state, key: card.name }),
    )
  }

  function MarketTab({ useMarket, t, actions, openInstall, installOfficial, openPackage }) {
    const state = useMarket(snapshot => snapshot)
    const [query, setQuery] = React.useState('')
    const [detailsId, setDetailsId] = React.useState(undefined)
    const search = React.useRef(null)
    const activeCard = state.cards.find(card => card.id === detailsId)
    React.useEffect(() => { void actions.load() }, [actions])
    React.useLayoutEffect(() => {
      if (detailsId !== undefined && activeCard === undefined) {
        setDetailsId(undefined)
        search.current?.focus()
      }
    }, [detailsId, activeCard])

    if (state.status === 'loading') return h('p', { style: styles.note, role: 'status' }, t('loading'))
    if (state.status === 'error') {
      return h('div', null,
        h('p', { style: styles.error, role: 'alert' }, state.error),
        h('button', { type: 'button', style: styles.button, onClick: () => { void actions.load() } }, t('retry')),
      )
    }
    const visible = filterCards(state.cards, query)
    const controls = { t, state, actions, openInstall, installOfficial, openPackage }
    return h('div', { style: styles.root },
      h('div', { style: styles.head },
        h('div', null,
          h('h2', { style: styles.title }, t('title')),
          h('p', { style: styles.hint }, t('hint')),
          h('p', { style: styles.note }, `${t('installedLabel')}: ${state.counts.installed} / ${state.counts.total} · ${t('enabledLabel')}: ${state.counts.enabled}`
            + (query.trim().length === 0 ? '' : ` · ${t('foundLabel')}: ${visible.length}`)),
        ),
        h('div', { style: styles.toolbar },
          h('input', { ref: search, type: 'search', style: styles.search, value: query,
            placeholder: t('searchPlaceholder'), 'aria-label': t('search'), onChange: event => setQuery(event.target.value),
          }),
          h('button', { type: 'button', style: styles.button, onClick: () => { void actions.load() } }, t('refresh')),
        ),
      ),
      state.error === undefined ? null : h('p', { style: styles.error, role: 'alert' }, state.error),
      activeCard === undefined ? h(ChangeNotice, { notice: state.notice, t }) : null,
      visible.length === 0 ? h('p', { style: styles.note }, t(state.cards.length === 0 ? 'empty' : 'noMatches'))
        : h('div', { style: styles.list }, visible.map(card => h(Card, {
          ...controls, key: card.id, card, onDetails: () => setDetailsId(card.id),
        }))),
      h(DetailsDialog, { ...controls, card: activeCard, onClose: () => setDetailsId(undefined) }),
    )
  }

  return { MarketTab }
}
