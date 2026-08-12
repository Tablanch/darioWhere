/* ===== Dariowhere — invio di un nuovo sticker ===== */

(function () {
  'use strict';

  DW.initTheme('btn-theme');

  const $ = id => document.getElementById(id);

  const F = {
    lat: $('f-lat'), lng: $('f-lng'), title: $('f-title'), desc: $('f-desc'),
    author: $('f-author'), date: $('f-date'), place: $('f-place'),
    country: $('f-country'), countryCode: $('f-country-code'), tags: $('f-tags')
  };

  const MAX_SIDE = 1600;      // lato lungo della foto inviata
  const THUMB_SIDE = 160;     // miniatura per pin ed elenco

  let photo = null;           // { full: dataURL, thumb: dataURL, previewUrl }

  /* ---------- mappa di selezione ---------- */

  const bases = DW.baseLayers();

  const map = L.map('pick-map', {
    center: [44.4944, 11.3433],
    zoom: 4,
    layers: [DW.baseFor(bases, document.documentElement.getAttribute('data-theme'))]
  });

  L.control.layers(bases, null, { position: 'topright' }).addTo(map);

  document.addEventListener('dw:theme', e => {
    const want = DW.baseFor(bases, e.detail);
    Object.values(bases).forEach(l => { if (l !== want && map.hasLayer(l)) map.removeLayer(l); });
    if (!map.hasLayer(want)) want.addTo(map);
  });

  const marker = L.marker([44.4944, 11.3433], { draggable: true, icon: DW.pinIcon(null) }).addTo(map);

  marker.on('drag dragend', () => {
    const p = marker.getLatLng();
    setCoords(p.lat, p.lng, false);
  });

  map.on('click', e => setCoords(e.latlng.lat, e.latlng.lng, false));

  function setCoords(lat, lng, moveMap) {
    F.lat.value = Number(lat).toFixed(5);
    F.lng.value = Number(lng).toFixed(5);
    marker.setLatLng([lat, lng]);
    if (moveMap) map.setView([lat, lng], Math.max(map.getZoom(), 14));
    $('err-coords').hidden = true;
    render();
  }

  function coordsFromFields() {
    const lat = parseFloat(F.lat.value), lng = parseFloat(F.lng.value);
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  }

  [F.lat, F.lng].forEach(el => el.addEventListener('input', () => {
    const c = coordsFromFields();
    $('err-coords').hidden = !!c || (!F.lat.value && !F.lng.value);
    if (c) { marker.setLatLng([c.lat, c.lng]); map.panTo([c.lat, c.lng]); }
    render();
  }));

  /* ---------- ricerca luogo (Nominatim) ---------- */

  const resultsEl = $('geo-results');

  function geocode() {
    const q = $('geo-q').value.trim();
    if (q.length < 3) return DW.toast('Scrivi almeno 3 caratteri');
    resultsEl.innerHTML = '<li>Cerco…</li>';

    const url = 'https://nominatim.openstreetmap.org/search'
              + '?format=jsonv2&addressdetails=1&limit=6&q=' + encodeURIComponent(q);

    fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(list => {
        if (!list.length) { resultsEl.innerHTML = '<li>Nessun risultato.</li>'; return; }
        resultsEl.innerHTML = list.map((r, i) =>
          '<li data-i="' + i + '">' + DW.esc(r.display_name) + '</li>').join('');
        resultsEl._list = list;
      })
      .catch(() => {
        resultsEl.innerHTML = '<li>Ricerca non disponibile: clicca direttamente sulla mappa.</li>';
      });
  }

  $('geo-go').addEventListener('click', geocode);
  $('geo-q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); geocode(); } });

  resultsEl.addEventListener('click', e => {
    const li = e.target.closest('li[data-i]');
    if (!li || !resultsEl._list) return;
    const r = resultsEl._list[+li.dataset.i];
    setCoords(parseFloat(r.lat), parseFloat(r.lon), true);

    const a = r.address || {};
    applyLuogo({
      place: a.city || a.town || a.village || a.municipality
             || (r.display_name || '').split(',')[0] || '',
      country: a.country || (r.display_name || '').split(',').pop().trim(),
      countryCode: (a.country_code || '').toUpperCase()
    }, false);

    resultsEl.innerHTML = '';
    render();
  });

  /* Scrive luogo, paese e codice ISO. Con forza=false non sovrascrive quello che
     l'utente ha già digitato a mano. */
  function applyLuogo(luogo, forza) {
    if (luogo.place && (forza || !F.place.value)) F.place.value = luogo.place;
    if (luogo.country && (forza || !F.country.value)) F.country.value = luogo.country;
    if (luogo.countryCode) F.countryCode.value = luogo.countryCode;
    aggiornaFlagHint();
  }

  function aggiornaFlagHint() {
    const cc = F.countryCode.value;
    const flag = DW.flagEmoji(cc);
    $('flag-hint').textContent = cc ? '— ' + (flag ? flag + ' ' : '') + cc : '';
  }

  /* il paese scritto a mano non ha un codice ISO affidabile: lo si azzera */
  F.country.addEventListener('input', () => {
    F.countryCode.value = '';
    aggiornaFlagHint();
  });

  $('btn-reverse').addEventListener('click', async () => {
    const c = coordsFromFields();
    if (!c) return DW.toast('Prima scegli la posizione');

    const btn = $('btn-reverse');
    btn.disabled = true;
    try {
      applyLuogo(await DW.reverseGeocode(c.lat, c.lng), true);
      render();
      DW.toast('Luogo aggiornato');
    } catch (ex) {
      DW.toast(ex.message);
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- posizione / incolla coordinate ---------- */

  $('btn-here').addEventListener('click', () => {
    if (!navigator.geolocation) return DW.toast('Geolocalizzazione non disponibile');
    DW.toast('Cerco la tua posizione…');
    navigator.geolocation.getCurrentPosition(
      p => setCoords(p.coords.latitude, p.coords.longitude, true),
      () => DW.toast('Posizione non disponibile'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  $('btn-paste').addEventListener('click', () => {
    const txt = prompt('Incolla le coordinate (es. "44.49437, 11.34331"):', '');
    if (!txt) return;
    const m = txt.replace(/[^\d.,\-+\s]/g, ' ').match(/(-?\d+(?:\.\d+)?)[\s,]+(-?\d+(?:\.\d+)?)/);
    if (!m) return DW.toast('Formato non riconosciuto');
    setCoords(parseFloat(m[1]), parseFloat(m[2]), true);
  });

  /* ---------- foto: ridimensionamento nel browser ----------
     Ricodificare su canvas serve a due cose: l'upload passa da qualche MB a qualche
     centinaio di KB (il limite di payload delle Netlify Functions è ~6 MB) e i
     metadati EXIF dell'originale, GPS compreso, non vengono ripubblicati.          */

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non leggibile')); };
      img.src = url;
    });
  }

  /* Ridimensiona su canvas e ricodifica in JPEG.

     Attenzione all'orientamento EXIF: NON va riapplicato qui. I browser attuali
     orientano già l'immagine in fase di decodifica, quindi img.naturalWidth/Height
     riportano le dimensioni corrette e drawImage disegna la foto già dritta. Ruotare
     di nuovo in base al tag la coricherebbe. Verificato: un JPEG 1200x1600 con
     orientation=6 arriva a naturalWidth 1600 e naturalHeight 1200. */
  function toDataUrl(img, maxSide, quality) {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL('image/jpeg', quality);
  }

  $('f-file').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    const err = $('err-file');
    const okExif = $('ok-exif');
    err.hidden = true;
    okExif.hidden = true;

    if (photo && photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    photo = null;

    if (!file) { render(); return; }

    if (!/^image\//.test(file.type)) {
      err.textContent = 'Serve un file immagine.';
      err.hidden = false;
      render();
      return;
    }

    try {
      /* 1. metadati PRIMA di toccare l'immagine: la ricodifica su canvas li cancella */
      const meta = await DWExif.read(file);

      /* 2. ridimensionamento (l'orientamento lo ha già applicato il browser) */
      const img = await loadImage(file);
      photo = {
        full: toDataUrl(img, MAX_SIDE, 0.82),
        thumb: toDataUrl(img, THUMB_SIDE, 0.7)
      };
      photo.previewUrl = photo.full;

      const kb = Math.round(photo.full.length * 0.75 / 1024);

      /* 3. compilazione automatica da quello che la foto sapeva */
      const trovato = [];

      if (meta.date && !F.date.value) {
        F.date.value = meta.date;
        trovato.push('data');
      }

      if (meta.lat !== null) {
        setCoords(meta.lat, meta.lng, true);
        trovato.push('coordinate');

        okExif.textContent = 'GPS trovato nella foto: cerco il luogo…';
        okExif.hidden = false;

        try {
          const luogo = await DW.reverseGeocode(meta.lat, meta.lng);
          applyLuogo(luogo, true);
          if (luogo.place || luogo.country) trovato.push('luogo');
        } catch (ex) {
          console.warn('[Dariowhere] geocoding inverso non riuscito:', ex.message);
        }
      }

      okExif.textContent = trovato.length
        ? 'Dalla foto: ' + trovato.join(', ') + '. Foto pronta, ' + kb + ' KB.'
        : 'Nessun dato GPS nella foto: scegli il punto sulla mappa. Foto pronta, ' + kb + ' KB.';
      okExif.hidden = false;
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }
    render();
  });

  /* ---------- anteprima ---------- */

  function collect() {
    const c = coordsFromFields();
    return {
      title: F.title.value.trim(),
      description: F.desc.value.trim(),
      author: F.author.value.trim(),
      lat: c ? c.lat : null,
      lng: c ? c.lng : null,
      date: F.date.value || '',
      place: F.place.value.trim(),
      country: F.country.value.trim(),
      countryCode: F.countryCode.value.trim(),
      tags: F.tags.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 6)
    };
  }

  function render() {
    const st = collect();
    const place = [st.place, st.country].filter(Boolean).join(' · ');
    const coords = st.lat === null ? 'coordinate da scegliere' : DW.fmtCoords(st.lat, st.lng);

    $('preview').innerHTML = ''
      + '<img class="card-photo" src="' + DW.esc((photo && photo.previewUrl) || DW.PLACEHOLDER) + '" alt="">'
      + '<div class="card-body">'
      +   '<h3 class="card-title">' + DW.esc(DW.titleWithFlag(st.title, st.countryCode) || 'Sticker senza nome') + '</h3>'
      +   (place ? '<div class="card-place">' + DW.esc(place) + '</div>' : '')
      +   (st.description ? '<p class="card-desc">' + DW.esc(st.description) + '</p>' : '')
      +   (st.tags.length
            ? '<div class="card-tags">' + st.tags.map(t => '<span class="tag">' + DW.esc(t) + '</span>').join('') + '</div>'
            : '')
      +   '<div class="card-row">'
      +     '<span>di <span class="card-author">' + DW.esc(st.author || 'anonimo') + '</span></span>'
      +     (st.date ? '<span>' + DW.esc(DW.fmtDate(st.date)) + '</span>' : '')
      +   '</div>'
      +   '<div class="card-coords"><span>' + DW.esc(coords) + '</span></div>'
      + '</div>';
  }

  Object.values(F).forEach(el => {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  /* ---------- invio ---------- */

  const form = $('form');
  const btnSend = $('btn-send');
  const errForm = $('err-form');
  const okForm = $('ok-form');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errForm.hidden = true;
    okForm.hidden = true;

    const st = collect();

    if (!photo) return fail('Carica una foto dello sticker.');
    if (st.title.length < 3) return fail('Il titolo deve avere almeno 3 caratteri.');
    if (st.lat === null) return fail('Scegli la posizione sulla mappa.');

    btnSend.disabled = true;
    btnSend.textContent = 'Invio…';

    try {
      await DW.api('/api/submit', {
        method: 'POST',
        body: JSON.stringify(Object.assign({}, st, { photo: photo.full, thumb: photo.thumb }))
      });

      localStorage.setItem('dariowhere:author', st.author);
      okForm.textContent = 'Inviato. Comparirà sulla mappa dopo l\'approvazione.';
      okForm.hidden = false;
      form.reset();
      resetPhoto();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (ex) {
      fail(DW.apiErrorHint(ex));
    } finally {
      btnSend.disabled = false;
      btnSend.textContent = 'Invia per l\'approvazione';
    }

    function fail(msg) {
      errForm.textContent = msg;
      errForm.hidden = false;
      return false;
    }
  });

  function resetPhoto() {
    if (photo && photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    photo = null;
    $('f-file').value = '';
  }

  form.addEventListener('reset', () => {
    resetPhoto();
    $('ok-exif').hidden = true;
    setTimeout(() => {
      F.countryCode.value = '';
      aggiornaFlagHint();
      setCoords(44.4944, 11.3433, false);
      render();
    }, 0);
  });

  /* ---------- avvio ---------- */

  F.author.value = localStorage.getItem('dariowhere:author') || '';
  setCoords(44.4944, 11.3433, false);
  render();
})();
