/* Archiviazione delle foto su Netlify Blobs.

   Le immagini arrivano dal browser già ridimensionate e ricodificate come data URL
   (vedi resizeImage() in assets/js/add.js): la ricodifica su canvas elimina anche
   i metadati EXIF originali, quindi non finiscono online dati del dispositivo. */

import { getStore } from '@netlify/blobs';
import { HttpError } from './db.mjs';

const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function photoStore() {
  return getStore({ name: 'photos', consistency: 'strong' });
}

/* "data:image/jpeg;base64,..." → { bytes, contentType, ext } */
export function decodeDataUrl(dataUrl, maxBytes, label = 'foto') {
  if (typeof dataUrl !== 'string') throw new HttpError(400, 'Manca la ' + label);

  const m = /^data:([\w/+-]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) throw new HttpError(400, 'Formato della ' + label + ' non valido');

  const contentType = m[1].toLowerCase();
  const ext = ALLOWED[contentType];
  if (!ext) throw new HttpError(415, 'Formato non supportato: usa JPEG, PNG o WebP');

  const bytes = Buffer.from(m[2], 'base64');
  if (!bytes.length) throw new HttpError(400, 'La ' + label + ' è vuota');
  if (bytes.length > maxBytes) {
    throw new HttpError(413, 'La ' + label + ' supera ' + Math.round(maxBytes / 1024) + ' KB');
  }

  return { bytes, contentType, ext };
}

export async function savePhoto(key, { bytes, contentType }) {
  await photoStore().set(key, bytes, { metadata: { contentType } });
  return key;
}

export async function deletePhotos(keys) {
  const store = photoStore();
  await Promise.all(keys.filter(Boolean).map(k => store.delete(k).catch(() => {})));
}
