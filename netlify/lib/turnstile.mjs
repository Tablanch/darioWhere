/* Verifica del captcha Cloudflare Turnstile.

   Variabili d'ambiente:
     TURNSTILE_SITE_KEY    chiave pubblica, finisce nella pagina (la serve /api/config)
     TURNSTILE_SECRET_KEY  chiave privata, resta qui

   Se la chiave privata non c'è, la verifica è disattivata e l'invio funziona come
   prima: così il sito continua a ricevere proposte anche prima che il captcha sia
   configurato, e si accende da solo appena le chiavi vengono messe su Netlify. */

import { HttpError } from './db.mjs';

const VERIFICA = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstileConfigurato() {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verificaTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { verificato: false, motivo: 'non configurato' };

  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) {
    throw new HttpError(400, 'Verifica antispam mancante: ricarica la pagina e riprova');
  }

  const corpo = new URLSearchParams({ secret, response: token });
  if (ip) corpo.set('remoteip', ip);

  let esito;
  try {
    const res = await fetch(VERIFICA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: corpo
    });
    esito = await res.json();
  } catch (err) {
    /* Cloudflare irraggiungibile. Si lascia passare: bloccare tutti gli invii per un
       guasto di terzi farebbe più danno dello spam che si evita, e la proposta
       finisce comunque in coda di moderazione prima di comparire sulla mappa. */
    console.error('[dariowhere] Turnstile non raggiungibile, invio accettato', err);
    return { verificato: false, motivo: 'servizio non raggiungibile' };
  }

  if (!esito.success) {
    // "timeout-or-duplicate" significa token gia' usato: ogni token vale una volta sola
    console.warn('[dariowhere] Turnstile ha rifiutato il token:', esito['error-codes']);
    throw new HttpError(400, 'Verifica antispam non superata: riprova');
  }

  return { verificato: true };
}
