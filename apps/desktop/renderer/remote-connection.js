const form = document.querySelector('form')
const address = document.querySelector('#address')
const addresses = document.querySelector('#saved-addresses')
const token = document.querySelector('#token')
const remember = document.querySelector('#remember')
const connect = document.querySelector('#connect')
const forget = document.querySelector('#forget')
const closeButton = document.querySelector('#close')
const failure = document.querySelector('#failure')
const title = document.querySelector('#title')
const hint = document.querySelector('#hint')
const rememberRow = document.querySelector('#remember-row')
const saveHint = document.querySelector('#save-hint')
const identity = document.querySelector('#host-identity')
const addressField = document.querySelector('#address-field')
const tokenRow = document.querySelector('#token-row')
const rememberField = document.querySelector('#remember-field')
const bridge = globalThis.oceanRemoteForm

const view = await bridge.load()
for (const name of ['address', 'token', 'remember']) {
  document.querySelector(`#${name}-label`).textContent = view.messages[name]
}
title.textContent = view.messages.title
hint.textContent = view.messages.hint
connect.textContent = view.messages.connect
forget.textContent = view.messages.forget
closeButton.textContent = view.messages.cancel
saveHint.textContent = view.messages.saveUnavailable
saveHint.hidden = view.canSave
rememberRow.hidden = !view.canSave
failure.textContent = view.notice ?? view.messages.failure
failure.hidden = view.notice === undefined
remember.disabled = !view.canSave
if (view.address !== undefined) {
  address.value = view.address
}
/** Address of a pairing link waiting for the user's confirmation, or undefined in the ordinary form. */
let pairing = view.pairing?.address
function showPairing(target) {
  pairing = target
  hint.textContent = view.messages.pairHint.replace('{address}', target)
  for (const field of [addressField, tokenRow, rememberField]) field.hidden = true
  forget.hidden = true
  failure.hidden = true
  address.value = ''
  connect.disabled = false
  connect.focus()
}
const saved = new Set(view.addresses)
let unreadable = view.unreadable
let connected = false
function refreshSavedAddresses() {
  addresses.replaceChildren(...Array.from(saved, value => {
    const option = document.createElement('option')
    option.value = value
    return option
  }))
  updateForget()
}
function selectedAddress() {
  const url = URL.parse(address.value)
  if (url === null || url.search || url.hash || url.username || url.password) return undefined
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return saved.has(url.href) ? url.href : undefined
}
function updateForget() {
  forget.hidden = !unreadable && selectedAddress() === undefined
}
function validAddress() {
  if (address.value.trim() === '') return true
  const url = URL.parse(address.value.trim())
  return url !== null && url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
}
/**
 * Probe the entered address without sending a token, so the form can name the machine
 * it reaches and refuse an address that answers as a different one.
 */
let probeSequence = 0
let probeTimer
async function probeAddress() {
  const sequence = ++probeSequence
  const target = address.value.trim()
  identity.hidden = true
  if (pairing !== undefined || !validAddress() || target === '') return
  let result
  try { result = await bridge.probe(target) } catch (_error) { return }
  if (sequence !== probeSequence || result.kind === 'failed') return
  const shortId = result.hostId.slice(0, 8)
  const routes = result.routes ?? []
  identity.textContent = result.known && routes.length > 0
    ? view.messages.hostRoutes.replace('{id}', shortId).replace('{routes}', routes.join(', '))
    : view.messages.hostIdentity.replace('{id}', shortId)
  identity.hidden = false
}
address.addEventListener('input', () => {
  if (address.hasAttribute('aria-invalid')) {
    address.removeAttribute('aria-invalid')
    failure.hidden = true
  }
  updateForget()
  clearTimeout(probeTimer)
  probeTimer = setTimeout(() => { void probeAddress() }, 400)
})
refreshSavedAddresses()
connect.disabled = false
if (pairing !== undefined) showPairing(pairing)
else if (view.notice === undefined) address.focus()
else token.focus()

async function perform(action) {
  failure.hidden = true
  failure.textContent = view.messages.failure
  connect.disabled = true
  forget.disabled = true
  address.disabled = true
  token.disabled = true
  remember.disabled = true
  form.setAttribute('aria-busy', 'true')
  connect.textContent = view.messages.connecting
  try {
    const result = await action()
    connected = result.kind === 'connected'
    failure.textContent = result.message ?? view.messages.failure
    failure.hidden = result.kind !== 'failed' && result.message === undefined
    if (connected) forget.hidden = true
  } catch (_error) { failure.hidden = false }
  finally {
    form.setAttribute('aria-busy', 'false')
    connect.disabled = false
    forget.disabled = false
    address.disabled = connected
    token.disabled = connected
    remember.disabled = connected || !view.canSave
    closeButton.hidden = connected
    connect.textContent = connected ? view.messages.done : view.messages.connect
    if (connected) connect.focus()
  }
}

function closeDialog() {
  void bridge.close().catch(() => {
    failure.textContent = view.messages.failure
    failure.hidden = false
  })
}
closeButton.addEventListener('click', closeDialog)
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return
  event.preventDefault()
  closeDialog()
})

form.addEventListener('submit', event => {
  event.preventDefault()
  if (connected) {
    closeDialog()
    return
  }
  if (pairing !== undefined) {
    void perform(() => bridge.pair())
    return
  }
  const entered = address.value.trim()
  if (entered.startsWith('ocean://')) {
    void perform(async () => {
      const result = await bridge.pairLink(entered)
      if (result.kind === 'pairing') showPairing(result.address)
      return result
    })
    return
  }
  if (!validAddress()) {
    address.setAttribute('aria-invalid', 'true')
    failure.textContent = view.messages.invalidAddress
    failure.hidden = false
    address.focus()
    return
  }
  const secret = token.value
  token.value = ''
  void perform(() => bridge.connect(address.value, secret, remember.checked))
})
forget.addEventListener('click', () => {
  const selection = selectedAddress()
  if (selection === undefined && !unreadable) return
  void perform(async () => {
    const removed = await bridge.forget(selection)
    if (removed.kind === 'forgotten') {
      if (selection !== undefined) saved.delete(selection)
      unreadable = false
      address.value = ''
      refreshSavedAddresses()
    }
    return removed
  })
})
