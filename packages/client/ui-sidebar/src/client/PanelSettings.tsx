/** Global panel launchers hosted in Settings, including plugin-provided More actions. */
import { useState } from 'react'
import clsx from 'clsx'
import { IconAppsAddOutlineRegular, Menu, Tooltip } from '@ocean/ocean-client-ui-primitives'
import type {} from '@ocean/ocean-client-ui-settings/client'
import type { InjectFace, PropsLocale, PropsRenderFactories, PropsRenderSlots, PropsRuntime } from '@ocean/ocean-client-ui-slots'
import type { SidebarPanelActionsOwnerProps, SidebarRootInjected, SidebarSectionOwnerProps } from './contract/slots.ts'
import { PanelRow, officialEntry } from './PanelRow.tsx'
import { FIXED_PANEL_ID } from './panel-pins.ts'
import css from './SidebarRoot.module.css'

type PanelMoreMenuProps =
  Pick<SidebarSectionOwnerProps, 'wide'>
  & Omit<SidebarPanelActionsOwnerProps, 'onDismiss'>
  & PropsRenderSlots<'sidebar.panellist.actions'>
  & Pick<InjectFace<SidebarRootInjected>, 'trackEntryClick'>
  & { readonly label: string; readonly onNavigate: () => void }

/** The panel list's More launcher: a panel-row button whose menu rows come from `sidebar.panellist.actions`. */
function PanelMoreMenu({ wide, label, entries, onOpen, onPinnedChange, trackEntryClick, renderSlot, onNavigate }: PanelMoreMenuProps) {
  const [open, setOpen] = useState(false)
  const onDismiss = (): void => { setOpen(false) }
  return (
    <Menu open={open} onClose={onDismiss} portal autoFocus className={css.moreAnchor} listClassName={css.moreMenu}
      anchor={(
        <Tooltip label={label} delayMs={500} disabled={wide}>
          <button type="button" className={css.panelRow} aria-label={label} aria-haspopup="menu" aria-expanded={open}
            onClick={() => {
              trackEntryClick({ menu_name: 'more', position: 'sidebar' })
              setOpen(value => !value)
            }}>
            <span className={css.panelGlyph} aria-hidden="true"><IconAppsAddOutlineRegular size={wide ? 16 : 18} /></span>
            {wide && <span className={clsx(css.panelTitle, css.wide)}>{label}</span>}
          </button>
        </Tooltip>
      )}>
      {renderSlot('sidebar.panellist.actions', { entries, onOpen, onPinnedChange, onDismiss, onNavigate })}
    </Menu>
  )
}

type PanelSettingsProps = PropsRuntime<'settings.navigation'>
  & InjectFace<SidebarRootInjected> & PropsLocale<'sidebar'>
  & PropsRenderFactories & PropsRenderSlots<'sidebar.panellist.actions'>

/** Render all registered panels without leaving plugin launchers stranded in the sidebar.
 * @param props - Settings close action and the sidebar-owned panel registry.
 * @returns The panel navigation, or nothing while no panels are registered.
 */
export function PanelSettings({ close, selectPanel: openPanel, setPinned, trackEntryClick,
  usePanels, useEntryPins, useEntryActions, usePanelInfo, t, renderSlot, renderFactorySlot,
}: PanelSettingsProps) {
  const registeredPanels = usePanels(snapshot => snapshot)
  const panels = registeredPanels.filter(panel => panel.id !== 'schedules')
  const unpinned = useEntryPins(ids => ids)
  const activePanelId = usePanelInfo(info => info.activePanelId)
  const hasEntryActions = useEntryActions(registered => registered)
  const wide = true
  const selectPanel: SidebarRootInjected['selectPanel'] = (id) => {
    close()
    openPanel(id)
  }
  return <div className={css.settingsPanels}>
    {panels.length > 0 && (
      <nav className={css.panelList} aria-label={t('panels.label')}>
        {panels.filter(({ id }) => id === FIXED_PANEL_ID || !hasEntryActions || !unpinned.includes(id)).map(({ id, label }) => (
          <PanelRow
            key={id}
            id={id}
            label={label}
            wide={wide}
            unpinLabel={t('panels.unpin', { name: label })}
            unpinTooltip={t('panels.unpinTooltip')}
            canUnpin={hasEntryActions && id !== FIXED_PANEL_ID}
            setPinned={setPinned}
            usePanelInfo={usePanelInfo}
            selectPanel={selectPanel}
            trackEntryClick={trackEntryClick}
            renderFactorySlot={renderFactorySlot}
          />
        ))}
        {hasEntryActions && (
          <PanelMoreMenu
            wide={wide}
            label={t('panels.more')}
            entries={panels.filter(({ id }) => id !== FIXED_PANEL_ID)
              .map(({ id, label }) => ({ id, label, pinned: !unpinned.includes(id), active: id === activePanelId }))}
            onOpen={(id) => {
              const entry = officialEntry(id)
              if (entry !== undefined) trackEntryClick({ menu_name: entry, position: 'sidebar_more' })
              const panel = registeredPanels.find(candidate => candidate.id === id)
              if (panel !== undefined) selectPanel(panel.id)
            }}
            onNavigate={close}
            onPinnedChange={setPinned}
            trackEntryClick={trackEntryClick}
            renderSlot={renderSlot}
          />
        )}
      </nav>
    )}
  </div>
}
