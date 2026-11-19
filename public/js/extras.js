/* SmartBoard 2.6 extras: geometry tools, graph plotter, questions + word cloud, class recording,
 * handwriting to text, board files, breakout groups, attendance, chat and the "not clear" button.
 * Uses window.SB from app.js. */
(() => {
  'use strict';
  const SB = window.SB;
  const { S, $, $$, toast, emit, hook, openModal, closeModal } = SB;

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const icon = (name) => { const i = el('i'); i.dataset.icon = name; i.innerHTML = SB.svgOf(name); return i; };
  const closeMenus = () => { $('#teachMenu').classList.add('hidden'); $('#exportMenu').classList.add('hidden'); };
  const isT = () => SB.isTeacher();
  const ask = (ev, data) => new Promise((res) => { if (!S.socket || !S.socket.connected) return res({ ok: false, error: 'Not connected.' }); S.socket.emit(ev, data, (r) => res(r || { ok: false })); });
  function makeModal(id, title, cls) {
    const m = el('div', 'modal hidden'); m.id = id;
    const sh = el('div', 'sheet ' + (cls || ''));
    const head = el('div', 'sheet-head'); head.append(el('h3', null, title));
    const x = el('button', 'icon-btn sm'); x.append(icon('close')); x.onclick = () => closeModal(id); head.append(x);
    const body = el('div'); sh.append(head, body); m.append(sh); document.body.append(m);
    m.addEventListener('pointerdown', (e) => { if (e.target === m) closeModal(id); });
    return { m, body };
  }
  const btn = (txt, cls, fn) => { const b = el('button', 'btn ' + (cls || ''), txt); if (fn) b.onclick = fn; return b; };

  /* ================= geometry tools: ruler, protractor, set squares ================= */
  const GEO = {
    ruler: { w: 1000, h: 100, label: 'Ruler (25 cm)', at: [800, 450] },
    protractor: { w: 620, h: 330, label: 'Protractor (0 to 180 degrees)', at: [800, 520] },
    sq45: { w: 520, h: 520, label: 'Set square 45 degrees', at: [600, 450] },
    sq30: { w: 300, h: 520, label: 'Set square 30 / 60 degrees', at: [720, 450] },
  };
  const G = {}; // kind -> { x, y, rot, node }
  const edgesLocal = {
    ruler: [[[0, 0], [1000, 0]], [[0, 100], [1000, 100]]],
    protractor: [[[10, 310], [610, 310]]],
    sq45: [[[0, 0], [0, 520]], [[0, 520], [520, 520]], [[0, 0], [520, 520]]],
    sq30: [[[0, 0], [0, 520]], [[0, 520], [300, 520]], [[0, 0], [300, 520]]],
  };
  function geoSvg(kind) {
    const NS = 'http://www.w3.org/2000/svg';
    const { w, h } = GEO[kind];
    let inner = '';
    const tickLines = (pts) => pts.map(([a, b, c, d]) => `M${a} ${b}L${c} ${d}`).join('');
    if (kind === 'ruler') {
      let t = '', n = '';
      for (let i = 0; i <= 250; i++) {
        const len = i % 10 === 0 ? 28 : i % 5 === 0 ? 19 : 11;
        t += `M${i * 4} 0v${len}`;
        if (i % 10 === 0 && i < 250) n += `<text x="${i * 4 + 4}" y="52" font-size="17" font-weight="700">${i / 10}</text>`;
      }
      inner = `<g class="body"><rect width="1000" height="100" rx="8" fill="rgba(253,224,71,.82)" stroke="#8a6a00" stroke-width="2.5"/><path d="${t}" stroke="#5b4300" stroke-width="1.6" fill="none"/><g fill="#5b4300">${n}</g><text x="990" y="86" text-anchor="end" font-size="15" font-weight="700" fill="#5b4300">cm</text></g>`;
    } else if (kind === 'protractor') {
      let t = '', n = '';
      for (let a = 0; a <= 180; a++) {
        const r = 300, len = a % 10 === 0 ? 30 : a % 5 === 0 ? 20 : 11, rad = (a * Math.PI) / 180;
        const x1 = 310 + r * Math.cos(rad), y1 = 310 - r * Math.sin(rad), x2 = 310 + (r - len) * Math.cos(rad), y2 = 310 - (r - len) * Math.sin(rad);
        t += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
        if (a % 10 === 0) {
          const xo = 310 + 258 * Math.cos(rad), yo = 310 - 258 * Math.sin(rad), xi = 310 + 212 * Math.cos(rad), yi = 310 - 212 * Math.sin(rad);
          n += `<text x="${xo.toFixed(1)}" y="${(yo + 5).toFixed(1)}" text-anchor="middle" font-size="15" font-weight="700">${a}</text><text x="${xi.toFixed(1)}" y="${(yi + 5).toFixed(1)}" text-anchor="middle" font-size="13" fill="#0c4a6e" opacity=".8">${180 - a}</text>`;
        }
      }
      inner = `<g class="body"><path d="M10 310A300 300 0 0 1 610 310V322a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8Z" fill="rgba(125,211,252,.58)" stroke="#0369a1" stroke-width="2.5"/><path d="${t}" stroke="#0c4a6e" stroke-width="1.4" fill="none"/><g fill="#0c4a6e">${n}</g><path d="M295 310h30M310 295v30" stroke="#0c4a6e" stroke-width="2"/><circle cx="310" cy="310" r="5" fill="none" stroke="#0c4a6e" stroke-width="2"/></g>`;
    } else if (kind === 'sq45') {
      let t = '';
      for (let i = 0; i <= 13; i++) t += `M${i * 40} 520v${i % 5 === 0 ? -22 : -12}M0 ${520 - i * 40}h${i % 5 === 0 ? 22 : 12}`;
      inner = `<g class="body"><path fill-rule="evenodd" d="M0 0V520H520Z M70 200V450H320Z" fill="rgba(134,239,172,.62)" stroke="#15803d" stroke-width="2.5"/><path d="${t}" stroke="#14532d" stroke-width="1.6" fill="none"/><text x="470" y="470" font-size="18" font-weight="800" fill="#14532d">45°</text></g>`;
    } else {
      let t = '';
      for (let i = 0; i <= 13; i++) t += `M0 ${520 - i * 40}h${i % 5 === 0 ? 22 : 12}`;
      for (let i = 0; i <= 7; i++) t += `M${i * 40} 520v${i % 5 === 0 ? -22 : -12}`;
      inner = `<g class="body"><path fill-rule="evenodd" d="M0 0V520H300Z M52 230V470H160Z" fill="rgba(253,186,116,.66)" stroke="#c2410c" stroke-width="2.5"/><path d="${t}" stroke="#7c2d12" stroke-width="1.6" fill="none"/><text x="236" y="486" font-size="18" font-weight="800" fill="#7c2d12">30°</text><text x="14" y="70" font-size="18" font-weight="800" fill="#7c2d12">60°</text></g>`;
    }
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('preserveAspectRatio', 'none');
    svg.innerHTML = inner; return svg;
  }
  function geoPlace(kind) {
    const g = G[kind]; if (!g || !g.node) return;
    const { w, h } = GEO[kind], k = S.scale;
    const n = g.node;
    n.style.width = w * k + 'px'; n.style.height = h * k + 'px';
    n.style.left = (g.x - S.vx) * k - (w * k) / 2 + 'px'; n.style.top = (g.y - S.vy) * k - (h * k) / 2 + 'px';
    n.style.transform = `rotate(${g.rot}deg)`;
  }
  let geoSend = 0;
  function geoEmit(kind, on, force) {
    if (!isT()) return;
    const t = performance.now(); if (!force && t - geoSend < 60) return; geoSend = t;
    const g = G[kind];
    emit('ov:set', { kind, on, x: g ? g.x : 0, y: g ? g.y : 0, rot: g ? g.rot : 0 });
  }
  function geoShow(kind, st) {
    let g = G[kind];
    if (!g) g = G[kind] = { x: GEO[kind].at[0], y: GEO[kind].at[1], rot: 0, node: null };
    Object.assign(g, st || {});
    if (!g.node) {
      const n = el('div', 'geo'); n.dataset.kind = kind;
      n.append(geoSvg(kind));
      const rot = el('button', 'rot'); rot.title = 'Turn'; rot.innerHTML = SB.svgOf('redo');
      const x = el('button', 'xbtn'); x.title = 'Put away'; x.innerHTML = SB.svgOf('close');
      n.append(rot, x); $('#geoLayer').append(n); g.node = n;
      x.onclick = () => geoHide(kind, true);
      let drag = null;
      n.addEventListener('pointerdown', (e) => {
        if (!isT() || e.target.closest('.xbtn')) return;
        const isRot = !!e.target.closest('.rot');
        if (!isRot && !e.target.closest('.body')) return;
        e.preventDefault(); e.stopPropagation(); n.setPointerCapture(e.pointerId);
        const r = n.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        drag = { isRot, x0: e.clientX, y0: e.clientY, gx: g.x, gy: g.y, a0: Math.atan2(e.clientY - cy, e.clientX - cx), r0: g.rot, cx, cy };
      });
      n.addEventListener('pointermove', (e) => {
        if (!drag) return;
        if (drag.isRot) {
          let rot = drag.r0 + ((Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) - drag.a0) * 180) / Math.PI;
          rot = ((rot % 360) + 360) % 360;
          for (const s of [0, 45, 90, 135, 180, 225, 270, 315, 360]) if (Math.abs(rot - s) < 2) rot = s % 360;
          g.rot = Math.round(rot * 10) / 10;
        } else { g.x = drag.gx + (e.clientX - drag.x0) / S.scale; g.y = drag.gy + (e.clientY - drag.y0) / S.scale; }
        geoPlace(kind); geoEmit(kind, true);
      });
      const end = () => { if (drag) { drag = null; geoEmit(kind, true, true); } };
      n.addEventListener('pointerup', end); n.addEventListener('pointercancel', end);
    }
    geoPlace(kind);
  }
  function geoHide(kind, send) {
    const g = G[kind]; if (!g) return;
    if (g.node) g.node.remove();
    delete G[kind];
    if (send) emit('ov:set', { kind, on: false, x: 0, y: 0, rot: 0 });
    renderGeoMenu();
  }
  function geoToggle(kind) {
    if (G[kind]) { geoHide(kind, true); return; }
    geoShow(kind); geoEmit(kind, true, true); renderGeoMenu();
  }
  function renderGeoMenu() {
    const m = $('#geoMenu'); if (!m) return;
    m.textContent = '';
    Object.keys(GEO).forEach((k) => {
      const b = el('button'); b.append(icon('ruler'), document.createTextNode(GEO[k].label + (G[k] ? '  (on)' : '')));
      b.onclick = (e) => { e.stopPropagation(); geoToggle(k); m.classList.add('hidden'); };
      m.append(b);
    });
    m.append(el('div', 'hint', 'Drag a tool to move it, use the round button to turn it. Start a pen line close to an edge and it sticks to the edge, so lines are perfectly straight.'));
  }
  const toWorld = (kind, lx, ly) => {
    const g = G[kind], { w, h } = GEO[kind], th = (g.rot * Math.PI) / 180, c = Math.cos(th), s = Math.sin(th), dx = lx - w / 2, dy = ly - h / 2;
    return [g.x + dx * c - dy * s, g.y + dx * s + dy * c];
  };
  const allEdges = () => Object.keys(G).flatMap((k) => edgesLocal[k].map(([a, b]) => ({ a: toWorld(k, a[0], a[1]), b: toWorld(k, b[0], b[1]) })));
  const segPt = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return [a[0] + t * dx, a[1] + t * dy]; };
  SB.edgeBegin = (x, y) => {
    if (!Object.keys(G).length) return null;
    const tol = 26 / S.scale; let best = null, bd = tol;
    allEdges().forEach((e) => { const q = segPt([x, y], e.a, e.b), d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = e; } });
    return best;
  };
  SB.edgeProject = (lk, x, y) => segPt([x, y], lk.a, lk.b);

  /* ================= math graph plotter ================= */
  const FN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh };
  function compile(src) {
    let s = String(src).replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=\s*/i, '').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi').replace(/²/g, '^2').replace(/³/g, '^3').replace(/−/g, '-');
    const tokens = []; const re = /\s*(\d*\.?\d+(?:e[+-]?\d+)?|[a-zA-Z_]+|\*\*|[-+*/^(),|])/y; let m;
    re.lastIndex = 0;
    while (re.lastIndex < s.length && (m = re.exec(s))) tokens.push(m[1] === '**' ? '^' : m[1]);
    if (re.lastIndex < s.replace(/\s+$/, '').length) throw new Error('Cannot read: ' + s.slice(re.lastIndex).trim().slice(0, 12));
    let i = 0;
    const peek = () => tokens[i], eat = () => tokens[i++];
    const isNum = (t) => t !== undefined && /^[\d.]/.test(t);
    const isId = (t) => t !== undefined && /^[a-zA-Z_]/.test(t);
    function expr() { let l = term(); while (peek() === '+' || peek() === '-') { const op = eat(), r = term(), a = l; l = op === '+' ? (x) => a(x) + r(x) : (x) => a(x) - r(x); } return l; }
    function term() {
      let l = unary();
      for (;;) {
        const t = peek();
        if (t === '*' || t === '/') { eat(); const r = unary(), a = l; l = t === '*' ? (x) => a(x) * r(x) : (x) => a(x) / r(x); }
        else if (isNum(t) || isId(t) || t === '(' || t === '|') { const r = unary(), a = l; l = (x) => a(x) * r(x); }
        else return l;
      }
    }
    function unary() { if (peek() === '-') { eat(); const a = unary(); return (x) => -a(x); } if (peek() === '+') { eat(); return unary(); } return power(); }
    function power() { const b = atom(); if (peek() === '^') { eat(); const e = unary(); return (x) => Math.pow(b(x), e(x)); } return b; }
    function atom() {
      const t = eat();
      if (t === undefined) throw new Error('The expression ends too early');
      if (isNum(t)) { const v = parseFloat(t); return () => v; }
      if (t === '(') { const e = expr(); if (eat() !== ')') throw new Error('Missing )'); return e; }
      if (t === '|') { const e = expr(); if (eat() !== '|') throw new Error('Missing |'); return (x) => Math.abs(e(x)); }
      if (isId(t)) {
        const name = t.toLowerCase();
        if (name === 'x') return (x) => x;
        if (name === 'pi') return () => Math.PI;
        if (name === 'e') return () => Math.E;
        if (FN[name]) { const f = FN[name]; let a; if (peek() === '(') { eat(); a = expr(); if (eat() !== ')') throw new Error('Missing )'); } else a = power(); return (x) => f(a(x)); }
        throw new Error('Unknown word: ' + t);
      }
      throw new Error('Unexpected ' + t);
    }
    const f = expr();
    if (i < tokens.length) throw new Error('Unexpected ' + tokens[i]);
    return f;
  }
  function niceStep(range) { const raw = range / 8, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; }
  const fmtN = (v) => (Math.abs(v) < 1e-9 ? '0' : String(Math.round(v * 1000) / 1000));
  function plotGraphs(exprs, opt) {
    const { xmin, xmax } = opt, L = 220, T = 110, Wd = 1160, Ht = 690, colors = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c'];
    const fns = exprs.map((e) => ({ e, f: compile(e) }));
    const N = 720, xs = Array.from({ length: N + 1 }, (_, i) => xmin + ((xmax - xmin) * i) / N);
    const data = fns.map(({ f }) => xs.map((x) => { let y; try { y = f(x); } catch { y = NaN; } return Number.isFinite(y) ? y : NaN; }));
    let ymin = opt.ymin, ymax = opt.ymax;
    if (!Number.isFinite(ymin) || !Number.isFinite(ymax) || ymin >= ymax) {
      const all = data.flat().filter(Number.isFinite).sort((a, b) => a - b);
      if (!all.length) throw new Error('Nothing to draw for this range');
      let lo = all[Math.floor(all.length * 0.02)], hi = all[Math.ceil(all.length * 0.98) - 1];
      if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
      const pad = (hi - lo) * 0.1; ymin = lo - pad; ymax = hi + pad;
      if (ymin > 0 && ymin < (hi - lo) * 0.6) ymin = Math.min(ymin, 0);
      if (ymax < 0 && -ymax < (hi - lo) * 0.6) ymax = Math.max(ymax, 0);
    }
    const px = (x) => L + ((x - xmin) / (xmax - xmin)) * Wd, py = (y) => T + Ht - ((y - ymin) / (ymax - ymin)) * Ht;
    const ink = SB.ink(), objs = [];
    const add = (o) => { o.id = SB.uid(); objs.push(o); };
    const ax = Math.max(L, Math.min(L + Wd, px(0))), ay = Math.max(T, Math.min(T + Ht, py(0)));
    add({ type: 'arrow', x1: L - 10, y1: ay, x2: L + Wd + 14, y2: ay, color: ink, size: 3 });
    add({ type: 'arrow', x1: ax, y1: T + Ht + 10, x2: ax, y2: T - 16, color: ink, size: 3 });
    add({ type: 'text', x: L + Wd + 18, y: ay - 14, text: 'x', fs: 28, color: ink, f: 'sans' });
    add({ type: 'text', x: ax + 12, y: T - 40, text: 'y', fs: 28, color: ink, f: 'sans' });
    const sx = niceStep(xmax - xmin), sy = niceStep(ymax - ymin);
    for (let v = Math.ceil(xmin / sx) * sx; v <= xmax + 1e-9; v += sx) {
      if (Math.abs(v) < sx * 1e-6) continue;
      add({ type: 'line', x1: px(v), y1: ay - 7, x2: px(v), y2: ay + 7, color: ink, size: 2 });
      add({ type: 'text', x: px(v) - 10, y: ay + 12, text: fmtN(v), fs: 20, color: ink, f: 'sans' });
    }
    for (let v = Math.ceil(ymin / sy) * sy; v <= ymax + 1e-9; v += sy) {
      if (Math.abs(v) < sy * 1e-6) continue;
      add({ type: 'line', x1: ax - 7, y1: py(v), x2: ax + 7, y2: py(v), color: ink, size: 2 });
      add({ type: 'text', x: ax - 14 - 11 * fmtN(v).length, y: py(v) - 12, text: fmtN(v), fs: 20, color: ink, f: 'sans' });
    }
    add({ type: 'text', x: ax - 24, y: ay + 12, text: '0', fs: 20, color: ink, f: 'sans' });
    data.forEach((ys, k) => {
      const col = colors[k % colors.length];
      let seg = [];
      const flush = () => { if (seg.length >= 4) add({ type: 'pen', pts: seg, color: col, size: 4 }); seg = []; };
      ys.forEach((y, i) => {
        if (!Number.isFinite(y) || y < ymin - (ymax - ymin) * 0.05 || y > ymax + (ymax - ymin) * 0.05) { flush(); return; }
        if (i && Number.isFinite(ys[i - 1]) && Math.abs(y - ys[i - 1]) > (ymax - ymin) * 0.6) flush();
        seg.push(px(xs[i]), py(y));
      });
      flush();
      add({ type: 'text', x: L + 14, y: T - 62 + k * 34, text: 'y = ' + fns[k].e.replace(/^\s*(y|f\s*\(\s*x\s*\))\s*=\s*/i, ''), fs: 28, color: col, f: 'sans' });
    });
    objs.forEach((o) => SB.addObj(o));
    return objs.length;
  }
  SB.plotGraphs = plotGraphs; SB.compileExpr = compile;
  function openGraph() {
    const { body } = GRAPH;
    if (body._built) return openModal('mGraph');
    body._built = true;
    const ta = el('textarea', 'input'); ta.id = 'graphExpr'; ta.rows = 2; ta.placeholder = 'y = x^2 - 4'; ta.value = 'x^2 - 4';
    const f1 = el('label', 'field'); f1.append(el('span', null, 'Equation (one per line, up to 5 lines)'), ta);
    const ex = el('div', 'graph-ex');
    ['x^2 - 4', '2x + 1', 'sin(x)', 'sqrt(x)', '1/x', 'abs(x)', 'x^3 - 3x', 'e^x'].forEach((t) => { const b = el('button', null, t); b.onclick = () => { ta.value = ta.value.trim() ? ta.value.trim() + '\n' + t : t; }; ex.append(b); });
    const two = el('div', 'two');
    const mk = (lbl, v) => { const l = el('label', 'field'); const i = el('input', 'input'); i.type = 'number'; i.value = v; i.step = 'any'; l.append(el('span', null, lbl), i); return [l, i]; };
    const [l1, xmin] = mk('x from', -10), [l2, xmax] = mk('x to', 10);
    two.append(l1, l2);
    const hint = el('p', 'hint', 'You can write 2x, 3(x+1), x^2, sqrt(x), sin(x), abs(x), ln(x), pi, e. The curve and axes are placed on the board, and you can still move or delete them.');
    const err = el('p', 'err'); const row = el('div', 'row end');
    const go = btn('Draw on board', 'primary', () => {
      err.textContent = '';
      try {
        const lines = ta.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5);
        if (!lines.length) throw new Error('Type an equation first.');
        if (!(+xmax.value > +xmin.value)) throw new Error('"x to" must be bigger than "x from".');
        const n = plotGraphs(lines, { xmin: +xmin.value, xmax: +xmax.value });
        closeModal('mGraph'); toast(`Graph drawn (${n} objects)`, { ms: 1800 });
      } catch (e) { err.textContent = e.message; }
    });
    row.append(btn('Cancel', 'ghost', () => closeModal('mGraph')), go);
    body.append(f1, ex, two, hint, err, row);
    openModal('mGraph');
  }

  /* ================= questions: short answers and word cloud ================= */
  let askCard = null, askModeSel = 'text';
  const ASK = () => S.ask;
  function cloudEl(words) {
    const box = el('div', 'cloud'); const cnt = new Map();
    words.forEach((w) => { const k = w.trim().toLowerCase(); if (k) cnt.set(k, { n: (cnt.get(k) ? cnt.get(k).n : 0) + 1, t: cnt.get(k) ? cnt.get(k).t : w.trim() }); });
    const max = Math.max(1, ...[...cnt.values()].map((v) => v.n)), cols = ['#f59e0b', '#34d3c1', '#a78bfa', '#fb7185', '#60a5fa', '#4ade80'];
    if (!cnt.size) box.append(el('span', 'muted', 'Waiting for answers…'));
    [...cnt.values()].forEach((v, i) => { const s = el('span', null, v.t); s.style.fontSize = 15 + (v.n / max) * 34 + 'px'; s.style.color = cols[i % cols.length]; s.title = v.n + (v.n > 1 ? ' answers' : ' answer'); box.append(s); });
    return box;
  }
  function putNote(text, i) {
    const col = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa'][i % 5];
    SB.addObj({ id: SB.uid(), type: 'note', x: 120 + (i % 4) * 330, y: 120 + Math.floor(i / 4 % 3) * 250, w: 300, h: 220, text: text.slice(0, 160), color: col });
  }
  function renderAsk() {
    if (!askCard) { askCard = el('div', 'ask-card hidden'); $('#app').append(askCard); }
    const a = ASK();
    askCard.textContent = '';
    if (!a) { askCard.classList.add('hidden'); return; }
    askCard.classList.remove('hidden');
    askCard.append(el('p', 'aq', a.q));
    const meta = el('div', 'ameta'); meta.append(el('span', null, (a.mode === 'word' ? 'Word cloud' : 'Short answers') + (a.open ? '' : ' (closed)')), el('span', null, a.total + (a.total === 1 ? ' answer' : ' answers')));
    askCard.append(meta);
    if (isT()) {
      if (a.mode === 'word') askCard.append(cloudEl((a.answers || []).map((x) => x.text)));
      else {
        const list = el('div', 'ask-list');
        if (!(a.answers || []).length) list.append(el('span', 'muted', 'Waiting for answers…'));
        (a.answers || []).forEach((x, i) => {
          const it = el('div', 'ask-item'); const sp = el('span'); sp.append(el('b', null, x.name), document.createTextNode(x.text));
          const b = el('button', null, 'To board'); b.title = 'Put this answer on the board as a sticky note'; b.onclick = () => putNote(x.text, i);
          it.append(sp, b); list.append(it);
        });
        askCard.append(list);
      }
      const r1 = el('div', 'row');
      r1.append(btn(a.open ? 'Stop answers' : 'Open again', 'soft', () => emit('ask:ctl', { act: a.open ? 'close' : 'open' })), btn(a.share ? 'Hide from class' : 'Show to class', 'soft', () => emit('ask:ctl', { act: 'share', on: !a.share })));
      const r2 = el('div', 'row'); r2.style.marginTop = '8px';
      if ((a.answers || []).length && a.mode === 'text') r2.append(btn('All to board', 'soft', () => (a.answers || []).forEach((x, i) => putNote(x.text, i))));
      r2.append(btn('End', 'ghost', () => emit('ask:ctl', { act: 'end' })));
      askCard.append(r1, r2);
    } else {
      if (a.share && a.words) askCard.append(a.mode === 'word' ? cloudEl(a.words) : (() => { const l = el('div', 'ask-list'); a.words.forEach((w) => { const it = el('div', 'ask-item'); it.append(el('span', null, w)); l.append(it); }); return l; })());
      if (a.open) {
        const inp = a.mode === 'word' ? el('input', 'input') : el('textarea', 'input');
        inp.placeholder = a.mode === 'word' ? 'One word…' : 'Your answer…'; inp.maxLength = a.mode === 'word' ? 24 : 300; if (a.mode !== 'word') inp.rows = 3;
        inp.value = a.mine || '';
        const send = () => { const v = inp.value.trim(); if (v) { emit('ask:send', { text: v }); toast('Sent ✅', { ms: 1000 }); } };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
        askCard.append(inp, btn(a.mine ? 'Update answer' : 'Send', 'primary', send));
        askCard.lastChild.style.width = '100%';
      } else askCard.append(el('p', 'hint', a.mine ? 'Your answer: ' + a.mine : 'The teacher closed this question.'));
    }
  }
  function openAskModal() {
    const { body } = ASKM;
    body.textContent = '';
    const q = el('textarea', 'input'); q.rows = 2; q.placeholder = 'e.g. What is the capital of India?';
    const f = el('label', 'field'); f.append(el('span', null, 'Your question'), q);
    const seg = el('div', 'seg');
    [['text', 'Short answers (each student writes a sentence)'], ['word', 'Word cloud (one word each)']].forEach(([m, t]) => { const b = el('button', askModeSel === m ? 'on' : '', t); b.onclick = () => { askModeSel = m; $$('button', seg).forEach((x) => x.classList.remove('on')); b.classList.add('on'); }; seg.append(b); });
    const err = el('p', 'err'); const row = el('div', 'row end');
    row.append(btn('Cancel', 'ghost', () => closeModal('mAsk')), btn('Ask the class', 'primary', async () => {
      const r = await ask('ask:start', { q: q.value, mode: askModeSel });
      if (r.ok) closeModal('mAsk'); else err.textContent = r.error || 'Could not start.';
    }));
    body.append(f, seg, err, row); openModal('mAsk'); setTimeout(() => q.focus(), 40);
  }

  /* ================= breakout groups ================= */
  function renderBrk() {
    const b = S.brk, chip = $('#brkChip');
    chip.classList.toggle('hidden', !b);
    if (b) $('#brkTxt').textContent = isT() ? `Breakout (${b.n} groups)` : (b.group != null ? `Group ${b.group + 1}` : 'Breakout');
    let badge = $('#brkBadge');
    if (!badge) { badge = el('div', 'brk-badge hidden'); badge.id = 'brkBadge'; $('#stage').append(badge); }
    const mine = !isT() && b && b.page != null;
    badge.classList.toggle('hidden', !mine);
    if (mine) badge.textContent = `Group ${b.group + 1}: draw here, the teacher can see this board`;
    if (!BRK.m.classList.contains('hidden')) fillBrk();
  }
  function fillBrk() {
    const { body } = BRK; body.textContent = '';
    if (S.brk && isT()) {
      body.append(el('p', 'hint', 'Each group has its own board page. Students can only draw on their own group page. Tap View to look at a group.'));
      const grid = el('div', 'brk-grid');
      S.brk.groups.forEach((g, i) => {
        const card = el('div', 'brk-g'); card.append(el('b', null, 'Group ' + (i + 1)), el('div', null, g.members.length ? g.members.map((m) => m.name).join(', ') : 'No students'));
        card.append(btn('View board', 'soft', () => { SB.goPage(g.page); closeModal('mBrk'); }));
        grid.append(card);
      });
      const row = el('div', 'row end');
      row.append(btn('Close', 'ghost', () => closeModal('mBrk')), btn('End breakout', 'primary danger', async () => { if (await SB.uiConfirm('End the breakout? Students can go back to the main board. The group pages stay as pages.', 'End breakout')) { emit('break:end', {}); closeModal('mBrk'); } }));
      body.append(grid, row);
    } else {
      body.append(el('p', 'hint', 'Students are split into random groups. Every group gets its own page to work on. Students can only draw on their group page.'));
      const f = el('label', 'field'); const sel = el('select', 'select'); sel.style.width = '100%';
      for (let n = 2; n <= 8; n++) { const o = el('option', null, n + ' groups'); o.value = n; sel.append(o); }
      sel.value = 3; f.append(el('span', null, 'How many groups?'), sel);
      const err = el('p', 'err'); const row = el('div', 'row end');
      row.append(btn('Cancel', 'ghost', () => closeModal('mBrk')), btn('Start breakout', 'primary', async () => { const r = await ask('break:start', { n: +sel.value }); if (r.ok) fillBrk(); else err.textContent = r.error || 'Could not start.'; }));
      body.append(f, err, row);
    }
  }
  function setBrk(b, first) {
    const was = S.brk; S.brk = b || null;
    if (!isT()) {
      if (b && b.page != null) {
        if (S.cur !== b.page) SB.goPage(b.page, false);
        if (!first && !(was && was.page != null)) toast(`You are in Group ${b.group + 1}. Draw on this board together.`, { ms: 3500 });
      } else if (was && was.page != null) toast('Breakout ended. Back to the class board.', { ms: 2500 });
      SB.updateUI();
    }
    renderBrk();
  }

  /* ================= attendance ================= */
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fmtMin = (ms) => (ms < 60000 ? '<1 min' : Math.round(ms / 60000) + ' min');
  async function attendancePdf(list) {
    try {
      toast('Making the PDF…', { id: 'attpdf', ms: 0 });
      await SB.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const PW = pdf.internal.pageSize.getWidth(), PH = pdf.internal.pageSize.getHeight(), M = 40;
      const clip = (t, n) => { t = String(t); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
      const here = list.filter((a) => a.here).length;
      let y = 0;
      const head = () => {
        pdf.setFillColor(255, 138, 76); pdf.rect(0, 0, PW, 70, 'F');
        pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20); pdf.text('Attendance report', M, 32);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(11);
        pdf.text(clip(S.title || 'SmartBoard class', 50) + '   |   Code ' + (S.code || '-') + '   |   ' + new Date().toLocaleString(), M, 52);
        y = 96;
      };
      const cols = [M, M + 28, M + 200, M + 290, M + 380, M + 460];
      const th = () => {
        pdf.setFillColor(238, 241, 246); pdf.rect(M - 6, y - 14, PW - M * 2 + 12, 22, 'F');
        pdf.setTextColor(40, 48, 64); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);
        ['#', 'Student', 'Joined', 'Time in class', 'Times joined', 'Status'].forEach((h, i) => pdf.text(h, cols[i], y));
        y += 22;
      };
      head();
      pdf.setTextColor(40, 48, 64); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12);
      pdf.text(`Total students: ${list.length}     In class now: ${here}     Left: ${list.length - here}`, M, y); y += 28;
      th();
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
      list.forEach((a, i) => {
        if (y > PH - 50) { pdf.addPage(); head(); th(); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); }
        if (i % 2) { pdf.setFillColor(248, 249, 252); pdf.rect(M - 6, y - 12, PW - M * 2 + 12, 20, 'F'); }
        pdf.setTextColor(40, 48, 64);
        pdf.text(String(i + 1), cols[0], y); pdf.text(clip(a.name, 28), cols[1], y);
        pdf.text(fmtTime(a.first), cols[2], y); pdf.text(fmtMin(a.ms), cols[3], y); pdf.text(String(a.joins), cols[4], y);
        if (a.here) pdf.setTextColor(20, 140, 90); else pdf.setTextColor(150, 90, 40);
        pdf.text(a.here ? 'In class' : 'Left', cols[5], y);
        y += 20;
      });
      pdf.setTextColor(140, 148, 165); pdf.setFontSize(9); pdf.text('Made with SmartBoard', M, PH - 24);
      SB.saveBlob(pdf.output('blob'), `attendance-${S.code || 'class'}.pdf`);
      SB.toastDone('attpdf'); toast('Attendance PDF saved 📄');
    } catch (e) { SB.toastDone('attpdf'); toast('Could not make the PDF (internet needed).'); }
  }
  async function openAttendance() {
    const { body } = ATT; body.textContent = ''; openModal('mAtt');
    const r = await ask('att:get', {});
    if (!r.ok) { body.append(el('p', 'err', 'Could not load attendance.')); return; }
    const list = r.list.sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) { body.append(el('p', 'hint', 'No students have joined yet.')); return; }
    const t = el('table', 'att-table');
    const th = el('tr'); ['Student', 'Joined', 'Time in class', 'Status'].forEach((h) => th.append(el('th', null, h))); t.append(th);
    list.forEach((a) => { const tr = el('tr'); tr.append(el('td', null, a.name), el('td', null, fmtTime(a.first)), el('td', null, fmtMin(a.ms)), (() => { const td = el('td'); td.append(el('span', 'pill ' + (a.here ? 'in' : 'out'), a.here ? 'In class' : 'Left')); return td; })()); t.append(tr); });
    const row = el('div', 'row end');
    row.append(btn('Close', 'ghost', () => closeModal('mAtt')), btn('Refresh', 'soft', openAttendance), btn('Save as PDF', 'soft', () => attendancePdf(list)), btn('Download CSV', 'primary', () => {
      const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
      const csv = '﻿' + ['Name,Joined,Last seen,Minutes in class,Status,Times joined'].concat(list.map((a) => [q(a.name), q(new Date(a.first).toLocaleString()), q(new Date(a.last).toLocaleString()), Math.round(a.ms / 6000) / 10, a.here ? 'In class' : 'Left', a.joins].join(','))).join('\n');
      SB.saveBlob(new Blob([csv], { type: 'text/csv' }), `attendance-${S.code || 'class'}.csv`);
    }));
    body.append(t, row);
  }

  /* ================= chat and "not clear" ================= */
  let chatPanel = null, chatList = null, unread = 0;
  function chatAdd(m, silent) {
    if (!chatList) return;
    const e = chatList.querySelector('.chat-empty'); if (e) e.remove();
    const d = el('div', 'msg ' + (m.role === 'teacher' ? 't' : '') + (m.name === S.name && !isT() || (isT() && m.role === 'teacher') ? ' me' : ''));
    d.append(el('small', null, m.role === 'teacher' ? 'Teacher' : m.name), document.createTextNode(m.text));
    chatList.append(d); chatList.scrollTop = chatList.scrollHeight;
    const mine = m.name === S.name && !isT() || (isT() && m.role === 'teacher');
    if (!silent && !mine && chatPanel.classList.contains('hidden')) {
      unread++; const dot = $('#chatDot'); dot.textContent = unread > 9 ? '9+' : String(unread); dot.classList.remove('hidden');
      $('#chatBtn').classList.add('has-new');
      toast((m.role === 'teacher' ? 'Teacher' : m.name) + ': ' + (m.text.length > 50 ? m.text.slice(0, 50) + '…' : m.text), { id: 'chatnew', ms: 2200 });
    }
  }
  function buildChat() {
    chatPanel = el('div', 'chat-panel hidden'); chatPanel.id = 'chatPanel';
    const head = el('div', 'chat-head'); head.append(el('b', null, 'Class chat'));
    if (true) {
      const lab = el('label'); lab.className = 'teacher-only'; const cb = el('input'); cb.type = 'checkbox'; cb.id = 'chatOnCb'; cb.checked = true;
      cb.onchange = () => emit('chat:on', { on: cb.checked });
      lab.append(cb, document.createTextNode('Students can chat')); head.append(lab);
      const clr = el('button', 'icon-btn sm teacher-only'); clr.title = 'Clear chat'; clr.append(icon('trash')); clr.onclick = () => emit('chat:clear', {}); head.append(clr);
    }
    const x = el('button', 'icon-btn sm'); x.append(icon('close')); x.onclick = () => chatPanel.classList.add('hidden'); head.append(x);
    chatList = el('div', 'chat-list'); chatList.append(el('div', 'chat-empty', 'No messages yet. Ask a doubt or say hello.'));
    const foot = el('div', 'chat-foot'); const inp = el('input', 'input'); inp.placeholder = 'Type a message…'; inp.maxLength = 300; inp.id = 'chatInput';
    const send = () => { const v = inp.value.trim(); if (v) { emit('chat:send', { text: v }); inp.value = ''; } };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); e.stopPropagation(); });
    const sb = btn('Send', 'primary', send); foot.append(inp, sb);
    chatPanel.append(head, chatList, foot); $('#app').append(chatPanel);
    $('#chatBtn').onclick = () => { chatPanel.classList.toggle('hidden'); if (!chatPanel.classList.contains('hidden')) { unread = 0; $('#chatDot').classList.add('hidden'); $('#chatBtn').classList.remove('has-new'); chatList.scrollTop = chatList.scrollHeight; setTimeout(() => inp.focus(), 40); } };
  }
  function setChatOn(on) {
    S.chatOn = on;
    const cb = $('#chatOnCb'); if (cb) cb.checked = on;
    const inp = $('#chatInput'); if (inp && !isT()) { inp.disabled = !on; inp.placeholder = on ? 'Type a message…' : 'The teacher turned chat off'; }
  }
  let confCount = 0, confNames = [], confPop = null;
  function renderConfPop() {
    if (!confPop) return;
    confPop.textContent = '';
    confPop.append(el('b', null, 'Not clear (' + confNames.length + ')'));
    const ul = el('div', 'conf-list');
    confNames.forEach((n) => ul.append(el('span', 'conf-name', n)));
    if (!confNames.length) ul.append(el('span', 'muted', 'Nobody right now'));
    const clr = btn('Clear all', 'soft', () => { emit('confuse:clear', {}); confPop.classList.add('hidden'); });
    confPop.append(ul, clr);
  }
  function setConf(n, names, who) {
    confNames = Array.isArray(names) ? names : confNames;
    if (isT()) {
      if (who) toast(who + ' said: not clear 🤔', { id: 'conf', ms: 3000 });
      else if (n > confCount && n > 0) toast(`${n} student${n > 1 ? 's' : ''} said: not clear`, { id: 'conf', ms: 2500 });
      $('#confChip').classList.toggle('hidden', n === 0);
      $('#confChip').title = confNames.length ? 'Not clear: ' + confNames.join(', ') : 'Students who did not understand';
      if (n === 0 && confPop) confPop.classList.add('hidden');
      renderConfPop();
    }
    confCount = n; $('#confN').textContent = n;
  }

  /* ================= class recording (board + microphone) ================= */
  let rec = null;
  async function startRec() {
    if (rec) return stopRec();
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast('This browser cannot record. Please use Chrome or Edge.'); return; }
    const cv = el('canvas'); cv.width = 1280; cv.height = 720;
    const ctx = cv.getContext('2d'), bgC = $('#bg'), bC = $('#board');
    const draw = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 1280, 720); ctx.drawImage(bgC, 0, 0, 1280, 720); ctx.drawImage(bC, 0, 0, 1280, 720); };
    draw();
    const stream = cv.captureStream(24);
    let mic = null;
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); mic.getAudioTracks().forEach((t) => stream.addTrack(t)); }
    catch { toast('Microphone not allowed. Recording the board without sound.', { ms: 3500 }); }
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    let mr;
    try { mr = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 1200000 } : undefined); } catch (e) { toast('Could not start recording.'); if (mic) mic.getTracks().forEach((t) => t.stop()); return; }
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const t0 = Date.now();
    const tick = setInterval(draw, 1000 / 24);
    const clock = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $('#recTime').textContent = `REC ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 500);
    mr.onstop = () => {
      clearInterval(tick); clearInterval(clock);
      if (mic) mic.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: 'video/webm' });
      rec = null; $('#recChip').classList.add('hidden'); $('#recChip').classList.remove('rec'); $('#mRecTxt').textContent = 'Record class';
      if (blob.size < 500) { toast('Nothing was recorded.'); return; }
      SB.saveBlob(blob, `SmartBoard-class-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.webm`);
      toast('Recording saved ✅ (open it with Chrome or VLC)', { ms: 3500 });
    };
    mr.start(2000);
    rec = { mr };
    $('#recChip').classList.remove('hidden'); $('#recChip').classList.add('rec'); $('#mRecTxt').textContent = 'Stop recording';
    toast('Recording started: board + your voice', { ms: 2500 });
  }
  function stopRec() { if (rec && rec.mr.state !== 'inactive') rec.mr.stop(); }
  SB.recording = () => !!rec;

  /* ================= handwriting to text ================= */
  const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  function selectedObjs() {
    if (S.grp && S.grp.page === S.cur) return S.grp.ids.map((id) => (S.pages[S.cur] || []).find((o) => o.id === id)).filter(Boolean);
    if (S.sel && S.sel.page === S.cur) { const o = (S.pages[S.cur] || []).find((q) => q.id === S.sel.id); return o ? [o] : []; }
    return [];
  }
  function openOcr() {
    const objs = selectedObjs().filter((o) => o.type !== 'image' && o.type !== 'text');
    if (!objs.length) { toast('First select your handwriting with the Lasso tool.', { ms: 2800 }); return; }
    const { body } = OCR; body.textContent = '';
    body.append(el('p', 'hint', `Turns ${objs.length} selected stroke${objs.length > 1 ? 's' : ''} into typed text. Works best with neat, separate letters. You may need to fix a few words.`));
    let lang = 'eng';
    const seg = el('div', 'seg');
    [['eng', 'English'], ['hin', 'Hindi'], ['eng+hin', 'English + Hindi']].forEach(([v, t]) => { const b = el('button', v === lang ? 'on' : '', t); b.onclick = () => { lang = v; $$('button', seg).forEach((x) => x.classList.remove('on')); b.classList.add('on'); }; seg.append(b); });
    const status = el('p', 'hint'); const row = el('div', 'row end');
    const go = btn('Read my handwriting', 'primary', async () => {
      go.disabled = true; status.textContent = 'Loading the text reader (first time only, needs internet)…';
      try {
        if (!window.Tesseract) await SB.loadScript(TESS);
        const bb = objs.map((o) => SB.bboxOf(o)); const x0 = Math.min(...bb.map((b) => b.x)), y0 = Math.min(...bb.map((b) => b.y)), x1 = Math.max(...bb.map((b) => b.x + b.w)), y1 = Math.max(...bb.map((b) => b.y + b.h));
        const k = Math.min(2, 1800 / Math.max(1, x1 - x0)), cv = el('canvas'); cv.width = Math.ceil((x1 - x0 + 40) * k); cv.height = Math.ceil((y1 - y0 + 40) * k);
        const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.scale(k, k); cx.translate(20 - x0, 20 - y0);
        objs.forEach((o) => SB.drawObj(cx, Object.assign({}, o, { color: '#000000', ps: undefined })));
        status.textContent = 'Reading…';
        const res = await window.Tesseract.recognize(cv, lang, { logger: (m) => { if (m.status && m.progress != null) status.textContent = `${m.status} ${Math.round(m.progress * 100)}%`; } });
        const text = String((res && res.data && res.data.text) || '').trim();
        if (!text) { status.textContent = 'Could not read any text. Try writing bigger and with more space between letters.'; go.disabled = false; return; }
        const fs = Math.max(30, Math.min(64, Math.round((y1 - y0) / Math.max(1, text.split('\n').length) * 0.8)));
        SB.addObj({ id: SB.uid(), type: 'text', x: Math.max(10, x0), y: Math.min(840 - fs, y1 + 20), text, fs, color: SB.ink(), f: 'sans' });
        closeModal('mOcr'); toast('Typed text added below your handwriting. Delete the handwriting if you do not need it.', { ms: 4200 });
      } catch (e) { status.textContent = 'Could not read: ' + e.message + ' (this needs an internet connection)'; go.disabled = false; }
    });
    row.append(btn('Cancel', 'ghost', () => closeModal('mOcr')), go);
    body.append(seg, status, row); openModal('mOcr');
  }

  /* ================= board file: save and open ================= */
  function saveBoardFile() {
    const data = { app: 'SmartBoard', v: 1, title: S.title || '', bg: S.bg, bgs: S.pages.map((_, i) => SB.bgOf(i)), pages: S.pages, saved: new Date().toISOString() };
    const name = (S.title || 'board').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'board';
    SB.saveBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `${name}.smartboard.json`);
    toast('Board file saved. Use Teach > Open a board file to bring it back.', { ms: 3200 });
  }
  function openBoardFile() {
    const inp = el('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || data.app !== 'SmartBoard' || !Array.isArray(data.pages)) throw new Error('This is not a SmartBoard file.');
        if (!(await SB.uiConfirm(`Replace the current board with "${f.name}" (${data.pages.length} page${data.pages.length > 1 ? 's' : ''})? Students will see the new board.`, 'Open file', true))) return;
        const r = await ask('board:load', { pages: data.pages, bg: data.bg, bgs: data.bgs, title: data.title });
        if (!r.ok) toast(r.error || 'Could not open this file.');
      } catch (e) { toast('Could not open the file: ' + e.message, { ms: 3500 }); }
    };
    inp.click();
  }

  /* ================= wiring ================= */
  const GRAPH = makeModal('mGraph', 'Graph / equation plotter', 'sm');
  GRAPH.m.querySelector('.sheet').style.width = '460px';
  const ASKM = makeModal('mAsk', 'Ask the class a question', 'sm');
  const BRK = makeModal('mBrk', 'Breakout groups', 'wide');
  const ATT = makeModal('mAtt', 'Attendance', 'wide');
  const OCR = makeModal('mOcr', 'Handwriting to text', 'sm');

  function init() {
    // geometry menu
    const gm = el('div', 'menu geo-menu hidden'); gm.id = 'geoMenu'; $('#app').append(gm);
    $('#geoBtn').onclick = (e) => { e.stopPropagation(); renderGeoMenu(); gm.classList.toggle('hidden'); };
    document.addEventListener('pointerdown', (e) => { if (!gm.classList.contains('hidden') && !e.target.closest('#geoMenu') && !e.target.closest('#geoBtn')) gm.classList.add('hidden'); });
    // teach menu
    $('#mAskBtn').onclick = () => { closeMenus(); openAskModal(); };
    $('#mBrkBtn').onclick = () => { closeMenus(); fillBrk(); openModal('mBrk'); };
    $('#mGraphBtn').onclick = () => { closeMenus(); openGraph(); };
    $('#mAttBtn').onclick = () => { closeMenus(); openAttendance(); };
    $('#mRecBtn').onclick = () => { closeMenus(); startRec(); };
    $('#mOpenBtn').onclick = () => { closeMenus(); openBoardFile(); };
    $('#expJson').onclick = () => { closeMenus(); saveBoardFile(); };
    $('#recChip').onclick = stopRec;
    $('#brkChip').onclick = () => { if (isT()) { fillBrk(); openModal('mBrk'); } };
    confPop = el('div', 'conf-pop hidden'); confPop.id = 'confPop'; document.body.append(confPop);
    $('#confChip').onclick = (e) => {
      e.stopPropagation(); renderConfPop();
      const r = $('#confChip').getBoundingClientRect();
      confPop.style.top = (r.bottom + 8) + 'px'; confPop.style.left = Math.max(8, Math.min(innerWidth - 230, r.left)) + 'px';
      confPop.classList.toggle('hidden');
    };
    document.addEventListener('pointerdown', (e) => { if (confPop && !confPop.contains(e.target) && !$('#confChip').contains(e.target)) confPop.classList.add('hidden'); });
    $('#confBtn').onclick = () => emit('confuse:toggle', {});
    // OCR button in the selection bar
    const bar = $('#selBar'); const ob = el('button'); ob.id = 'selOcr'; ob.title = 'Turn handwriting into typed text'; ob.textContent = 'T↻'; ob.style.fontSize = '12px'; ob.onclick = openOcr;
    bar.insertBefore(ob, $('#selDup'));
    buildChat();
    hook('view', () => Object.keys(G).forEach(geoPlace));
    hook('net:ov:set', (d) => { if (isT()) return; if (d.on) geoShow(d.kind, { x: d.x, y: d.y, rot: d.rot }); else geoHide(d.kind, false); });
    hook('net:ask:state', (a) => { S.ask = a; renderAsk(); });
    hook('net:break:state', (b) => setBrk(b));
    hook('net:chat:msg', (m) => chatAdd(m));
    hook('net:chat:on', setChatOn);
    hook('net:chat:clear', () => { chatList.textContent = ''; chatList.append(el('div', 'chat-empty', 'Chat cleared.')); });
    hook('net:confuse:state', (d) => setConf(d.n, d.names, d.who));
    hook('net:confuse:mine', (d) => { $('#confBtn').classList.toggle('on', !!d.on); $('#confBtn span').textContent = d.on ? 'Told teacher' : 'Not clear'; if (d.on) toast('The teacher knows you did not understand', { ms: 1800 }); });
    hook('state', (st) => {
      Object.keys(G).forEach((k) => geoHide(k, false));
      Object.keys(st.ov || {}).forEach((k) => geoShow(k, st.ov[k]));
      S.ask = st.ask || null; renderAsk();
      setBrk(st.brk, true);
      chatList.textContent = '';
      if (!(st.chat || []).length) chatList.append(el('div', 'chat-empty', 'No messages yet. Ask a doubt or say hello.'));
      (st.chat || []).forEach((m) => chatAdd(m, true));
      setChatOn(st.chatOn !== false);
      setConf(st.confuse || 0, st.confNames || []);
      $('#confBtn').classList.toggle('on', !!st.confMine);
      if ($('#confBtn span')) $('#confBtn span').textContent = st.confMine ? 'Told teacher' : 'Not clear';
    });
    SB.paintIcons();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
