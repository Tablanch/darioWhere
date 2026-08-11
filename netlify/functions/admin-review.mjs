/* POST /api/admin/review — { id, action: "approve" | "reject" | "delete" } */

import { db, ensureSchema, HttpError } from '../lib/db.mjs';
import { handler, json, requireMethod, readJson } from '../lib/http.mjs';
import { requireAdmin } from '../lib/auth.mjs';
import { deletePhotos } from '../lib/photos.mjs';

export const config = { path: '/api/admin/review' };

export default handler(async req => {
  requireMethod(req, 'POST');
  await requireAdmin(req);
  await ensureSchema();

  const { id, action } = await readJson(req, 4096);
  if (!id || typeof id !== 'string') throw new HttpError(400, 'ID mancante');

  const sql = db();

  if (action === 'approve' || action === 'reject') {
    const status = action === 'approve' ? 'approved' : 'rejected';
    const rows = await sql`update stickers set status = ${status} where id = ${id} returning id`;
    if (!rows.length) throw new HttpError(404, 'Sticker non trovato');
    return json({ ok: true, id, status });
  }

  if (action === 'delete') {
    const rows = await sql`delete from stickers where id = ${id} returning photo_key, thumb_key`;
    if (!rows.length) throw new HttpError(404, 'Sticker non trovato');
    await deletePhotos([rows[0].photo_key, rows[0].thumb_key]);
    return json({ ok: true, id, status: 'deleted' });
  }

  throw new HttpError(400, 'Azione non valida');
});
