/* SmartBoard 2.21: better PDF upload.
 *  - upload sheet: drop zone, preview, page count, placement, quality, page range, progress bar
 *  - sharp pages: adaptive JPEG quality, up to "Ultra HD"
 *  - PDF dock (teacher): next/back, thumbnails, Fit / Stretch / Fill, zoom, apply to all pages, full screen present
 */
(() => {
  'use strict';
  const SB = window.SB;
  if (!SB) return;
  const { S, $, W, H, emit, toast, toastDone, uid, clone, addObj, addPage, goPage, loadScript, openModal, closeModal, isTeacher } = SB;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const PDFJS = '3.11.174';
  const MAX_PAGES = 60;
  const small = () => window.innerWidth < 800;
  const fmtSize = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');

  let pdf = null, file = null, busy = false, cancel = false;
  let opt = { fit: 'full', q: small() ? 'hd' : 'hd', range: 'all' };

  async function ensureLib() {
    if (window.pdfjsLib) return;
    await loadScript(`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS}/pdf.min.js`);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS}/pdf.worker.min.js`;
  }

  // ---------- sizing ----------
  function sizeFor(ar, mode) {
    if (mode === 'stretch') return { x: 0, y: 0, w: W, h: H };
    let w, h;
    if (mode === 'fill') { w = Math.max(W, H * ar); h = w / ar; }
    else { w = Math.min(W, H * ar); h = w / ar; if (mode === 'normal') { w *= 0.85; h *= 0.85; } }
    return { x: (W - w) / 2, y: (H - h) / 2, w, h };
  }
  function modeOf(o) {
    const ar = o.pdf && o.pdf.ar; if (!ar) return '';
    for (const m of ['full', 'stretch', 'fill', 'normal']) { const s = sizeFor(ar, m); if (Math.abs(s.w - o.w) < 2 && Math.abs(s.h - o.h) < 2) return m; }
    return '';
  }
  const pdfObjs = () => {
    const out = [];
    S.pages.forEach((p, i) => (p || []).forEach((o) => { if (o.type === 'image' && o.pdf) out.push({ page: i, o }); }));
    return out;
  };
  const curPdfObj = () => (S.pages[S.cur] || []).find((o) => o.type === 'image' && o.pdf);

  // ---------- the upload sheet ----------
  function build() {
    if ($('#mPdf')) return;
    const m = el('div', 'modal hidden'); m.id = 'mPdf';
    m.innerHTML = `<div class="sheet pk-sheet">
      <div class="sheet-head"><h3>📄 Add a PDF</h3><button class="icon-btn" id="pkX" title="Close">✕</button></div>
      <div id="pkDrop" class="pk-drop" tabindex="0"><div class="pk-dicon">📄</div><b>Drop a PDF here</b><span>or tap to choose a file</span></div>
      <div id="pkInfo" class="pk-info hidden"><canvas id="pkThumb" width="160" height="110"></canvas><div class="pk-meta"><b id="pkName"></b><span id="pkMeta"></span><button class="btn ghost pk-small" id="pkChange">Change file</button></div></div>
      <div id="pkOpts" class="hidden">
        <div class="pk-lab">How should the pages fill the board?</div>
        <div class="seg pk-seg" data-k="fit"><button data-v="full" class="on"><b>Full screen</b><small>Fits, shape stays</small></button><button data-v="stretch"><b>Stretch</b><small>Fills every corner</small></button><button data-v="fill"><b>Fill</b><small>Covers, edges cropped</small></button><button data-v="normal"><b>Small</b><small>Write around it</small></button></div>
        <div class="pk-lab">Quality</div>
        <div class="seg pk-seg" data-k="q"><button data-v="std"><b>Standard</b><small>Fast</small></button><button data-v="hd" class="on"><b>HD</b><small>Sharp text</small></button><button data-v="ultra"><b>Ultra HD</b><small>Best, slower</small></button></div>
        <div class="pk-lab">Pages</div>
        <div class="pk-pages"><button class="pk-chip on" data-r="all" id="pkAll">All pages</button><button class="pk-chip" data-r="range">Choose pages</button><input id="pkRange" class="hidden" placeholder="e.g. 1-5, 8, 10-12" inputmode="text"></div>
        <p class="hint" id="pkHint"></p>
      </div>
      <div id="pkProg" class="pk-prog hidden"><div class="pk-bar"><i id="pkFill"></i></div><span id="pkPct">Starting…</span></div>
      <div class="pk-actions"><button class="btn ghost" id="pkCancel">Cancel</button><button class="btn primary" id="pkGo" disabled>Add to board</button></div>
    </div>`;
    document.body.append(m);
    const inp = el('input'); inp.type = 'file'; inp.accept = 'application/pdf'; inp.hidden = true; inp.id = 'pkFile'; m.append(inp);
    const drop = $('#pkDrop');
    drop.onclick = () => inp.click();
    drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') inp.click(); };
    $('#pkChange').onclick = () => inp.click();
    inp.onchange = () => { if (inp.files[0]) load(inp.files[0]); inp.value = ''; };
    ['dragenter', 'dragover'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) load(f); });
    m.querySelectorAll('.pk-seg').forEach((seg) => seg.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); opt[seg.dataset.k] = b.dataset.v; hint();
    }));
    m.querySelectorAll('.pk-chip').forEach((c) => c.addEventListener('click', () => {
      m.querySelectorAll('.pk-chip').forEach((x) => x.classList.toggle('on', x === c)); opt.range = c.dataset.r;
      $('#pkRange').classList.toggle('hidden', opt.range !== 'range'); if (opt.range === 'range') $('#pkRange').focus(); hint();
    }));
    $('#pkRange').addEventListener('input', hint);
    $('#pkX').onclick = $('#pkCancel').onclick = () => { if (busy) { cancel = true; $('#pkPct').textContent = 'Stopping…'; } else shut(); };
    $('#pkGo').onclick = run;
    m.addEventListener('click', (e) => { if (e.target === m && !busy) shut(); });
  }
  const shut = () => { closeModal('mPdf'); pdf = null; file = null; };

  function pickPages() {
    const n = pdf ? pdf.numPages : 0, set = new Set();
    if (opt.range === 'all') { for (let i = 1; i <= n; i++) set.add(i); }
    else String($('#pkRange').value || '').split(',').forEach((part) => {
      const m = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/); if (!m) return;
      let a = +m[1], b = m[2] ? +m[2] : a; if (a > b) [a, b] = [b, a];
      for (let i = Math.max(1, a); i <= Math.min(n, b); i++) set.add(i);
    });
    return [...set].sort((a, b) => a - b);
  }
  function hint() {
    if (!pdf) return;
    const list = pickPages(), room = MAX_PAGES - S.pages.length + (S.pages[S.cur] && S.pages[S.cur].length === 0 ? 1 : 0);
    const h = $('#pkHint'); let t = list.length + ' page' + (list.length === 1 ? '' : 's') + ' will be added.';
    if (list.length > room) t += ` Only ${Math.max(0, room)} more pages fit on this board, the rest are skipped.`;
    h.textContent = t; $('#pkGo').disabled = !list.length || busy;
  }

  async function load(f) {
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { toast('Please choose a PDF file.'); return; }
    build(); openModal('mPdf');
    $('#pkDrop').classList.add('hidden'); $('#pkInfo').classList.remove('hidden'); $('#pkOpts').classList.add('hidden'); $('#pkGo').disabled = true;
    $('#pkName').textContent = f.name; $('#pkMeta').textContent = 'Reading…';
    try {
      await ensureLib();
      file = f;
      pdf = await window.pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
      $('#pkMeta').textContent = `${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''} · ${fmtSize(f.size)}`;
      const p1 = await pdf.getPage(1), v = p1.getViewport({ scale: 1 }), k = Math.min(160 / v.width, 110 / v.height);
      const c = $('#pkThumb'); c.width = Math.round(v.width * k); c.height = Math.round(v.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await p1.render({ canvasContext: g, viewport: p1.getViewport({ scale: k }) }).promise;
      $('#pkOpts').classList.remove('hidden'); hint();
    } catch (err) {
      console.error(err); $('#pkMeta').textContent = 'Could not read this PDF. Check the file or your internet.'; pdf = null;
    }
  }

  // JPEG as sharp as the size budget allows
  async function encode(c, cap) {
    for (let scale = 1; scale > 0.45; scale *= 0.85) {
      let src = c;
      if (scale < 1) { src = document.createElement('canvas'); src.width = Math.round(c.width * scale); src.height = Math.round(c.height * scale); const g = src.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, src.width, src.height); }
      for (const q of [0.95, 0.9, 0.85, 0.8]) { const s = src.toDataURL('image/jpeg', q); if (s.length <= cap) return s; }
    }
    return c.toDataURL('image/jpeg', 0.7);
  }

  async function run() {
    if (!pdf || busy) return;
    const list = pickPages(); if (!list.length) return;
    busy = true; cancel = false;
    $('#pkGo').disabled = true; $('#pkProg').classList.remove('hidden'); $('#pkCancel').textContent = 'Stop';
    const pid = uid(), name = (file && file.name || 'PDF').replace(/\.pdf$/i, '');
    const want = { std: 2, hd: 3, ultra: 4 }[opt.q] * (small() ? 0.75 : 1);
    const cap = Math.max(1.2e6, Math.min(5.5e6, 45e6 / list.length));
    const useCurrent = (S.pages[S.cur] || []).length === 0;
    let first = null, done = 0;
    try {
      for (let k = 0; k < list.length; k++) {
        if (cancel) break;
        const i = list[k];
        $('#pkPct').textContent = `Page ${k + 1} of ${list.length}…`; $('#pkFill').style.width = Math.round((k / list.length) * 100) + '%';
        const page = await pdf.getPage(i), v0 = page.getViewport({ scale: 1 }), ar = v0.width / v0.height;
        const f = Math.min(W / v0.width, H / v0.height);
        let vp = page.getViewport({ scale: f * want });
        const maxPx = small() ? 3200 : 6400; if (vp.width > maxPx) vp = page.getViewport({ scale: f * want * (maxPx / vp.width) });
        const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: cx, viewport: vp }).promise;
        const src = await encode(c, cap);
        c.width = c.height = 1;
        const idx = k === 0 && useCurrent ? S.cur : await addPage();
        if (idx === null) { toast('Page limit reached.'); break; }
        if (first === null) first = idx;
        const z = sizeFor(ar, opt.fit);
        addObj({ id: uid(), type: 'image', x: z.x, y: z.y, w: z.w, h: z.h, src, pdf: { id: pid, name, i, n: pdf.numPages, ar } }, idx);
        done++;
        await new Promise((r) => setTimeout(r, 0));
      }
    } catch (err) { console.error(err); toast('Something went wrong while adding the PDF.'); }
    busy = false; $('#pkCancel').textContent = 'Cancel'; $('#pkProg').classList.add('hidden');
    shut();
    if (first !== null) goPage(first);
    if (done) { toast(`PDF added: ${done} page${done > 1 ? 's' : ''} 📄 Tap the 📄 dot on the side for PDF tools.`, { ms: 3600 }); dockOpen = true; refresh(true); }
  }

  // ---------- PDF bar (teacher) ----------
  let dock = null, thumbs = null, allPages = true, dockOpen = true, lastKey = '';
  function applyTo(mode, fn) {
    const cur = curPdfObj(); if (!cur) return;
    const targets = pdfObjs().filter((x) => (allPages ? x.o.pdf.id === cur.pdf.id : x.o === cur));
    targets.forEach(({ page, o }) => { fn(o); emit('obj:replace', { page, obj: clone(o) }); });
  }
  function setFit(mode) { applyTo(mode, (o) => Object.assign(o, sizeFor(o.pdf.ar, mode))); toast({ full: 'Full screen fit', stretch: 'Stretched to the whole board', fill: 'Filled (edges cropped)', normal: 'Small size' }[mode], { ms: 1300 }); redraw(); }
  function zoomBy(k) {
    applyTo('', (o) => { const cx = o.x + o.w / 2, cy = o.y + o.h / 2; o.w *= k; o.h *= k; o.x = cx - o.w / 2; o.y = cy - o.h / 2; });
    redraw();
  }
  function redraw() { goPage(S.cur, false); refresh(true); }

  let dot = null;
  function buildDot() {
    dot = el('button', 'pdf-dot hidden', '📄'); dot.id = 'pdfDot'; dot.title = 'PDF tools (drag to move)'; document.body.append(dot);
    const put = (x, y) => { dot.style.left = x + 'px'; dot.style.top = y + 'px'; dot.style.right = 'auto'; dot.style.bottom = 'auto'; };
    const clampPos = () => { const r = dot.getBoundingClientRect(); put(Math.min(Math.max(4, r.left), innerWidth - r.width - 4), Math.min(Math.max(4, r.top), innerHeight - r.height - 4)); };
    try { const sp = JSON.parse(localStorage.getItem('sb_pdf_dot') || 'null'); if (sp) put(sp.x * innerWidth, sp.y * innerHeight); } catch { /* ignore */ }
    let drag = null, moved = false, lastDrag = 0;
    dot.style.touchAction = 'none';
    dot.addEventListener('pointerdown', (e) => { const r = dot.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY }; moved = false; try { dot.setPointerCapture(e.pointerId); } catch { /* ignore */ } });
    dot.addEventListener('pointermove', (e) => { if (!drag) return; if (!moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return; moved = true; put(e.clientX - drag.dx, e.clientY - drag.dy); clampPos(); });
    const end = () => { if (drag && moved) { lastDrag = Date.now(); try { const r = dot.getBoundingClientRect(); localStorage.setItem('sb_pdf_dot', JSON.stringify({ x: r.left / innerWidth, y: r.top / innerHeight })); } catch { /* ignore */ } } drag = null; };
    dot.addEventListener('pointerup', end); dot.addEventListener('pointercancel', end);
    dot.addEventListener('click', () => {
      if (Date.now() - lastDrag < 350) return;
      if (dock.classList.contains('faded')) wake(); else { dock.classList.add('faded'); thumbs.classList.add('hidden'); dot.classList.remove('on'); clearTimeout(hideT); }
    });
    window.addEventListener('resize', () => { if (dot.style.left) clampPos(); });
  }
  function buildDock() {
    if (dock) return;
    dock = el('div', 'pdf-dock hidden faded'); dock.id = 'pdfDock';
    dock.innerHTML = `<div class="pd-body" id="pdBody">
        <button class="pd-b" id="pdPrev" title="Previous page">‹</button>
        <span class="pd-num" id="pdNum">1 / 1</span>
        <button class="pd-b" id="pdNext" title="Next page">›</button>
        <button class="pd-b" id="pdThumbs" title="All pages">▦</button>
        <span class="pd-sep"></span>
        <button class="pd-t" data-fit="full" title="Fit: whole page, shape stays">Fit</button>
        <button class="pd-t" data-fit="stretch" title="Stretch to every corner">Stretch</button>
        <button class="pd-t" data-fit="fill" title="Fill the board, crop edges">Fill</button>
        <span class="pd-sep"></span>
        <button class="pd-b" id="pdZm" title="Smaller">−</button><button class="pd-b" id="pdZp" title="Bigger">+</button>
        <button class="pd-t" id="pdAll" title="Apply size changes to every page of this PDF">All pages</button>
        <span class="pd-sep"></span>
        <button class="pd-t strong" id="pdPresent" title="Full screen, hides all tools">⛶ Full screen</button>
      </div>`;
    document.body.append(dock);
    buildDot();
    thumbs = el('div', 'pd-thumbs hidden'); thumbs.id = 'pdThumbsBox'; document.body.append(thumbs);
    $('#pdPrev').onclick = () => { if (S.cur > 0) goPage(S.cur - 1); };
    $('#pdNext').onclick = () => { if (S.cur < S.pages.length - 1) goPage(S.cur + 1); };
    $('#pdThumbs').onclick = () => { thumbs.classList.contains('hidden') ? openThumbs() : thumbs.classList.add('hidden'); };
    dock.querySelectorAll('[data-fit]').forEach((b) => (b.onclick = () => setFit(b.dataset.fit)));
    $('#pdZm').onclick = () => zoomBy(1 / 1.15); $('#pdZp').onclick = () => zoomBy(1.15);
    $('#pdAll').onclick = () => { allPages = !allPages; toast(allPages ? 'Changes apply to every page of this PDF' : 'Changes apply to this page only', { ms: 1500 }); refresh(true); };
    $('#pdPresent').onclick = () => SB.setPresent(true);
  }
  function openThumbs() {
    const cur = curPdfObj(); if (!cur) return;
    thumbs.innerHTML = '';
    pdfObjs().filter((x) => x.o.pdf.id === cur.pdf.id).forEach(({ page, o }) => {
      const b = el('button', 'pd-th' + (page === S.cur ? ' on' : ''));
      const im = new Image(); im.decoding = 'async'; im.loading = 'lazy'; im.src = o.src; b.append(im, el('span', '', String(o.pdf.i)));
      b.onclick = () => { goPage(page); thumbs.classList.add('hidden'); };
      thumbs.append(b);
    });
    thumbs.classList.remove('hidden');
    const on = thumbs.querySelector('.on'); if (on) setTimeout(() => on.scrollIntoView({ block: 'nearest', inline: 'center' }), 30);
  }
  let hideT = null;
  function wake() {
    if (!dock) return;
    dock.classList.remove('faded'); if (dot) dot.classList.add('on'); clearTimeout(hideT);
    hideT = setTimeout(() => {
      if (dock.matches(':hover') || (thumbs && thumbs.matches(':hover'))) return wake();
      dock.classList.add('faded'); if (thumbs) thumbs.classList.add('hidden'); if (dot) dot.classList.remove('on');
    }, 5000);
  }
  function refresh(force) {
    if (!dock) buildDock();
    const o = isTeacher() ? curPdfObj() : null;
    const key = o ? [S.cur, o.pdf.id, o.w | 0, o.h | 0, dockOpen, allPages, S.present].join('|') : 'none|' + dockOpen;
    if (!force && key === lastKey) return; lastKey = key;
    dock.classList.toggle('hidden', !o); dot.classList.toggle('hidden', !o); if (!o) { thumbs.classList.add('hidden'); return; }
    dock.classList.toggle('closed', !dockOpen);
    $('#pdNum').textContent = `${o.pdf.i} / ${o.pdf.n}`;
    $('#pdPrev').disabled = S.cur === 0; $('#pdNext').disabled = S.cur >= S.pages.length - 1;
    const m = modeOf(o); dock.querySelectorAll('[data-fit]').forEach((b) => b.classList.toggle('on', b.dataset.fit === m));
    $('#pdAll').classList.toggle('on', allPages);
    $('#pdPresent').style.display = S.present ? 'none' : '';
  }

  // ---------- wire up ----------
  function init() {
    build(); buildDock();
    document.addEventListener('click', (e) => {
      if (!e.target.closest || !e.target.closest('#pdfBtn')) return;
      e.stopImmediatePropagation(); e.preventDefault();
      build(); openModal('mPdf'); $('#pkDrop').classList.remove('hidden'); $('#pkInfo').classList.add('hidden'); $('#pkOpts').classList.add('hidden'); $('#pkGo').disabled = true; $('#pkProg').classList.add('hidden');
    }, true);
    // drag a PDF straight onto the board
    document.addEventListener('dragover', (e) => { if (isTeacher() && e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault(); });
    document.addEventListener('drop', (e) => {
      if (!isTeacher() || e.target.closest && e.target.closest('#mPdf')) return;
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) { e.preventDefault(); load(f); }
    });
    // a small dot (drag it anywhere) opens the PDF bar; the bar hides itself again after a few seconds
    setInterval(() => { const k = lastKey; refresh(false); if (lastKey !== k && dock && !dock.classList.contains('faded')) wake(); }, 350);
    ['pointerdown', 'touchstart', 'keydown'].forEach((n) => dock.addEventListener(n, () => wake(), { passive: true }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
