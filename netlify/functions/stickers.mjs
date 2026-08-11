/* GET /api/stickers — elenco pubblico degli sticker approvati */

import { db, ensureSchema, toPublic } from '../lib/db.mjs';
import { handler, json, requireMethod } from '../lib/http.mjs';

export const config = { path: '/api/stickers' };

export default handler(async req => {
  requireMethod(req, 'GET');
  await ensureSchema();

  const sql = db();
  const rows = await sql`
    select id, title, description, author, lat, lng,
           photo_key, thumb_key, photo_url, taken_on, place, country, tags
      from stickers
     where status = 'approved'
     order by created_at desc
     limit 2000`;

  return json(rows.map(toPublic), 200, {
    // breve: dopo un'approvazione la mappa si aggiorna entro un minuto
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
  });
});
