/* POST /api/admin/seed — carica gli sticker di esempio (idempotente) */

import { db, ensureSchema } from '../lib/db.mjs';
import { handler, json, requireMethod } from '../lib/http.mjs';
import { requireAdmin } from '../lib/auth.mjs';
import { SEED } from '../lib/seed.mjs';

export const config = { path: '/api/admin/seed' };

export default handler(async req => {
  requireMethod(req, 'POST');
  await requireAdmin(req);
  await ensureSchema();

  const sql = db();
  let inseriti = 0;

  for (const s of SEED) {
    const rows = await sql`
      insert into stickers
        (id, title, description, author, lat, lng, photo_url,
         taken_on, place, country, country_code, tags, status, submitter)
      values
        (${s.id}, ${s.title}, ${s.description}, ${s.author}, ${s.lat}, ${s.lng},
         ${s.photo_url}, ${s.taken_on}, ${s.place}, ${s.country}, ${s.country_code},
         ${s.tags}, 'approved', 'seed')
      on conflict (id) do nothing
      returning id`;
    inseriti += rows.length;
  }

  return json({ ok: true, inseriti, totale: SEED.length });
});
