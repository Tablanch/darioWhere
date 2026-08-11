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
      if (/scaduta|assente/i.test(ex.message)) return showLogin();
      DW.toast(ex.message);
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

  function card(s) {
    const place = [s.place, s.country].filter(Boolean).join(' · ');
    const inviato = s.createdAt ? new Date(s.createdAt).toLocaleString('it-IT') : '';

    const actions = [];
    if (s.status !== 'approved') actions.push('<button class="btn primary" data-act="approve" data-id="' + DW.esc(s.id) + '">Approva</button>');
    if (s.status !== 'rejected') actions.push('<button class="btn" data-act="reject" data-id="' + DW.esc(s.id) + '">Rifiuta</button>');
    actions.push('<button class="btn danger" data-act="delete" data-id="' + DW.esc(s.id) + '">Elimina</button>');

    return ''
      + '<article class="admin-card">'
      +   '<img src="' + DW.esc(DW.photoOf(s)) + '" alt="" loading="lazy"'
      +        ' onerror="this.src=\'' + DW.PLACEHOLDER + '\'">'
      +   '<div class="admin-card-body">'
      +     '<div class="admin-card-head">'
      +       '<h3>' + DW.esc(s.title) + '</h3>'
      +       '<span class="badge ' + DW.esc(s.status) + '">' + DW.esc(s.status) + '</span>'
      +     '</div>'
      +     (place ? '<div class="card-place">' + DW.esc(place) + '</div>' : '')
      +     (s.description ? '<p class="card-desc">' + DW.esc(s.description) + '</p>' : '')
      +     '<div class="card-coords"><span>' + DW.fmtCoords(s.lat, s.lng) + '</span></div>'
      +     '<div class="card-row">'
      +       '<span>di <span class="card-author">' + DW.esc(s.author || 'anonimo') + '</span></span>'
      +       '<span>' + DW.esc(inviato) + '</span>'
      +     '</div>'
      +     '<div class="actions">' + actions.join('') + '</div>'
      +   '</div>'
      + '</article>';
  }

  function renderGrid() {
    const shown = items.filter(s => s.status === filter);
    $('grid').innerHTML = shown.map(card).join('');
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

    const { act, id } = btn.dataset;
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
      DW.toast(ex.message);
      btn.disabled = false;
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
