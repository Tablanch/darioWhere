# 📍 Dariowhere

Mappa interattiva degli sticker sparsi per il mondo. Clicchi una puntina e si apre il popup
con foto, descrizione, autore e coordinate. Chiunque può proporre uno sticker caricando una
foto; le proposte compaiono online dopo l'approvazione di un moderatore.

## Tecnologie

- **Leaflet** con tile **OpenStreetMap** e **CARTO** — nessuna API key, nessuna carta di credito
- **Leaflet.markercluster** per raggruppare i pin vicini
- **Nominatim** per la ricerca degli indirizzi nel form di inserimento
- Frontend in **HTML, CSS e JavaScript** senza framework né build step
- **Netlify Functions** (Node 20, ESM) per l'API `/api/*`
- **Netlify DB** — Postgres serverless di Neon — per i dati degli sticker
- **Netlify Blobs** per le foto, ridimensionate nel browser prima dell'upload
- Sessione admin con cookie HttpOnly firmato in HMAC-SHA256

## Pagine

| | |
|---|---|
| `index.html` | la mappa |
| `add.html` | form pubblico di proposta |
| `admin.html` | moderazione, protetta da password |

Per installazione e configurazione: [DEPLOY.md](DEPLOY.md).
