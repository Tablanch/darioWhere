/* GET /api/config — le poche impostazioni che la pagina deve conoscere.

   Serve a non dover scrivere la chiave pubblica del captcha dentro l'HTML: il sito
   non ha un passaggio di build che possa sostituire un segnaposto, quindi la chiave
   arriva da qui. È pubblica per definizione, Turnstile la espone nella pagina. */

import { handler, json, requireMethod } from '../lib/http.mjs';

export const config = { path: '/api/config' };

export default handler(async req => {
  requireMethod(req, 'GET');

  return json(
    { turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || null },
    200,
    { 'Cache-Control': 'public, max-age=300' }
  );
});
