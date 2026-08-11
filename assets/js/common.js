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
    try { body = await res.json(); } catch (e) { /* risposta senza corpo */ }
    if (!res.ok) throw new Error((body && body.error) || ('Errore ' + res.status));
    return body;
  }

  /* --- icona pin con miniatura della foto --- */

  function pinIcon(st) {
    return L.divIcon({
      className: 'pin-wrap',
      html: '<div class="pin">'
          +   '<div class="pin-shape"><img class="pin-photo" src="' + esc(thumbOf(st))
          +     '" alt="" onerror="this.src=\'' + PLACEHOLDER + '\'"></div>'
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
    toast, copy, api, baseLayers, baseFor, pinIcon,
    PLACEHOLDER
  };
})();
