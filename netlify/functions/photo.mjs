/* GET /api/photo/:key — immagine salvata su Netlify Blobs.

   L'accesso non e' libero: prima si guarda lo stato dello sticker a cui la foto
   appartiene. Senza questo controllo il form pubblico diventerebbe un servizio di
   hosting immagini per chiunque — basta inviare una proposta, leggere la chiave e
   diffondere l'URL — e il materiale rifiutato resterebbe raggiungibile anche dopo
   che il moderatore lo ha scartato.

   Tre modi per ottenere una foto non approvata: avere la sessione admin, avere un
   token firmato (quello della mail di notifica), oppure niente: 404. */

import { db, ensureSchema, HttpError } from '../lib/db.mjs';
import { handler, requireMethod } from '../lib/http.mjs';
import { isAdmin, photoTokenValid } from '../lib/auth.mjs';
import { photoStore } from '../lib/photos.mjs';

export const config = { path: '/api/photo/:key' };

/* Le chiavi sono "<id>.<ext>" per la foto e "<id>-t.<ext>" per la miniatura, e gli
   id finiscono sempre con sei caratteri casuali: si risale allo sticker senza una
   query aggiuntiva per indice. */
function stickerIdFromKey(key) {
  return key.replace(/\.[A-Za-z0-9]+$/, '').replace(/-t$/, '');
}

export default handler(async (req, context) => {
  requireMethod(req, 'GET');

  const key = context.params.key;
  if (!/^[A-Za-z0-9._-]{3,80}$/.test(key)) throw new HttpError(400, 'Chiave non valida');

  await ensureSchema();
  const sql = db();
  const rows = await sql`
    select status, photo_key, thumb_key
      from stickers
     where id = ${stickerIdFromKey(key)}`;

  const riga = rows[0];
  const appartiene = riga && (riga.photo_key === key || riga.thumb_key === key);
  const approvata = appartiene && riga.status === 'approved';

  if (!approvata) {
    const token = new URL(req.url).searchParams.get('t');
    const autorizzato = await isAdmin(req) || await photoTokenValid(key, token);
    // 404 e non 403: a chi non ha titolo non si conferma nemmeno che la foto esista
    if (!autorizzato) throw new HttpError(404, 'Foto non trovata');
  }

  const res = await photoStore().getWithMetadata(key, { type: 'arrayBuffer' });
  if (!res) throw new HttpError(404, 'Foto non trovata');

  return new Response(res.data, {
    headers: {
      'Content-Type': (res.metadata && res.metadata.contentType) || 'image/jpeg',
      /* Solo le approvate sono pubbliche e immutabili (la chiave ha un suffisso
         casuale, il contenuto non cambia mai). Le altre non vanno in nessuna cache
         condivisa, altrimenti una foto poi rifiutata resterebbe servita dalla CDN. */
      'Cache-Control': approvata
        ? 'public, max-age=31536000, immutable'
        : 'private, no-store'
    }
  });
});
