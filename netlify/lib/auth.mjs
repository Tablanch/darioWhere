/* Sessione admin: cookie HttpOnly firmato in HMAC-SHA256.

   Variabili d'ambiente richieste:
     ADMIN_PASSWORD  la password di accesso a /admin.html
     ADMIN_SECRET    stringa casuale lunga, usata per firmare il cookie e per
                     salare l'hash degli IP (cambiarla invalida tutte le sessioni) */

import { HttpError } from './db.mjs';

const COOKIE = 'dw_admin';
const TTL_SECONDS = 12 * 60 * 60;          // 12 ore

function secret() {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) {
    throw new HttpError(503, 'ADMIN_SECRET non configurata (serve una stringa casuale lunga)');
  }
  return s;
}

const enc = new TextEncoder();

async function hmac(message) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* confronto a tempo costante fra due stringhe esadecimali */
function sameDigest(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* IP salato e hashato: basta per il rate limiting, non è un dato identificativo */
export async function hashIp(ip) {
  return sha256Hex('ip:' + secret() + ':' + ip);
}

export async function checkPassword(password) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new HttpError(503, 'ADMIN_PASSWORD non configurata');
  if (typeof password !== 'string' || !password) return false;
  // digest di entrambe per confrontare stringhe di lunghezza uguale
  return sameDigest(await sha256Hex(password), await sha256Hex(expected));
}

export async function createSession() {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = String(exp);
  return payload + '.' + await hmac(payload);
}

export async function sessionCookie() {
  return COOKIE + '=' + await createSession()
    + '; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=' + TTL_SECONDS;
}

export function clearCookie() {
  return COOKIE + '=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}

function readCookie(req) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

export async function isAdmin(req) {
  const token = readCookie(req);
  if (!token) return false;

  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;

  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  if (!sameDigest(sig, await hmac(payload))) return false;
  return Number(payload) > Math.floor(Date.now() / 1000);
}

export async function requireAdmin(req) {
  if (!await isAdmin(req)) throw new HttpError(401, 'Sessione scaduta o assente');
}
