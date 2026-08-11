/* Helper comuni alle funzioni: risposte JSON, gestione errori, lettura del body. */

import { HttpError } from './db.mjs';

export { HttpError };

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers)
  });
}

/* Avvolge un handler: converte le eccezioni in risposte JSON e non fa mai
   uscire dettagli interni verso il client. */
export function handler(fn) {
  return async (req, context) => {
    try {
      return await fn(req, context);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status >= 500) console.error('[dariowhere]', err);
      return json({ error: status >= 500 ? 'Errore interno' : err.message }, status);
    }
  };
}

export function requireMethod(req, method) {
  if (req.method !== method) throw new HttpError(405, 'Metodo non consentito');
}

export async function readJson(req, maxBytes = 8 * 1024 * 1024) {
  const raw = await req.text();
  if (raw.length > maxBytes) throw new HttpError(413, 'Richiesta troppo grande');
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new HttpError(400, 'JSON non valido');
  }
}

/* IP del chiamante, per il rate limiting */
export function clientIp(req, context) {
  return (context && context.ip)
    || req.headers.get('x-nf-client-connection-ip')
    || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || 'unknown';
}
