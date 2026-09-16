/* Validazione dei campi di uno sticker, condivisa fra invio pubblico e modifica admin.
   Tronca invece di rifiutare dove il troncamento è innocuo, rifiuta dove il dato
   sarebbe inutilizzabile (titolo troppo corto, coordinate fuori scala, data illeggibile). */

import { HttpError } from './db.mjs';
import { titleWithFlag, stripFlag } from './flag.mjs';

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

/* Coordinate arrotondate a 5 decimali, cioè circa 1,1 metri.

   Oltre e' precisione finta: la sesta cifra vale 11 cm, contro un errore del GPS
   di un telefono che va dai 3 ai 10 metri, ed e' meno di mezzo pixel allo zoom
   massimo delle mappe. Tenere un formato unico rende prevedibili i confronti fra
   coordinate, per esempio per accorgersi di due sticker nello stesso punto.

   Nota: non e' questo a impedire il blocco del form di modifica in admin. Quello
   dipende dall'attributo step degli input, che e' "any" proprio per non rifiutare
   valori con piu' decimali comunque arrivino. */
function round5(n) {
  return Math.round(n * 1e5) / 1e5;
}

/* Campi comuni a invio e modifica. Ritorna valori già puliti e pronti per il DB. */
export function stickerFields(body) {
  /* Il titolo in arrivo può già contenere la bandiera (per esempio dal form di
     modifica, che mostra il titolo come è salvato): la lunghezza minima e massima si
     misurano sul nome pulito, la bandiera viene riaccodata dopo. */
  const nome = text(stripFlag(body.title), { max: 80, min: 3, label: 'Titolo' });

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
    title: titleWithFlag(nome, countryCode),
    description: text(body.description, { max: 600, label: 'Descrizione' }),
    author: text(body.author, { max: 60, label: 'Autore' }) || 'anonimo',
    lat: round5(lat),
    lng: round5(lng),
    date: date || null,
    place: text(body.place, { max: 80, label: 'Luogo' }),
    country: text(body.country, { max: 60, label: 'Paese' }),
    countryCode: countryCode || null,
    tags
  };
}
