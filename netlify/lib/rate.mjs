/* Freno ai tentativi di accesso, tenuto sul database.

   La versione precedente usava una Map in memoria. Su Netlify ogni richiesta può
   finire su un'istanza diversa, e le istanze nascono e muoiono di continuo: il
   contatore ripartiva da zero a ogni istanza nuova, quindi bastava mandare le
   richieste in parallelo per avere molti più tentativi di quanti ne concedesse il
   limite. Misurato sul sito: 12 richieste parallele, 6 passate.

   Sul database il conteggio è uno solo per tutti. */

import { db, HttpError } from './db.mjs';

const FINESTRA_MIN = 15;      // i tentativi contano per questo tempo
const MAX_PER_IP = 8;         // falliti consecutivi dallo stesso indirizzo
const MAX_GLOBALI = 40;       // falliti da chiunque: argina un attacco distribuito

let schemaReady;

export function ensureRateSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = db();
      await sql`
        create table if not exists login_attempts (
          id         bigserial primary key,
          ip_hash    text not null,
          created_at timestamptz not null default now()
        )`;
      await sql`create index if not exists login_attempts_idx
                  on login_attempts (created_at desc)`;
      await sql`create index if not exists login_attempts_ip_idx
                  on login_attempts (ip_hash, created_at desc)`;
    })().catch(err => { schemaReady = undefined; throw err; });
  }
  return schemaReady;
}

/* Da chiamare PRIMA di controllare la password. */
export async function checkLoginAllowed(ipHash) {
  await ensureRateSchema();
  const sql = db();

  const [c] = await sql`
    select count(*) filter (where ip_hash = ${ipHash})::int as miei,
           count(*)::int                                    as tutti
      from login_attempts
     where created_at > now() - make_interval(mins => ${FINESTRA_MIN})`;

  if (c.miei >= MAX_PER_IP || c.tutti >= MAX_GLOBALI) {
    throw new HttpError(429, 'Troppi tentativi di accesso: riprova fra ' + FINESTRA_MIN + ' minuti');
  }
}

/* Da chiamare dopo un tentativo fallito. */
export async function recordLoginFailure(ipHash) {
  const sql = db();
  await sql`insert into login_attempts (ip_hash) values (${ipHash})`;
  // pulizia opportunistica, così la tabella non cresce all'infinito
  await sql`delete from login_attempts where created_at < now() - interval '1 day'`;
}

/* Accesso riuscito: si azzerano i tentativi di quell'indirizzo. */
export async function clearLoginFailures(ipHash) {
  const sql = db();
  await sql`delete from login_attempts where ip_hash = ${ipHash}`;
}
