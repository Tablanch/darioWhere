/* Conteggio visite, tenuto sul database del sito.

   Niente cookie e nessun servizio esterno: si salvano solo totali per giorno,
   pagina, provenienza e tipo di dispositivo. L'indirizzo IP non viene mai scritto
   in chiaro: ne resta un hash salato in una tabella di appoggio, che serve a non
   contare due volte lo stesso visitatore e sparisce dopo trenta giorni. Non
   servendo consenso per dati aggregati e non identificativi, non serve nemmeno
   il banner dei cookie. */

import { db } from './db.mjs';

const GIORNI_APPOGGIO = 30;
const MAX_PER_VISITATORE = 20;   // oltre, le visite non contano più: argina il gonfiaggio

let schemaReady;

export function ensureStatsSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = db();
      await sql`
        create table if not exists visits (
          day     date not null,
          path    text not null,
          source  text not null,
          device  text not null,
          hits    int  not null default 0,
          uniques int  not null default 0,
          primary key (day, path, source, device)
        )`;
      await sql`
        create table if not exists visit_seen (
          day     date not null,
          path    text not null,
          ip_hash text not null,
          n       int  not null default 1,
          primary key (day, path, ip_hash)
        )`;
    })().catch(err => { schemaReady = undefined; throw err; });
  }
  return schemaReady;
}

/* Pagine conosciute: qualunque altro percorso finisce in "altro", così nessuno può
   riempire la tabella inventandosi URL. */
const PAGINE = new Set(['/', '/add.html', '/admin.html']);

export function normalizePath(p) {
  const s = String(p || '/').split('?')[0].split('#')[0];
  if (s === '/index.html') return '/';
  return PAGINE.has(s) ? s : 'altro';
}

/* Provenienza: l'host di chi ci ha linkato, oppure "diretto". Gli adesivi hanno
   l URL nudo, quindi una scansione del QR arriva senza referrer: si riconosce come
   "diretto" da telefono. */
export function normalizeSource(ref, selfHost, qr) {
  if (qr) return 'qr';
  if (!ref) return 'diretto';
  try {
    const host = new URL(ref).host.toLowerCase();
    if (!host || host === String(selfHost).toLowerCase()) return 'interno';
    return host.replace(/^www\./, '').slice(0, 60);
  } catch (e) {
    return 'diretto';
  }
}

export function deviceFromUserAgent(ua) {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(String(ua || '')) ? 'mobile' : 'desktop';
}

export async function recordVisit({ path, source, device, ipHash }) {
  await ensureStatsSchema();
  const sql = db();
  const oggi = new Date().toISOString().slice(0, 10);

  /* xmax = 0 e vero solo quando la riga e stata inserita adesso: e il modo piu
     economico per sapere se questo visitatore e nuovo per oggi. */
  const [visto] = await sql`
    insert into visit_seen (day, path, ip_hash)
    values (${oggi}, ${path}, ${ipHash})
    on conflict (day, path, ip_hash) do update set n = visit_seen.n + 1
    returning n, (xmax = 0) as nuovo`;

  if (visto.n > MAX_PER_VISITATORE) return { contata: false };

  await sql`
    insert into visits (day, path, source, device, hits, uniques)
    values (${oggi}, ${path}, ${source}, ${device}, 1, ${visto.nuovo ? 1 : 0})
    on conflict (day, path, source, device) do update
      set hits = visits.hits + 1,
          uniques = visits.uniques + ${visto.nuovo ? 1 : 0}`;

  if (visto.nuovo) {
    await sql`delete from visit_seen
               where day < current_date - make_interval(days => ${GIORNI_APPOGGIO})`;
  }
  return { contata: true, nuovo: visto.nuovo };
}

export async function readStats(giorni = 30) {
  await ensureStatsSchema();
  const sql = db();

  const perGiorno = await sql`
    select day::text as day, sum(hits)::int as hits, sum(uniques)::int as uniques
      from visits
     where day > current_date - make_interval(days => ${giorni})
     group by day order by day desc`;

  const perProvenienza = await sql`
    select source, sum(hits)::int as hits
      from visits
     where day > current_date - make_interval(days => ${giorni})
     group by source order by hits desc limit 15`;

  const perPagina = await sql`
    select path, sum(hits)::int as hits, sum(uniques)::int as uniques
      from visits
     where day > current_date - make_interval(days => ${giorni})
     group by path order by hits desc`;

  const perDispositivo = await sql`
    select device, sum(hits)::int as hits
      from visits
     where day > current_date - make_interval(days => ${giorni})
     group by device order by hits desc`;

  /* Gli adesivi portano l URL senza parametri: una scansione si presenta come
     visita diretta da telefono. Non e una certezza, e il nome lo dice. */
  const [qr] = await sql`
    select coalesce(sum(hits), 0)::int as hits
      from visits
     where day > current_date - make_interval(days => ${giorni})
       and device = 'mobile' and source in ('diretto', 'qr')`;

  const [totali] = await sql`
    select coalesce(sum(hits), 0)::int as hits, coalesce(sum(uniques), 0)::int as uniques
      from visits
     where day > current_date - make_interval(days => ${giorni})`;

  return { giorni, totali, perGiorno, perProvenienza, perPagina, perDispositivo,
           probabiliQr: qr.hits };
}
