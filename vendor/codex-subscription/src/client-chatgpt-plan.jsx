import { useEffect, useState } from 'react'
import { Button, Input } from './client-primitives.jsx'
import { recoveryCall } from './client-recovery.js'

/** Primary account UI. Legacy credentials remain independently owned and untouched. */
export function ChatGPTPlanCard({ rpc, t, active }) {
  const [status, setStatus] = useState()
  const [label, setLabel] = useState('')
  const [models, setModels] = useState()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [signOutId, setSignOutId] = useState()
  const [revocationUnconfirmed, setRevocationUnconfirmed] = useState(false)
  const [adding, setAdding] = useState(false)
  const call = (endpoint, payload = {}) => recoveryCall(rpc, endpoint, payload, 30000)
  useEffect(() => {
    if (!active) return undefined
    let live = true
    let polling = false
    const read = async () => {
      if (polling) return
      polling = true
      try { const value = await call('plan/status'); if (live) setStatus(value) }
      catch { if (live) setError(true) }
      finally { polling = false }
    }
    void read()
    const timer = window.setInterval(() => void read(), 2000)
    return () => { live = false; window.clearInterval(timer) }
  }, [rpc, active])
  const selected = status?.accounts?.find(account => account.id === status.activeId)
  useEffect(() => { setSignOutId(undefined) }, [status?.activeId])
  const connected = Boolean(selected && !selected.signedOut && !selected.retired && !selected.reauthorizationRequired)
  const waiting = status?.phase === 'starting' || status?.phase === 'waiting_browser'
  // Catalog results belong to one account; never display another account's cached result.
  const visibleModels = connected && models?.accountId === status?.activeId ? models?.items : undefined
  const run = async (endpoint, payload = {}) => {
    setBusy(true); setError(false)
    try {
      const result = await call(endpoint, payload)
      if (endpoint === 'plan/models') setModels({ accountId: status?.activeId, items: result })
      else {
        setStatus(result); setModels(undefined)
        if (endpoint === 'plan/account/select') setSignOutId(undefined)
        if (endpoint === 'plan/login/start') setAdding(false)
        if (endpoint === 'plan/account/sign-out' || endpoint === 'plan/account/recover-sign-out') { setRevocationUnconfirmed(!result.remoteRevoked); setSignOutId(undefined) }
      }
    } catch { setError(true) } finally { setBusy(false) }
  }
  const disabled = busy || waiting || !status
  return <section className="codexSubscriptionCard codexPlanCard" aria-label={t('planTitle')} aria-busy={busy}>
    <div className="codexPlanHeader"><div><h3>{t('planTitle')}</h3><p className="codexPlanHint">{t('planDescription')}</p></div><span className="codexPlanStatus" data-connected={connected} role="status">{t(!status ? 'planLoading' : waiting ? 'planWaitingShort' : connected ? 'planConnected' : 'planDisconnected')}</span></div>
    {status?.accounts?.map(account => <div className="codexPlanAccount" key={account.id}>
      <div className="codexPlanAccountRow"><strong>{account.label}</strong>{account.id === status.activeId && <span className="codexPlanHint">{t('planSelected')}</span>}
      {account.id !== status.activeId && !account.retired && <Button variant="outline" size="sm" disabled={disabled} onClick={() => void run('plan/account/select', { id: account.id })}>{t('planSelect')}</Button>}
      {account.reauthorizationRequired && !account.retired && !account.revocationPending && <Button variant="outline" size="sm" disabled={disabled} onClick={() => void run('plan/login/start', { label: account.label, renewId: account.id })}>{t('planRenew')}</Button>}</div>
      {account.retired && <p className="codexPlanHint">{t('planRetired')}</p>}
      {account.revocationUnconfirmed && <p className="codexSubscriptionError" role="alert">{t('planRevocationUnconfirmed')}</p>}
    </div>)}
    {waiting ? <div className="codexPlanActions"><p role="status">{t('planWaiting')}</p><Button variant="outline" disabled={busy} onClick={() => void run('plan/login/cancel')}>{t('planCancel')}</Button></div> : (!selected || adding || selected.retired) ? <div className="codexPlanSignIn">
      <label className="codexPlanLabel">{t('planLabel')}<Input value={label} maxLength={48} onChange={event => setLabel(event.target.value)} /></label>
      <div className="codexPlanActions"><Button variant="primary" disabled={disabled} onClick={() => void run('plan/login/start', { label: label.trim() || t('planDefaultLabel') })}>{t('planSignIn')}</Button>{adding && <Button disabled={disabled} onClick={() => setAdding(false)}>{t('planCancel')}</Button>}</div>
    </div> : null}
    <div className="codexPlanActions">
      {selected && <Button variant="primary" disabled={disabled || !connected} onClick={() => void run('plan/models')}>{t('planLoadModels')}</Button>}
      {selected && !adding && !waiting && <Button variant="outline" disabled={busy} onClick={() => setAdding(true)}>{t('planAddAccount')}</Button>}
      {selected && !selected.signedOut && !signOutId && <Button variant="outline" disabled={disabled} onClick={() => setSignOutId(selected.id)}>{t(selected.revocationPending ? 'planRecover' : 'planSignOut')}</Button>}
    </div>
    {signOutId && selected?.id === signOutId && <div className="codexPlanConfirm"><p>{t(selected.revocationPending ? 'planRecoveryConfirm' : 'planSignOutConfirm')}</p><div className="codexPlanActions"><Button variant="outline" disabled={busy} onClick={() => void run(selected.revocationPending ? 'plan/account/recover-sign-out' : 'plan/account/sign-out', { id: signOutId, confirm: true })}>{t(selected.revocationPending ? 'planRecover' : 'planSignOut')}</Button><Button disabled={busy} onClick={() => setSignOutId(undefined)}>{t('planCancel')}</Button></div></div>}
    {revocationUnconfirmed && <p className="codexSubscriptionError" role="alert">{t('planRevocationUnconfirmed')}</p>}
    {status?.cleanupUnconfirmed && <p className="codexSubscriptionError" role="alert">{t('planRevocationUnconfirmed')}</p>}
    {(status?.phase === 'failed' || error) && <p className="codexSubscriptionError" role="alert">{t('planFailed')}</p>}
    <p className="codexPlanHint">{t('planCatalogOnly')}</p>
    {visibleModels && (visibleModels.length ? <ul className="codexPlanModels" aria-label={t('planModelsTitle')}>{visibleModels.map(model => <li key={model.id}>{model.name}</li>)}</ul> : <p role="status">{t('planEmpty')}</p>)}
  </section>
}
