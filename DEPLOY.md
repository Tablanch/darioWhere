# Messa online su Netlify

## 1. Collega il repository

Su Netlify: *Add new site → Import an existing project → GitHub → darioWhere*.
Build command vuoto, publish directory `.`: è già tutto in [netlify.toml](netlify.toml).

## 2. Crea il database su Neon

L'estensione *Netlify DB* è stata dismessa e non crea più database nuovi, quindi il
progetto Postgres si crea direttamente su Neon — è lo stesso servizio che stava sotto
l'estensione, e il driver usato dal codice non cambia.

1. Su [neon.com](https://neon.com) crea un account e un progetto (piano gratuito:
   0,5 GB di storage, il compute va in pausa quando non serve).
2. Copia la **connection string** del branch `main`, con `?sslmode=require`.
3. Incollala su Netlify come variabile `DATABASE_URL` (passo 3).

Va bene sia l'endpoint diretto sia quello con `-pooler` nell'host: `@neondatabase/serverless`
esegue le query su HTTPS, ogni query è una richiesta a sé e non tiene aperta una connessione,
quindi il pooler non cambia nulla per questo progetto.

Le tabelle vengono create alla prima chiamata dell'API: nessuna migrazione a mano.

> Se in futuro Netlify reintroduce un'integrazione che imposta `NETLIFY_DATABASE_URL`,
> il codice la usa senza modifiche: [netlify/lib/db.mjs](netlify/lib/db.mjs) accetta
> `NETLIFY_DATABASE_URL`, `NETLIFY_DATABASE_URL_UNPOOLED` o `DATABASE_URL`, in quest'ordine.

## 3. Imposta le variabili d'ambiente

*Site configuration → Environment variables*:

| Variabile | Obbligatoria | Valore |
|---|---|---|
| `DATABASE_URL` | sì | la connection string Neon del passo 2 |
| `ADMIN_PASSWORD` | sì | la password con cui entri in `/admin.html` |
| `ADMIN_SECRET` | sì | stringa casuale lunga, firma i cookie di sessione e sala gli hash degli IP |
| `RESEND_API_KEY` | no | chiave [Resend](https://resend.com) per la mail di notifica; se manca, la notifica è disattivata e l'invio funziona comunque |
| `NOTIFY_EMAIL` | no | destinatario della notifica (default `a.bianchi@ads.it`) |
| `MAIL_FROM` | no | mittente verificato su Resend (default `onboarding@resend.dev`, il mittente di prova) |

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

Per lavorare su un database separato da quello di produzione, crea un branch nel progetto
Neon e mettine la connection string in un `.env` locale (già in `.gitignore`):

```
DATABASE_URL=postgresql://…
ADMIN_PASSWORD=…
ADMIN_SECRET=…
```

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
| `POST /api/admin/update` | admin | modifica i campi di uno sticker |
| `POST /api/admin/seed` | admin | carica gli sticker di esempio |

## Notifica email

Alla ricezione di una proposta parte una mail al moderatore con foto, dati e un pulsante
verso `/admin.html`. Passa dall'API HTTP di [Resend](https://resend.com): niente SMTP,
niente dipendenze, piano gratuito 3.000 mail al mese.

Per attivarla basta `RESEND_API_KEY`. Il mittente di prova `onboarding@resend.dev`
funziona solo verso l'indirizzo dell'account Resend: per scrivere ad altri indirizzi
serve un dominio verificato e `MAIL_FROM` su quel dominio.

Se l'invio della mail fallisce lo sticker resta comunque salvato: l'errore finisce nei
*Function logs* e la risposta contiene `notified: false`.

## Limiti e difese

- **Payload**: le Netlify Functions accettano ~6 MB. Il browser ridimensiona la foto a
  1600px lato lungo (JPEG q0.82, ~300 KB) e genera una miniatura da 160px per i pin.
  Il server rifiuta comunque foto oltre 3 MB e miniature oltre 400 KB.
- **EXIF**: la ricodifica su canvas elimina i metadati dell'originale, GPS del telefono compreso.
- **GPS dalla foto su Android**: il selettore foto di sistema rimuove la posizione dalle
  immagini che consegna al browser, quindi l'EXIF arriva con la data ma senza coordinate.
  Non è aggirabile da una pagina web: il form lo dice e propone la posizione del
  dispositivo o la scelta a mano. Su iOS e da desktop il GPS si legge normalmente.
- **Rate limiting**: massimo 5 invii all'ora per IP, che viene salvato solo come hash salato.
- **Login**: 6 tentativi poi un minuto di attesa, cookie `HttpOnly; Secure; SameSite=Strict`
  valido 12 ore.
- **Moderazione**: nessuno sticker compare sulla mappa senza approvazione. Nota che
  `/api/photo/:key` serve qualunque chiave esistente, anche di una proposta non ancora
  approvata: le chiavi contengono un suffisso casuale e non sono elencabili, quindi non
  sono indovinabili, ma non sono un segreto crittografico.
- **Cosa manca se il sito diventa pubblico davvero**: un captcha (Cloudflare Turnstile è
  gratuito) sul form di invio, e un tetto giornaliero globale agli invii.
