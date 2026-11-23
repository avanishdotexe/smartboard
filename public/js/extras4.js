/* SmartBoard 2.12: size + type popover for the Marker and the Eraser on the main toolbar. */
(() => {
  'use strict';
  const SB = window.SB;
  const { S, $, setTool } = SB;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  const HL = [['classic', 'Classic'], ['round', 'Round tip'], ['soft', 'Soft'], ['bold', 'Bold'], ['thin', 'Fine']];
  const ER = [[false, 'Rub out', 'Like a duster'], [true, 'Whole stroke', 'Tap a line to remove it']];
  const SIZES = { hl: [3, 6, 10, 16], eraser: [4, 8, 14, 24] };

  function init() {
    if (!$('.tool[data-tool="hl"]') || $('#toolPop')) return;
    const pop = el('div', 'tool-pop hidden'); pop.id = 'toolPop'; document.body.append(pop);
    let mode = 'hl';

    const sizeRow = () => {
      const get = () => (mode === 'eraser' ? S.eSize : S.size), set = (v) => { if (mode === 'eraser') S.eSize = v; else S.size = v; const r = $('#sizeRange'); if (r) r.value = v; r && r.dispatchEvent(new Event('input')); };
      pop.append(el('div', 'tp-lab', mode === 'eraser' ? 'Eraser size' : 'Marker size'));
      const sz = el('div', 'tp-sizes');
      SIZES[mode].forEach((v) => {
        const b = el('button', 'tp-sz' + (Math.abs(get() - v) <= 1 ? ' on' : '')); const dot = el('i');
        const px = Math.round(Math.min(26, (mode === 'eraser' ? v * 1.1 : v * 1.5) + 4)); dot.style.width = dot.style.height = px + 'px';
        if (mode === 'eraser') { dot.style.background = 'transparent'; dot.style.border = '2px dashed var(--text)'; }
        b.append(dot); b.title = v; b.onclick = (e) => { e.stopPropagation(); set(v); draw(); };
        sz.append(b);
      });
      pop.append(sz);
      const row = el('div', 'tp-row'); const rng = el('input'); rng.type = 'range'; rng.min = 1; rng.max = mode === 'eraser' ? 40 : 30; rng.value = get();
      const num = el('b', 'tp-num', String(get()));
      rng.oninput = () => { set(+rng.value); num.textContent = rng.value; };
      rng.onchange = () => draw();
      row.append(rng, num); pop.append(row);
    };

    function draw() {
      pop.textContent = '';
      if (mode === 'hl') {
        pop.append(el('div', 'tp-lab', 'Marker type'));
        const g = el('div', 'tp-opts');
        HL.forEach(([id, name]) => {
          const b = el('button', 'tp-opt' + ((S.hlStyle || 'classic') === id ? ' on' : ''));
          const c = el('canvas'); c.width = 200; c.height = 52; const x = c.getContext('2d'); x.scale(2, 2);
          const pts = []; for (let i = 0; i <= 24; i++) pts.push(8 + i * 3.4, 13 + Math.sin(i / 3) * 5);
          SB.drawObj(x, { type: 'hl', hs: id, color: '#ffc928', size: 3, pts });
          b.append(c, el('span', null, name));
          b.onclick = (e) => { e.stopPropagation(); S.hlStyle = id; draw(); };
          g.append(b);
        });
        pop.append(g);
        sizeRow();
        pop.append(el('div', 'tp-lab', 'Colour: use the colour bar below'));
      } else {
        pop.append(el('div', 'tp-lab', 'Eraser type'));
        const g = el('div', 'tp-opts');
        ER.forEach(([v, name, sub]) => {
          const b = el('button', 'tp-opt' + (!!S.strokeErase === v ? ' on' : '')); b.append(el('span', null, name), el('small', null, sub));
          b.onclick = (e) => { e.stopPropagation(); S.strokeErase = v; draw(); };
          g.append(b);
        });
        pop.append(g);
        sizeRow();
      }
    }

    const place = (btn) => {
      const r = btn.getBoundingClientRect(); const w = 250;
      const left = innerWidth <= 560 ? Math.max(8, Math.min(innerWidth - w - 8, r.left)) : r.right + 10;
      let top = innerWidth <= 560 ? r.top - pop.offsetHeight - 10 : r.top - 20;
      top = Math.max(8, Math.min(innerHeight - pop.offsetHeight - 8, top));
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
    };

    ['hl', 'eraser'].forEach((m) => {
      const btn = $(`.tool[data-tool="${m}"]`); let was = false;
      btn.addEventListener('click', () => { was = S.tool === m; }, true);
      btn.addEventListener('click', () => {
        ['#stampMenu', '#shapeMenu', '#penMenu'].forEach((q) => { const e = $(q); if (e) e.classList.add('hidden'); });
        if (!was) { pop.classList.add('hidden'); return; } // first click only picks the tool
        if (!pop.classList.contains('hidden') && mode === m) { pop.classList.add('hidden'); return; }
        mode = m; draw(); pop.classList.remove('hidden'); place(btn);
      });
    });
    document.querySelectorAll('.tool[data-tool]').forEach((b) => b.addEventListener('click', () => { if (!['hl', 'eraser'].includes(b.dataset.tool)) pop.classList.add('hidden'); }));
    document.addEventListener('pointerdown', (e) => { if (!pop.classList.contains('hidden') && !e.target.closest('#toolPop') && !e.target.closest('.tool[data-tool="hl"]') && !e.target.closest('.tool[data-tool="eraser"]')) pop.classList.add('hidden'); });
    SB.hook('left', () => pop.classList.add('hidden'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* tap the board (student, rotated phone) to show / hide the controls */
(() => {
  const mq = window.matchMedia('(orientation: landscape) and (max-height: 520px)');
  let t = null, down = null;
  const app = () => document.getElementById('app');
  const hide = () => { const a = app(); if (a) a.classList.remove('ui-on'); };
  const show = () => { const a = app(); if (!a) return; a.classList.add('ui-on'); clearTimeout(t); t = setTimeout(hide, 5000); };
  function init() {
    const area = document.getElementById('stageArea'); if (!area) return;
    area.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: Date.now() }; });
    area.addEventListener('pointerup', (e) => {
      const a = app(); if (!down || !a || !mq.matches || !a.classList.contains('viewer') || a.classList.contains('is-teacher')) { down = null; return; }
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10, quick = Date.now() - down.t < 450; down = null;
      if (moved || !quick) return;
      if (a.classList.contains('ui-on')) { clearTimeout(t); hide(); } else show();
    });
    document.getElementById('app').addEventListener('click', (e) => { if (app().classList.contains('ui-on') && e.target.closest('.topbar,.pager,.zoom-bar')) show(); });
    mq.addEventListener && mq.addEventListener('change', hide);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
