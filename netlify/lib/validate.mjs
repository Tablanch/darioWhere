/* Validazione dei campi di uno sticker, condivisa fra invio pubblico e modifica admin.
   Tronca invece di rifiutare dove il troncamento è innocuo, rifiuta dove il dato
   sarebbe inutilizzabile (titolo troppo corto, coordinate fuori scala, data illeggibile). */

import { HttpError } from './db.mjs';

export function text(value, { max, min = 0, label = 'Campo' } = {}) {
  const s = String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
  if (s.length < min) throw new HttpError(400, label + ': serve almeno ' + min + ' caratteri');
  return s.slice(0, max);
}

export function slug(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

/* Campi comuni a invio e modifica. Ritorna valori già puliti e pronti per il DB. */
export function stickerFields(body) {
  const title = text(body.title, { max: 80, min: 3, label: 'Titolo' });

  const lat = Number(body.lat), lng = Number(body.lng);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new HttpError(400, 'Coordinate non valide');
  }

  const date = String(body.date || '').trim();
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Data non valida');

  const countryCode = String(body.countryCode || '').trim().toUpperCase();
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    throw new HttpError(400, 'Codice paese: servono due lettere ISO, es. IT');
  }

  const tags = (Array.isArray(body.tags) ? body.tags : [])
    .map(t => text(t, { max: 24, label: 'Tag' }))
    .filter(Boolean)
    .slice(0, 6);

  return {
    title,
    description: text(body.description, { max: 600, label: 'Descrizione' }),
    author: text(body.author, { max: 60, label: 'Autore' }) || 'anonimo',
    lat,
    lng,
    date: date || null,
    place: text(body.place, { max: 80, label: 'Luogo' }),
    country: text(body.country, { max: 60, label: 'Paese' }),
    countryCode: countryCode || null,
    tags
  };
}
