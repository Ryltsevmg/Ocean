const form = document.querySelector('form')
const address = document.querySelector('#address')
const token = document.querySelector('#token')
const remember = document.querySelector('#remember')
const connect = document.querySelector('#connect')
const password = document.querySelector('#password')
const closeButton = document.querySelector('#close')
const failure = document.querySelector('#failure')
const forgetUnreadable = document.querySelector('#forget-unreadable')
const title = document.querySelector('#title')
const hint = document.querySelector('#hint')
const machinesSection = document.querySelector('#machines')
const machinesLabel = document.querySelector('#machines-label')
const machineList = document.querySelector('#machine-list')
const discoverStatus = document.querySelector('#discover-status')
const refresh = document.querySelector('#refresh')
const passwordField = document.querySelector('#password-field')
const back = document.querySelector('#back')
const otherWays = document.querySelector('#other-ways')
const rememberRow = document.querySelector('#remember-row')
const saveHint = document.querySelector('#save-hint')
const identity = document.querySelector('#host-identity')
const sshField = document.querySelector('#ssh-field')
const sshHost = document.querySelector('#ssh-host')
const sshStart = document.querySelector('#ssh-start')
const bridge = globalThis.oceanRemoteForm

const view = await bridge.load()
const messages = view.messages
for (const name of ['address', 'token', 'remember']) {
  document.querySelector(`#${name}-label`).textContent = messages[name]
}
title.textContent = messages.title
hint.textContent = messages.hint
connect.textContent = messages.connect
closeButton.textContent = messages.cancel
forgetUnreadable.textContent = messages.forget
saveHint.textContent = messages.saveUnavailable
machinesLabel.textContent = messages.machines
refresh.textContent = messages.refresh
document.querySelector('#other-ways-summary').textContent = messages.otherWays
document.querySelector('#password-label').textContent = messages.password
back.textContent = messages.back
for (const name of ['label', 'hint', 'start']) document.querySelector(`#ssh-${name}`).textContent = messages[`ssh${name[0].toUpperCase()}${name.slice(1)}`]
saveHint.hidden = view.canSave
rememberRow.hidden = !view.canSave
failure.textContent = view.notice ?? messages.failure
failure.hidden = view.notice === undefined
forgetUnreadable.hidden = !view.unreadable
remember.disabled = !view.canSave
if (view.address !== undefined) {
  address.value = view.address
}
/** Address of a pairing link waiting for the user's confirmation, or undefined in the ordinary form. */
let pairing = view.pairing?.address
/** Tailscale machine whose pairing password is being entered, or undefined in the list. */
let passwordTarget
/** Saved machines as last read, each with its identity and routes; tokens never reach this document. */
let machines = view.machines
let unreadable = view.unreadable
let sshTargets = []
let tailscaleHosts = []
let connected = false
let discovering = false

/** The route a saved machine is offered at: its most recently saved address, else the one it was just discovered at. */
function savedRoute(machine) {
  return tailscaleHosts.find(host => host.known && host.hostId === machine.hostId)?.address ?? machine.routes.at(-1)
}
/** A route without its scheme, as the list captions it. */
function routeLabel(route) {
  try { return new URL(route).host } catch (_error) { return route }
}
/**
 * Build the machine list: saved machines first, then SSH destinations, then Tailscale machines
 * without a saved token. Each row carries one action.
 */
function renderMachines() {
  const rows = [
    ...machines.map(machine => {
      const route = savedRoute(machine)
      return {
        caption: routeLabel(route), badge: messages.savedBadge, action: messages.connect,
        run: () => perform(() => bridge.connect(route, '', remember.checked)),
        forget: () => forgetMachine(machine),
      }
    }),
    ...sshTargets.map(target => ({
      caption: target.label, badge: messages.sshBadge, action: messages.setup,
      run: (button) => provisionOverSsh(target.host, button),
    })),
    ...tailscaleHosts.filter(host => !host.known).map(host => ({
      caption: routeLabel(host.address), badge: messages.tailscaleBadge, action: messages.pair,
      run: () => { showPassword(host.address) },
    })),
  ]
  machineList.replaceChildren(...rows.map(row => {
    const item = document.createElement('div')
    item.setAttribute('role', 'listitem')
    item.className = 'machine'
    const name = document.createElement('span')
    name.className = 'name'
    name.textContent = row.caption
    const badge = document.createElement('span')
    badge.className = 'badge'
    badge.textContent = row.badge
    const action = document.createElement('button')
    action.type = 'button'
    action.textContent = row.action
    action.addEventListener('click', () => { void row.run(action) })
    item.append(name, badge, action)
    if (row.forget !== undefined) {
      const forget = document.createElement('button')
      forget.type = 'button'
      forget.className = 'link'
      forget.textContent = messages.forgetMachine
      forget.addEventListener('click', () => { void row.forget() })
      item.append(forget)
    }
    return item
  }))
}
/** Focus the action of the first machine, so the keyboard starts in the list. */
function focusFirstMachine() {
  machineList.querySelector('button')?.focus()
}
/** Enable or disable every control that a pending or finished connection takes out of use. */
function setBusy(busy) {
  form.setAttribute('aria-busy', String(busy))
  const settled = busy || connected
  connect.disabled = busy
  address.disabled = settled
  token.disabled = settled
  password.disabled = settled
  remember.disabled = settled || !view.canSave
  forgetUnreadable.disabled = settled
  refresh.disabled = settled || discovering
  sshStart.disabled = settled
  sshHost.disabled = settled
  for (const button of machineList.querySelectorAll('button')) button.disabled = settled
  connect.textContent = busy ? messages.connecting : connected ? messages.done : passwordTarget === undefined ? messages.connect : messages.pair
}
function showPairing(target) {
  pairing = target
  passwordTarget = undefined
  hint.textContent = messages.pairHint.replace('{address}', target)
  for (const section of [machinesSection, passwordField, otherWays]) section.hidden = true
  forgetUnreadable.hidden = true
  failure.hidden = true
  address.value = ''
  connect.textContent = messages.connect
  connect.disabled = false
  connect.focus()
}
/** Ask for the pairing password of a Tailscale machine that has no saved token. */
function showPassword(target) {
  passwordTarget = target
  hint.textContent = messages.passwordHint.replace('{address}', target)
  for (const section of [machinesSection, otherWays]) section.hidden = true
  passwordField.hidden = false
  forgetUnreadable.hidden = true
  failure.hidden = true
  connect.textContent = messages.pair
  connect.disabled = false
  password.focus()
}
/** Leave the password prompt for the list; nothing was sent. */
function showList() {
  passwordTarget = undefined
  password.value = ''
  hint.textContent = messages.hint
  machinesSection.hidden = false
  passwordField.hidden = true
  otherWays.hidden = false
  forgetUnreadable.hidden = !unreadable
  failure.hidden = true
  connect.textContent = messages.connect
  focusFirstMachine()
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
    ? messages.hostRoutes.replace('{id}', shortId).replace('{routes}', routes.join(', '))
    : messages.hostIdentity.replace('{id}', shortId)
  identity.hidden = false
}
address.addEventListener('input', () => {
  if (address.hasAttribute('aria-invalid')) {
    address.removeAttribute('aria-invalid')
    failure.hidden = true
  }
  clearTimeout(probeTimer)
  probeTimer = setTimeout(() => { void probeAddress() }, 400)
})
renderMachines()
connect.disabled = false
if (pairing !== undefined) showPairing(pairing)
else focusFirstMachine()

/** Ask the main process which machines are reachable now, and list them. */
async function discover() {
  if (discovering || connected) return
  discovering = true
  discoverStatus.textContent = messages.discovering
  refresh.disabled = true
  let result
  try { result = await bridge.discover() } catch (_error) {
    // A discovery that cannot run leaves the saved machines listed and says nothing about the others.
    result = undefined
  }
  discovering = false
  refresh.disabled = connected
  if (result === undefined) {
    discoverStatus.textContent = ''
    return
  }
  sshTargets = result.ssh
  tailscaleHosts = result.tailscale
  discoverStatus.textContent = result.tailscaleAvailable ? '' : messages.tailscaleMissing
  renderMachines()
  if (document.activeElement === document.body) focusFirstMachine()
}
refresh.addEventListener('click', () => { void discover() })

async function perform(action) {
  failure.hidden = true
  failure.textContent = messages.failure
  setBusy(true)
  try {
    const result = await action()
    connected = result.kind === 'connected'
    failure.textContent = result.message ?? messages.failure
    failure.hidden = result.kind !== 'failed' && result.message === undefined
    if (connected) forgetUnreadable.hidden = true
  } catch (_error) { failure.hidden = false }
  finally {
    setBusy(false)
    closeButton.hidden = connected
    if (connected) connect.focus()
  }
}

/** Remove the most recently saved route of a machine; the machine leaves with its last route. */
async function forgetMachine(machine) {
  await perform(async () => {
    const route = machine.routes.at(-1)
    const removed = await bridge.forget(route)
    if (removed.kind === 'forgotten') {
      const routes = machine.routes.filter(saved => saved !== route)
      machines = routes.length > 0 ? machines.map(saved => saved === machine ? { ...saved, routes } : saved) : machines.filter(saved => saved !== machine)
      tailscaleHosts = tailscaleHosts.map(host => routes.length === 0 && host.hostId === machine.hostId ? { ...host, known: false } : host)
      renderMachines()
    }
    return removed
  })
}

function closeDialog() {
  void bridge.close().catch(() => {
    failure.textContent = messages.failure
    failure.hidden = false
  })
}
/**
 * Prepare and start a Host on a remote machine over SSH, then let the user confirm
 * the address it became reachable at. The Host mints the pairing link itself, so no
 * token is typed here.
 */
async function provisionOverSsh(host, button) {
  failure.hidden = true
  button.disabled = true
  const label = button.textContent
  button.textContent = messages.sshStarting
  form.setAttribute('aria-busy', 'true')
  try {
    const result = await bridge.startSsh(host)
    if (result.kind === 'pairing') showPairing(result.address)
    else {
      failure.textContent = result.message ?? messages.failure
      failure.hidden = false
    }
  } catch (_error) {
    failure.textContent = messages.failure
    failure.hidden = false
  } finally {
    form.setAttribute('aria-busy', 'false')
    button.disabled = connected
    button.textContent = label
  }
}
sshStart.addEventListener('click', () => {
  const host = sshHost.value.trim()
  if (host === '') {
    sshHost.focus()
    return
  }
  sshHost.disabled = true
  void provisionOverSsh(host, sshStart).finally(() => { sshHost.disabled = connected })
})
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
  if (passwordTarget !== undefined) {
    const target = passwordTarget
    const secret = password.value
    password.value = ''
    if (secret === '') {
      password.focus()
      return
    }
    void perform(() => bridge.pairPassword(target, secret))
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
    failure.textContent = messages.invalidAddress
    failure.hidden = false
    address.focus()
    return
  }
  const secret = token.value
  token.value = ''
  void perform(() => bridge.connect(address.value, secret, remember.checked))
})
back.addEventListener('click', showList)
forgetUnreadable.addEventListener('click', () => {
  if (!unreadable) return
  void perform(async () => {
    const removed = await bridge.forget()
    if (removed.kind === 'forgotten') {
      unreadable = false
      forgetUnreadable.hidden = true
      failure.hidden = true
    }
    return removed
  })
})
void discover()
