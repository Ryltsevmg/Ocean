/** Current Host and pending input across independent Desktop connections. */
import { useState } from 'react'
import { IconGlobeOutlineRegular, Menu, MenuItemButton, Tooltip } from '@ocean/ocean-client-ui-primitives'
import type { HostEntry, HostNavigationProps } from './hosts.ts'
import css from './HostNavigation.module.css'

/**
 * Render the Host selector in both the expanded sidebar and its compact rail.
 * @param props - Framework-bound Host snapshot, actions and localized labels.
 * @returns Current Host control and navigation menu.
 */
export function HostNavigation({ wide, useHosts, select, retry, t }: HostNavigationProps) {
  const state = useHosts(value => value)
  const [open, setOpen] = useState(false)
  const selection = state.selection
  const current = selection?.entries.find(entry => entry.id === selection.selected)
  const label = current?.label ?? state.address ?? t('hosts.local')
  const counts = (entry: HostEntry): string => entry.pendingApprovals === undefined || entry.pendingQuestions === undefined
    ? t('hosts.pendingUnknown')
    : t('hosts.pending', { approvals: entry.pendingApprovals, questions: entry.pendingQuestions })
  const totals = selection?.entries.reduce((sum, entry) => ({
    approvals: sum.approvals + (entry.pendingApprovals ?? 0),
    questions: sum.questions + (entry.pendingQuestions ?? 0),
  }), { approvals: 0, questions: 0 }) ?? { approvals: 0, questions: 0 }
  const waiting = totals.approvals + totals.questions
  const description = selection !== undefined && waiting > 0
    ? `${label}. ${selection.label}: ${t('hosts.pending', totals)}`
    : current === undefined ? label : `${label}. ${counts(current)}`
  const navigate = (hostId: string, sessionId?: string): void => { setOpen(false); select(hostId, sessionId) }
  const trigger = <Tooltip label={description} disabled={wide}>
    <button type="button" className={css.trigger} aria-label={description} title={wide ? label : undefined}
      aria-haspopup="menu" aria-expanded={open} disabled={state.busy} onClick={() => { setOpen(value => !value) }}>
      <IconGlobeOutlineRegular size={18} />
      {wide && <span className={css.title}>{label}</span>}
      {waiting > 0 && <span className={css.badge}>{waiting}</span>}
    </button>
  </Tooltip>
  return <div className={css.root} data-wide={wide || undefined}>
    <Menu open={open} onClose={() => { setOpen(false) }} portal autoFocus className={css.anchor}
      listClassName={css.menu} anchor={trigger}>
      {selection === undefined
        ? <MenuItemButton onSelect={() => { setOpen(false) }}>{label}</MenuItemButton>
        : selection.entries.map(entry => <MenuItemButton key={entry.id} current={entry.id === selection.selected} aria-label={`${entry.label}. ${counts(entry)}`}
          onSelect={() => { navigate(entry.id) }}>
          <span className={css.entry}>
            <span className={css.title}>{entry.label}</span>
            <span className={css.pending}>{counts(entry)}</span>
          </span>
        </MenuItemButton>)}
      {selection?.entries.flatMap(entry => (entry.sessions ?? []).map((session, index) =>
        <MenuItemButton key={`${entry.id}/${session.id}`} separatorBefore={index === 0} aria-label={`${session.title} ${entry.label}`}
          onSelect={() => { navigate(entry.id, session.id) }}>
          <span className={css.entry}>
            <span className={css.title}>{session.title}</span><span className={css.pending}>{entry.label}</span>
          </span>
        </MenuItemButton>))}
    </Menu>
    {state.error !== undefined && <div role="status" className={css.error}>
      <button type="button" className={css.retry} onClick={retry} title={t(`hosts.error.${state.error}`)}>
        {wide ? t(`hosts.error.${state.error}`) : t('hosts.retry')}
      </button>
    </div>}
  </div>
}
