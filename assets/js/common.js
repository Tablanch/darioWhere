/* ===== Dariowhere — utilità condivise ===== */

window.DW = (function () {

  /* --- tema chiaro/scuro --- */

  const THEME_KEY = 'dariowhere:theme';

  function currentTheme() {
    return localStorage.getItem(THEME_KEY)
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem(THEME_KEY, t);
    document.dispatchEvent(new CustomEvent('dw:theme', { detail: t }));
  }

  function initTheme(buttonId) {
    applyTheme(currentTheme());
    const btn = buttonId && document.getElementById(buttonId);
    if (btn) btn.addEventListener('click', () => {
      applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  /* --- helper --- */

  const PLACEHOLDER = 'photos/_placeholder.svg';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function photoOf(st) {
    return (st && st.photo) || PLACEHOLDER;
  }

  /* miniatura: usata nei pin e nell'elenco, molto più leggera della foto piena */
  function thumbOf(st) {
    return (st && (st.thumb || st.photo)) || PLACEHOLDER;
  }

  function fmtCoords(lat, lng, digits = 5) {
    return Number(lat).toFixed(digits) + ', ' + Number(lng).toFixed(digits);
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* --- bandierine ---
     Il codice ISO a due lettere diventa la coppia di "regional indicator" che i
     browser rendono come bandiera. Nota: Windows non ha i glifi delle bandiere,
     quindi lì si vedono le due lettere invece del disegno. */

  function flagEmoji(code) {
    if (!/^[A-Za-z]{2}$/.test(code || '')) return '';
    return String.fromCodePoint(...code.toUpperCase().split('')
      .map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  }

  /* Titolo con la bandiera davanti, già pronto per innerHTML */
  function titleWithFlag(st) {
    const flag = flagEmoji(st && st.countryCode);
    const title = esc((st && st.title) || 'Sticker senza nome');
    return flag
      ? '<span class="flag" title="' + esc(st.country || '') + '">' + flag + '</span>' + title
      : title;
  }

  /* --- geocoding inverso: coordinate → luogo, paese, codice ISO ---
     Nominatim chiede al massimo una richiesta al secondo, quindi si serializza. */

  let lastNominatim = 0;

  async function reverseGeocode(lat, lng) {
    const wait = Math.max(0, 1100 - (Date.now() - lastNominatim));
    if (wait) await new Promise(r => setTimeout(r, wait));
    lastNominatim = Date.now();

    const url = 'https://nominatim.openstreetmap.org/reverse'
              + '?format=jsonv2&addressdetails=1&zoom=16'
              + '&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng);

    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Geocoding non disponibile (' + res.status + ')');

    const data = await res.json();
    const a = data.address || {};

    /* Prima la città vera e propria: i campi suburb/city_district darebbero nomi come
       "Municipio 1" o il quartiere, che sono meno riconoscibili e spezzerebbero il
       conteggio delle città sulla mappa. */
    return {
      place: a.city || a.town || a.village || a.municipality || a.county
             || a.city_district || a.suburb || '',
      country: a.country || '',
      countryCode: (a.country_code || '').toUpperCase(),
      display: data.display_name || ''
    };
  }

  function slugify(s) {
    return String(s || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  }

  /* --- toast --- */

  let toastEl, toastTimer;

  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  function copy(text, msg) {
    const done = () => toast(msg || 'Copiato!');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Copia non riuscita'); }
    ta.remove();
  }

  /* --- basemap: OSM + varianti CARTO --- */

  function baseLayers() {
    const osmAttr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    const cartoAttr = osmAttr + ' &copy; <a href="https://carto.com/attributions">CARTO</a>';
    return {
      'Stradale': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: osmAttr }),
      'Chiaro': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 20, subdomains: 'abcd', attribution: cartoAttr }),
      'Scuro': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { maxZoom: 20, subdomains: 'abcd', attribution: cartoAttr })
    };
  }

  /* basemap adatta al tema */
  function baseFor(layers, theme) {
    return theme === 'dark' ? layers['Scuro'] : layers['Stradale'];
  }

  /* --- chiamate all'API --- */

  async function api(path, options) {
    const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, options));
    let body = null;
    try { body = await res.json(); } catch (e) { /* risposta senza corpo JSON */ }
    if (!res.ok) {
      const err = new Error((body && body.error) || ('Errore ' + res.status));
      err.status = res.status;
      throw err;
    }
    return body;
  }

  /* Messaggio diagnostico: distingue "API non pubblicata" da "database non configurato". */
  function apiErrorHint(err) {
    if (err && err.status === 404) {
      return 'API non raggiungibile: il sito non è servito da Netlify. In locale serve "netlify dev".';
    }
    if (err && err.status === 503) {
      return err.message;      // arriva dalla funzione: es. DATABASE_URL mancante
    }
    if (err && !err.status) {
      return 'Nessuna risposta dal server: connessione assente o richiesta bloccata.';
    }
    return err && err.message ? err.message : 'Errore sconosciuto';
  }

  /* --- icona pin con miniatura della foto --- */

  function pinIcon(st) {
    /* La miniatura è uno sfondo, non un <img>: con background-size:cover il ritaglio
       resta centrato dentro il cerchio qualunque sia il formato dell'immagine. Il
       secondo url è il segnaposto, che il browser mostra se il primo non carica. */
    const url = String(thumbOf(st)).replace(/['"()\s]/g, encodeURIComponent);

    return L.divIcon({
      className: 'pin-wrap',
      html: '<div class="pin">'
          +   '<div class="pin-shape" style="background-image:url(\'' + url + '\'),url(\'' + PLACEHOLDER + '\')"></div>'
          +   '<div class="pin-tail"></div>'
          + '</div>',
      iconSize: [44, 53],
      iconAnchor: [22, 53],
      popupAnchor: [0, -48]
    });
  }

  return {
    initTheme, applyTheme, currentTheme,
    esc, photoOf, thumbOf, fmtCoords, fmtDate, slugify,
    flagEmoji, titleWithFlag, reverseGeocode,
    toast, copy, api, apiErrorHint, baseLayers, baseFor, pinIcon,
    PLACEHOLDER
  };
})();
