/* GET /api/photo/:key — restituisce una foto salvata su Netlify Blobs */

import { handler, requireMethod, HttpError } from '../lib/http.mjs';
import { photoStore } from '../lib/photos.mjs';

export const config = { path: '/api/photo/:key' };

export default handler(async (req, context) => {
  requireMethod(req, 'GET');

  const key = context.params.key;
  if (!/^[A-Za-z0-9._-]{3,80}$/.test(key)) throw new HttpError(400, 'Chiave non valida');

  const res = await photoStore().getWithMetadata(key, { type: 'arrayBuffer' });
  if (!res) throw new HttpError(404, 'Foto non trovata');

  return new Response(res.data, {
    headers: {
      'Content-Type': (res.metadata && res.metadata.contentType) || 'image/jpeg',
      // la chiave contiene un suffisso casuale: il contenuto non cambia mai
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
});
