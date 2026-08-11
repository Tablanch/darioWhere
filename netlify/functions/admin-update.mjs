/* POST /api/admin/update — modifica i campi di uno sticker esistente.
   La foto non si cambia da qui: per sostituirla si elimina e si reinvia. */

import { db, ensureSchema, toPublic, HttpError } from '../lib/db.mjs';
import { handler, json, requireMethod, readJson } from '../lib/http.mjs';
import { requireAdmin } from '../lib/auth.mjs';
import { stickerFields } from '../lib/validate.mjs';

export const config = { path: '/api/admin/update' };

const STATI = ['pending', 'approved', 'rejected'];

export default handler(async req => {
  requireMethod(req, 'POST');
  await requireAdmin(req);
  await ensureSchema();

  const body = await readJson(req);
  if (!body.id || typeof body.id !== 'string') throw new HttpError(400, 'ID mancante');

  const f = stickerFields(body);

  // lo stato è opzionale: se assente resta quello attuale
  const status = body.status == null ? null : String(body.status);
  if (status !== null && !STATI.includes(status)) throw new HttpError(400, 'Stato non valido');

  const sql = db();
  const rows = await sql`
    update stickers set
      title        = ${f.title},
      description  = ${f.description},
      author       = ${f.author},
      lat          = ${f.lat},
      lng          = ${f.lng},
      taken_on     = ${f.date},
      place        = ${f.place},
      country      = ${f.country},
      country_code = ${f.countryCode},
      tags         = ${f.tags},
      status       = coalesce(${status}, status)
    where id = ${body.id}
    returning id, title, description, author, lat, lng, photo_key, thumb_key, photo_url,
              taken_on, place, country, country_code, tags, status, created_at`;

  if (!rows.length) throw new HttpError(404, 'Sticker non trovato');

  return json(Object.assign(toPublic(rows[0]), {
    status: rows[0].status,
    createdAt: rows[0].created_at
  }));
});
