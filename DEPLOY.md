# Messa online su Netlify

## 1. Collega il repository

Su Netlify: *Add new site → Import an existing project → GitHub → darioWhere*.
Build command vuoto, publish directory `.`: è già tutto in [netlify.toml](netlify.toml).

## 2. Crea il database

Nella dashboard del sito: *Extensions → Netlify DB → Install*, poi crea il database.
Netlify imposta da sola la variabile `NETLIFY_DATABASE_URL`. Le tabelle vengono create
alla prima chiamata dell'API, non serve nessuna migrazione a mano.

> Il database creato da Netlify è *claimable*: rivendicalo con un account Neon entro pochi
> giorni, altrimenti viene cancellato.

## 3. Imposta le due variabili d'ambiente

*Site configuration → Environment variables*:

| Variabile | Valore |
|---|---|
| `ADMIN_PASSWORD` | la password con cui entri in `/admin.html` |
| `ADMIN_SECRET` | stringa casuale lunga, firma i cookie di sessione e sala gli hash degli IP |

Per generare il secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Cambiare `ADMIN_SECRET` invalida tutte le sessioni admin aperte. Dopo aver aggiunto le
variabili serve un nuovo deploy perché le funzioni le vedano.

## 4. Primo giro

1. Apri `/admin.html`, entra con `ADMIN_PASSWORD`.
2. Se vuoi la mappa già popolata, premi **Carica i 7 sticker di esempio** (cancellabili uno per uno).
3. Apri `/add.html` e prova un invio: comparirà in *In attesa*.
4. Approvalo: entro un minuto è sulla mappa (l'elenco pubblico ha `max-age=60`).

## Sviluppo in locale

```bash
npm install
npx netlify dev
```

`netlify dev` collega il sito remoto, quindi usa lo stesso database e gli stessi Blobs.
Senza di esso le pagine si aprono ma `/api/*` non risponde.

## API

| Metodo e rotta | Accesso | Cosa fa |
|---|---|---|
| `GET /api/stickers` | pubblico | sticker approvati |
| `POST /api/submit` | pubblico | propone uno sticker (stato `pending`) |
| `GET /api/photo/:key` | pubblico | foto dai Blobs, cache immutabile |
| `POST /api/admin/login` | password | apre la sessione |
| `POST /api/admin/logout` | — | chiude la sessione |
| `GET /api/admin/session` | — | dice se la sessione è valida |
| `GET /api/admin/stickers` | admin | tutti gli sticker, ogni stato |
| `POST /api/admin/review` | admin | `approve` / `reject` / `delete` |
| `POST /api/admin/seed` | admin | carica gli sticker di esempio |

## Limiti e difese

- **Payload**: le Netlify Functions accettano ~6 MB. Il browser ridimensiona la foto a
  1600px lato lungo (JPEG q0.82, ~300 KB) e genera una miniatura da 160px per i pin.
  Il server rifiuta comunque foto oltre 3 MB e miniature oltre 400 KB.
- **EXIF**: la ricodifica su canvas elimina i metadati dell'originale, GPS del telefono compreso.
- **Rate limiting**: massimo 5 invii all'ora per IP, che viene salvato solo come hash salato.
- **Login**: 6 tentativi poi un minuto di attesa, cookie `HttpOnly; Secure; SameSite=Strict`
  valido 12 ore.
- **Moderazione**: nessuno sticker compare sulla mappa senza approvazione. Nota che
  `/api/photo/:key` serve qualunque chiave esistente, anche di una proposta non ancora
  approvata: le chiavi contengono un suffisso casuale e non sono elencabili, quindi non
  sono indovinabili, ma non sono un segreto crittografico.
- **Cosa manca se il sito diventa pubblico davvero**: un captcha (Cloudflare Turnstile è
  gratuito) sul form di invio, e un tetto giornaliero globale agli invii.
