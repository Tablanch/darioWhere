/* Sessione admin:
     POST /api/admin/login   { password }  → cookie di sessione
     POST /api/admin/logout               → cancella il cookie
     GET  /api/admin/session              → { admin: true|false } */

import { handler, json, readJson, HttpError } from '../lib/http.mjs';
import { checkPassword, sessionCookie, clearCookie, isAdmin } from '../lib/auth.mjs';

export const config = {
  path: ['/api/admin/login', '/api/admin/logout', '/api/admin/session']
};

/* piccolo freno ai tentativi a raffica sulla stessa istanza */
const attempts = new Map();

function throttle(ip) {
  const now = Date.now();
  const rec = attempts.get(ip) || { n: 0, until: 0 };
  if (rec.until > now) throw new HttpError(429, 'Troppi tentativi: aspetta un minuto');
  rec.n++;
  if (rec.n >= 6) { rec.until = now + 60_000; rec.n = 0; }
  attempts.set(ip, rec);
}

export default handler(async req => {
  const action = new URL(req.url).pathname.split('/').pop();

  if (action === 'session') {
    return json({ admin: await isAdmin(req) });
  }

  if (action === 'logout') {
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
  }

  if (action !== 'login') throw new HttpError(404, 'Azione sconosciuta');
  if (req.method !== 'POST') throw new HttpError(405, 'Metodo non consentito');

  throttle(req.headers.get('x-nf-client-connection-ip') || 'unknown');

  const { password } = await readJson(req, 4096);
  if (!await checkPassword(password)) throw new HttpError(401, 'Password errata');

  return json({ ok: true }, 200, { 'Set-Cookie': await sessionCookie() });
});
