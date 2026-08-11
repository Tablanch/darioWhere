/* POST /api/submit — proposta di un nuovo sticker (finisce in coda di moderazione) */

import { db, ensureSchema, HttpError } from '../lib/db.mjs';
import { handler, json, requireMethod, readJson, clientIp } from '../lib/http.mjs';
import { hashIp } from '../lib/auth.mjs';
import { decodeDataUrl, savePhoto, deletePhotos } from '../lib/photos.mjs';
import { stickerFields, slug } from '../lib/validate.mjs';
import { notifyNewSticker } from '../lib/notify.mjs';

export const config = { path: '/api/submit' };

const MAX_PHOTO = 3 * 1024 * 1024;      // 3 MB, il browser ridimensiona a 1600px
const MAX_THUMB = 400 * 1024;
const MAX_PER_HOUR = 5;

export default handler(async (req, context) => {
  requireMethod(req, 'POST');
  await ensureSchema();

  const body = await readJson(req);
  const sql = db();

  const f = stickerFields(body);
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

  const id = (slug(f.title) || 'sticker') + '-' + crypto.randomUUID().slice(0, 6);
  const photoKey = id + '.' + photo.ext;
  const thumbKey = id + '-t.' + thumb.ext;

  await savePhoto(photoKey, photo);
  await savePhoto(thumbKey, thumb);

  try {
    await sql`
      insert into stickers
        (id, title, description, author, lat, lng, photo_key, thumb_key,
         taken_on, place, country, country_code, tags, status, submitter)
      values
        (${id}, ${f.title}, ${f.description}, ${f.author}, ${f.lat}, ${f.lng},
         ${photoKey}, ${thumbKey}, ${f.date}, ${f.place}, ${f.country}, ${f.countryCode},
         ${f.tags}, 'pending', ${submitter})`;
  } catch (err) {
    await deletePhotos([photoKey, thumbKey]);     // niente foto orfane nei Blobs
    throw err;
  }

  /* Notifica al moderatore. Attesa volutamente: dopo il return la funzione può essere
     congelata, quindi un invio "fire and forget" non partirebbe in modo affidabile.
     notifyNewSticker() non solleva eccezioni: se l'email non parte, lo sticker resta. */
  const site = process.env.URL || new URL(req.url).origin;
  const notifica = await notifyNewSticker(
    Object.assign({}, f, { photoUrl: site + '/api/photo/' + photoKey }), site);

  return json({ ok: true, id, status: 'pending', notified: notifica.sent }, 201);
});
