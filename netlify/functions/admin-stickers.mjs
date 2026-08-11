/* GET /api/admin/stickers — tutti gli sticker, in coda di moderazione e già pubblicati */

import { db, ensureSchema, toPublic } from '../lib/db.mjs';
import { handler, json, requireMethod } from '../lib/http.mjs';
import { requireAdmin } from '../lib/auth.mjs';

export const config = { path: '/api/admin/stickers' };

export default handler(async req => {
  requireMethod(req, 'GET');
  await requireAdmin(req);
  await ensureSchema();

  const sql = db();
  const rows = await sql`
    select id, title, description, author, lat, lng,
           photo_key, thumb_key, photo_url, taken_on, place, country, country_code, tags,
           status, created_at
      from stickers
     order by (status = 'pending') desc, created_at desc
     limit 500`;

  return json(rows.map(r => Object.assign(toPublic(r), {
    status: r.status,
    createdAt: r.created_at
  })), 200, { 'Cache-Control': 'no-store' });
});
