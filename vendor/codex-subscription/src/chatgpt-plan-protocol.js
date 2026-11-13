/** OAuth protocol and account-specific model listing for ChatGPT plan usage. */
import { createHash, randomBytes } from 'node:crypto'
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose'

const ISSUER = 'https://auth.openai.com'
const RESOURCE = 'https://api.openai.com/v1'
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct'
const randomValue = () => randomBytes(32).toString('base64url')
const nonempty = value => typeof value === 'string' && value.length > 0

/** Create a host-only OAuth transaction after binding the listener. @param {object} options - Host identity and bound port. @returns {object} The authorization URL and private transaction state. */
export function createPlanAttempt({ hostId, port, registration }) {
  if (!/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(hostId) || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid ChatGPT authorization parameters')
  if (registration !== undefined && (!nonempty(registration.clientId) || registration.clientId === 'dynamic_agent_client' || !nonempty(registration.subject))) throw new Error('Invalid ChatGPT registration')
  const verifier = randomValue(), state = randomValue(), nonce = randomValue()
  const redirectUri = `http://127.0.0.1:${port}/auth/callback`
  const url = new URL('/api/accounts/authorize', ISSUER)
  for (const [key, value] of Object.entries({ client_id: registration?.clientId ?? 'dynamic_agent_client', ...(registration === undefined ? { agent_name_hint: 'Ocean' } : {}), ext_agent_host_id: hostId, response_type: 'code', redirect_uri: redirectUri, scope: SCOPES, resource: RESOURCE, state, nonce, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') })) url.searchParams.set(key, value)
  return { url: url.href, redirectUri, verifier, state, nonce, hostId, registration, used: false }
}

/** Exchange and validate a single callback. @param {object} options - Private attempt, callback, transport and verification key. @returns {Promise<object>} The validated host-only grant. */
export async function exchangePlanCode({ attempt, callback, fetch: request = fetch, key, signal, onUncommitted = async () => {}, onUnknown = () => {} }) {
  signal?.throwIfAborted()
  if (attempt.used || callback.origin + callback.pathname !== attempt.redirectUri || ['state', 'code'].some(name => callback.searchParams.getAll(name).length !== 1) || callback.searchParams.getAll('client_id').length > 1 || callback.searchParams.get('state') !== attempt.state || callback.searchParams.has('error')) throw new Error('ChatGPT authorization callback rejected')
  const code = callback.searchParams.get('code'), returnedClientId = callback.searchParams.get('client_id'), clientId = returnedClientId ?? attempt.registration?.clientId
  if (attempt.registration && returnedClientId !== null && returnedClientId !== attempt.registration.clientId) throw new Error('ChatGPT registration does not match')
  if (!nonempty(code) || !nonempty(clientId) || clientId === 'dynamic_agent_client') throw new Error('ChatGPT authorization callback incomplete')
  attempt.used = true
  const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: attempt.verifier, redirect_uri: attempt.redirectUri, resource: RESOURCE })
  let response, token
  try {
    response = await request(`${ISSUER}/api/accounts/oauth/token`, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body, redirect: 'error', signal })
    if (!response.ok) { onUnknown(); throw new Error('ChatGPT token exchange failed') }
    token = await response.json()
  } catch (error) {
    if (!response || response.ok) onUnknown()
    throw error
  }
  try {
    const scopes = typeof token.scope === 'string' ? token.scope.split(/\s+/u).filter(Boolean) : []
    if (!nonempty(token.access_token) || !nonempty(token.refresh_token) || !nonempty(token.id_token) || !Number.isFinite(token.expires_in) || token.expires_in <= 0 || String(token.token_type).toLowerCase() !== 'bearer' || !scopes.includes('chatgpt.tokens.use.direct') || !scopes.includes('resource.invoke')) throw new Error('ChatGPT token response incomplete')
    const verificationKey = key ?? createRemoteJWKSet(new URL('/.well-known/jwks.json', ISSUER), { [customFetch]: request })
    const { payload } = await jwtVerify(token.id_token, verificationKey, { issuer: ISSUER, audience: clientId, requiredClaims: ['sub', 'exp', 'iat'], clockTolerance: 5 })
    if (!nonempty(payload.sub) || payload.nonce !== attempt.nonce || (attempt.registration && payload.sub !== attempt.registration.subject)) throw new Error('ChatGPT identity validation failed')
    signal?.throwIfAborted()
    return { clientId, hostId: attempt.hostId, subject: payload.sub, accessToken: token.access_token, refreshToken: token.refresh_token, idToken: token.id_token, expiresAt: Date.now() + token.expires_in * 1000, scopes }
  } catch (error) {
    if (nonempty(token?.refresh_token)) await onUncommitted({ clientId, refreshToken: token.refresh_token })
    else onUnknown()
    throw error
  }
}

/** Read account choices; a listed model is not proof of inference access. @param {object} options - Access token and transport. @returns {Promise<object[]>} Visible model names and identifiers. */
export async function listPlanModels({ accessToken, fetch: request = fetch, signal }) {
  if (!nonempty(accessToken)) throw new Error('ChatGPT plan credential unavailable')
  const response = await request(`${RESOURCE}/models`, { headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' }, redirect: 'error', signal })
  if (!response.ok) throw new Error('ChatGPT model catalog request failed')
  const body = await response.json()
  if (!Array.isArray(body?.models)) throw new Error('ChatGPT model catalog invalid')
  return body.models.filter(model => model?.visibility === 'list' && nonempty(model.slug)).map(model => ({ id: model.slug, name: nonempty(model.display_name) ? model.display_name : model.slug }))
}

/** Refresh a token pair under the caller's grant lock. @param {object} options - Current grant and transport. @returns {Promise<object>} Replacement grant to persist atomically. */
export async function refreshPlanGrant({ grant, fetch: request = fetch, signal, onUncommitted = async () => {}, onUnknown = () => {} }) {
  if (!nonempty(grant?.clientId) || !nonempty(grant?.refreshToken)) throw new Error('ChatGPT plan refresh credential unavailable')
  const body = new URLSearchParams({ grant_type: 'refresh_token', client_id: grant.clientId, refresh_token: grant.refreshToken, resource: RESOURCE })
  let response, token
  try {
    response = await request(`${ISSUER}/api/accounts/oauth/token`, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body, redirect: 'error', signal })
    if (!response.ok) { onUnknown(); throw new Error('ChatGPT plan refresh failed') }
    token = await response.json()
  } catch (error) {
    if (!response || response.ok) onUnknown()
    throw error
  }
  try {
    const scopes = typeof token.scope === 'string' ? token.scope.split(/\s+/u).filter(Boolean) : grant.scopes
    if (!nonempty(token.access_token) || !nonempty(token.refresh_token) || !Number.isFinite(token.expires_in) || token.expires_in <= 0 || String(token.token_type).toLowerCase() !== 'bearer' || !Array.isArray(scopes) || !scopes.includes('resource.invoke') || !scopes.includes('chatgpt.tokens.use.direct')) throw new Error('ChatGPT plan refresh response incomplete')
    return { ...grant, accessToken: token.access_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000, scopes }
  } catch (error) {
    if (nonempty(token?.refresh_token)) await onUncommitted({ clientId: grant.clientId, refreshToken: token.refresh_token })
    else onUnknown()
    throw error
  }
}

/** End one renewable session. @param {object} options - Registration grant and restricted transport. @returns {Promise<void>} Resolves when revocation is confirmed. */
export async function revokePlanGrant({ grant, fetch: request = fetch, signal }) {
  if (!nonempty(grant?.clientId) || !nonempty(grant?.refreshToken)) throw new Error('ChatGPT plan credential unavailable')
  const body = new URLSearchParams({ token: grant.refreshToken, token_type_hint: 'refresh_token', client_id: grant.clientId })
  const response = await request(`${ISSUER}/api/accounts/oauth/revoke`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, redirect: 'error', signal })
  if (response.status !== 200) throw Object.assign(new Error('ChatGPT session revocation unconfirmed'), { retryable: response.status >= 500 || response.status === 408 || response.status === 429 })
}
