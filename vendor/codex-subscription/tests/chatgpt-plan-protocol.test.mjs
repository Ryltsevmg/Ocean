import assert from 'node:assert/strict'
import test from 'node:test'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { createPlanAttempt, exchangePlanCode, listPlanModels, refreshPlanGrant } from '../src/chatgpt-plan-protocol.js'

test('authorization uses Ocean identity, loopback PKCE and the plan scopes', () => {
  const attempt = createPlanAttempt({ hostId: 'urn:uuid:00000000-0000-4000-8000-000000000000', port: 12345 })
  const url = new URL(attempt.url)
  assert.equal(url.origin, 'https://auth.openai.com')
  assert.equal(url.searchParams.get('client_id'), 'dynamic_agent_client')
  assert.equal(url.searchParams.get('agent_name_hint'), 'Ocean')
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:12345/auth/callback')
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.ok(url.searchParams.get('scope').includes('chatgpt.tokens.use.direct'))
  assert.notEqual(attempt.verifier, url.searchParams.get('code_challenge'))
})

test('reauthorization reuses the issued client without impersonating a different app', () => {
  const registration = { clientId: 'oaiapp_existing', subject: 'subject-existing' }
  const attempt = createPlanAttempt({ hostId: 'urn:uuid:00000000-0000-4000-8000-000000000000', port: 12345, registration })
  const url = new URL(attempt.url)
  assert.equal(url.searchParams.get('client_id'), 'oaiapp_existing')
  assert.equal(url.searchParams.has('agent_name_hint'), false)
  assert.equal(url.searchParams.has('id_token_hint'), false)
})

test('reauthorization accepts an omitted client ID only for the same verified identity', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const registration = { clientId: 'oaiapp_existing', subject: 'subject-existing' }
  const attempt = createPlanAttempt({ hostId: 'urn:uuid:00000000-0000-4000-8000-000000000000', port: 12345, registration })
  const token = await new SignJWT({ nonce: attempt.nonce }).setProtectedHeader({ alg: 'RS256' }).setIssuer('https://auth.openai.com').setAudience(registration.clientId).setSubject(registration.subject).setIssuedAt().setExpirationTime('5m').sign(privateKey)
  const callback = new URL(attempt.redirectUri)
  callback.search = new URLSearchParams({ state: attempt.state, code: 'fixture' }).toString()
  const fetch = async () => Response.json({ access_token: 'fixture', refresh_token: 'fixture', id_token: token, expires_in: 3600, token_type: 'Bearer', scope: 'openid resource.invoke chatgpt.tokens.use.direct' })
  const wrongClient = new URL(callback)
  wrongClient.searchParams.set('client_id', 'oaiapp_other')
  await assert.rejects(exchangePlanCode({ attempt, callback: wrongClient, fetch, key: publicKey }))
  const grant = await exchangePlanCode({ attempt, callback, fetch, key: publicKey })
  assert.equal(grant.clientId, registration.clientId)
  const mismatch = { ...attempt, used: false, registration: { ...registration, subject: 'different' } }
  await assert.rejects(exchangePlanCode({ attempt: mismatch, callback, fetch, key: publicKey }))
})

test('exchange verifies callback state, issued client, signature, nonce and plan permission', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const attempt = createPlanAttempt({ hostId: 'urn:uuid:00000000-0000-4000-8000-000000000000', port: 12345 })
  const token = await new SignJWT({ nonce: attempt.nonce }).setProtectedHeader({ alg: 'RS256' }).setIssuer('https://auth.openai.com').setAudience('oaiapp_fixture').setSubject('fixture-subject').setIssuedAt().setExpirationTime('5m').sign(privateKey)
  let calls = 0
  const fetch = async (_url, options) => {
    calls++
    assert.equal(options.redirect, 'error')
    return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', id_token: token, expires_in: 3600, token_type: 'Bearer', scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct' })
  }
  const callback = new URL(attempt.redirectUri)
  callback.searchParams.set('code', 'fixture-code')
  callback.searchParams.set('client_id', 'oaiapp_fixture')
  callback.searchParams.set('state', 'wrong')
  await assert.rejects(exchangePlanCode({ attempt, callback, fetch, key: publicKey }))
  assert.equal(calls, 0)
  callback.searchParams.set('state', attempt.state)
  callback.searchParams.append('state', 'wrong')
  await assert.rejects(exchangePlanCode({ attempt, callback, fetch, key: publicKey }))
  assert.equal(calls, 0)
  callback.searchParams.set('state', attempt.state)
  const grant = await exchangePlanCode({ attempt, callback, fetch, key: publicKey })
  assert.equal(grant.subject, 'fixture-subject')
  assert.equal(grant.clientId, 'oaiapp_fixture')
  await assert.rejects(exchangePlanCode({ attempt, callback, fetch, key: publicKey }))
  const wrongNonce = { ...attempt, nonce: 'wrong', used: false }
  await assert.rejects(exchangePlanCode({ attempt: wrongNonce, callback, fetch, key: publicKey }))
})

test('exchange rejects an ID token signed by another key', async () => {
  const signer = await generateKeyPair('RS256'), verifier = await generateKeyPair('RS256')
  const attempt = createPlanAttempt({ hostId: 'urn:uuid:00000000-0000-4000-8000-000000000000', port: 12345 })
  const token = await new SignJWT({ nonce: attempt.nonce }).setProtectedHeader({ alg: 'RS256' }).setIssuer('https://auth.openai.com').setAudience('oaiapp_fixture').setSubject('fixture-subject').setIssuedAt().setExpirationTime('5m').sign(signer.privateKey)
  const callback = new URL(attempt.redirectUri)
  callback.search = new URLSearchParams({ code: 'fixture-code', client_id: 'oaiapp_fixture', state: attempt.state }).toString()
  await assert.rejects(exchangePlanCode({ attempt, callback, key: verifier.publicKey, fetch: async () => Response.json({ access_token: 'fixture', refresh_token: 'fixture', id_token: token, expires_in: 3600, token_type: 'Bearer', scope: 'openid resource.invoke chatgpt.tokens.use.direct' }) }))
})

test('JWKS lookup uses the supplied transport rather than a global fetch', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const attempt = createPlanAttempt({ hostId: 'urn:uuid:00000000-0000-4000-8000-000000000000', port: 12345 })
  const token = await new SignJWT({ nonce: attempt.nonce }).setProtectedHeader({ alg: 'RS256', kid: 'fixture' }).setIssuer('https://auth.openai.com').setAudience('oaiapp_fixture').setSubject('fixture-subject').setIssuedAt().setExpirationTime('5m').sign(privateKey)
  const callback = new URL(attempt.redirectUri)
  callback.search = new URLSearchParams({ code: 'fixture-code', client_id: 'oaiapp_fixture', state: attempt.state }).toString()
  const seen = []
  const fetch = async url => {
    seen.push(String(url))
    if (String(url).endsWith('/.well-known/jwks.json')) return Response.json({ keys: [{ ...await exportJWK(publicKey), kid: 'fixture', alg: 'RS256' }] })
    return Response.json({ access_token: 'fixture', refresh_token: 'fixture', id_token: token, expires_in: 3600, token_type: 'Bearer', scope: 'openid resource.invoke chatgpt.tokens.use.direct' })
  }
  await exchangePlanCode({ attempt, callback, fetch })
  assert.deepEqual(seen, ['https://auth.openai.com/api/accounts/oauth/token', 'https://auth.openai.com/.well-known/jwks.json'])
})

test('exchange refuses an otherwise valid token without plan permission', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const attempt = createPlanAttempt({ hostId: 'urn:uuid:00000000-0000-4000-8000-000000000000', port: 12345 })
  const token = await new SignJWT({ nonce: attempt.nonce }).setProtectedHeader({ alg: 'RS256' }).setIssuer('https://auth.openai.com').setAudience('oaiapp_fixture').setSubject('fixture-subject').setIssuedAt().setExpirationTime('5m').sign(privateKey)
  const callback = new URL(attempt.redirectUri)
  callback.search = new URLSearchParams({ code: 'fixture-code', client_id: 'oaiapp_fixture', state: attempt.state }).toString()
  await assert.rejects(exchangePlanCode({ attempt, callback, key: publicKey, fetch: async () => Response.json({ access_token: 'fixture', refresh_token: 'fixture', id_token: token, expires_in: 3600, token_type: 'Bearer', scope: 'openid' }) }))
})

test('official catalog uses bearer authentication and lists only visible models', async () => {
  const models = await listPlanModels({ accessToken: 'fixture-access', fetch: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/models')
    assert.equal(options.headers.authorization, 'Bearer fixture-access')
    assert.equal(options.redirect, 'error')
    return Response.json({ models: [{ slug: 'model-a', display_name: 'Model A', visibility: 'list' }, { slug: 'model-b', visibility: 'hide' }] })
  } })
  assert.deepEqual(models, [{ id: 'model-a', name: 'Model A' }])
})

test('refresh uses the issued client and atomically returns the replacement token pair', async () => {
  const current = { clientId: 'oaiapp_fixture', refreshToken: 'old-private', accessToken: 'old-access', idToken: 'retained-id', scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }
  const next = await refreshPlanGrant({ grant: current, fetch: async (url, options) => {
    assert.equal(url, 'https://auth.openai.com/api/accounts/oauth/token')
    assert.equal(options.redirect, 'error')
    assert.equal(options.body.get('client_id'), 'oaiapp_fixture')
    assert.equal(options.body.get('grant_type'), 'refresh_token')
    assert.equal(options.body.get('resource'), 'https://api.openai.com/v1')
    assert.equal(options.body.has('scope'), false)
    return Response.json({ access_token: 'new-access', refresh_token: 'new-private', expires_in: 3600, token_type: 'Bearer', scope: 'resource.invoke chatgpt.tokens.use.direct' })
  } })
  assert.equal(next.accessToken, 'new-access')
  assert.equal(next.refreshToken, 'new-private')
  assert.equal(next.idToken, 'retained-id')
  assert.equal(current.refreshToken, 'old-private')
})

test('revocation sends only the selected issued client and refresh token in a form body', async () => {
  const { revokePlanGrant } = await import('../src/chatgpt-plan-protocol.js')
  let received
  await revokePlanGrant({ grant: { clientId: 'oaiapp_test', refreshToken: 'refresh-secret' }, fetch: async (url, init) => { received = { url, init }; return new Response(null, { status: 200 }) } })
  assert.equal(received.url, 'https://auth.openai.com/api/accounts/oauth/revoke')
  assert.equal(received.init.method, 'POST')
  assert.equal(received.init.body.get('token'), 'refresh-secret')
  assert.equal(received.init.body.get('client_id'), 'oaiapp_test')
  assert.equal(received.init.body.get('token_type_hint'), 'refresh_token')
  await assert.rejects(revokePlanGrant({ grant: { clientId: 'oaiapp_test', refreshToken: 'refresh-secret' }, fetch: async () => new Response(null, { status: 503 }) }))
})

test('cancelling after token response schedules cleanup of the issued refresh token', async () => {
  const keys = await generateKeyPair('RS256')
  const attempt = createPlanAttempt({ hostId: 'urn:uuid:00000000-0000-4000-8000-000000000000', port: 12345 })
  const token = await new SignJWT({ nonce: attempt.nonce }).setProtectedHeader({ alg: 'RS256' }).setIssuer('https://auth.openai.com').setAudience('oaiapp_fixture').setSubject('fixture').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey)
  const callback = new URL(attempt.redirectUri)
  callback.search = new URLSearchParams({ code: 'code', client_id: 'oaiapp_fixture', state: attempt.state }).toString()
  const controller = new AbortController()
  let discarded
  await assert.rejects(exchangePlanCode({ attempt, callback, key: keys.publicKey, signal: controller.signal, fetch: async () => { controller.abort(); return Response.json({ access_token: 'a', refresh_token: 'r', id_token: token, expires_in: 100, token_type: 'Bearer', scope: 'resource.invoke chatgpt.tokens.use.direct' }) }, onUncommitted: async grant => { discarded = grant } }))
  assert.deepEqual(discarded, { clientId: 'oaiapp_fixture', refreshToken: 'r' })
})

test('a malformed refresh response cleans up the newly issued refresh token', async () => {
  let discarded
  const grant = { clientId: 'client', refreshToken: 'old', scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }
  await assert.rejects(refreshPlanGrant({ grant, fetch: async () => Response.json({ access_token: 'a', refresh_token: 'new', expires_in: -1, token_type: 'Bearer' }), onUncommitted: async value => { discarded = value } }))
  assert.deepEqual(discarded, { clientId: 'client', refreshToken: 'new' })
})

test('an interrupted authorization exchange reports that the remote outcome is unknown', async () => {
  const attempt = createPlanAttempt({ hostId: 'urn:uuid:00000000-0000-4000-8000-000000000000', port: 12345 })
  const callback = new URL(attempt.redirectUri)
  callback.search = new URLSearchParams({ code: 'code', client_id: 'client', state: attempt.state }).toString()
  let unknown = false
  await assert.rejects(exchangePlanCode({ attempt, callback, fetch: async () => { throw new Error('connection lost') }, onUnknown: () => { unknown = true } }))
  assert.equal(unknown, true)
})

test('refresh marks outcomes unknown when the server returns an error or omits the replacement token', async () => {
  const grant = { clientId: 'client', refreshToken: 'old', scopes: ['resource.invoke', 'chatgpt.tokens.use.direct'] }
  for (const response of [new Response(null, { status: 429 }), Response.json({ access_token: 'a' })]) {
    let unknown = false
    await assert.rejects(refreshPlanGrant({ grant, fetch: async () => response, onUnknown: () => { unknown = true } }))
    assert.equal(unknown, true)
  }
})
