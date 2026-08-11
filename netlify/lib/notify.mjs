/* Notifica per email quando arriva uno sticker da approvare.

   Usa l'API HTTP di Resend, quindi non serve nessuna dipendenza né un server SMTP.
   Variabili d'ambiente:
     RESEND_API_KEY  chiave dell'account Resend. Se manca, la notifica è silenziosamente
                     disattivata: l'invio dello sticker funziona comunque.
     NOTIFY_EMAIL    destinatario (default: a.bianchi@ads.it)
     MAIL_FROM       mittente verificato su Resend (default: il mittente di prova)

   Non solleva mai eccezioni: un problema con l'email non deve far fallire una proposta
   già salvata sul database. */

const DEFAULT_TO = 'a.bianchi@ads.it';
const DEFAULT_FROM = 'Dariowhere <onboarding@resend.dev>';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function corpo(st, site) {
  const riga = (etichetta, valore) => valore
    ? '<tr><td style="padding:3px 12px 3px 0;color:#6a7080">' + esc(etichetta) + '</td>'
      + '<td style="padding:3px 0"><strong>' + esc(valore) + '</strong></td></tr>'
    : '';

  const luogo = [st.place, st.country].filter(Boolean).join(', ');
  const coord = Number(st.lat).toFixed(5) + ', ' + Number(st.lng).toFixed(5);

  return ''
    + '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#16181d">'
    +   '<h2 style="margin:0 0 4px">Nuovo sticker da approvare</h2>'
    +   '<p style="margin:0 0 16px;color:#6a7080">' + esc(st.title) + '</p>'
    +   (st.photoUrl
          ? '<img src="' + esc(st.photoUrl) + '" alt="" '
            + 'style="max-width:420px;width:100%;border-radius:10px;display:block;margin:0 0 16px">'
          : '')
    +   '<table style="border-collapse:collapse;font-size:14px;margin:0 0 18px">'
    +     riga('Autore', st.author)
    +     riga('Luogo', luogo)
    +     riga('Coordinate', coord)
    +     riga('Data', st.date)
    +     riga('Tag', (st.tags || []).join(', '))
    +   '</table>'
    +   (st.description
          ? '<p style="margin:0 0 18px;white-space:pre-wrap">' + esc(st.description) + '</p>'
          : '')
    +   '<p style="margin:0 0 6px">'
    +     '<a href="' + esc(site) + '/admin.html" '
    +       'style="display:inline-block;background:#e8482f;color:#fff;text-decoration:none;'
    +       'padding:10px 18px;border-radius:8px;font-weight:600">Apri la moderazione</a>'
    +   '</p>'
    +   '<p style="margin:14px 0 0;font-size:12px;color:#9aa1b1">'
    +     'Mappa: <a href="https://www.openstreetmap.org/?mlat=' + st.lat + '&amp;mlon=' + st.lng
    +     '">' + coord + '</a>'
    +   '</p>'
    + '</div>';
}

export async function notifyNewSticker(st, site) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: 'RESEND_API_KEY non impostata' };

  const to = process.env.NOTIFY_EMAIL || DEFAULT_TO;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || DEFAULT_FROM,
        to: [to],
        subject: 'Dariowhere: nuovo sticker da approvare — ' + st.title,
        html: corpo(st, site)
      })
    });

    if (!res.ok) {
      const testo = await res.text().catch(() => '');
      console.error('[dariowhere] notifica email fallita', res.status, testo.slice(0, 300));
      return { sent: false, reason: 'HTTP ' + res.status };
    }
    return { sent: true };
  } catch (err) {
    console.error('[dariowhere] notifica email non inviata', err);
    return { sent: false, reason: String(err && err.message) };
  }
}
