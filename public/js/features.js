/* SmartBoard 2.0 features: poll, class timer, people + raise hand, random picker, invite (QR),
 * templates, stamps, recent boards. Uses window.SB from app.js. */
(() => {
  'use strict';
  const SB = window.SB;
  const { S, $, $$, toast, emit, hook, openModal, closeModal } = SB;
  const QR_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  const LETTERS = ['A', 'B', 'C', 'D'];

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const icon = (name) => { const i = el('i'); i.dataset.icon = name; i.innerHTML = SB.svgOf(name); return i; };
  const closeMenus = () => { $('#teachMenu').classList.add('hidden'); $('#exportMenu').classList.add('hidden'); };

  // ---------- sound (a short beep for the timer) ----------
  let audio = null;
  document.addEventListener('pointerdown', () => {
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch { /* no audio */ }
  }, { once: false });
  function beep(times = 3) {
    if (!audio) return;
    try {
      for (let i = 0; i < times; i++) {
        const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + i * 0.28;
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + 0.22);
      }
    } catch { /* ignore */ }
  }

  // ---------- quick poll ----------
  let hiddenPoll = null, pollView = null;

  function buildPollForm() {
    const box = $('#pollOpts');
    box.textContent = '';
    for (let i = 0; i < 4; i++) {
      const row = el('div', 'opt-row');
      const r = el('input'); r.type = 'radio'; r.name = 'pollCorrect'; r.value = i; r.title = 'Mark as correct answer';
      const t = el('input', 'input pollOpt'); t.maxLength = 80; t.placeholder = `Option ${LETTERS[i]}${i > 1 ? ' (optional)' : ''}`; t.autocomplete = 'off';
      row.append(r, t); box.appendChild(row);
    }
  }

  function startPoll() {
    const question = $('#pollQ').value.trim();
    const rows = $$('#pollOpts .opt-row');
    const options = [];
    let correct = null;
    rows.forEach((row, i) => {
      const v = $('.pollOpt', row).value.trim();
      if (!v) return;
      if ($('input[type=radio]', row).checked) correct = options.length;
      options.push(v);
    });
    if (!question) return toast('Type the question first.');
    if (options.length < 2) return toast('Add at least two options.');
    emit('poll:start', { question, options, correct }, (res) => {
      if (res && res.ok) { closeModal('mPoll'); $('#pollQ').value = ''; $$('#pollOpts input').forEach((x) => { if (x.type === 'radio') x.checked = false; else x.value = ''; }); }
      else toast((res && res.error) || 'Could not start the poll.');
    });
  }

  function renderPoll(v) {
    pollView = v;
    const card = $('#pollCard');
    if (!v || hiddenPoll === v.id) { card.classList.add('hidden'); card.textContent = ''; return; }
    const teacher = SB.isTeacher();
    card.textContent = '';
    card.classList.remove('hidden');
    card.appendChild(el('p', 'pq', v.question));
    const meta = el('div', 'pmeta');
    meta.append(el('span', '', v.open ? 'Poll is open' : 'Poll closed'), el('span', '', `${v.total} vote${v.total === 1 ? '' : 's'}`));
    card.appendChild(meta);

    const showCounts = Array.isArray(v.counts);
    v.options.forEach((text, i) => {
      const canVote = !teacher && v.open && v.myVote === null;
      const o = el(canVote ? 'button' : 'div', 'popt');
      if (v.myVote === i) o.classList.add('mine');
      if (v.correct === i) o.classList.add('correct');
      const bar = el('span', 'bar');
      const pct = showCounts && v.total ? Math.round((v.counts[i] / v.total) * 100) : 0;
      bar.style.width = pct + '%';
      const lt = el('span', 'lt', v.correct === i ? '✓' : LETTERS[i]);
      const tx = el('span', 'tx', text);
      o.append(bar, lt, tx);
      if (showCounts) o.appendChild(el('span', 'ct', `${v.counts[i]} · ${pct}%`));
      if (canVote) o.onclick = () => emit('poll:vote', { id: v.id, choice: i });
      card.appendChild(o);
    });

    if (!teacher && v.open && v.myVote !== null) card.appendChild(el('p', 'hint', 'Your answer is in. Results appear when the teacher closes the poll.'));
    if (!teacher && !v.open && v.correct !== null && v.myVote !== null) {
      card.appendChild(el('p', 'hint', v.myVote === v.correct ? '🎉 Correct!' : 'Not quite. The green option is correct.'));
    }
    const row = el('div', 'prow');
    if (teacher) {
      if (v.open) { const b = el('button', 'btn primary', 'Close & reveal'); b.onclick = () => emit('poll:close'); row.appendChild(b); }
      const rm = el('button', 'btn soft', 'Remove'); rm.onclick = () => emit('poll:clear'); row.appendChild(rm);
    }
    const hide = el('button', 'btn ghost', 'Hide'); hide.onclick = () => { hiddenPoll = v.id; renderPoll(v); };
    row.appendChild(hide);
    card.appendChild(row);
  }

  // ---------- class timer ----------
  let timer = null, tick = null, hideT = null;
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  function renderTimer() {
    const chip = $('#timerChip');
    clearInterval(tick); clearTimeout(hideT);
    if (!timer) { chip.classList.add('hidden'); chip.classList.remove('low'); return; }
    chip.classList.remove('hidden');
    const upd = () => {
      const left = timer.endAt - Date.now();
      $('#timerText').textContent = fmt(left);
      chip.classList.toggle('low', left <= 10000 && left > 0);
      if (left <= 0) {
        clearInterval(tick);
        chip.classList.remove('low');
        $('#timerText').textContent = "Time's up!";
        toast("⏰ Time's up!", { ms: 4000 });
        beep();
        hideT = setTimeout(() => { timer = null; renderTimer(); }, 8000);
      }
    };
    upd();
    tick = setInterval(upd, 250);
  }
  function setTimer(v) { timer = v ? { endAt: Date.now() + v.remaining, total: v.total } : null; renderTimer(); }

  function buildTimerForm() {
    const box = $('#timerPresets');
    [1, 2, 5, 10, 15].forEach((m) => {
      const b = el('button', '', `${m} min`);
      b.onclick = () => { $$('#timerPresets button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); $('#timerMin').value = m; };
      box.appendChild(b);
    });
    $('#timerGo').onclick = () => {
      const m = parseFloat($('#timerMin').value);
      if (!m || m <= 0 || m > 120) return toast('Enter minutes between 1 and 120.');
      emit('timer:start', { seconds: Math.round(m * 60) });
      closeModal('mTimer');
    };
    $('#timerStop').onclick = () => emit('timer:stop');
  }

  // ---------- people, raise hand, random pick ----------
  let people = [];
  const hue = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

  function renderPeople() {
    const raised = people.filter((p) => p.hand).length;
    $('#handDot').classList.toggle('hidden', !(SB.isTeacher() && raised > 0));
    $('#peopleCount').textContent = `${people.length} online${raised ? ` · ${raised} hand${raised > 1 ? 's' : ''} up` : ''}`;
    const list = $('#peopleList');
    list.textContent = '';
    const sorted = people.slice().sort((a, b) => (b.hand - a.hand) || ((b.role === 'teacher') - (a.role === 'teacher')) || a.name.localeCompare(b.name));
    sorted.forEach((p) => {
      const row = el('div', 'person');
      const av = el('span', 'av', (p.name || '?').trim().charAt(0).toUpperCase() || '?');
      av.style.background = `hsl(${hue(p.name || '?')} 55% 45%)`;
      const nm = el('span', 'nm', p.name);
      nm.appendChild(el('small', '', p.role === 'teacher' ? 'Teacher' : 'Student'));
      row.append(av, nm);
      if (p.hand) {
        row.appendChild(el('span', 'up', '✋'));
        const lw = el('button', 'btn soft', 'Lower'); lw.onclick = () => emit('hand:lower', { id: p.id }); row.appendChild(lw);
      }
      list.appendChild(row);
    });
  }

  let handUp = false;
  function setHand(up) {
    handUp = !!up;
    const b = $('#handBtn');
    b.classList.toggle('accent-soft', handUp);
    b.classList.toggle('soft', !handUp);
    $('span', b).textContent = handUp ? 'Lower hand' : 'Raise hand';
  }

  function pickStudent() {
    emit('pick', {}, (res) => { if (res && !res.ok) toast('No students on the board yet.'); });
  }
  function showPicked({ name }) {
    const n = $('#pickName');
    n.textContent = '...'; n.classList.add('spin');
    openModal('mPick');
    $('#pickAgain').classList.toggle('hidden', !SB.isTeacher());
    setTimeout(() => { n.classList.remove('spin'); n.textContent = name; }, 900);
  }

  // ---------- invite + QR ----------
  const isLocalHost = () => /^(localhost|127\.|\[::1\])/.test(location.hostname);
  let qrT = null;

  async function drawQr(url) {
    const box = $('#qrBox');
    try {
      await SB.loadScript(QR_SRC);
      const qr = window.qrcode(0, 'M');
      qr.addData(url); qr.make();
      const n = qr.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
      box.innerHTML = `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="QR code to join the board"><path d="${d}" fill="#000"/></svg>`;
    } catch {
      box.textContent = 'QR needs internet';
      box.style.color = '#334155'; box.style.fontSize = '13px'; box.style.textAlign = 'center';
    }
  }

  function openInvite() {
    if (!S.code) return;
    $('#bigCode').textContent = S.code;
    const url = `${location.origin}/?room=${S.code}`;
    $('#joinUrl').value = url;
    const hint = $('#urlHint');
    if (isLocalHost()) {
      hint.classList.remove('hidden');
      hint.textContent = 'You are on localhost, so phones cannot open this link. Replace "localhost" above with your laptop IP (for example http://192.168.1.5:3000) or use your deployed link. The QR updates automatically.';
    } else hint.classList.add('hidden');
    drawQr(url);
    openModal('mInvite');
  }

  async function copyText(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg); }
    catch {
      const inp = $('#joinUrl'); inp.focus(); inp.select();
      toast('Press Ctrl+C to copy the selected link.');
    }
  }

  // ---------- templates ----------
  const BLUE = '#3b82f6', RED = '#ef4444', GREEN = '#22c55e', PURPLE = '#8b5cf6', ORANGE = '#f97316';
  const ln = (x1, y1, x2, y2, color, size = 3) => ({ type: 'line', x1, y1, x2, y2, color, size });
  const ar = (x1, y1, x2, y2, color, size = 4) => ({ type: 'arrow', x1, y1, x2, y2, color, size });
  const rc = (x1, y1, x2, y2, color, size = 3, fill = false) => ({ type: 'rect', x1, y1, x2, y2, color, size, fill });
  const ov = (x1, y1, x2, y2, color, size = 3, fill = false) => ({ type: 'ellipse', x1, y1, x2, y2, color, size, fill });
  const tx = (x, y, text, fs, color) => ({ type: 'text', x, y, text, fs, color, f: 'sans' });

  const TEMPLATES = [
    { id: 'table', name: 'Table', desc: '4 columns, 5 rows with a header', icon: 'template', make(ink) {
      const o = [rc(160, 140, 1440, 230, BLUE, 3, true), rc(160, 140, 1440, 800, ink, 4)];
      for (let c = 1; c < 4; c++) o.push(ln(160 + c * 320, 140, 160 + c * 320, 800, ink, 3));
      for (let r = 1; r < 5; r++) o.push(ln(160, 230 + r * 114, 1440, 230 + r * 114, ink, 3));
      ['Heading 1', 'Heading 2', 'Heading 3', 'Heading 4'].forEach((t, c) => o.push(tx(185 + c * 320, 162, t, 36, ink)));
      return o;
    } },
    { id: 'venn', name: 'Venn diagram', desc: 'Compare two ideas', icon: 'ellipse', make(ink) {
      return [ov(330, 170, 870, 760, BLUE, 4, true), ov(730, 170, 1270, 760, RED, 4, true),
        tx(470, 100, 'Set A', 40, BLUE), tx(960, 100, 'Set B', 40, RED), tx(745, 440, 'Both', 36, ink)];
    } },
    { id: 'mind', name: 'Mind map', desc: 'Main topic with 4 branches', icon: 'wand', make(ink) {
      const o = [ar(700, 400, 360, 250, ink), ar(900, 400, 1240, 250, ink), ar(700, 500, 360, 650, ink), ar(900, 500, 1240, 650, ink),
        ov(620, 370, 980, 530, ORANGE, 4, true), tx(735, 425, 'Main topic', 40, ink)];
      [[160, 190, BLUE], [1040, 190, GREEN], [160, 590, PURPLE], [1040, 590, RED]].forEach(([x, y, c]) => {
        o.push(ov(x, y, x + 400, y + 120, c, 4, true), tx(x + 110, y + 38, 'Idea', 36, ink));
      });
      return o;
    } },
    { id: 'numline', name: 'Number line', desc: '-7 to 7 with tick marks', icon: 'line', make(ink) {
      const o = [ar(100, 450, 1500, 450, ink, 4), ar(1500, 450, 100, 450, ink, 4)];
      for (let k = -7; k <= 7; k++) {
        const x = 800 + k * 100;
        o.push(ln(x, 430, x, 470, ink, 3), tx(x - (k < 0 ? 16 : 8), 485, String(k), 30, ink));
      }
      return o;
    } },
    { id: 'cornell', name: 'Cornell notes', desc: 'Cues, notes and summary', icon: 'pdf', make(ink) {
      return [rc(80, 90, 1520, 160, BLUE, 3, true), rc(80, 90, 1520, 830, ink, 4), ln(500, 160, 500, 690, ink, 3), ln(80, 690, 1520, 690, ink, 3),
        tx(110, 105, 'Topic / Date', 34, ink), tx(110, 185, 'Cues', 32, BLUE), tx(530, 185, 'Notes', 32, BLUE), tx(110, 715, 'Summary', 32, BLUE)];
    } },
    { id: 'kwl', name: 'KWL chart', desc: 'Know, Want to know, Learned', icon: 'template', make(ink) {
      const o = [];
      [['K  Know', BLUE], ['W  Want to know', ORANGE], ['L  Learned', GREEN]].forEach(([t, c], i) => {
        const x = 100 + i * 470;
        o.push(rc(x, 110, x + 440, 190, c, 3, true), rc(x, 110, x + 440, 800, ink, 4), tx(x + 24, 128, t, 36, ink));
      });
      return o;
    } },
    { id: 'flow', name: 'Flowchart', desc: 'Start, steps and end', icon: 'arrow', make(ink) {
      const o = [ov(100, 360, 380, 540, GREEN, 4, true), tx(190, 430, 'Start', 36, ink),
        rc(520, 360, 860, 540, BLUE, 4, true), tx(600, 430, 'Step 1', 36, ink),
        rc(1000, 360, 1340, 540, PURPLE, 4, true), tx(1080, 430, 'Step 2', 36, ink),
        ar(380, 450, 520, 450, ink), ar(860, 450, 1000, 450, ink)];
      return o;
    } },
  ];

  const SH = (k, x1, y1, x2, y2, color, size = 4, fill = false) => ({ type: 'shape', k, x1, y1, x2, y2, color, size, fill });
  TEMPLATES.push(
    { id: 'quiz', name: 'Quiz question', desc: 'Question with options A to D', icon: 'poll', make(ink) {
      const o = [tx(120, 90, 'Question: ______________________________', 44, ink)];
      ['A', 'B', 'C', 'D'].forEach((l, i) => {
        const x = 120 + (i % 2) * 700, y = 280 + Math.floor(i / 2) * 230;
        o.push(rc(x, y, x + 620, y + 160, [BLUE, GREEN, ORANGE, PURPLE][i], 4, true), tx(x + 30, y + 52, `${l}.`, 52, ink));
      });
      return o;
    } },
    { id: 'matrix', name: '2 x 2 matrix', desc: 'SWOT or compare four ideas', icon: 'template', make(ink) {
      return [rc(200, 100, 1400, 820, ink, 4), ln(800, 100, 800, 820, ink, 4), ln(200, 460, 1400, 460, ink, 4),
        tx(230, 120, 'Strengths', 40, GREEN), tx(830, 120, 'Weaknesses', 40, RED), tx(230, 480, 'Opportunities', 40, BLUE), tx(830, 480, 'Threats', 40, ORANGE)];
    } },
    { id: 'pyth', name: 'Right triangle', desc: 'Pythagoras with labelled sides', icon: 'shapes', make(ink) {
      return [SH('rtri', 450, 160, 1000, 700, BLUE, 5, true), tx(380, 400, 'a', 50, ink), tx(700, 715, 'b', 50, ink), tx(760, 360, 'c', 50, ink),
        tx(1060, 330, 'a² + b² = c²', 56, RED), rc(450, 640, 510, 700, ink, 3)];
    } },
    { id: 'venn3', name: 'Venn (3 sets)', desc: 'Three overlapping circles', icon: 'ellipse', make(ink) {
      return [ov(480, 100, 920, 540, BLUE, 4, true), ov(700, 100, 1140, 540, RED, 4, true), ov(590, 330, 1030, 770, GREEN, 4, true),
        tx(560, 40, 'A', 44, BLUE), tx(1010, 40, 'B', 44, RED), tx(790, 780, 'C', 44, GREEN)];
    } },
    { id: 'timetable', name: 'Timetable', desc: 'Days by periods grid', icon: 'clock', make(ink) {
      const o = [rc(120, 110, 1480, 190, ORANGE, 3, true), rc(120, 110, 1480, 800, ink, 4)];
      for (let c = 1; c < 6; c++) o.push(ln(120 + c * 226, 110, 120 + c * 226, 800, ink, 3));
      for (let r = 1; r < 6; r++) o.push(ln(120, 190 + r * 122, 1480, 190 + r * 122, ink, 3));
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach((d, i) => o.push(tx(150 + (i + 1) * 226, 128, d, 36, ink)));
      for (let r = 1; r <= 5; r++) o.push(tx(150, 190 + (r - 1) * 122 + 40, `P${r}`, 34, ink));
      return o;
    } },
    { id: 'fraction', name: 'Fraction bars', desc: 'Whole, halves, quarters, eighths', icon: 'template', make(ink) {
      const o = [];
      [1, 2, 4, 8].forEach((n, r) => {
        const y = 140 + r * 180, w = 1200 / n;
        for (let i = 0; i < n; i++) o.push(rc(200 + i * w, y, 200 + (i + 1) * w, y + 120, [BLUE, GREEN, ORANGE, PURPLE][r], 3, true));
        o.push(tx(100, y + 38, n === 1 ? '1' : `1/${n}`, 38, ink));
      });
      return o;
    } },
  );

  function buildTemplates() {
    const grid = $('#tplGrid');
    TEMPLATES.forEach((t) => {
      const b = el('button', 'tpl');
      b.append(icon(t.icon), el('b', '', t.name), el('span', '', t.desc));
      b.onclick = () => insertTemplate(t);
      grid.appendChild(b);
    });
  }

  async function insertTemplate(t) {
    closeModal('mTemplates');
    let idx = S.cur;
    if (S.pages[S.cur].length) {
      idx = await SB.addPage();
      if (idx === null) return toast('Page limit reached.');
    }
    const ink = SB.ink();
    t.make(ink).forEach((o) => SB.addObj({ id: SB.uid(), ...o }, idx));
    toast(`${t.name} added. Use Select (V) to move things around.`);
  }

  // ---------- stamps (symbol palettes) + shapes menu ----------
  const STAMP_SETS = {
    Maths: ['π', '√', '∑', '∞', '±', '×', '÷', '≠', '≤', '≥', '≈', '°', 'θ', 'α', 'β', 'γ', 'Δ', '∫', '∠', '⊥', '∥', '²', '³', '½', '⅓', '¼', '∈', '∪', '∩', '⊂', '∴', '∵', '➕', '➖', '✖️', '➗'],
    Science: ['H₂O', 'CO₂', 'O₂', 'NaCl', 'Ω', 'μ', 'λ', 'Å', '⚛️', '🔬', '🧪', '🌡️', '⚡', '🧲', '🔭', '🌍', '☀️', '🌙', '🔥', '💧', '🌱', '🧬', '⚗️', '🔋'],
    Marks: ['✅', '❌', '⭐', '❓', '❗', '👍', '👏', '💡', '🎯', '🏆', '💯', '🔥', '✔️', '⚠️', '😀', '🤔', '🎉', '📌', '📝', '🔔'],
    Arrows: ['→', '←', '↑', '↓', '↔', '↕', '⇒', '⇐', '⇔', '↗', '↘', '↻', '↺', '➡️', '⬅️', '⬆️', '⬇️', '🔄'],
  };
  let stampTab = 'Maths';
  function buildStamps() {
    const m = $('#stampMenu');
    const draw = () => {
      m.textContent = '';
      const tabs = el('div', 'stamp-tabs');
      Object.keys(STAMP_SETS).forEach((k) => {
        const t = el('button', k === stampTab ? 'on' : '', k);
        t.onclick = (e) => { e.stopPropagation(); stampTab = k; draw(); };
        tabs.appendChild(t);
      });
      m.appendChild(tabs);
      m.appendChild(el('div', 'lbl2', 'Pick one, then tap on the board. Brush size changes its size.'));
      const g = el('div', 'stamp-grid');
      STAMP_SETS[stampTab].forEach((sym) => {
        const b = el('button', S.stamp === sym ? 'on' : '', sym);
        b.style.fontSize = sym.length > 2 ? '13px' : '22px';
        b.onclick = (e) => {
          e.stopPropagation();
          S.stamp = sym;
          m.classList.add('hidden');
          SB.setTool('stamp');
          toast(`Tap on the board to place ${sym}`, { ms: 1600 });
        };
        g.appendChild(b);
      });
      m.appendChild(g);
    };
    draw();
    $('.tool[data-tool="stamp"]').addEventListener('click', () => { $('#shapeMenu').classList.add('hidden'); draw(); m.classList.toggle('hidden'); });
  }

  function buildShapes() {
    const m = $('#shapeMenu');
    m.appendChild(el('div', 'lbl2', 'Drag on the board to draw. Turn on Dashed, Snap and Fill in the bottom bar.'));
    const g = el('div', 'stamp-grid');
    const add = (title, svg, onPick) => {
      const b = el('button'); b.title = title; b.innerHTML = svg;
      b.onclick = (e) => { e.stopPropagation(); m.classList.add('hidden'); onPick(); toast(`${title}: drag on the board`, { ms: 1500 }); };
      g.appendChild(b);
    };
    Object.entries(SB.SHAPES).forEach(([k, sh]) => {
      let d;
      if (sh.heart) d = 'M12 21C3 14 3 5.5 8 4.5c2-.3 3.4.8 4 2 .6-1.200 2-2.300 4-2C21 5.500 21 14 12 21Z';
      else d = sh.p.map(([u, v], i) => `${i ? 'L' : 'M'}${(2 + u * 20).toFixed(1)} ${(2 + v * 20).toFixed(1)}`).join('') + 'Z';
      add(sh.name, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="${d}"/></svg>`, () => { S.shapeKind = k; SB.setTool('shape'); });
    });
    add('Double arrow', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>', () => { S.both = true; SB.setTool('arrow'); });
    m.appendChild(g);
    $('.tool[data-tool="shape"]').addEventListener('click', () => { $('#stampMenu').classList.add('hidden'); m.classList.toggle('hidden'); });
  }

  // ---------- pen styles ----------
  function buildPens() {
    const m = $('#penMenu');
    const draw = () => {
      m.textContent = '';
      const col = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#888';
      SB.PENS.forEach(([id, name]) => {
        const b = el('button', 'pen-row' + (S.penStyle === id ? ' on' : ''));
        const c = el('canvas'); c.width = 240; c.height = 68;
        const x = c.getContext('2d'); x.scale(2, 2);
        const pts = []; for (let i = 0; i <= 44; i++) pts.push(8 + i * 2.5, 17 + Math.sin(i / 4.5) * 8);
        SB.drawObj(x, { type: 'pen', ps: id === 'normal' ? undefined : id, color: S.color && S.color.toLowerCase() !== '#ffffff' ? col : col, size: Math.max(3, Math.min(7, S.size)), pts });
        b.append(c, el('span', '', name));
        b.onclick = (e) => { e.stopPropagation(); S.penStyle = id; m.classList.add('hidden'); SB.setTool('pen'); toast(`${name} selected`, { ms: 1300 }); };
        m.appendChild(b);
      });
    };
    const btn = $('.tool[data-tool="pen"]');
    let was = false;
    btn.addEventListener('click', () => { was = S.tool === 'pen'; }, true);
    btn.addEventListener('click', () => {
      $('#stampMenu').classList.add('hidden'); $('#shapeMenu').classList.add('hidden');
      if (was) { draw(); m.classList.toggle('hidden'); } else m.classList.add('hidden');
    });
  }

  // ---------- wallpapers ----------
  function buildWallpapers() {
    $('#bgBtn').addEventListener('click', () => {
      const box = $('#bgGallery');
      box.textContent = '';
      SB.BG_LIST.forEach(([cat, items]) => {
        box.appendChild(el('h4', '', cat));
        const grid = el('div', 'bg-grid');
        items.forEach(([id, name]) => {
          const b = el('button', 'bgt' + (S.bg === id ? ' cur' : ''));
          const c = el('canvas'); c.width = 320; c.height = 180;
          const x = c.getContext('2d'); x.scale(0.2, 0.2);
          SB.paintBg(x, id);
          b.append(c, el('span', '', name));
          b.onclick = () => { SB.applyBg(id); emit('bg:set', id); closeModal('mBg'); };
          grid.appendChild(b);
        });
        box.appendChild(grid);
      });
    });
  }

  // ---------- reactions ----------
  function buildReactions() {
    const m = $('#reactMenu');
    ['👍', '🙋', '🤔', '👏', '😮', '❤️'].forEach((e) => {
      const b = el('button', '', e); b.title = 'Send ' + e;
      b.onclick = (ev) => { ev.stopPropagation(); emit('react', { e }); m.classList.add('hidden'); };
      m.appendChild(b);
    });
  }
  function floatEmoji({ e }) {
    const box = $('#floats');
    if (!box) return;
    const f = el('span', 'float', e);
    f.style.left = 6 + Math.random() * 84 + '%';
    box.appendChild(f);
    setTimeout(() => f.remove(), 3300);
  }

  // ---------- page sorter ----------
  async function openPages() {
    openModal('mPages');
    const grid = $('#pageGrid');
    grid.textContent = '';
    for (let i = 0; i < S.pages.length; i++) {
      const b = el('button', 'pg' + (i === S.cur ? ' cur' : ''));
      const c = await SB.pageCanvas(i, 0.3);
      b.append(c, el('span', '', `Page ${i + 1}`));
      b.onclick = () => { SB.goPage(i); closeModal('mPages'); };
      grid.appendChild(b);
    }
  }

  // ---------- random groups ----------
  let groups = [];
  function makeGroups() {
    const n = Math.max(2, Math.min(10, parseInt($('#groupN').value, 10) || 4));
    const students = people.filter((p) => p.role !== 'teacher').map((p) => p.name);
    const out = $('#groupOut');
    out.textContent = '';
    $('#groupPost').classList.add('hidden');
    if (students.length < 2) { out.appendChild(el('p', 'hint', 'Need at least 2 students on the board.')); return; }
    for (let i = students.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [students[i], students[j]] = [students[j], students[i]]; }
    groups = Array.from({ length: Math.min(n, students.length) }, () => []);
    students.forEach((nm, i) => groups[i % groups.length].push(nm));
    groups.forEach((g, i) => { const card = el('div', 'grp'); card.append(el('b', '', `Group ${i + 1}`), el('div', '', g.join(', '))); out.appendChild(card); });
    $('#groupPost').classList.remove('hidden');
  }
  async function postGroups() {
    closeModal('mGroups');
    const idx = await SB.addPage();
    if (idx === null) return toast('Page limit reached.');
    const ink = SB.ink(), cols = [BLUE, GREEN, ORANGE, PURPLE, RED];
    SB.addObj({ id: SB.uid(), ...tx(80, 40, 'Groups', 56, ink) }, idx);
    groups.forEach((g, i) => {
      const x = 80 + (i % 2) * 740, y = 150 + Math.floor(i / 2) * 230;
      SB.addObj({ id: SB.uid(), ...rc(x, y, x + 680, y + 190, cols[i % 5], 4, true) }, idx);
      SB.addObj({ id: SB.uid(), ...tx(x + 24, y + 16, `Group ${i + 1}`, 34, ink) }, idx);
      SB.addObj({ id: SB.uid(), ...tx(x + 24, y + 70, g.join(', '), 30, ink) }, idx);
    });
  }

  // ---------- recent boards (landing page) ----------
  const REC_KEY = 'sb_recent';
  const loadRecent = () => { try { return JSON.parse(SB.store.get(REC_KEY, '[]')); } catch { return []; } };
  const saveRecent = (l) => SB.store.set(REC_KEY, JSON.stringify(l.slice(0, 6)));
  function upsertRecent(code, patch) {
    const l = loadRecent();
    const i = l.findIndex((r) => r.code === code);
    const base = i >= 0 ? l.splice(i, 1)[0] : { code };
    l.unshift({ ...base, ...patch, t: Date.now() });
    saveRecent(l);
  }
  function renderRecent() {
    const l = loadRecent();
    const box = $('#recent');
    box.classList.toggle('hidden', !l.length);
    const list = $('#recentList');
    list.textContent = '';
    l.forEach((r) => {
      const item = el('div', 'rec');
      item.append(el('b', '', r.title || 'Untitled board'), el('small', '', r.code), el('span', r.role === 'teacher' ? 'role t' : 'role', r.role === 'teacher' ? 'Teacher' : 'Student'));
      item.onclick = () => { $('#codeInput').value = r.code; SB.joinBoard(r.code); };
      const x = el('button'); x.title = 'Remove'; x.appendChild(icon('close'));
      x.onclick = (e) => { e.stopPropagation(); saveRecent(loadRecent().filter((q) => q.code !== r.code)); renderRecent(); };
      item.appendChild(x);
      list.appendChild(item);
    });
  }

  // ---------- wiring ----------
  function wire() {
    buildPollForm(); buildTimerForm(); buildTemplates(); buildStamps(); buildShapes(); buildReactions(); buildPens(); buildWallpapers();

    $('#mPollBtn').onclick = () => { closeMenus(); openModal('mPoll'); };
    $('#mTimerBtn').onclick = () => { closeMenus(); openModal('mTimer'); };
    $('#mPickBtn').onclick = () => { closeMenus(); pickStudent(); };
    $('#mTplBtn').onclick = () => { closeMenus(); openModal('mTemplates'); };
    $('#mGroupBtn').onclick = () => { closeMenus(); $('#groupOut').textContent = ''; $('#groupPost').classList.add('hidden'); openModal('mGroups'); };
    $('#mHelpBtn').onclick = () => { closeMenus(); openModal('mHelp'); };
    $('#groupGo').onclick = makeGroups;
    $('#groupPost').onclick = postGroups;
    $('#pagesBtn').onclick = openPages;
    $('#pgAdd').onclick = async () => { closeModal('mPages'); emit('page:add', null); };
    $('#pollGo').onclick = startPoll;
    $('#pollQ').addEventListener('keydown', (e) => { if (e.key === 'Enter') startPoll(); });

    $('#peopleBtn').onclick = () => { if (SB.isTeacher()) $('#people').classList.toggle('hidden'); else toast(`${S.count} on this board`, { ms: 1400 }); };
    $('#peopleClose').onclick = () => $('#people').classList.add('hidden');
    $('#lowerAll').onclick = () => emit('hand:lower', { all: true });
    $('#pickBtn2').onclick = pickStudent;
    $('#pickAgain').onclick = pickStudent;
    $('#handBtn').onclick = () => { setHand(!handUp); emit('hand:toggle', { up: handUp }); if (handUp) toast('✋ Hand raised. The teacher can see it.', { ms: 1800 }); };

    $('#copyLink').onclick = () => copyText($('#joinUrl').value, 'Link copied 🔗');
    $('#copyCode').onclick = () => copyText(S.code, 'Code copied');
    $('#joinUrl').addEventListener('input', (e) => { clearTimeout(qrT); qrT = setTimeout(() => drawQr(e.target.value || ' '), 250); });
    $('#codeChip').onclick = openInvite;
  }

  hook('net:react', floatEmoji);
  hook('net:poll:state', (v) => { if (v && pollView && v.id !== pollView.id) hiddenPoll = null; renderPoll(v); });
  hook('net:timer:state', setTimer);
  hook('net:people', (l) => { people = l || []; renderPeople(); });
  hook('net:hand:raised', ({ name }) => { toast(`✋ ${name} raised a hand`, { ms: 3000 }); });
  hook('net:hand:state', setHand);
  hook('net:picked', showPicked);

  hook('state', (st) => {
    pollView = null; hiddenPoll = null;
    renderPoll(st.poll);
    setTimer(st.timer);
    people = st.people || [];
    renderPeople();
    setHand(st.hand);
  });
  hook('enter', ({ code, role, title }) => {
    upsertRecent(code, { role, title });
    $('#people').classList.add('hidden');
  });
  hook('title', (t) => { if (S.code) upsertRecent(S.code, { title: t, role: S.role }); });
  hook('leave', () => {
    renderPoll(null); setTimer(null); people = []; setHand(false);
    $('#people').classList.add('hidden'); $('#stampMenu').classList.add('hidden'); $('#shapeMenu').classList.add('hidden'); $('#penMenu').classList.add('hidden');
    renderRecent();
  });
  hook('init', () => { wire(); renderRecent(); });

  SB.openInvite = openInvite;
  SB.start();
})();
