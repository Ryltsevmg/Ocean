/** Self-contained device sign-in document for the unauthenticated Host index. */
import { createHash } from 'node:crypto'
import { DEVICE_PROTOCOL_HEADER, DEVICE_PROTOCOL_VERSION } from '@ocean/ocean-client-connection/protocol'

const copy = {
  en: {
    title: 'Sign in to Ocean',
    token: 'Device token',
    submit: 'Sign in',
    failed: 'Could not sign in. Check the device token and try again.',
  },
  zh: {
    title: '登录 Ocean',
    token: '设备令牌',
    submit: '登录',
    failed: '无法登录。请检查设备令牌并重试。',
  },
} as const

const script = `
const form = document.querySelector('form');
const input = document.querySelector('input');
const submit = document.querySelector('button');
const error = document.querySelector('[role="alert"]');
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  const token = input.value.trim();
  input.value = '';
  submit.disabled = true;
  error.hidden = true;
  try {
    const response = await fetch('./connect', {
      method: 'POST',
      credentials: 'same-origin',
      redirect: 'error',
      headers: { Authorization: 'Bearer ' + token, '${DEVICE_PROTOCOL_HEADER}': '${DEVICE_PROTOCOL_VERSION}' },
    });
    if (response.status !== 204) throw new Error('sign-in refused');
    location.replace('./');
  } catch {
    error.hidden = false;
    submit.disabled = false;
    input.focus();
  }
});
submit.disabled = false;
`
const integrity = createHash('sha256').update(script).digest('base64')

/**
 * Render the device sign-in form without embedding any Host or credential data.
 * @param request - Anonymous browser document request.
 * @returns A non-cacheable challenge document.
 */
export function deviceSignIn(request: Request): Response {
  const lang = request.headers.get('accept-language')?.trim().toLowerCase().startsWith('zh') ? 'zh' : 'en'
  const labels = copy[lang]
  return new Response(request.method === 'HEAD' ? null : `<!doctype html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${labels.title}</title></head>
<body><main><h1>${labels.title}</h1>
<form><label for="device-token">${labels.token}</label>
<input id="device-token" type="password" autocomplete="off" required maxlength="80">
<button type="submit" disabled>${labels.submit}</button>
<p role="alert" hidden>${labels.failed}</p>
</form></main><script>${script}</script></body>
</html>`, {
    status: 401,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': `default-src 'none'; script-src 'sha256-${integrity}'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'`,
      'referrer-policy': 'no-referrer',
    },
  })
}
