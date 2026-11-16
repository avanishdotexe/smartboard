/* Teacher accounts: login / sign up, and "My boards" (needs the server with /api). */
(() => {
  'use strict';
  const SB = window.SB; if (!SB || !location.protocol.startsWith('http')) return;
  const { $, toast, store } = SB;
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };
  const tok = () => store.get('sb_token', '');
  let user = null, available = true;

  async function api(path, opts = {}) {
    const r = await fetch('/api' + path, Object.assign({ headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok() } }, opts, opts.body ? { body: JSON.stringify(opts.body) } : {}));
    let j = null; try { j = await r.json(); } catch (e) { /* not json */ }
    if (!r.ok) { const err = new Error((j && j.error) || 'Something went wrong.'); err.status = r.status; throw err; }
    return j;
  }

  const modal = el('div', 'modal hidden'); modal.id = 'mAcct';
  const sheet = el('div', 'sheet'); modal.append(sheet); document.body.append(modal);
  const show = () => modal.classList.remove('hidden'), hide = () => modal.classList.add('hidden');
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) hide(); });
  const head = (t) => { const h = el('div', 'sheet-head'); h.append(el('h3', null, t)); const x = el('button', 'icon-btn sm'); x.innerHTML = SB.svgOf('close'); x.onclick = hide; h.append(x); return h; };

  function authForm(mode) {
    sheet.textContent = ''; sheet.append(head(mode === 'login' ? 'Teacher login' : 'Create teacher account'));
    const f = el('form'); f.style.display = 'grid'; f.style.gap = '10px';
    const field = (label, type, ph, ac) => { const l = el('label', 'field'); l.append(el('span', null, label)); const i = el('input', 'input'); i.type = type; i.placeholder = ph; i.autocomplete = ac; i.required = true; l.append(i); f.append(l); return i; };
    const name = mode === 'signup' ? field('Your name', 'text', 'e.g. Avanish', 'name') : null;
    const email = field('Email', 'email', 'you@example.com', 'email');
    const pw = field('Password', 'password', mode === 'signup' ? 'At least 6 characters' : 'Your password', mode === 'signup' ? 'new-password' : 'current-password');
    const err = el('p', 'err'); const go = el('button', 'btn primary big', mode === 'login' ? 'Log in' : 'Sign up'); go.type = 'submit';
    const sw = el('button', 'btn ghost', mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'); sw.type = 'button'; sw.onclick = () => authForm(mode === 'login' ? 'signup' : 'login');
    f.append(err, go, sw, el('p', 'hint', 'Only teachers need an account. Students just join with the board code.'));
    f.onsubmit = async (e) => {
      e.preventDefault(); err.textContent = ''; go.disabled = true;
      try {
        const r = await api(mode === 'login' ? '/login' : '/signup', { method: 'POST', body: mode === 'login' ? { email: email.value, password: pw.value } : { name: name.value, email: email.value, password: pw.value } });
        store.set('sb_token', r.token); user = r.user; hide(); bar(); toast(`Welcome, ${user.name}! 👋`);
      } catch (ex) { err.textContent = ex.message; } go.disabled = false;
    };
    sheet.append(f); show(); setTimeout(() => (name || email).focus(), 60);
  }

  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
  async function myBoards() {
    sheet.textContent = ''; sheet.append(head('My boards')); const list = el('div'); list.style.cssText = 'display:grid;gap:8px;max-height:60vh;overflow:auto'; sheet.append(list); show();
    list.append(el('p', 'hint', 'Loading...'));
    try {
      const { boards } = await api('/boards'); list.textContent = '';
      if (!boards.length) list.append(el('p', 'hint', 'No saved boards yet. Create a board while logged in and it will appear here.'));
      boards.forEach((b) => {
        const row = el('div', 'acct-row'); const info = el('div'); info.append(el('b', null, b.title || 'Untitled board'), el('small', null, `${b.code} · ${b.pages} page${b.pages > 1 ? 's' : ''} · ${ago(b.last)}${b.live ? ' · LIVE' : ''}`));
        const open = el('button', 'btn primary', 'Open'); open.onclick = async () => { try { const r = await api(`/boards/${b.code}/open`, { method: 'POST' }); SB.saveKey(r.code, r.key); hide(); SB.joinBoard(r.code); } catch (e) { toast(e.message); } };
        const del = el('button', 'icon-btn sm'); del.title = 'Delete board'; del.innerHTML = SB.svgOf('trash');
        del.onclick = async () => { if (!(await SB.uiConfirm(`Delete "${b.title || 'Untitled board'}" for good?`, 'Delete', true))) return; try { await api('/boards/' + b.code, { method: 'DELETE' }); row.remove(); } catch (e) { toast(e.message); } };
        row.append(info, open, del); list.append(row);
      });
    } catch (e) { list.textContent = ''; list.append(el('p', 'err', e.message)); }
  }

  function bar() {
    const b = $('#acctBar'); if (!b) return; b.textContent = ''; b.classList.remove('hidden');
    if (!available) { b.classList.add('hidden'); return; }
    if (user) {
      const my = el('button', 'btn soft', 'My boards'); my.onclick = myBoards;
      const out = el('button', 'btn ghost', `${user.name.split(' ')[0]} · Log out`); out.onclick = () => { store.set('sb_token', ''); user = null; bar(); toast('Logged out.'); };
      b.append(my, out);
    } else { const li = el('button', 'btn soft', 'Teacher login'); li.onclick = () => authForm('login'); b.append(li); }
  }

  async function init() {
    try {
      if (tok()) { try { user = (await api('/me')).user; } catch (e) { if (e.status === 401) store.set('sb_token', ''); else throw e; } }
      else await fetch('/api/me'); // just to learn whether an account server exists
    } catch (e) { available = false; }
    bar();
  }
  init();
})();
