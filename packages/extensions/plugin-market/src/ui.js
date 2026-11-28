/** Published catalogue, its live details, and navigation to the page-owned installer and Installed tab. */
import { filterCards } from './view.js'

/** @typedef {ReturnType<typeof import('./controller.js').createMarketController>} Market */
/** @typedef {ReturnType<Market['getSnapshot']>} MarketSnapshot */
/** @typedef {MarketSnapshot['cards'][number]} Card */
/** @typedef {import('@ocean/ocean-client-ui-plugin-manager/client').PluginTabProps} PluginTabProps */
/** @typedef {Pick<Market, 'load' | 'setEnabled' | 'getInstallTarget'>} MarketActions */
/** @typedef {(key: import('./locales.js').MarketKey, params?: Record<string, string | number>) => string} MarketTranslate */
/** @typedef {Pick<PluginTabProps, 'installPublished' | 'openPackage'> & {t: MarketTranslate, state: MarketSnapshot, actions: MarketActions}} Controls */

const border = '1px solid var(--dsw-alias-border-l2)'
const errorInk = 'var(--dsw-alias-state-error-primary)'
const brandInk = 'var(--dsw-alias-brand-primary)'
const button = { fontSize: 12, padding: '4px 10px', borderRadius: 7, border, background: 'transparent', color: 'inherit' }
// The primary management actions (install, turn on/off) carry the brand accent; Open and Details stay quiet links.
const accentButton = { ...button, color: brandInk,
  border: '1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, transparent)',
  background: 'color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent)' }
const idleInk = 'var(--dsw-alias-state-idle-primary)'
const warnInk = 'var(--dsw-alias-state-warn-primary)'
const successInk = 'var(--dsw-alias-state-success-primary)'
/** Status pill tone per badge, reusing the Plugins page state-color treatment. */
const badgeTone = { badgeOn: successInk, badgeOff: idleInk, badgeMissing: idleInk, badgeBlocked: warnInk,
  badgeBroken: errorInk, badgeIncompatible: warnInk, badgeUnknown: idleInk }
/** @param {string} badge the card's badge key @returns {import('react').CSSProperties} a compact state-colored pill */
function badgeStyle(badge) {
  const ink = badgeTone[badge] ?? idleInk
  return { fontSize: 11, fontWeight: 500, lineHeight: 1.4, padding: '2px 8px', borderRadius: 999,
    display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', whiteSpace: 'nowrap',
    color: ink, background: `color-mix(in srgb, ${ink} 12%, transparent)`, border: '1px solid transparent' }
}
/** @type {Record<string, import('react').CSSProperties>} */
const styles = {
  root: { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: 500, margin: '0 0 4px' },
  hint: { fontSize: 12, lineHeight: 1.45, opacity: 0.75, margin: '0 0 6px' },
  note: { fontSize: 12, lineHeight: 1.45, margin: '6px 0 0', overflowWrap: 'anywhere' },
  error: { fontSize: 12, lineHeight: 1.45, color: errorInk, margin: '6px 0 0', overflowWrap: 'anywhere' },
  toolbar: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', minWidth: 0, maxWidth: '100%' },
  search: { fontSize: 'max(1em, var(--dsw-font-base-16-font-size))', padding: '5px 10px', borderRadius: 7, width: 240, maxWidth: '100%', border, background: 'transparent', color: 'inherit' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', border, borderRadius: 10, minWidth: 0 },
  cardHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px 10px', flexWrap: 'wrap' },
  cardIdentity: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  artwork: { display: 'inline-flex', flex: 'none', alignItems: 'center', justifyContent: 'center', width: 36, height: 36,
    border: '0.5px solid var(--dsw-alias-border-l3)', borderRadius: 'var(--dsw-radius-lg)', color: 'var(--dsw-alias-label-secondary)' },
  artworkImage: { display: 'block', width: 30, height: 30, objectFit: 'contain' },
  cardTitle: { fontSize: 13, fontWeight: 500, margin: 0, minWidth: 0, overflowWrap: 'anywhere' },
  summary: { fontSize: 12, lineHeight: 1.5, margin: 0, overflowWrap: 'anywhere' },
  meta: { display: 'flex', alignItems: 'center', gap: '4px 12px', fontSize: 11, opacity: 0.85, flexWrap: 'wrap', overflowWrap: 'anywhere', minWidth: 0 },
  name: { fontFamily: 'ui-monospace, monospace', minWidth: 0 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  dialogBody: { display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 },
  dialogHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  detail: { fontSize: 13, lineHeight: 1.55, minWidth: 0, overflowWrap: 'anywhere' },
  button,
  link: { ...button, borderColor: 'transparent', paddingInline: 4 },
}

/**
 * Build the catalogue tab with the shared modal, which owns initial focus and normal return focus.
 * @param {typeof import('react')} React the shared React instance.
 * @param {typeof import('@ocean/ocean-client-ui-primitives')} primitives the shared client primitives: the modal, the
 * Markdown renderer of a long description, and the default plugin artwork.
 * @param {string} [dialogClass] the scrollable details styling; absent uses the shared modal alone.
 * @returns The catalogue tab component, ready to register in the Plugins page.
 */
export function createMarketTab(React, primitives, dialogClass) {
  const h = React.createElement
  const { Modal, MarkdownText, PluginArtworkDefault } = primitives

  /** @param {{icon: string | undefined}} props */
  function Artwork({ icon }) {
    const [failed, setFailed] = React.useState(/** @type {string | undefined} */ (undefined))
    return h('span', { style: styles.artwork, 'aria-hidden': 'true' },
      icon === undefined || icon === failed
        ? h(PluginArtworkDefault, { size: 30 })
        : h('img', { src: icon, width: 30, height: 30, alt: '', style: styles.artworkImage, onError: () => { setFailed(icon) } }),
    )
  }

  /**
   * Markdown chrome for a published long description; the reference must stay stable while the strings do.
   * @param {MarketTranslate} t the active dictionary.
   * @returns the renderer labels.
   */
  function useMarkdownLabels(t) {
    const copy = t('codeCopy')
    const copied = t('codeCopied')
    const code = t('codeBlock')
    const wrap = t('codeWrap')
    const unwrap = t('codeUnwrap')
    const footnotes = t('footnotes')
    return React.useMemo(() => ({
      code: { copyLabel: copy, copiedLabel: copied, toolbarLabels: { codeLabel: code, wrapLabel: wrap, unwrapLabel: unwrap } },
      footnotes,
    }), [copy, copied, code, wrap, unwrap, footnotes])
  }

  /** @param {Controls & {card: Card, onDetails?: () => void}} props */
  function CardActions({ card, t, state, actions, installPublished, openPackage, onDetails }) {
    const detailsButton = React.useRef(/** @type {HTMLButtonElement | null} */ (null))
    const installButton = React.useRef(/** @type {HTMLButtonElement | null} */ (null))
    const setInstallButton = React.useCallback(/** @param {HTMLButtonElement | null} next */ next => {
      const previous = installButton.current
      if (next === null && previous !== null && previous === previous.ownerDocument.activeElement) {
        const fallback = detailsButton.current ?? previous.closest('[role="dialog"]')
        if (fallback instanceof HTMLElement) fallback.focus({ preventScroll: true })
      }
      installButton.current = next
    }, [])
    return h('div', { style: styles.actions },
      onDetails === undefined ? null : h('button', { ref: detailsButton, type: 'button', style: styles.link, onClick: onDetails }, t('details')),
      card.actions.map(action => {
        const toggle = action.kind === 'enable' || action.kind === 'disable'
        const disabled = (action.kind !== 'open' && state.busy !== undefined) || (toggle && state.inventory !== 'ready')
        function activate() {
          if (disabled) return
          if (action.kind === 'install') {
            const target = actions.getInstallTarget(action.target)
            if (target !== undefined) installPublished(target)
          } else if (action.kind === 'open') {
            openPackage(card.name)
          } else {
            void actions.setEnabled(card.name, action.kind === 'enable')
          }
        }
        return h('button', { type: 'button', key: toggle ? 'toggle' : action.kind,
          ref: action.kind === 'install' ? setInstallButton : undefined,
          style: action.kind === 'open' ? styles.link : accentButton,
          'aria-disabled': disabled || undefined, onClick: activate,
        }, t(action.kind))
      }),
    )
  }

  /** @param {{notice: MarketSnapshot['notice'], t: MarketTranslate}} props */
  function ChangeNotice({ notice, t }) {
    if (notice === undefined) return null
    const failed = notice.title === 'failed' || notice.title === 'transportError'
    const message = t(notice.title)
    return h('p', { role: failed ? 'alert' : 'status', style: failed ? styles.error : styles.note },
      notice.diagnostic === undefined ? message : t('changeDiagnostic', { message, diagnostic: notice.diagnostic }))
  }

  /** @param {{card: Card, t: MarketTranslate, pending: boolean}} props */
  function BundleMeta({ card, t, pending }) {
    return h('div', { style: styles.meta },
      h('span', { style: styles.name }, card.name),
      card.installed ? h('span', null, t('installedVersion', { version: card.version ?? t('unknownVersion') })) : null,
      card.version === card.publishedVersion ? null : h('span', null, t('publishedVersion', { version: card.publishedVersion })),
      pending ? h('span', { role: 'status' }, t('changing')) : null,
    )
  }

  /** @param {{card: Card, t: MarketTranslate}} props */
  function CardNotes({ card, t }) {
    return h(React.Fragment, null,
      !card.compatible ? h('p', { style: styles.note }, t('noteIncompatible')) : null,
      card.note === undefined ? null : h('p', { style: styles.note }, t(card.note)),
      card.error === undefined ? null : h('p', { style: styles.error }, card.error),
    )
  }

  /** @param {{card: Card, t: MarketTranslate, state: MarketSnapshot}} props */
  function DetailBody({ card, t, state }) {
    const labels = useMarkdownLabels(t)
    return h('div', { style: styles.dialogBody },
      h('div', { style: styles.dialogHead },
        h(Artwork, { icon: card.icon }),
        h('span', { style: badgeStyle(card.badge) }, t(card.badge)),
      ),
      h(BundleMeta, { card, t, pending: state.busy?.name === card.name }),
      h('p', { style: styles.summary }, card.description),
      card.detail === undefined ? null : h('div', { style: styles.detail }, h(MarkdownText, { text: card.detail, labels, omitHtml: true })),
      h(CardNotes, { card, t }), h(ChangeNotice, { notice: state.notice, t }))
  }

  /** @param {Controls & {card: Card | undefined, onClose: () => void}} props */
  function DetailsDialog({ card, t, state, onClose, installPublished, openPackage, actions }) {
    if (card === undefined) return null
    return h(Modal, {
      open: true, onClose, title: card.title, closeLabel: t('close'), className: dialogClass,
      footer: card.actions.length === 0 ? undefined : h(CardActions, {
        card, t, state, actions,
        installPublished: target => { onClose(); installPublished(target) },
        openPackage: name => { onClose(); openPackage(name) },
      }),
    }, h(DetailBody, { card, t, state }))
  }

  /** @param {Controls & {card: Card, onDetails: () => void}} props */
  function MarketCard({ card, t, state, ...rest }) {
    return h('article', { style: styles.card },
      h('div', { style: styles.cardHead },
        h('div', { style: styles.cardIdentity },
          h(Artwork, { icon: card.icon }),
          h('h3', { style: styles.cardTitle }, card.title)),
        h('span', { style: badgeStyle(card.badge) }, t(card.badge))),
      h('p', { style: styles.summary }, card.description),
      h(BundleMeta, { card, t, pending: state.busy?.name === card.name }),
      h(CardNotes, { card, t }),
      h(CardActions, { ...rest, card, t, state }),
    )
  }

  /** @param {Controls & {useMarket: <T>(select: (snapshot: MarketSnapshot) => T) => T}} props */
  function MarketTab({ useMarket, t, actions, installPublished, openPackage }) {
    const state = useMarket(snapshot => snapshot)
    const [query, setQuery] = React.useState('')
    const [detailsName, setDetailsName] = React.useState(/** @type {string | undefined} */ (undefined))
    const refresh = React.useRef(/** @type {HTMLButtonElement | null} */ (null))
    const activeCard = state.cards.find(card => card.name === detailsName)
    const detailsRemoved = detailsName !== undefined && activeCard === undefined
    React.useEffect(() => { void actions.load() }, [actions])
    React.useEffect(() => {
      if (detailsRemoved) {
        setDetailsName(undefined)
        // The detached card's Details button is no longer a return-focus target for the shared modal.
        refresh.current?.focus({ preventScroll: true })
      }
    }, [detailsRemoved])

    const visible = filterCards(state.cards, query)
    const controls = { t, state, actions, installPublished, openPackage }
    const degraded = state.status === 'stale' || state.status === 'unavailable'
    return h('div', { style: styles.root },
      h('div', { style: styles.head },
        h('div', null,
          h('h2', { style: styles.title }, t('title')),
          h('p', { style: styles.hint }, t('hint')),
          state.hasCatalog && state.inventory === 'ready' ? h('p', { style: styles.note }, t('counts', state.counts)) : null,
        ),
        h('div', { style: styles.toolbar },
          h('input', { type: 'search', style: styles.search, value: query,
            placeholder: t('searchPlaceholder'), 'aria-label': t('search'), onChange: event => setQuery(event.currentTarget.value),
          }),
          h('button', { ref: refresh, type: 'button', style: styles.button, onClick: () => { void actions.load() } }, t('refresh')),
        ),
      ),
      state.status === 'loading' ? h('p', { style: styles.note, role: 'status' }, t('loading')) : null,
      degraded ? h('p', { style: state.hasCatalog ? styles.note : styles.error, role: state.hasCatalog ? 'status' : 'alert' },
        t(state.hasCatalog ? 'cached' : 'unavailable')) : null,
      state.inventory === 'unavailable' ? h('p', { style: styles.error, role: 'alert' }, t('inventoryUnavailable')) : null,
      activeCard === undefined ? h(ChangeNotice, { notice: state.notice, t }) : null,
      !state.hasCatalog ? null : visible.length === 0 ? h('p', { style: styles.note }, t(state.cards.length === 0 ? 'empty' : 'noMatches'))
        : h('div', { style: styles.list }, visible.map(card => h(MarketCard, {
          ...controls, key: card.name, card, onDetails: () => setDetailsName(card.name),
        }))),
      h(DetailsDialog, { ...controls, card: activeCard, onClose: () => setDetailsName(undefined) }),
    )
  }

  return { MarketTab }
}
