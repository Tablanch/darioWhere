/* POST /api/submit — proposta di un nuovo sticker (finisce in coda di moderazione) */

import { db, ensureSchema, HttpError } from '../lib/db.mjs';
import { handler, json, requireMethod, readJson, clientIp } from '../lib/http.mjs';
import { hashIp } from '../lib/auth.mjs';
import { decodeDataUrl, savePhoto, deletePhotos } from '../lib/photos.mjs';

export const config = { path: '/api/submit' };

const MAX_PHOTO = 3 * 1024 * 1024;      // 3 MB, il browser ridimensiona a 1600px
const MAX_THUMB = 400 * 1024;
const MAX_PER_HOUR = 5;

function text(value, { max, min = 0, label }) {
  const s = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  if (s.length < min) throw new HttpError(400, label + ': serve almeno ' + min + ' caratteri');
  return s.slice(0, max);
}

function slug(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export default handler(async (req, context) => {
  requireMethod(req, 'POST');
  await ensureSchema();

  const body = await readJson(req);
  const sql = db();

  /* --- validazione --- */

  const title = text(body.title, { max: 80, min: 3, label: 'Titolo' });

  const lat = Number(body.lat), lng = Number(body.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new HttpError(400, 'Coordinate non valide');
  }

  const date = String(body.date || '').trim();
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Data non valida');

  const tags = (Array.isArray(body.tags) ? body.tags : [])
    .map(t => text(t, { max: 24, label: 'Tag' }))
    .filter(Boolean)
    .slice(0, 6);

  const photo = decodeDataUrl(body.photo, MAX_PHOTO, 'foto');
  const thumb = decodeDataUrl(body.thumb, MAX_THUMB, 'miniatura');

  /* --- rate limiting per IP --- */

  const submitter = await hashIp(clientIp(req, context));
  const [{ recenti }] = await sql`
    select count(*)::int as recenti
      from stickers
     where submitter = ${submitter}
       and created_at > now() - interval '1 hour'`;

  if (recenti >= MAX_PER_HOUR) {
    throw new HttpError(429, 'Hai già inviato ' + MAX_PER_HOUR + ' sticker nell\'ultima ora: riprova più tardi');
  }

  /* --- salvataggio --- */

  const id = (slug(title) || 'sticker') + '-' + crypto.randomUUID().slice(0, 6);
  const photoKey = id + '.' + photo.ext;
  const thumbKey = id + '-t.' + thumb.ext;

  await savePhoto(photoKey, photo);
  await savePhoto(thumbKey, thumb);

  try {
    await sql`
      insert into stickers
        (id, title, description, author, lat, lng, photo_key, thumb_key,
         taken_on, place, country, tags, status, submitter)
      values
        (${id}, ${title},
         ${text(body.description, { max: 600, label: 'Descrizione' })},
         ${text(body.author, { max: 60, label: 'Autore' }) || 'anonimo'},
         ${lat}, ${lng}, ${photoKey}, ${thumbKey},
         ${date || null},
         ${text(body.place, { max: 80, label: 'Luogo' })},
         ${text(body.country, { max: 60, label: 'Paese' })},
         ${tags}, 'pending', ${submitter})`;
  } catch (err) {
    await deletePhotos([photoKey, thumbKey]);     // niente foto orfane nei Blobs
    throw err;
  }

  return json({ ok: true, id, status: 'pending' }, 201);
});
