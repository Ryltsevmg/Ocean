/** Self-contained device sign-in document for the unauthenticated Host index. */
import { createHash } from 'node:crypto'
import { DEVICE_PROTOCOL_HEADER, DEVICE_PROTOCOL_VERSION } from '@ocean/ocean-client-connection/protocol'

const copy = {
  en: {
    title: 'Sign in to Ocean',
    token: 'Device token or pairing link',
    submit: 'Sign in',
    pairing: 'Pairing this device…',
    failed: 'Could not sign in. Check the device token or pairing link and try again.',
    foreign: 'This pairing link belongs to another Ocean Host.',
  },
  zh: {
    title: '登录 Ocean',
    token: '设备令牌或配对链接',
    submit: '登录',
    pairing: '正在配对此设备…',
    failed: '无法登录。请检查设备令牌或配对链接并重试。',
    foreign: '此配对链接属于另一个 Ocean 主机。',
  },
} as const

const script = `
const form = document.querySelector('form');
const input = document.querySelector('input');
const submit = document.querySelector('button');
const status = document.querySelector('[role="status"]');
const failure = document.querySelector('[data-failed]');
const foreign = document.querySelector('[data-foreign]');
const grant = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.[A-Za-z0-9_-]{43}$/i;
const page = new URL('./', location.href);
const send = (path, bearer) => fetch(path, {
  method: 'POST',
  credentials: 'same-origin',
  redirect: 'error',
  headers: { Authorization: 'Bearer ' + bearer, '${DEVICE_PROTOCOL_HEADER}': '${DEVICE_PROTOCOL_VERSION}' },
});
// The grant of a pairing link, undefined for any other text, and null when the link names another Host.
const grantIn = text => {
  const value = text.trim();
  let url;
  try { url = new URL(value.startsWith('#') ? page.href + value : value); } catch { return undefined; }
  const app = url.protocol === 'ocean:' && url.hostname === 'pair';
  const secret = app ? url.hash.slice(1) : url.hash.slice('#pair='.length);
  if (!grant.test(secret)) return undefined;
  try {
    const host = new URL(app ? url.searchParams.get('host') ?? '' : url.href.slice(0, url.href.length - url.hash.length));
    const path = host.pathname.endsWith('/') ? host.pathname : host.pathname + '/';
    return host.origin === page.origin && path === page.pathname ? secret : null;
  } catch {
    return undefined;
  }
};
const attempt = async (path, bearer) => {
  submit.disabled = true;
  status.hidden = path !== './connect/pair';
  failure.hidden = true;
  foreign.hidden = true;
  try {
    const paired = path === './connect/pair' ? await send(path, bearer) : undefined;
    if (paired !== undefined && paired.status !== 200) throw new Error('pairing refused');
    const token = paired === undefined ? bearer : (await paired.json()).token;
    if ((await send('./connect', token)).status !== 204) throw new Error('sign-in refused');
    location.replace('./');
  } catch {
    status.hidden = true;
    failure.hidden = false;
    submit.disabled = false;
    input.focus();
  }
};
form.addEventListener('submit', event => {
  event.preventDefault();
  if (submit.disabled) return;
  const text = input.value.trim();
  input.value = '';
  const link = grantIn(text);
  if (link === null) foreign.hidden = false;
  else void attempt(link === undefined ? './connect' : './connect/pair', link ?? text);
});
// A pairing URL carries its grant in the fragment; drop it before anything else reads the address bar.
const fromBar = location.hash.startsWith('#pair=') ? grantIn(location.hash) : undefined;
history.replaceState(null, '', location.pathname + location.search);
if (fromBar) void attempt('./connect/pair', fromBar);
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
<input id="device-token" type="password" autocomplete="off" required maxlength="512">
<button type="submit" disabled>${labels.submit}</button>
<p role="status" hidden>${labels.pairing}</p>
<p role="alert" data-failed hidden>${labels.failed}</p>
<p role="alert" data-foreign hidden>${labels.foreign}</p>
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
