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

  if (action === 'approve') {
    const rows = await sql`
      update stickers set status = 'approved' where id = ${id} returning id`;
    if (!rows.length) throw new HttpError(404, 'Sticker non trovato');
    return json({ ok: true, id, status: 'approved' });
  }

  /* Rifiuto ed eliminazione tolgono entrambi i file dai Blobs: tenere materiale che
     il moderatore ha scartato non serve a niente e, prima del controllo di accesso
     in photo.mjs, restava pure raggiungibile da chi ne conosceva la chiave.

     Le chiavi vanno lette PRIMA della modifica: in Postgres RETURNING su un UPDATE
     restituisce i valori nuovi, quindi dopo l'azzeramento tornerebbero due null e
     i file resterebbero orfani nello store. */
  const [corrente] = await sql`
    select status, photo_key, thumb_key from stickers where id = ${id}`;
  if (!corrente) throw new HttpError(404, 'Sticker non trovato');

  const chiavi = [corrente.photo_key, corrente.thumb_key];

  if (action === 'reject') {
    // la riga resta: tiene memoria della decisione e conta negli invii per IP
    await sql`
      update stickers set status = 'rejected', photo_key = null, thumb_key = null
       where id = ${id}`;
    await deletePhotos(chiavi);
    return json({ ok: true, id, status: 'rejected' });
  }

  if (action === 'delete') {
    await sql`delete from stickers where id = ${id}`;
    await deletePhotos(chiavi);
    return json({ ok: true, id, status: 'deleted' });
  }

  throw new HttpError(400, 'Azione non valida');
});
