/* POST /api/hit — una visita. Chiamato da ogni pagina, non blocca nulla. */

import { handler, json, requireMethod, readJson, clientIp } from '../lib/http.mjs';
import { hashIp } from '../lib/auth.mjs';
import { recordVisit, normalizePath, normalizeSource, deviceFromUserAgent } from '../lib/stats.mjs';

export const config = { path: '/api/hit' };

export default handler(async (req, context) => {
  requireMethod(req, 'POST');

  const body = await readJson(req, 2048);

  await recordVisit({
    path: normalizePath(body.path),
    source: normalizeSource(body.ref, new URL(req.url).host, !!body.qr),
    device: deviceFromUserAgent(req.headers.get('user-agent')),
    ipHash: await hashIp(clientIp(req, context))
  });

  return json({ ok: true }, 200, { 'Cache-Control': 'no-store' });
});
