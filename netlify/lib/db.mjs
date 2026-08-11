/* Accesso al database (Netlify DB / Neon Postgres).

   La connessione arriva da NETLIFY_DATABASE_URL, impostata automaticamente da Netlify
   quando si crea il database dall'estensione Netlify DB. */

import { neon } from '@neondatabase/serverless';

const CONNECTION =
  process.env.NETLIFY_DATABASE_URL ||
  process.env.NETLIFY_DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL;

/* Errore con codice HTTP, tradotto in risposta da jsonHandler() */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let _sql;

export function db() {
  if (!_sql) {
    if (!CONNECTION) {
      throw new HttpError(503, 'Database non configurato: crea Netlify DB e ridistribuisci il sito');
    }
    _sql = neon(CONNECTION);
  }
  return _sql;
}

/* Schema creato al primo utilizzo: idempotente, una sola volta per istanza. */
let schemaReady;

export function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = db();
      await sql`
        create table if not exists stickers (
          id           text primary key,
          title        text not null,
          description  text,
          author       text,
          lat          double precision not null,
          lng          double precision not null,
          photo_key    text,
          thumb_key    text,
          photo_url    text,
          taken_on     date,
          place        text,
          country      text,
          tags         text[] not null default '{}',
          status       text not null default 'pending',
          submitter    text,
          created_at   timestamptz not null default now()
        )`;
      await sql`create index if not exists stickers_status_idx on stickers (status, created_at desc)`;
      await sql`create index if not exists stickers_submitter_idx on stickers (submitter, created_at desc)`;
    })().catch(err => {
      schemaReady = undefined;      // il prossimo tentativo riprova
      throw err;
    });
  }
  return schemaReady;
}

/* Riga del DB → oggetto consumato dal frontend */
export function toPublic(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    author: row.author || '',
    lat: Number(row.lat),
    lng: Number(row.lng),
    photo: row.photo_key ? '/api/photo/' + row.photo_key : (row.photo_url || ''),
    thumb: row.thumb_key ? '/api/photo/' + row.thumb_key : (row.photo_url || ''),
    date: row.taken_on ? new Date(row.taken_on).toISOString().slice(0, 10) : '',
    place: row.place || '',
    country: row.country || '',
    tags: row.tags || []
  };
}
