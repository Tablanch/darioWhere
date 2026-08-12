/* ===== Dariowhere — pagina di moderazione ===== */

(function () {
  'use strict';

  DW.initTheme('btn-theme');

  const $ = id => document.getElementById(id);

  let items = [];
  let filter = 'pending';

  /* ---------- accesso ---------- */

  function showLogin() {
    $('login').hidden = false;
    $('panel').hidden = true;
    $('btn-logout').hidden = true;
    $('f-pw').focus();
  }

  function showPanel() {
    $('login').hidden = true;
    $('panel').hidden = false;
    $('btn-logout').hidden = false;
    load();
  }

  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('login-err');
    err.hidden = true;
    $('btn-login').disabled = true;

    try {
      await DW.api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password: $('f-pw').value })
      });
      $('f-pw').value = '';
      showPanel();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    } finally {
      $('btn-login').disabled = false;
    }
  });

  $('btn-logout').addEventListener('click', async () => {
    try { await DW.api('/api/admin/logout', { method: 'POST' }); } catch (e) { /* ignora */ }
    items = [];
    showLogin();
  });

  /* ---------- elenco ---------- */

  async function load() {
    try {
      items = await DW.api('/api/admin/stickers');
    } catch (ex) {
      if (ex.status === 401) return showLogin();
      DW.toast(DW.apiErrorHint(ex));
      return;
    }
    renderCounts();
    renderGrid();
  }

  function renderCounts() {
    const counts = { pending: 0, approved: 0, rejected: 0 };
    items.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
    Object.keys(counts).forEach(k => {
      const el = document.querySelector('[data-count="' + k + '"]');
      if (el) el.textContent = counts[k];
    });
    $('summary').textContent = items.length
      ? counts.pending + ' in attesa di approvazione, ' + counts.approved + ' pubblicati'
      : 'Ancora nessuno sticker inviato.';
  }

  /* id dello sticker attualmente in modifica, uno alla volta */
  let editing = null;

  function card(s) {
    const place = [s.place, s.country].filter(Boolean).join(' · ');
    const inviato = s.createdAt ? new Date(s.createdAt).toLocaleString('it-IT') : '';
    const id = DW.esc(s.id);

    const actions = [];
    if (s.status !== 'approved') actions.push('<button class="btn primary" data-act="approve" data-id="' + id + '">Approva</button>');
    if (s.status !== 'rejected') actions.push('<button class="btn" data-act="reject" data-id="' + id + '">Rifiuta</button>');
    actions.push('<button class="btn" data-act="edit" data-id="' + id + '">Modifica</button>');
    actions.push('<button class="btn danger" data-act="delete" data-id="' + id + '">Elimina</button>');

    return ''
      + '<article class="admin-card" data-card="' + id + '">'
      +   '<img src="' + DW.esc(DW.photoOf(s)) + '" alt="" loading="lazy"'
      +        ' onerror="this.src=\'' + DW.PLACEHOLDER + '\'">'
      +   '<div class="admin-card-body">'
      +     '<div class="admin-card-head">'
      +       '<h3>' + DW.esc(s.title) + '</h3>'
      +       '<span class="badge ' + DW.esc(s.status) + '">' + DW.esc(s.status) + '</span>'
      +     '</div>'
      +     (place ? '<div class="card-place">' + DW.esc(place) + '</div>' : '')
      +     (s.description ? '<p class="card-desc">' + DW.esc(s.description) + '</p>' : '')
      +     (s.tags && s.tags.length
              ? '<div class="card-tags">' + s.tags.map(t => '<span class="tag">' + DW.esc(t) + '</span>').join('') + '</div>'
              : '')
      +     '<div class="card-coords"><span>' + DW.fmtCoords(s.lat, s.lng) + '</span></div>'
      +     '<div class="card-row">'
      +       '<span>di <span class="card-author">' + DW.esc(s.author || 'anonimo') + '</span></span>'
      +       '<span>' + DW.esc(s.date ? DW.fmtDate(s.date) : inviato) + '</span>'
      +     '</div>'
      +     '<div class="actions">' + actions.join('') + '</div>'
      +   '</div>'
      + '</article>';
  }

  /* --- scheda in modalità modifica --- */

  function editCard(s) {
    const id = DW.esc(s.id);
    const v = x => DW.esc(x == null ? '' : x);

    const campo = (name, label, value, attrs) => ''
      + '<div class="field"><label>' + label + '</label>'
      + '<input name="' + name + '" value="' + v(value) + '" ' + (attrs || '') + '></div>';

    return ''
      + '<article class="admin-card editing" data-card="' + id + '">'
      +   '<img src="' + DW.esc(DW.photoOf(s)) + '" alt="" loading="lazy"'
      +        ' onerror="this.src=\'' + DW.PLACEHOLDER + '\'">'
      +   '<div class="admin-card-body">'
      +     '<form class="edit-form" data-edit="' + id + '">'
      /* nel form si modifica il nome pulito: la bandiera la riaccoda il backend
         partendo dal codice ISO, così non se ne accumulano e cambiando paese
         si aggiorna da sola */
      +       campo('title', 'Titolo (senza bandiera)', DW.stripFlag(s.title), 'maxlength="80" required')
      +       '<div class="field"><label>Descrizione</label>'
      +         '<textarea name="description" maxlength="600">' + v(s.description) + '</textarea></div>'
      +       '<div class="field-row">'
      +         campo('author', 'Autore', s.author, 'maxlength="60"')
      +         campo('date', 'Data', s.date, 'type="date"')
      +       '</div>'
      +       '<div class="field-row">'
      +         campo('lat', 'Latitudine', s.lat, 'type="number" step="0.00001" min="-90" max="90" required')
      +         campo('lng', 'Longitudine', s.lng, 'type="number" step="0.00001" min="-180" max="180" required')
      +       '</div>'
      +       '<div class="field-row three">'
      +         campo('place', 'Città', s.place, 'maxlength="80"')
      +         campo('country', 'Paese', s.country, 'maxlength="60"')
      +         campo('countryCode', 'ISO', s.countryCode, 'maxlength="2" placeholder="IT" style="text-transform:uppercase"')
      +       '</div>'
      +       campo('tags', 'Tag (virgole)', (s.tags || []).join(', '), 'maxlength="160"')
      +       '<div class="field"><label>Stato</label><select name="status">'
      +         ['pending', 'approved', 'rejected'].map(st =>
                  '<option value="' + st + '"' + (st === s.status ? ' selected' : '') + '>' + st + '</option>').join('')
      +       '</select></div>'
      +       '<div class="actions">'
      +         '<button class="btn primary" type="submit">Salva</button>'
      +         '<button class="btn" type="button" data-act="cancel">Annulla</button>'
      +         '<button class="btn" type="button" data-act="reverse" data-id="' + id + '">Ricava luogo</button>'
      +       '</div>'
      +       '<p class="err" hidden></p>'
      +     '</form>'
      +   '</div>'
      + '</article>';
  }

  function renderGrid() {
    const shown = items.filter(s => s.status === filter);
    $('grid').innerHTML = shown.map(s => s.id === editing ? editCard(s) : card(s)).join('');
    $('grid-empty').hidden = shown.length > 0;
  }

  $('tabs').addEventListener('click', e => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    filter = tab.dataset.status;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    renderGrid();
  });

  $('grid').addEventListener('click', async e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;

    /* --- azioni sul form di modifica --- */

    if (act === 'edit') { editing = id; renderGrid(); return; }
    if (act === 'cancel') { editing = null; renderGrid(); return; }

    if (act === 'reverse') {
      const form = btn.closest('form[data-edit]');
      const lat = parseFloat(form.elements.lat.value);
      const lng = parseFloat(form.elements.lng.value);
      if (!isFinite(lat) || !isFinite(lng)) return DW.toast('Coordinate non valide');

      btn.disabled = true;
      try {
        const luogo = await DW.reverseGeocode(lat, lng);
        if (luogo.place) form.elements.place.value = luogo.place;
        if (luogo.country) form.elements.country.value = luogo.country;
        if (luogo.countryCode) form.elements.countryCode.value = luogo.countryCode;
        DW.toast('Luogo ricavato');
      } catch (ex) {
        DW.toast(ex.message);
      } finally {
        btn.disabled = false;
      }
      return;
    }

    /* --- approva / rifiuta / elimina --- */

    if (act === 'delete' && !confirm('Eliminare definitivamente "' + id + '" e la sua foto?')) return;

    btn.disabled = true;
    try {
      await DW.api('/api/admin/review', {
        method: 'POST',
        body: JSON.stringify({ id, action: act })
      });
      DW.toast(act === 'approve' ? 'Approvato' : act === 'reject' ? 'Rifiutato' : 'Eliminato');
      await load();
    } catch (ex) {
      DW.toast(DW.apiErrorHint(ex));
      btn.disabled = false;
    }
  });

  /* --- salvataggio della modifica --- */

  $('grid').addEventListener('submit', async e => {
    const form = e.target.closest('form[data-edit]');
    if (!form) return;
    e.preventDefault();

    const err = form.querySelector('.err');
    err.hidden = true;

    const el = form.elements;
    const payload = {
      id: form.dataset.edit,
      title: el.title.value,
      description: el.description.value,
      author: el.author.value,
      lat: el.lat.value,
      lng: el.lng.value,
      date: el.date.value,
      place: el.place.value,
      country: el.country.value,
      countryCode: el.countryCode.value,
      tags: el.tags.value.split(',').map(s => s.trim()).filter(Boolean),
      status: el.status.value
    };

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;

    try {
      await DW.api('/api/admin/update', { method: 'POST', body: JSON.stringify(payload) });
      editing = null;
      DW.toast('Modifiche salvate');
      await load();
    } catch (ex) {
      err.textContent = DW.apiErrorHint(ex);
      err.hidden = false;
      submit.disabled = false;
    }
  });

  $('btn-seed').addEventListener('click', async () => {
    try {
      const res = await DW.api('/api/admin/seed', { method: 'POST' });
      DW.toast(res.inseriti ? res.inseriti + ' sticker di esempio caricati' : 'Erano già tutti presenti');
      await load();
    } catch (ex) {
      DW.toast(ex.message);
    }
  });

  /* ---------- avvio ---------- */

  DW.api('/api/admin/session')
    .then(r => r && r.admin ? showPanel() : showLogin())
    .catch(() => showLogin());
})();
