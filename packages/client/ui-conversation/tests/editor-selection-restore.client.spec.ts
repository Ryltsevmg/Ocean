// @vitest-environment jsdom
/**
 * Native caret moves over a typed draft survive blur and explicit composer
 * focus: the restored DOM selection covers the same text with the same
 * directed offsets (the composer-focus browser lane, at component level).
 * Home/End line navigation is owned by the composer keymap, which performs
 * the standard line-boundary edit in every scroll context.
 */
import { expect, it, onTestFinished, vi } from 'vitest'
import { $getSelection, $isRangeSelection, KEY_DOWN_COMMAND } from 'lexical'
import { DraftEditorRuntime } from '../src/client/input/editor/runtime.ts'
import { registerComposerKeymap } from '../src/client/input/editor/keymap.ts'
import { focusDraftEditor } from '../src/client/input/editor/view-binding.ts'

const DRAFT = 'alpha beta gamma'

function fixture() {
  // jsdom has no Range geometry; these cases observe selection and focus, not scrolling.
  const geometry = Object.getOwnPropertyDescriptor(Range.prototype, 'getBoundingClientRect')
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() })
  onTestFinished(() => {
    if (geometry === undefined) Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect')
    else Object.defineProperty(Range.prototype, 'getBoundingClientRect', geometry)
  })
  // jsdom implements no Selection.modify; fill the single-line lineboundary
  // semantics the keymap uses (the browser lane exercises the engine's own).
  const modify = Object.getOwnPropertyDescriptor(Selection.prototype, 'modify')
  Object.defineProperty(Selection.prototype, 'modify', {
    configurable: true,
    value(this: Selection, alter: string, direction: string, granularity: string): void {
      if (granularity !== 'lineboundary') throw new Error('The jsdom modify stub covers lineboundary only')
      const focusNode = this.focusNode
      if (focusNode === null) return
      const text = focusNode.nodeType === Node.TEXT_NODE ? focusNode : focusNode.firstChild
      if (text === null) return
      const target = direction === 'backward' ? 0 : text.textContent?.length ?? 0
      if (alter === 'move') this.setBaseAndExtent(text, target, text, target)
      else if (this.anchorNode !== null) this.setBaseAndExtent(this.anchorNode, this.anchorOffset, text, target)
    },
  })
  onTestFinished(() => {
    if (modify === undefined) Reflect.deleteProperty(Selection.prototype, 'modify')
    else Object.defineProperty(Selection.prototype, 'modify', modify)
  })
  const root = document.createElement('div')
  root.setAttribute('contenteditable', 'true')
  root.tabIndex = 0
  const card = document.createElement('div')
  card.tabIndex = -1
  card.append(root)
  const outside = document.createElement('button')
  document.body.append(card, outside)
  onTestFinished(() => { card.remove(); outside.remove() })
  // jsdom collapses document Selection on every focus(); Chromium retains the
  // editor range here. Keep native focus events, activeElement changes, and
  // the selection's direction (a cloned Range would normalize it forward).
  for (const element of [root, outside]) {
    const focus = element.focus.bind(element)
    const mocked = vi.spyOn(element, 'focus').mockImplementation((options) => {
      const selection = document.getSelection()!
      const saved = selection.rangeCount === 0 ? undefined : {
        anchorNode: selection.anchorNode, anchorOffset: selection.anchorOffset,
        focusNode: selection.focusNode, focusOffset: selection.focusOffset,
      }
      focus(options)
      if (saved !== undefined && saved.anchorNode !== null && saved.focusNode !== null) {
        selection.setBaseAndExtent(saved.anchorNode, saved.anchorOffset, saved.focusNode, saved.focusOffset)
      }
    })
    onTestFinished(() => { mocked.mockRestore() })
  }
  const runtime = new DraftEditorRuntime({
    onUpdate: () => { runtime.refreshProjection() },
    quoteLabels: () => ({ remove: 'Remove quote' }),
    openReference: () => false,
    lexicon: () => new Map(), resolveLexicon: () => undefined,
  })
  const dispose = runtime.register()
  const { editor } = runtime
  onTestFinished(() => { dispose(); editor.setRootElement(null) })
  const unkeymap = registerComposerKeymap(editor, {
    arbitrate: () => 'pass',
    space: () => false,
    dismissPopup: () => {},
    canSubmit: () => false,
    submit: () => {},
    intakeFiles: () => {},
    pasteText: () => {},
  })
  onTestFinished(unkeymap)
  editor.setRootElement(root)
  root.focus()
  runtime.setDraft(DRAFT)
  const internal = () => editor.getEditorState().read(() => {
    const selected = $getSelection()
    if (!$isRangeSelection(selected)) throw new Error('Expected a Composer range selection')
    return { anchor: selected.anchor.offset, focus: selected.focus.offset, text: selected.getTextContent() }
  })
  const dom = () => {
    const selected = document.getSelection()!
    return { anchor: selected.anchorOffset, focus: selected.focusOffset, text: selected.toString() }
  }
  // Native caret navigation (Home, ArrowRight x10, Shift+ArrowLeft x4 in the
  // browser lane): move the DOM selection directly and let the editor's
  // selectionchange tracking absorb it, exactly as a keystroke would.
  const nativeSelect = (anchor: number, focus: number): void => {
    // jsdom fires no selectionchange for the editor's own DOM selection
    // writes; deliver the event the browser would fire so Lexical's
    // from-DOM-update flag is consumed before the native move arrives.
    document.dispatchEvent(new Event('selectionchange'))
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const text = walker.nextNode() as Text
    const selection = document.getSelection()!
    selection.setBaseAndExtent(text, anchor, text, focus)
    document.dispatchEvent(new Event('selectionchange'))
    editor.read(() => {})
  }
  // One keystroke on the editor, then the selectionchange delivery the
  // browser performs after a selection edit so Lexical absorbs the result.
  const press = (key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
    root.dispatchEvent(event)
    document.dispatchEvent(new Event('selectionchange'))
    editor.read(() => {})
    return event
  }
  return { runtime, editor, root, card, outside, internal, dom, nativeSelect, press }
}

it('restores the directed native selection over "beta" after blur and explicit focus', () => {
  const f = fixture()
  // The typed draft lands the caret at its end; the editor observes it.
  expect(f.dom()).toMatchObject({ anchor: DRAFT.length, focus: DRAFT.length, text: '' })

  f.nativeSelect(10, 6)
  expect(f.dom()).toEqual({ anchor: 10, focus: 6, text: 'beta' })
  expect(f.internal()).toEqual({ anchor: 10, focus: 6, text: 'beta' })

  // A press outside the card blurs the editor; the selection stays put.
  f.outside.focus()
  f.editor.read(() => {})
  expect(document.activeElement).toBe(f.outside)
  expect(f.internal()).toEqual({ anchor: 10, focus: 6, text: 'beta' })

  // The card's unused-space press returns focus through the Lexical restore.
  const reveal = vi.fn()
  focusDraftEditor(f.editor, reveal)
  f.editor.read(() => {})
  expect(document.activeElement).toBe(f.root)
  expect(reveal).toHaveBeenCalledOnce()
  expect(f.dom()).toEqual({ anchor: 10, focus: 6, text: 'beta' })
  expect(f.internal()).toEqual({ anchor: 10, focus: 6, text: 'beta' })
})

it('keeps the restored caret typing position after a native collapse', () => {
  const f = fixture()
  f.nativeSelect(9, 9)
  expect(f.internal()).toEqual({ anchor: 9, focus: 9, text: '' })
  f.outside.focus()
  f.editor.read(() => {})
  focusDraftEditor(f.editor, () => {})
  f.editor.read(() => {})
  expect(f.dom()).toEqual({ anchor: 9, focus: 9, text: '' })
  expect(f.internal()).toEqual({ anchor: 9, focus: 9, text: '' })
})

it('moves the caret to the line start on Home and absorbs it into the editor', () => {
  const f = fixture()
  f.nativeSelect(8, 8)
  const event = f.press('Home')
  expect(event.defaultPrevented).toBe(true)
  expect(f.dom()).toEqual({ anchor: 0, focus: 0, text: '' })
  expect(f.internal()).toEqual({ anchor: 0, focus: 0, text: '' })
})

it('extends the selection to the line end on Shift+End', () => {
  const f = fixture()
  f.nativeSelect(8, 8)
  const event = f.press('End', { shiftKey: true })
  expect(event.defaultPrevented).toBe(true)
  expect(f.dom()).toEqual({ anchor: 8, focus: DRAFT.length, text: 'ta gamma' })
  expect(f.internal()).toEqual({ anchor: 8, focus: DRAFT.length, text: 'ta gamma' })
})

it('leaves modifier chords and foreign selections to their native owners', () => {
  const f = fixture()
  f.nativeSelect(8, 8)
  expect(f.press('Home', { ctrlKey: true }).defaultPrevented).toBe(false)
  expect(f.press('End', { metaKey: true }).defaultPrevented).toBe(false)
  expect(f.press('Home', { altKey: true }).defaultPrevented).toBe(false)
  expect(f.press('End', { isComposing: true }).defaultPrevented).toBe(false)
  expect(f.dom()).toMatchObject({ anchor: 8, focus: 8 })
  f.outside.textContent = 'outside text'
  const foreign = f.outside.firstChild as Text
  document.getSelection()!.setBaseAndExtent(foreign, 2, foreign, 2)
  expect(f.press('Home').defaultPrevented).toBe(false)
})

it('leaves Home to the engine without a root, a selection, or Selection.modify', () => {
  const f = fixture()
  f.nativeSelect(8, 8)
  const detached = new KeyboardEvent('keydown', { key: 'Home', cancelable: true })
  f.editor.setRootElement(null)
  f.editor.dispatchCommand(KEY_DOWN_COMMAND, detached)
  expect(detached.defaultPrevented).toBe(false)
  f.editor.setRootElement(f.root)
  const absent = vi.spyOn(document, 'getSelection').mockReturnValue(null)
  try {
    expect(f.press('Home').defaultPrevented).toBe(false)
  } finally {
    absent.mockRestore()
  }
  Reflect.deleteProperty(Selection.prototype, 'modify')
  expect(f.press('Home').defaultPrevented).toBe(false)
  expect(f.dom()).toMatchObject({ anchor: 8, focus: 8 })
})
