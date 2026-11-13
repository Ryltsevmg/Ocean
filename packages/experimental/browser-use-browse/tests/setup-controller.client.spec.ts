import { expect, it, vi } from 'vitest'
import { SetupController, type SetupStatus } from '../src/client/controller.ts'
const initial: SetupStatus = { revision: 'one', enabled: false, writable: true, blocked: false,
  configuration: { endpoint: 'http://127.0.0.1:19988', tokenFile: '', browser: '', allowedOrigins: [] }, connection: 'not-tested' }
const flush = async () => { await Promise.resolve(); await Promise.resolve() }
it('reads without writing, requires review, cancels, and deduplicates confirmations', async () => {
  const save = vi.fn(async () => ({ ok: true as const, value: initial }))
  const controller = new SetupController({ status: async () => ({ ok: true, value: initial }), save })
  const face = controller.face(); face.refresh(); await flush()
  face.edit('browser', 'paired'); face.confirmSave(); expect(save).not.toHaveBeenCalled()
  face.requestSave(); face.cancelSave(); face.confirmSave(); expect(save).not.toHaveBeenCalled()
  face.requestSave(); face.confirmSave(); face.confirmSave(); await flush()
  expect(save).toHaveBeenCalledTimes(1)
  expect(controller.state.getSnapshot().saved).toBe(true)
  controller.dispose()
})
it('invalidates confirmation after editing and makes uncertain writes require a new read', async () => {
  const save = vi.fn(async () => { throw new Error('uncertain') })
  const controller = new SetupController({ status: async () => ({ ok: true, value: initial }), save })
  const face = controller.face(); face.refresh(); await flush()
  face.requestSave(); face.edit('origins', 'https://example.com'); face.confirmSave()
  expect(save).not.toHaveBeenCalled()
  face.requestSave(); face.confirmSave(); await flush()
  expect(controller.state.getSnapshot().status).toBeNull()
  face.requestSave(); face.confirmSave(); expect(save).toHaveBeenCalledTimes(1)
  controller.dispose()
})
it('does not publish a late read after disposal or issue writes from a stale face', async () => {
  let complete!: (v: { ok:true;value:SetupStatus })=>void
  const save = vi.fn(async () => ({ ok:true as const,value:initial }))
  const controller = new SetupController({ status: () => new Promise((resolve) => {complete=resolve}), save })
  const face=controller.face();face.refresh();controller.dispose();complete({ ok:true,value:initial });await flush()
  expect(controller.state.getSnapshot().status).toBeNull()
  face.requestSave();face.confirmSave();expect(save).not.toHaveBeenCalled()
})
