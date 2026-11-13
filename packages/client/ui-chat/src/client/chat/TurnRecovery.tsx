/** Explicit model selection for continuing failed history in a separate conversation. */
import { useRef, useState } from 'react'
import type { InjectFace } from '@ocean/ocean-client-ui-slots'
import type { ModelCatalog, ModelSelection } from '@ocean/ocean-api-session-controller/types'
import { Button, Modal } from '@ocean/ocean-client-ui-primitives'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import css from './TurnRecovery.module.css'

/** Session-scoped operations for explicitly recovering a failed conversation. */
export interface TurnRecoveryInjected {
  canRecover: boolean
  loadRecoveryModels: () => Promise<ModelCatalog>
  recoverAt: (seq: number, selection: ModelSelection) => Promise<void>
}

/**
 * Identify terminal route or authentication failures that support model recovery.
 * @param code - Terminal failure code, not an RPC admission error.
 * @returns Whether an explicit replacement route can address this failure.
 */
export function canRecoverRoute(code: string | undefined): boolean {
  return code === 'NO_ADAPTER' || code === 'AUTH' || code === 'MISSING_CREDENTIAL'
    || code === 'ACCOUNT_SIGN_IN_REQUIRED' || code === 'ACCOUNT_TOKEN_INVALID'
    || code === 'ACCOUNT_SIGNED_OUT'
}

type RecoveryState =
  | { kind: 'closed' }
  | { kind: 'loading' }
  | { kind: 'load-error' }
  | { kind: 'ready'; catalog: ModelCatalog; selected: string; failed: boolean }
  | { kind: 'submitting'; catalog: ModelCatalog; selected: string }

/**
 * Require a model choice before creating a child; never send or retry input.
 * @param props - Failed-turn boundary, localized labels, and recovery operations.
 * @returns The recovery action and its controlled model-selection dialog.
 */
export function TurnRecovery({ seq, t, loadRecoveryModels, recoverAt }: {
  seq: number
  t: ChatViewSlotProps['t']
} & Pick<InjectFace<TurnRecoveryInjected>, 'loadRecoveryModels' | 'recoverAt'>) {
  const [state, setState] = useState<RecoveryState>({ kind: 'closed' })
  const generation = useRef(0)
  const close = (): void => {
    if (state.kind === 'submitting') return
    generation.current += 1
    setState({ kind: 'closed' })
  }
  const open = (): void => {
    const current = ++generation.current
    setState({ kind: 'loading' })
    void loadRecoveryModels().then((catalog) => {
      if (generation.current === current) setState({ kind: 'ready', catalog, selected: '', failed: false })
    }, () => {
      if (generation.current === current) setState({ kind: 'load-error' })
    })
  }
  const choices = state.kind === 'ready' || state.kind === 'submitting'
    ? state.catalog.groups.flatMap(group => group.models.map(model => ({
      key: JSON.stringify([group.id, model.id]),
      label: `${group.name} / ${model.name}`,
      selection: { provider: group.id, model: model.id },
    })))
    : []
  const selected = state.kind === 'ready' || state.kind === 'submitting'
    ? choices.find(choice => choice.key === state.selected)
    : undefined
  const submit = (): void => {
    if (state.kind !== 'ready' || selected === undefined) return
    const ready = state
    setState({ kind: 'submitting', catalog: ready.catalog, selected: ready.selected })
    void recoverAt(seq, selected.selection).then(() => {
      setState({ kind: 'closed' })
    }, () => {
      setState({ ...ready, failed: true })
    })
  }
  return (
    <div className={css.recovery}>
      <p>{t('message.recovery.hint')}</p>
      <Button variant="outline" size="sm" onClick={open}>{t('message.recovery.open')}</Button>
      <Modal open={state.kind !== 'closed'} onClose={close} title={t('message.recovery.title')}
        closeLabel={t('message.recovery.cancel')} description={t('message.recovery.description')}>
        {state.kind === 'loading' && <p role="status">{t('message.recovery.loading')}</p>}
        {state.kind === 'load-error' && <p role="alert">{t('message.recovery.catalogError')}</p>}
        {(state.kind === 'ready' || state.kind === 'submitting') && (
          <>
            {choices.length === 0 ? <p role="status">{t('message.recovery.empty')}</p> : (
              <fieldset className={css.choices} disabled={state.kind === 'submitting'}>
                <legend>{t('message.recovery.model')}</legend>
                {choices.map(choice => (
                  <label key={choice.key} className={css.choice}>
                    <input type="radio" name="recovery-model" value={choice.key} checked={state.selected === choice.key}
                      onChange={() => { if (state.kind === 'ready') setState({ ...state, selected: choice.key, failed: false }) }} />
                    <span>{choice.label}</span>
                  </label>
                ))}
              </fieldset>
            )}
            {state.kind === 'ready' && state.failed && <p role="alert">{t('message.recovery.failed')}</p>}
          </>
        )}
        <div className={css.actions}>
          <Button variant="ghost" onClick={close} disabled={state.kind === 'submitting'}>{t('message.recovery.cancel')}</Button>
          <Button variant="primary" onClick={submit} disabled={state.kind !== 'ready' || selected === undefined}>
            {t(state.kind === 'submitting' ? 'message.recovery.creating' : 'message.recovery.confirm')}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
