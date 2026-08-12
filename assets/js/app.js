/* ===== Dariowhere — mappa principale ===== */

(function () {
  'use strict';

  DW.initTheme('btn-theme');

  /* ---------- mappa ---------- */

  const bases = DW.baseLayers();
  let userPickedBase = false;

  const map = L.map('map', {
    center: [30, 10],
    zoom: 2,
    minZoom: 2,
    worldCopyJump: true,
    zoomControl: false,
    layers: [DW.baseFor(bases, document.documentElement.getAttribute('data-theme'))]
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control.layers(bases, null, { position: 'topright' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

  map.on('baselayerchange', () => { userPickedBase = true; });

  // il tema trascina anche la basemap, se l'utente non l'ha scelta a mano
  document.addEventListener('dw:theme', e => {
    if (userPickedBase) return;
    const want = DW.baseFor(bases, e.detail);
    Object.values(bases).forEach(l => { if (l !== want && map.hasLayer(l)) map.removeLayer(l); });
    if (!map.hasLayer(want)) want.addTo(map);
  });

  const cluster = L.markerClusterGroup({
    maxClusterRadius: 46,
    showCoverageOnHover: false,
    spiderfyDistanceMultiplier: 1.4,
    iconCreateFunction: c => {
      const n = c.getChildCount();
      const size = n < 10 ? 38 : n < 50 ? 46 : 54;
      return L.divIcon({
        html: '<div class="dw-cluster" style="width:' + size + 'px;height:' + size + 'px">' + n + '</div>',
        className: '',
        iconSize: [size, size]
      });
    }
  }).addTo(map);

  /* ---------- riferimenti al DOM ---------- */

  const listEl = document.getElementById('sticker-list');
  const emptyEl = document.getElementById('list-empty');
  const searchEl = document.getElementById('search');
  const counterEl = document.getElementById('counter');
  const footEl = document.getElementById('foot-count');

  let stickers = [];
  const byId = new Map();

  /* ---------- popup ---------- */

  function popupHtml(st) {
    const coords = DW.fmtCoords(st.lat, st.lng);
    const place = [st.place, st.country].filter(Boolean).join(' · ');
    const date = DW.fmtDate(st.date);

    return ''
      + '<img class="card-photo" src="' + DW.esc(DW.photoOf(st)) + '" alt="' + DW.esc(st.title || 'Sticker') + '"'
      +      ' data-lightbox="' + DW.esc(st.id) + '"'
      +      ' onerror="this.src=\'' + DW.PLACEHOLDER + '\'">'
      + '<div class="card-body">'
      +   '<h3 class="card-title">' + DW.esc(st.title || 'Sticker senza nome') + '</h3>'
      +   (place ? '<div class="card-place">' + DW.esc(place) + '</div>' : '')
      +   (st.description ? '<p class="card-desc">' + DW.esc(st.description) + '</p>' : '')
      +   (st.tags && st.tags.length
            ? '<div class="card-tags">' + st.tags.map(t => '<span class="tag">' + DW.esc(t) + '</span>').join('') + '</div>'
            : '')
      +   '<div class="card-row">'
      +     '<span>di <span class="card-author">' + DW.esc(st.author || 'anonimo') + '</span></span>'
      +     (date ? '<span>' + DW.esc(date) + '</span>' : '')
      +   '</div>'
      +   '<div class="card-coords">'
      +     '<span>' + coords + '</span>'
      +     '<button type="button" data-copy="' + coords + '" title="Copia coordinate">copia</button>'
      +     '<button type="button" data-share="' + DW.esc(st.id) + '" title="Copia link a questo sticker">link</button>'
      +   '</div>'
      +   '<div class="card-links">'
      +     '<a href="https://www.google.com/maps/search/?api=1&query=' + st.lat + ',' + st.lng
      +        '" target="_blank" rel="noopener">Google Maps</a>'
      +     '<a href="https://www.openstreetmap.org/?mlat=' + st.lat + '&mlon=' + st.lng + '#map=17/'
      +        st.lat + '/' + st.lng + '" target="_blank" rel="noopener">OpenStreetMap</a>'
      +   '</div>'
      + '</div>';
  }

  /* ---------- elenco laterale ---------- */

  function haystack(st) {
    return [st.title, st.description, st.author, st.place, st.country, (st.tags || []).join(' ')]
      .join(' ').toLowerCase();
  }

  function renderList(q) {
    const query = (q || '').trim().toLowerCase();
    const shown = query ? stickers.filter(s => haystack(s).includes(query)) : stickers;

    listEl.innerHTML = shown.map(st => ''
      + '<li data-id="' + DW.esc(st.id) + '" tabindex="0">'
      +   '<img class="thumb" src="' + DW.esc(DW.thumbOf(st)) + '" alt="" loading="lazy"'
      +        ' onerror="this.src=\'' + DW.PLACEHOLDER + '\'">'
      +   '<div class="li-body">'
      +     '<div class="li-title">' + DW.esc(st.title || 'Sticker senza nome') + '</div>'
      +     '<div class="li-meta">' + DW.esc([st.place, st.author && ('di ' + st.author)].filter(Boolean).join(' · ')) + '</div>'
      +   '</div>'
      + '</li>').join('');

    emptyEl.hidden = shown.length > 0;
    footEl.textContent = shown.length + ' sticker' + (query ? ' su ' + stickers.length : '');
    return shown;
  }

  function setActive(id) {
    listEl.querySelectorAll('li.active').forEach(li => li.classList.remove('active'));
    if (!id) return;
    const li = listEl.querySelector('li[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    if (li) {
      li.classList.add('active');
      li.scrollIntoView({ block: 'nearest' });
    }
  }

  /* ---------- marker ---------- */

  function addMarkers() {
    stickers.forEach(st => {
      const m = L.marker([st.lat, st.lng], {
        icon: DW.pinIcon(st),
        title: st.title || '',
        riseOnHover: true
      });
      m.bindPopup(popupHtml(st), { maxWidth: 300, minWidth: 274, autoPanPadding: [30, 30] });
      m.on('popupopen', () => {
        setActive(st.id);
        if (history.replaceState) history.replaceState(null, '', '#s=' + encodeURIComponent(st.id));
      });
      m.on('popupclose', () => {
        setActive(null);
        if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
      });
      st._marker = m;
      byId.set(st.id, st);
      cluster.addLayer(m);
    });
  }

  function fitAll(animate) {
    if (!stickers.length) return;
    const b = L.latLngBounds(stickers.map(s => [s.lat, s.lng]));
    map.fitBounds(b.pad(0.18), { animate: !!animate, maxZoom: 13 });
  }

  function openSticker(id, zoom) {
    const st = byId.get(id);
    if (!st) return;
    closeSidebarOnMobile();
    const target = Math.max(zoom || 15, map.getZoom());
    // prima "srotola" l'eventuale cluster che contiene il pin, poi avvicina e apre il popup
    cluster.zoomToShowLayer(st._marker, () => {
      if (map.getZoom() < target) map.setView([st.lat, st.lng], target, { animate: true });
      else map.panTo([st.lat, st.lng], { animate: true });
      st._marker.openPopup();
    });
  }

  /* ---------- caricamento dati ---------- */

  DW.api('/api/stickers')
    .then(data => {
      stickers = (data || []).filter(s => isFinite(s.lat) && isFinite(s.lng));
      addMarkers();
      renderList('');

      /* Se il contenitore era ancora a dimensione zero quando la mappa è nata (finestra
         strettissima, scheda in secondo piano), Leaflet ha misure sbagliate e fitBounds
         inquadrerebbe un'area degenere, lasciando i pin fuori dalla vista. */
      refreshMap();
      fitAll(false);

      /* Le città si contano sul campo "place" normalizzato: contare i paesi darebbe
         numeri sorprendentemente bassi ("4 sticker in 2 luoghi" per quattro città di
         tre stati diversi). Il conteggio dei paesi resta nel tooltip. */
      const chiave = s => (s.place || s.country || '').trim().toLowerCase();
      const citta = new Set(stickers.map(chiave).filter(Boolean));
      const paesi = new Set(stickers.map(s => (s.countryCode || s.country || '').trim().toUpperCase()).filter(Boolean));

      counterEl.textContent = stickers.length + ' sticker'
        + (citta.size ? ' in ' + citta.size + (citta.size === 1 ? ' città' : ' città') : '');
      counterEl.title = citta.size + (citta.size === 1 ? ' città' : ' città')
        + ', ' + paesi.size + (paesi.size === 1 ? ' paese' : ' paesi');

      if (!stickers.length) emptyEl.textContent = 'Ancora nessuno sticker. Sii il primo ad aggiungerne uno.';
      setTimeout(fromHash, 250);
    })
    .catch(err => {
      const hint = DW.apiErrorHint(err);
      console.error('[Dariowhere] GET /api/stickers →', err.status || 'nessuna risposta', err);
      emptyEl.textContent = hint;
      emptyEl.hidden = false;
      footEl.textContent = '';
      DW.toast('Sticker non caricati');
    });

  /* ---------- interazioni ---------- */

  let searchTimer;
  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => renderList(searchEl.value), 120);
  });

  listEl.addEventListener('click', e => {
    const li = e.target.closest('li[data-id]');
    if (li) openSticker(li.dataset.id);
  });

  listEl.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const li = e.target.closest('li[data-id]');
    if (li) { e.preventDefault(); openSticker(li.dataset.id); }
  });

  document.getElementById('btn-fit').addEventListener('click', () => fitAll(true));

  document.getElementById('btn-locate').addEventListener('click', () => {
    if (!navigator.geolocation) return DW.toast('Geolocalizzazione non disponibile');
    DW.toast('Cerco la tua posizione…');
    navigator.geolocation.getCurrentPosition(
      p => map.flyTo([p.coords.latitude, p.coords.longitude], 12),
      () => DW.toast('Posizione non disponibile'),
      { timeout: 8000 }
    );
  });

  /* ---------- elenco: collassabile e ridimensionabile ---------- */

  const appEl = document.querySelector('.app');
  const resizer = document.getElementById('sidebar-resizer');
  const toggleBtn = document.getElementById('btn-toggle-sidebar');

  const MIN_W = 260, MAX_W = 640, DEF_W = 380;
  const KEY_W = 'dariowhere:sidebarWidth';
  const KEY_HIDDEN = 'dariowhere:sidebarHidden';

  const mq = window.matchMedia('(max-width: 780px)');
  const isMobile = () => mq.matches;

  function setWidth(px, persist) {
    const w = Math.round(Math.max(MIN_W, Math.min(MAX_W, px)));
    document.documentElement.style.setProperty('--sidebar-w', w + 'px');
    if (persist) localStorage.setItem(KEY_W, String(w));
    return w;
  }

  /* Leaflet tiene in cache le dimensioni del contenitore: senza invalidateSize la
     mappa resta della larghezza vecchia e i click cadono spostati. */
  function refreshMap() {
    map.invalidateSize({ pan: false, debounceMoveend: true });
  }

  function setHidden(hidden, persist) {
    appEl.classList.toggle('sidebar-hidden', hidden);
    toggleBtn.setAttribute('aria-expanded', String(!hidden));
    toggleBtn.title = hidden ? 'Mostra elenco' : 'Nascondi elenco';
    if (persist && !isMobile()) localStorage.setItem(KEY_HIDDEN, hidden ? '1' : '0');
    setTimeout(refreshMap, 0);
  }

  const savedWidth = parseInt(localStorage.getItem(KEY_W), 10);
  if (isFinite(savedWidth)) setWidth(savedWidth, false);

  /* Su schermo piccolo l'elenco parte chiuso, altrimenti vale la preferenza salvata.
     Va rivalutato al cambio di breakpoint e non solo al caricamento: la finestra può
     nascere strettissima (o venire ridimensionata) e altrimenti l'elenco resterebbe
     chiuso anche tornati in larghezza. */
  function applyBreakpointState() {
    setHidden(isMobile() ? true : localStorage.getItem(KEY_HIDDEN) === '1', false);
  }

  applyBreakpointState();
  mq.addEventListener('change', applyBreakpointState);

  toggleBtn.addEventListener('click', () =>
    setHidden(!appEl.classList.contains('sidebar-hidden'), true));

  function closeSidebarOnMobile() {
    if (isMobile()) setHidden(true, false);
  }

  /* trascinamento della maniglia */

  let dragging = false, pending = 0;

  resizer.addEventListener('pointerdown', e => {
    if (isMobile() || e.button !== 0) return;
    dragging = true;
    resizer.setPointerCapture(e.pointerId);
    resizer.classList.add('dragging');
    document.body.classList.add('resizing');
    e.preventDefault();
  });

  resizer.addEventListener('pointermove', e => {
    if (!dragging) return;
    setWidth(e.clientX, false);            // l'elenco parte da x = 0
    if (!pending) {
      pending = requestAnimationFrame(() => { pending = 0; refreshMap(); });
    }
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    if (e && e.pointerId != null && resizer.hasPointerCapture(e.pointerId)) {
      resizer.releasePointerCapture(e.pointerId);
    }
    resizer.classList.remove('dragging');
    document.body.classList.remove('resizing');
    setWidth(parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10), true);
    refreshMap();
  }

  resizer.addEventListener('pointerup', endDrag);
  resizer.addEventListener('pointercancel', endDrag);

  resizer.addEventListener('dblclick', () => { setWidth(DEF_W, true); refreshMap(); });

  // da tastiera: frecce per regolare, Invio per collassare
  resizer.addEventListener('keydown', e => {
    const corrente = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10);
    if (e.key === 'ArrowLeft')       { setWidth(corrente - 24, true); refreshMap(); }
    else if (e.key === 'ArrowRight') { setWidth(corrente + 24, true); refreshMap(); }
    else if (e.key === 'Enter')      { setHidden(true, true); }
    else return;
    e.preventDefault();
  });

  /* ---------- lightbox + azioni nel popup ---------- */

  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbCap = document.getElementById('lightbox-cap');

  function openLightbox(st) {
    lbImg.src = DW.photoOf(st);
    lbImg.alt = st.title || 'Sticker';
    lbCap.textContent = [st.title, st.place, st.author && ('© ' + st.author)].filter(Boolean).join(' — ');
    lb.hidden = false;
  }

  function closeLightbox() { lb.hidden = true; lbImg.src = ''; }

  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lb.hidden) closeLightbox(); });

  document.addEventListener('click', e => {
    const zoomable = e.target.closest('[data-lightbox]');
    if (zoomable) {
      const st = byId.get(zoomable.dataset.lightbox);
      if (st) openLightbox(st);
      return;
    }
    const cp = e.target.closest('[data-copy]');
    if (cp) { DW.copy(cp.dataset.copy, 'Coordinate copiate'); return; }

    const sh = e.target.closest('[data-share]');
    if (sh) {
      const url = location.origin + location.pathname + '#s=' + encodeURIComponent(sh.dataset.share);
      DW.copy(url, 'Link copiato');
    }
  });

  /* ---------- deep link #s=<id> ---------- */

  function fromHash() {
    const m = /^#s=(.+)$/.exec(location.hash);
    if (m) openSticker(decodeURIComponent(m[1]), 16);
  }

  window.addEventListener('hashchange', fromHash);
})();
