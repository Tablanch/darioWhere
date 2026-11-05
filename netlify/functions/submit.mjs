/* POST /api/submit — proposta di un nuovo sticker (finisce in coda di moderazione) */

import { db, ensureSchema, HttpError } from '../lib/db.mjs';
import { handler, json, requireMethod, readJson, clientIp } from '../lib/http.mjs';
import { hashIp, photoToken } from '../lib/auth.mjs';
import { decodeDataUrl, savePhoto, deletePhotos } from '../lib/photos.mjs';
import { stickerFields, slug } from '../lib/validate.mjs';
import { notifyNewSticker } from '../lib/notify.mjs';

export const config = { path: '/api/submit' };

const MAX_PHOTO = 3 * 1024 * 1024;      // 3 MB, il browser ridimensiona a 1600px
const MAX_THUMB = 400 * 1024;
const MAX_PER_HOUR = 5;              // per singolo IP

/* Il limite per IP da solo non basta: gli indirizzi si cambiano, e con gli adesivi
   in giro l'indirizzo del sito e' pubblico. Questi due tetti limitano il danno che
   puo' fare un gruppo di mittenti diversi, e si liberano da soli man mano che il
   moderatore smaltisce la coda. */
const MAX_PER_HOUR_GLOBAL = 30;      // invii complessivi nell'ultima ora
const MAX_IN_CODA = 150;             // proposte in attesa non ancora moderate
const MAX_MAIL_IN_CODA = 20;         // oltre, niente notifica: la coda e' gia' nota

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

  /* --- tetti globali --- */

  const [conteggi] = await sql`
    select count(*) filter (where created_at > now() - interval '1 hour')::int as ultima_ora,
           count(*) filter (where status = 'pending')::int                     as in_coda
      from stickers`;

  if (conteggi.ultima_ora >= MAX_PER_HOUR_GLOBAL) {
    throw new HttpError(429, 'Troppi invii in questo momento: riprova fra qualche minuto');
  }
  if (conteggi.in_coda >= MAX_IN_CODA) {
    throw new HttpError(503, 'La coda di moderazione è piena: riprova più tardi');
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
  const notifica = conteggi.in_coda >= MAX_MAIL_IN_CODA
    ? { sent: false, reason: 'coda già lunga' }
    : await notifyNewSticker(
    Object.assign({}, f, {
      // la foto non e' ancora approvata: senza token firmato il client di posta vedrebbe un 404
      photoUrl: site + '/api/photo/' + photoKey + '?t=' + await photoToken(photoKey)
    }), site);

  return json({ ok: true, id, status: 'pending', notified: notifica.sent }, 201);
});
