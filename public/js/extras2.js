/* SmartBoard 2.10: page overview, auto-save + restore, board grid, cheer confetti. */
(() => {
  'use strict';
  const SB = window.SB;
  const { S, $, toast, emit, hook, openModal, closeModal } = SB;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const isT = () => SB.isTeacher();
  const hideMenus = () => { const m = $('#teachMenu'); if (m) m.classList.add('hidden'); };
  const KEY = 'sb-autosave-v1';
  const ls = { get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* full or blocked */ } } };

  // ---------- page overview ----------
  let ovModal = null;
  async function openOverview() {
    if (!ovModal) {
      const m = el('div', 'modal hidden'); m.id = 'mOverview';
      const sh = el('div', 'sheet'); sh.style.maxWidth = '860px';
      const head = el('div', 'sheet-head'); head.append(el('h3', null, 'All pages'));
      const x = el('button', 'icon-btn sm'); x.innerHTML = SB.svgOf('close'); x.onclick = () => closeModal('mOverview'); head.append(x);
      const grid = el('div', 'pg-grid'); sh.append(head, grid); m.append(sh); document.body.append(m);
      m.addEventListener('pointerdown', (e) => { if (e.target === m) closeModal('mOverview'); });
      ovModal = { m, grid };
    }
    openModal('mOverview');
    const g = ovModal.grid; g.textContent = '';
    for (let i = 0; i < S.pages.length; i++) {
      const card = el('button', 'pg-card' + (i === S.cur ? ' on' : ''));
      const holder = el('div', 'pg-thumb'); card.append(holder, el('span', null, `Page ${i + 1}`));
      card.onclick = () => { if (isT()) SB.goPage(i); closeModal('mOverview'); };
      g.append(card);
      SB.pageCanvas(i, 0.22).then((c) => { holder.append(c); }).catch(() => {});
    }
  }

  // ---------- auto-save ----------
  const hasInk = () => S.pages.some((p) => p.length);
  function snap() {
    if (!isT() || !S.socket || !hasInk()) return;
    ls.set({ title: S.title || '', bg: S.bg, bgs: S.pages.map((_, i) => SB.bgOf(i)), pages: S.pages, at: Date.now() });
    updRestore();
  }
  function ago(t) { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; }
  let restoreBtn = null;
  function updRestore() { if (!restoreBtn) return; const v = ls.get(); restoreBtn.querySelector('span').textContent = v ? `Restore auto-save (${ago(v.at)})` : 'Restore auto-save'; restoreBtn.disabled = !v; }
  async function restore() {
    const v = ls.get(); if (!v || !Array.isArray(v.pages)) return toast('No auto-save found on this device.');
    if (!(await SB.uiConfirm(`Replace the current board with the auto-saved one (${v.pages.length} page${v.pages.length > 1 ? 's' : ''}, ${ago(v.at)})?`, 'Restore', true))) return;
    S.socket.emit('board:load', { pages: v.pages, bg: v.bg, bgs: v.bgs, title: v.title }, (r) => { if (!r || !r.ok) toast((r && r.error) || 'Could not restore.'); });
  }

  // ---------- grid ----------
  let gridOn = false; const gridEl = el('div', 'board-grid hidden');
  function placeGrid() {
    if (!gridOn) return;
    const u = 50 * S.scale; gridEl.style.backgroundSize = `${u}px ${u}px`;
    gridEl.style.backgroundPosition = `${-S.vx * S.scale}px ${-S.vy * S.scale}px`;
  }
  function toggleGrid() { gridOn = !gridOn; gridEl.classList.toggle('hidden', !gridOn); placeGrid(); const b = $('#mGridTxt'); if (b) b.textContent = gridOn ? 'Hide grid' : 'Show grid'; hideMenus(); }

  // ---------- cheer confetti ----------
  function confetti(text) {
    const c = el('canvas', 'confetti'); document.body.append(c);
    const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const cols = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'];
    const P = Array.from({ length: 140 }, () => ({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .6, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[(Math.random() * cols.length) | 0] }));
    const t0 = performance.now();
    (function tick(t) {
      const e = t - t0; x.clearRect(0, 0, innerWidth, innerHeight);
      P.forEach((p) => { p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore(); });
      const a = Math.min(1, e / 250, Math.max(0, (3200 - e) / 600));
      x.globalAlpha = a; x.font = '800 54px system-ui, sans-serif'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = '#f97316'; x.lineWidth = 8; x.lineJoin = 'round';
      x.strokeText(text, innerWidth / 2, innerHeight * .38 - (1 - a) * 20); x.fillText(text, innerWidth / 2, innerHeight * .38 - (1 - a) * 20); x.globalAlpha = 1;
      if (e < 3400) requestAnimationFrame(tick); else c.remove();
    })(t0);
  }
  const CHEERS = ['Shabaash! 🎉', 'Well done! 👏', 'Excellent! ⭐', 'Great job! 🌟'];


  // ---------- quiz leaderboard ----------
  let lbEl = null, lbTimer = 0;
  const MEDAL = ['🥇', '🥈', '🥉'];
  function showLb(d) {
    const list = (d && d.list) || [];
    if (!list.length) { if (lbEl) { lbEl.remove(); lbEl = null; } if (d && d.show === false) toast('Scores reset.'); else if (isT()) toast('No scores yet. Run a poll with a correct answer first.', { ms: 2600 }); return; }
    if (lbEl) lbEl.remove();
    const me = (S.name || '').toLowerCase();
    const card = el('div', 'lb-card'); lbEl = card;
    const x = el('button', 'icon-btn sm lb-x'); x.innerHTML = SB.svgOf('close'); x.onclick = () => { card.remove(); lbEl = null; };
    card.append(x, el('h3', null, '🏆 Leaderboard'));
    const top = list[0].pts || 1;
    list.slice(0, 5).forEach((r, i) => {
      const row = el('div', 'lb-row' + (r.k === me ? ' me' : ''));
      const bar = el('div', 'lb-bar'); bar.style.width = Math.max(8, Math.round(r.pts / top * 100)) + '%';
      row.append(el('span', 'lb-rank', MEDAL[i] || String(i + 1)), el('span', 'lb-name', r.name), bar, el('b', 'lb-pts', String(r.pts)));
      const g = d.gain && d.gain[r.k]; if (g) row.append(el('em', 'lb-gain', '+' + g));
      card.append(row);
    });
    const mi = list.findIndex((r) => r.k === me);
    if (mi >= 5) card.append(el('div', 'lb-mine', `You: #${mi + 1} with ${list[mi].pts} points`));
    document.body.append(card);
    clearTimeout(lbTimer); lbTimer = setTimeout(() => { if (lbEl === card) { card.remove(); lbEl = null; } }, 12000);
    if (d.gain && Object.keys(d.gain).length) confetti('🏆');
  }


  // ---------- yes / no poll ----------
  function yesNo() {
    // one tap: no question to type. Students just press 👍 (understood) or 👎 (not yet).
    SB.emit('poll:start', { question: 'Did you understand? 👍 or 👎', options: ['👍', '👎'] }, (r) => { if (r && r.ok === false) SB.toast(r.error || 'Could not start the poll.'); });
    SB.toast('👍 / 👎 poll started. Students can vote now.', { ms: 2000 });
  }

  // ---------- page replay ----------
  async function replay() {
    const objs = (S.pages[S.cur] || []).slice();
    if (!objs.length) return toast('This page is empty, nothing to replay.');
    const probe = await SB.pageCanvas(S.cur, 1); const W = probe.width, H = probe.height;
    const m = el('div', 'modal'); m.id = 'mReplay'; const sh = el('div', 'sheet'); sh.style.maxWidth = '900px';
    const head = el('div', 'sheet-head'); head.append(el('h3', null, '▶ Replay of page ' + (S.cur + 1)));
    const x = el('button', 'icon-btn sm'); x.innerHTML = SB.svgOf('close'); head.append(x);
    const cv = el('canvas', 'rp-cv'); cv.width = W; cv.height = H;
    const bar = el('div', 'rp-bar'); const fill = el('i'); bar.append(fill);
    const again = el('button', 'btn ghost sm', 'Play again'); again.style.marginTop = '8px';
    sh.append(head, cv, bar, again); m.append(sh); document.body.append(m);
    let stop = false; let run = 0;
    const close = () => { stop = true; m.remove(); }; x.onclick = close; m.addEventListener('pointerdown', (e) => { if (e.target === m) close(); });
    const units = objs.map((o) => (o.type === 'pen' && o.pts ? Math.max(4, o.pts.length / 2) : 10));
    const total = units.reduce((a, b) => a + b, 0), speed = total / Math.min(14, Math.max(3, total / 40)); // units per second
    const ctx = cv.getContext('2d');
    const play = () => {
      const id = ++run; const t0 = performance.now();
      (function frame(t) {
        if (stop || id !== run) return;
        const done = Math.min(total, (t - t0) / 1000 * speed);
        ctx.setTransform(1, 0, 0, 1, 0, 0); SB.paintBg(ctx, SB.bgOf(S.cur));
        let acc = 0;
        for (let i = 0; i < objs.length; i++) {
          const o = objs[i]; const u = units[i];
          if (done >= acc + u) SB.drawObj(ctx, o);
          else if (done > acc && o.type === 'pen' && o.pts) { const n = Math.max(2, Math.floor((done - acc) / u * (o.pts.length / 2))) * 2; SB.drawObj(ctx, Object.assign({}, o, { pts: o.pts.slice(0, n) })); }
          else if (done > acc) { /* non-pen objects appear when finished */ }
          acc += u;
          if (done < acc) break;
        }
        fill.style.width = (done / total * 100) + '%';
        if (done < total) requestAnimationFrame(frame);
      })(t0);
    };
    again.onclick = play; play();
  }


  // ---------- phone: extra top-bar buttons live in a "More" menu ----------
  function initMore() {
    const right = document.querySelector('.tb-right'); if (!right || $('#moreBtn')) return;
    const btn = el('button', 'icon-btn'); btn.id = 'moreBtn'; btn.title = 'More'; btn.innerHTML = SB.svgOf('more');
    if (!btn.innerHTML) btn.textContent = '⋯';
    const menu = el('div', 'menu hidden'); menu.id = 'moreMenu';
    const items = [
      ['video', 'Video class', '#callBtn', false], ['present', 'Present mode', '#presentBtn', true],
      ['image', 'Save page (PNG)', '#expPng', true], ['pdf', 'Save board (PDF)', '#expPdf', true], ['save', 'Save board file', '#expJson', true],
      ['palette', 'Change theme', '#themeBtn', false], ['exit', 'Leave board', '#leaveBtn', false],
    ];
    items.forEach(([ic, txt, sel, tOnly]) => {
      const b = el('button'); b.dataset.t = tOnly ? '1' : ''; const i = el('i'); i.innerHTML = SB.svgOf(ic); b.append(i, document.createTextNode(txt));
      b.onclick = () => { menu.classList.add('hidden'); const t = $(sel); if (t) t.click(); };
      menu.append(b);
    });
    right.insertBefore(btn, $('#leaveBtn'));
    document.body.append(menu);
    btn.onclick = (e) => { e.stopPropagation(); [...menu.children].forEach((b) => { b.style.display = b.dataset.t && !isT() ? 'none' : ''; }); menu.classList.toggle('hidden'); };
    document.addEventListener('pointerdown', (e) => { if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) menu.classList.add('hidden'); });
  }

  function init() {
    initMore();
    const menu = $('#teachMenu'); if (!menu) return;
    const anchor = $('#mAttBtn');
    const add = (id, ic, txt, fn) => { const b = el('button'); b.id = id; const i = el('i'); i.dataset.icon = ic; i.innerHTML = SB.svgOf(ic); const sp = el('span', null, txt); b.append(i, sp); b.onclick = () => { hideMenus(); fn(); }; menu.insertBefore(b, anchor); return b; };
    add('mOverviewBtn', 'copy', 'All pages (overview)', openOverview);
    add('mCheerBtn', 'smile', 'Cheer the class 🎉', () => emit('cheer:go', { text: CHEERS[(Math.random() * CHEERS.length) | 0] }));
    const gb = add('mGridBtn', 'grid', 'Show grid', toggleGrid); gb.querySelector('span').id = 'mGridTxt';
    add('mYesNoBtn', 'check', '👍 / 👎 quick poll', yesNo);
    add('mReplayBtn', 'present', 'Replay this page', replay);
    add('mLbBtn', 'poll', 'Quiz leaderboard', () => emit('lb:show', {}));
    add('mLbResetBtn', 'trash', 'Reset quiz scores', () => emit('lb:clear', {}));
    restoreBtn = add('mRestoreBtn', 'undo', 'Restore auto-save', restore);
    const host = $('#geoLayer') && $('#geoLayer').parentElement; if (host) host.append(gridEl);
    $('#pageNum').style.cursor = 'pointer'; $('#pageNum').title = 'See all pages';
    $('#pageNum').addEventListener('click', openOverview);
    hook('net:lb:state', showLb);
    hook('net:cheer', (d) => confetti((d && d.text) || 'Well done! 👏'));
    hook('view', placeGrid);
    hook('state', () => updRestore());
    setInterval(snap, 15000);
    addEventListener('beforeunload', snap);
    updRestore();
    SB.paintIcons && SB.paintIcons();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
