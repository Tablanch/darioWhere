/* La bandiera fa parte del titolo salvato sul database: "Portici di via Zamboni 🇮🇹".
   La colonna country_code resta come sorgente del dato, ma quello che si legge in
   giro è il titolo completo.

   Le due funzioni qui sotto servono a mantenere l'invariante "al massimo una bandiera,
   in fondo, dopo un solo spazio": senza rimuovere quella vecchia, ogni salvataggio ne
   accodava un'altra e cambiare paese non l'avrebbe aggiornata. */

/* coppia di "regional indicator" eventualmente ripetuta, in fondo alla stringa */
const FLAG_AT_END = /(?:\s*[\u{1F1E6}-\u{1F1FF}]{2})+\s*$/u;

export function flagEmoji(code) {
  if (!/^[A-Za-z]{2}$/.test(code || '')) return '';
  return String.fromCodePoint(...String(code).toUpperCase().split('')
    .map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

export function stripFlag(title) {
  return String(title == null ? '' : title).replace(FLAG_AT_END, '').trim();
}

/* Titolo normalizzato: nome pulito + spazio singolo + bandiera, se il codice c'è. */
export function titleWithFlag(title, code) {
  const base = stripFlag(title);
  const flag = flagEmoji(code);
  return flag ? base + ' ' + flag : base;
}
