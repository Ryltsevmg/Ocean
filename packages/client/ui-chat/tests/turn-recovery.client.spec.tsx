// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ModelCatalog } from '@ocean/ocean-api-session-controller/types'
import type { ChatViewSlotProps } from '../src/client/contract/slots.ts'
import { TurnRecovery, canRecoverRoute } from '../src/client/chat/TurnRecovery.tsx'
import { en } from '../src/client/locale.ts'

afterEach(cleanup)
const t: ChatViewSlotProps['t'] = key => Object.hasOwn(en, key) ? en[key as keyof typeof en] : key
const catalog: ModelCatalog = {
  default: { provider: 'available', model: 'model' },
  routableProviders: ['available'], failures: [],
  groups: [{ id: 'available', name: 'Available provider', models: [{ id: 'model', name: 'Chosen model' }] }],
}

it('requires an explicit choice instead of selecting the catalog default', async () => {
  const recoverAt = vi.fn(async () => {})
  render(<TurnRecovery seq={42} t={t} loadRecoveryModels={async () => catalog} recoverAt={recoverAt} />)
  fireEvent.click(screen.getByRole('button', { name: en['message.recovery.open'] }))
  const radio = await screen.findByRole('radio', { name: 'Available provider / Chosen model' })
  const confirm = screen.getByRole('button', { name: en['message.recovery.confirm'] })
  expect(radio).toHaveProperty('checked', false)
  expect(confirm).toHaveProperty('disabled', true)
  expect(recoverAt).not.toHaveBeenCalled()
  fireEvent.click(radio)
  expect(confirm).toHaveProperty('disabled', false)
  await act(async () => { fireEvent.click(confirm) })
  expect(recoverAt).toHaveBeenCalledExactlyOnceWith(42, { provider: 'available', model: 'model' })
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('cancels a pending catalog read without creating or reopening a conversation', async () => {
  const pending = Promise.withResolvers<ModelCatalog>()
  const recoverAt = vi.fn(async () => {})
  render(<TurnRecovery seq={42} t={t} loadRecoveryModels={() => pending.promise} recoverAt={recoverAt} />)
  fireEvent.click(screen.getByRole('button', { name: en['message.recovery.open'] }))
  expect(screen.getByRole('status').textContent).toBe(en['message.recovery.loading'])
  fireEvent.click(screen.getAllByRole('button', { name: en['message.recovery.cancel'] }).at(-1)!)
  await act(async () => { pending.resolve(catalog) })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(recoverAt).not.toHaveBeenCalled()
})

it('reports an empty catalog and does not offer a default fallback', async () => {
  render(<TurnRecovery seq={42} t={t} loadRecoveryModels={async () => ({ ...catalog, groups: [] })} recoverAt={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: en['message.recovery.open'] }))
  await screen.findByText(en['message.recovery.empty'])
  expect(screen.queryByRole('radio')).toBeNull()
  expect(screen.getByRole('button', { name: en['message.recovery.confirm'] })).toHaveProperty('disabled', true)
})

it('keeps catalog failures localized without exposing provider diagnostics', async () => {
  render(<TurnRecovery seq={42} t={t}
    loadRecoveryModels={async () => { throw new Error('private provider diagnostic') }} recoverAt={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: en['message.recovery.open'] }))
  expect((await screen.findByRole('alert')).textContent).toBe(en['message.recovery.catalogError'])
  expect(screen.queryByText('private provider diagnostic')).toBeNull()
})

it('prevents duplicate submission and reports an uncertain outcome without retrying', async () => {
  const pending = Promise.withResolvers<undefined>()
  const recoverAt = vi.fn(() => pending.promise)
  render(<TurnRecovery seq={42} t={t} loadRecoveryModels={async () => catalog} recoverAt={recoverAt} />)
  fireEvent.click(screen.getByRole('button', { name: en['message.recovery.open'] }))
  fireEvent.click(await screen.findByRole('radio'))
  fireEvent.click(screen.getByRole('button', { name: en['message.recovery.confirm'] }))
  expect(screen.getByRole('button', { name: en['message.recovery.creating'] })).toHaveProperty('disabled', true)
  expect(screen.getAllByRole('button', { name: en['message.recovery.cancel'] }).at(-1)).toHaveProperty('disabled', true)
  await act(async () => { pending.reject(new Error('unknown remote outcome')) })
  expect(screen.getByRole('alert').textContent).toBe(en['message.recovery.failed'])
  expect(recoverAt).toHaveBeenCalledTimes(1)
})

it.each(['NO_ADAPTER', 'AUTH', 'MISSING_CREDENTIAL', 'ACCOUNT_SIGN_IN_REQUIRED', 'ACCOUNT_TOKEN_INVALID', 'ACCOUNT_SIGNED_OUT'])(
  'offers route recovery for %s', (code) => { expect(canRecoverRoute(code)).toBe(true) },
)
it.each([undefined, 'QUOTA', 'RATE_LIMIT', 'UNKNOWN', 'TRANSPORT'])(
  'does not misclassify %s as a model-route failure', (code) => { expect(canRecoverRoute(code)).toBe(false) },
)
