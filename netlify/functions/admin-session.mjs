/* Sessione admin:
     POST /api/admin/login   { password }  → cookie di sessione
     POST /api/admin/logout               → cancella il cookie
     GET  /api/admin/session              → { admin: true|false } */

import { handler, json, readJson, requireMethod, clientIp, HttpError } from '../lib/http.mjs';
import { checkPassword, sessionCookie, clearCookie, isAdmin, hashIp } from '../lib/auth.mjs';
import { checkLoginAllowed, recordLoginFailure, clearLoginFailures } from '../lib/rate.mjs';

export const config = {
  path: ['/api/admin/login', '/api/admin/logout', '/api/admin/session']
};

export default handler(async (req, context) => {
  const action = new URL(req.url).pathname.split('/').pop();

  if (action === 'session') {
    return json({ admin: await isAdmin(req) }, 200, { 'Cache-Control': 'no-store' });
  }

  if (action === 'logout') {
    return json({ ok: true }, 200, { 'Set-Cookie': clearCookie(), 'Cache-Control': 'no-store' });
  }

  if (action !== 'login') throw new HttpError(404, 'Azione sconosciuta');
  requireMethod(req, 'POST');

  /* L'IP si tiene solo come hash salato: serve a contare i tentativi, non a sapere
     chi è. Il controllo viene prima della lettura della password, così un attacco
     non costa nemmeno il confronto. */
  const ipHash = await hashIp(clientIp(req, context));
  await checkLoginAllowed(ipHash);

  const { password } = await readJson(req, 4096);

  if (!await checkPassword(password)) {
    await recordLoginFailure(ipHash);
    throw new HttpError(401, 'Password errata');
  }

  await clearLoginFailures(ipHash);
  return json({ ok: true }, 200, {
    'Set-Cookie': await sessionCookie(),
    'Cache-Control': 'no-store'
  });
});
