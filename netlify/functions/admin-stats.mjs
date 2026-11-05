/* GET /api/admin/stats — numeri delle visite per la pagina di moderazione */

import { handler, json, requireMethod } from '../lib/http.mjs';
import { requireAdmin } from '../lib/auth.mjs';
import { readStats } from '../lib/stats.mjs';

export const config = { path: '/api/admin/stats' };

export default handler(async req => {
  requireMethod(req, 'GET');
  await requireAdmin(req);

  const giorni = Math.min(365, Math.max(1,
    Number(new URL(req.url).searchParams.get('giorni')) || 30));

  return json(await readStats(giorni), 200, { 'Cache-Control': 'no-store' });
});
