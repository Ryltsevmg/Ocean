/** Explicit, review-before-write configuration; saved does not mean connected. */
import css from './panel.module.css'
import { useEffect } from 'react'
import { Button } from '@ocean/ocean-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@ocean/ocean-client-ui-slots'
import type { SetupFace } from './controller.ts'
import type { NS } from './locales.ts'
/** Slot-supplied state and user actions. */
export type SetupPanelProps = InjectFace<SetupFace> & PropsLocale<typeof NS>
/** Configuration form never handles token contents. */
export function SetupPanel(props: SetupPanelProps) {
  const view = props.useBrowserSetup(value => value)
  useEffect(() => { props.refresh() }, [props.refresh])
  const disabled = view.busy || !view.status?.writable || view.status.blocked
  return <section className={css.panel} aria-label={props.t('title')}>
    <h3>{props.t('title')}</h3><p>{props.t('help')}</p>
    <p role="status">{props.t(view.saved ? 'saved' : 'notTested')}</p>
    {view.status?.blocked && <p role="alert">{props.t('blocked')}</p>}
    {view.status && !view.status.writable && <p>{props.t('readOnly')}</p>}
    {view.error && <p role="alert">{props.t(view.error === 'read' ? 'readError' : 'saveError')}</p>}
    <fieldset className={css.fields} disabled={disabled}>
      <legend>{props.t('summary')}</legend>
      {(['endpoint', 'tokenFile', 'browser'] as const).map(field => <p key={field}><label>
        {props.t(field)} <input type="text" autoComplete="off" value={view.draft[field]} onChange={(event) =>{  props.edit(field, event.target.value) }} />
      </label></p>)}
      <p><label>{props.t('origins')}<textarea rows={4} autoComplete="off" value={view.draft.origins} onChange={(event) =>{  props.edit('origins', event.target.value) }} /></label></p>
      <p><label className={css.toggle}><input type="checkbox" checked={view.draft.enabled} onChange={(event) =>{  props.edit('enabled', event.target.checked) }} />{props.t('enabled')}</label></p>
      <p>{props.t('enabledHelp')}</p>
      <Button disabled={disabled} onClick={props.requestSave}>{props.t('save')}</Button>
    </fieldset>
    <Button variant="outline" disabled={view.busy} onClick={props.refresh}>{props.t('refresh')}</Button>
    {view.confirming && <section className={css.confirmation} role="alertdialog" aria-label={props.t('confirm')}>
      <h4>{props.t('confirm')}</h4><p>{props.t('consequences')}</p>
      <Button disabled={view.busy} onClick={props.confirmSave}>{props.t('confirmSave')}</Button>
      <Button variant="outline" disabled={view.busy} onClick={props.cancelSave}>{props.t('cancel')}</Button>
    </section>}
  </section>
}
