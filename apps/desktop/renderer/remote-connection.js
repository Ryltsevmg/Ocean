const form = document.querySelector('form')
const address = document.querySelector('#address')
const addresses = document.querySelector('#saved-addresses')
const token = document.querySelector('#token')
const remember = document.querySelector('#remember')
const connect = document.querySelector('#connect')
const forget = document.querySelector('#forget')
const failure = document.querySelector('#failure')
const bridge = globalThis.oceanRemoteForm

const view = await bridge.load()
for (const name of ['address', 'token', 'remember']) {
  document.querySelector(`#${name}-label`).textContent = view.messages[name]
}
connect.textContent = view.messages.connect
forget.textContent = view.messages.forget
failure.textContent = view.notice ?? view.messages.failure
failure.hidden = view.notice === undefined
remember.disabled = !view.canSave
if (view.address !== undefined) {
  address.value = view.address
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
address.addEventListener('input', updateForget)
refreshSavedAddresses()
connect.disabled = false
if (view.notice === undefined) address.focus()
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
    connect.textContent = connected ? view.messages.done : view.messages.connect
    if (connected) connect.focus()
  }
}

form.addEventListener('submit', event => {
  event.preventDefault()
  if (connected) {
    void bridge.close().catch(() => {
      failure.textContent = view.messages.failure
      failure.hidden = false
    })
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
