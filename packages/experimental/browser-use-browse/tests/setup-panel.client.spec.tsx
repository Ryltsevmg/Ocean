// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { bindSnapshotSelector, makeTranslate } from '@ocean/ocean-client-test-runtime'
import { SetupController, type SetupSave, type SetupStatus } from '../src/client/controller.ts'
import { SetupPanel, type SetupPanelProps } from '../src/client/panel.tsx'
import { en } from '../src/client/locales.ts'
afterEach(cleanup)
it('requires explicit review and confirmation, and never claims a saved connection is tested', async () => {
  const initial: SetupStatus = { revision:'one',enabled:false,writable:true,blocked:false,configuration:{ endpoint:'http://127.0.0.1:19988',tokenFile:'',browser:'',allowedOrigins:[] },connection:'not-tested' }
  const save=vi.fn(async (input:SetupSave)=>({ ok:true as const,value:{ ...initial,revision:'two',enabled:input.enabled } }))
  const controller=new SetupController({ status:async()=>({ ok:true,value:initial }),save })
  const face=controller.face()
  const props={ ...face,useBrowserSetup:bindSnapshotSelector(controller.state),t:makeTranslate(en) } as SetupPanelProps
  render(<SetupPanel {...props}/>)
  await waitFor(()=>{ expect(screen.getByText(en.save).closest('button')?.disabled).toBe(false) })
  fireEvent.click(screen.getByText(en.save));expect(save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText(en.cancel));expect(screen.queryByRole('alertdialog')).toBeNull()
  fireEvent.click(screen.getByText(en.save));fireEvent.click(screen.getByText(en.confirmSave))
  await waitFor(()=>{ expect(save).toHaveBeenCalledTimes(1) })
  await waitFor(()=>{ expect(screen.getByRole('status').textContent).toBe(en.saved) })
  controller.dispose()
})
