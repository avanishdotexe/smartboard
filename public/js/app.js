/* SmartBoard 2.0 client: canvas engine, selection tools, smart shapes, networking.
 * Extra UI (poll, timer, people, templates, invite...) lives in features.js and talks to this file through window.SB. */
(() => {
  'use strict';

  // ---------- constants ----------
  const W = 1600, H = 900; // logical board size (everyone sees the same 16:9 board)
  const RES = Math.min(2, window.devicePixelRatio || 1);
  const COLORS = ['#1f2937', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
  const INK = '#1f2937';
  const BG = {
    white: { color: '#ffffff', dark: false },
    grid: { color: '#ffffff', dark: false },
    ruled: { color: '#fffdf4', dark: false },
    dots: { color: '#ffffff', dark: false },
    axes: { color: '#ffffff', dark: false },
    chalk: { color: '#1b3d31', dark: true },
    dark: { color: '#10131c', dark: true },
    paper: { color: '#fbf6ea', dark: false },
    kraft: { color: '#c9a66b', dark: false },
    mm: { color: '#ffffff', dark: false },
    hex: { color: '#ffffff', dark: false },
    iso: { color: '#ffffff', dark: false },
    polar: { color: '#ffffff', dark: false },
    music: { color: '#fffef9', dark: false },
    fourline: { color: '#ffffff', dark: false },
    blueprint: { color: '#12345b', dark: true },
    chess: { color: '#f1efe9', dark: false },
    sunrise: { color: '#ffd9a8', dark: false },
    sunset: { color: '#2a1b5c', dark: true },
    ocean: { color: '#0b5a86', dark: true },
    forest: { color: '#0b4a24', dark: true },
    aurora: { color: '#060a1c', dark: true },
    stars: { color: '#070b1e', dark: true },
    pastel: { color: '#ffe7f3', dark: false },
    mint: { color: '#dcfce7', dark: false },
    peach: { color: '#ffe9d9', dark: false },
    wood: { color: '#b98a5b', dark: false },
    cornell: { color: '#ffffff', dark: false },
    numline: { color: '#ffffff', dark: false },
    table: { color: '#ffffff', dark: false },
    calendar: { color: '#ffffff', dark: false },
    kwl: { color: '#ffffff', dark: false },
    storyboard: { color: '#fffef9', dark: false },
    venn2: { color: '#ffffff', dark: false },
    sky: { color: '#bfe3ff', dark: false },
    lavender: { color: '#ece6ff', dark: false },
    slate: { color: '#1e293b', dark: true },
    sand: { color: '#f5e6c8', dark: false },
    galaxy: { color: '#0b0620', dark: true },
  };
  const BG_LIST = [
    ['Basic', [['white', 'White'], ['grid', 'Grid'], ['ruled', 'Ruled lines'], ['dots', 'Dots'], ['axes', 'Graph axes'], ['chalk', 'Chalkboard'], ['dark', 'Dark']]],
    ['Study', [['paper', 'Cream paper'], ['kraft', 'Kraft paper'], ['mm', 'Graph paper (mm)'], ['hex', 'Hexagons (chemistry)'], ['iso', 'Isometric dots'], ['polar', 'Polar grid'], ['music', 'Music staff'], ['fourline', 'English 4-line'], ['blueprint', 'Blueprint'], ['chess', 'Chess board']]],
    ['Teaching', [['cornell', 'Cornell notes'], ['numline', 'Number lines'], ['table', 'Table (rows x columns)'], ['calendar', 'Month calendar'], ['kwl', 'K-W-L chart'], ['storyboard', 'Storyboard (6 frames)'], ['venn2', 'Venn diagram (2 sets)']]],
    ['Wallpapers', [['sky', 'Blue sky'], ['lavender', 'Lavender'], ['slate', 'Slate'], ['sand', 'Sand'], ['galaxy', 'Galaxy'], ['sunrise', 'Sunrise'], ['sunset', 'Sunset'], ['ocean', 'Ocean'], ['forest', 'Forest'], ['aurora', 'Aurora'], ['stars', 'Night sky'], ['pastel', 'Pastel pink'], ['mint', 'Mint'], ['peach', 'Peach'], ['wood', 'Wood desk']]],
  ];
  const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const grad = (ctx, stops, x0 = 0, y0 = 0, x1 = 0, y1 = H) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };
  const WALL = {
    paper(ctx) {
      const r = rng(11); ctx.fillStyle = 'rgba(120,90,40,.07)';
      for (let i = 0; i < 1400; i++) { ctx.beginPath(); ctx.arc(r() * W, r() * H, 0.5 + r() * 1.1, 0, 7); ctx.fill(); }
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, W * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(120,80,20,.12)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    },
    kraft(ctx) {
      const r = rng(5);
      for (let i = 0; i < 700; i++) {
        ctx.strokeStyle = r() > 0.5 ? 'rgba(90,60,20,.16)' : 'rgba(255,235,190,.2)'; ctx.lineWidth = 1;
        const x = r() * W, y = r() * H, a = r() * 6.28, l = 6 + r() * 22;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      }
    },
    mm(ctx) {
      for (let x = 0; x <= W; x += 10) { ctx.strokeStyle = x % 100 === 0 ? 'rgba(214,76,76,.55)' : x % 50 === 0 ? 'rgba(214,76,76,.35)' : 'rgba(214,76,76,.14)'; ctx.lineWidth = x % 100 === 0 ? 1.6 : 1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 10) { ctx.strokeStyle = y % 100 === 0 ? 'rgba(214,76,76,.55)' : y % 50 === 0 ? 'rgba(214,76,76,.35)' : 'rgba(214,76,76,.14)'; ctx.lineWidth = y % 100 === 0 ? 1.6 : 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    },
    hex(ctx) {
      const R = 44, w = Math.sqrt(3) * R; ctx.strokeStyle = 'rgba(13,148,136,.4)'; ctx.lineWidth = 1.6;
      for (let row = -1; row < H / (R * 1.5) + 1; row++) for (let col = -1; col < W / w + 1; col++) {
        const cx = col * w + (row % 2 ? w / 2 : 0), cy = row * R * 1.5;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); }
        ctx.closePath(); ctx.stroke();
      }
    },
    iso(ctx) {
      ctx.fillStyle = 'rgba(79,70,229,.45)'; const dx = 48, dy = 41.57;
      for (let row = 0; row * dy < H + dy; row++) for (let x = (row % 2) * (dx / 2); x < W + dx; x += dx) { ctx.beginPath(); ctx.arc(x, row * dy, 2.2, 0, 7); ctx.fill(); }
    },
    polar(ctx) {
      const cx = W / 2, cy = H / 2;
      ctx.lineWidth = 1.2;
      for (let r = 50; r < 900; r += 50) { ctx.strokeStyle = r % 250 === 0 ? 'rgba(79,70,229,.5)' : 'rgba(79,70,229,.2)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); }
      for (let a = 0; a < 360; a += 15) { ctx.strokeStyle = a % 90 === 0 ? 'rgba(30,41,59,.65)' : 'rgba(79,70,229,.22)'; ctx.lineWidth = a % 90 === 0 ? 2 : 1; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos((a * Math.PI) / 180) * 1000, cy + Math.sin((a * Math.PI) / 180) * 1000); ctx.stroke(); }
    },
    music(ctx) {
      ctx.strokeStyle = 'rgba(30,41,59,.75)'; ctx.lineWidth = 1.6;
      for (let k = 0; k < 6; k++) {
        const y0 = 70 + k * 140;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(60, y0 + i * 17); ctx.lineTo(W - 60, y0 + i * 17); ctx.stroke(); }
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(60, y0); ctx.lineTo(60, y0 + 68); ctx.moveTo(W - 60, y0); ctx.lineTo(W - 60, y0 + 68); ctx.stroke(); ctx.lineWidth = 1.6;
      }
    },
    fourline(ctx) {
      for (let k = 0; k < 6; k++) {
        const y0 = 70 + k * 138;
        [[0, 'rgba(59,130,246,.6)', []], [28, 'rgba(59,130,246,.45)', [10, 8]], [56, 'rgba(239,68,68,.65)', []], [84, 'rgba(59,130,246,.6)', []]].forEach(([dy, c, d]) => {
          ctx.strokeStyle = c; ctx.lineWidth = 1.8; ctx.setLineDash(d); ctx.beginPath(); ctx.moveTo(40, y0 + dy); ctx.lineTo(W - 40, y0 + dy); ctx.stroke();
        });
        ctx.setLineDash([]);
      }
    },
    blueprint(ctx) {
      for (let x = 0; x <= W; x += 40) { ctx.strokeStyle = x % 200 === 0 ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.12)'; ctx.lineWidth = x % 200 === 0 ? 1.6 : 1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y <= H; y += 40) { ctx.strokeStyle = y % 200 === 0 ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.12)'; ctx.lineWidth = y % 200 === 0 ? 1.6 : 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    },
    chess(ctx) {
      ctx.fillStyle = '#c9c2ad';
      for (let r = 0; r < 9; r++) for (let c = 0; c < 16; c++) if ((r + c) % 2) ctx.fillRect(c * 100, r * 100, 100, 100);
    },
    sunrise(ctx) {
      grad(ctx, [[0, '#ffe3b3'], [0.55, '#ffb59a'], [1, '#e9a8f0']]);
      const g = ctx.createRadialGradient(1250, 760, 10, 1250, 760, 420); g.addColorStop(0, 'rgba(255,255,230,.95)'); g.addColorStop(0.25, 'rgba(255,214,130,.7)'); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    },
    sunset(ctx) {
      grad(ctx, [[0, '#1e1b4b'], [0.45, '#6d28d9'], [0.75, '#fb7185'], [1, '#fdba74']]);
      ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(800, 900, 190, Math.PI, 0); ctx.fill();
      const r = rng(3); ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 70; i++) { ctx.beginPath(); ctx.arc(r() * W, r() * 380, r() * 1.8 + 0.4, 0, 7); ctx.fill(); }
    },
    ocean(ctx) {
      grad(ctx, [[0, '#0c4a6e'], [0.6, '#0284c7'], [1, '#38bdf8']]);
      for (let k = 0; k < 9; k++) { ctx.strokeStyle = `rgba(255,255,255,${0.05 + k * 0.012})`; ctx.lineWidth = 3; ctx.beginPath(); for (let x = 0; x <= W; x += 20) { const y = 380 + k * 56 + Math.sin(x / 90 + k) * 14; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    },
    forest(ctx) {
      grad(ctx, [[0, '#052e16'], [1, '#15803d']]);
      const r = rng(9);
      for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = ['rgba(2,44,20,.35)', 'rgba(2,44,20,.5)', 'rgba(2,30,14,.7)'][layer];
        for (let x = -40; x < W + 60; x += 70 + r() * 40) { const h = 140 + layer * 60 + r() * 90, y = H - layer * 10; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 45, y - h); ctx.lineTo(x + 90, y); ctx.fill(); }
      }
    },
    aurora(ctx) {
      [[300, 300, '16,185,129'], [800, 220, '56,189,248'], [1250, 330, '168,85,247']].forEach(([x, y, c]) => { const g = ctx.createRadialGradient(x, y, 10, x, y, 520); g.addColorStop(0, `rgba(${c},.55)`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); });
      const r = rng(21); ctx.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 120; i++) { ctx.beginPath(); ctx.arc(r() * W, r() * H, r() * 1.4 + 0.3, 0, 7); ctx.fill(); }
    },
    stars(ctx) {
      grad(ctx, [[0, '#04060f'], [1, '#111a3d']]);
      const r = rng(77);
      for (let i = 0; i < 420; i++) { const a = 0.3 + r() * 0.7; ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(r() * W, r() * H, r() * 1.6 + 0.3, 0, 7); ctx.fill(); }
      for (let i = 0; i < 6; i++) { const x = r() * W, y = r() * H, g = ctx.createRadialGradient(x, y, 0, x, y, 26); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 26, y - 26, 52, 52); }
    },
    pastel(ctx) { grad(ctx, [[0, '#ffe4f1'], [0.5, '#e0f2fe'], [1, '#ede9fe']], 0, 0, W, H); },
    mint(ctx) { grad(ctx, [[0, '#dcfce7'], [1, '#cffafe']], 0, 0, W, H); },
    peach(ctx) { grad(ctx, [[0, '#fff1e6'], [1, '#ffd9cc']], 0, 0, W, H); },
    wood(ctx) {
      const r = rng(4);
      for (let i = 0; i < 160; i++) { const y = r() * H; ctx.strokeStyle = `rgba(70,40,15,${0.06 + r() * 0.12})`; ctx.lineWidth = 1 + r() * 2.5; ctx.beginPath(); for (let x = 0; x <= W; x += 40) { const yy = y + Math.sin(x / 140 + i) * 5; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); }
      for (let y = 150; y < H; y += 150) { ctx.fillStyle = 'rgba(40,22,8,.45)'; ctx.fillRect(0, y - 2, W, 4); }
    },

    cornell(ctx) {
      ctx.strokeStyle = 'rgba(59,130,246,.28)'; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let y = 190; y < 700; y += 46) { ctx.moveTo(420, y); ctx.lineTo(W - 30, y); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(30,41,59,.7)'; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(30, 130); ctx.lineTo(W - 30, 130); ctx.moveTo(420, 130); ctx.lineTo(420, 720); ctx.moveTo(30, 720); ctx.lineTo(W - 30, 720); ctx.stroke();
      ctx.fillStyle = 'rgba(30,41,59,.5)'; ctx.font = `700 24px ${FONTS.sans}`; ctx.textBaseline = 'alphabetic';
      ctx.fillText('Topic / Date:', 40, 100); ctx.fillText('Cue / Questions', 40, 170); ctx.fillText('Notes', 440, 170); ctx.fillText('Summary', 40, 760);
    },
    numline(ctx) {
      ctx.strokeStyle = '#334155'; ctx.fillStyle = '#334155'; ctx.lineWidth = 3; ctx.font = `600 18px ${FONTS.sans}`; ctx.textAlign = 'center';
      for (let k = 0; k < 4; k++) {
        const y = 150 + k * 210, x0 = 70, x1 = W - 70, step = (x1 - x0) / 20;
        ctx.beginPath(); ctx.moveTo(x0 - 30, y); ctx.lineTo(x1 + 30, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1 + 36, y); ctx.lineTo(x1 + 18, y - 8); ctx.lineTo(x1 + 18, y + 8); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x0 - 36, y); ctx.lineTo(x0 - 18, y - 8); ctx.lineTo(x0 - 18, y + 8); ctx.closePath(); ctx.fill();
        for (let i = 0; i <= 20; i++) {
          const x = x0 + i * step, big = i % 5 === 0;
          ctx.beginPath(); ctx.moveTo(x, y - (big ? 14 : 8)); ctx.lineTo(x, y + (big ? 14 : 8)); ctx.stroke();
          if (big || i === 10) ctx.fillText(String(i - 10), x, y + 40);
        }
      }
    },
    table(ctx) {
      const x0 = 80, y0 = 80, cw = (W - 160) / 5, rh = (H - 160) / 7;
      ctx.fillStyle = 'rgba(99,102,241,.14)'; ctx.fillRect(x0, y0, cw * 5, rh);
      ctx.strokeStyle = 'rgba(30,41,59,.75)'; ctx.lineWidth = 2.2; ctx.beginPath();
      for (let c = 0; c <= 5; c++) { ctx.moveTo(x0 + c * cw, y0); ctx.lineTo(x0 + c * cw, y0 + rh * 7); }
      for (let r = 0; r <= 7; r++) { ctx.moveTo(x0, y0 + r * rh); ctx.lineTo(x0 + cw * 5, y0 + r * rh); }
      ctx.stroke(); ctx.lineWidth = 4; ctx.strokeRect(x0, y0, cw * 5, rh * 7);
    },
    calendar(ctx) {
      const x0 = 60, y0 = 150, cw = (W - 120) / 7, rh = (H - 190) / 5;
      ctx.fillStyle = 'rgba(244,114,60,.9)'; ctx.fillRect(x0, 60, cw * 7, 56);
      ctx.fillStyle = '#fff'; ctx.font = `700 24px ${FONTS.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d, i) => ctx.fillText(d, x0 + cw * (i + 0.5), 88));
      ctx.strokeStyle = 'rgba(30,41,59,.55)'; ctx.lineWidth = 1.8; ctx.beginPath();
      for (let c = 0; c <= 7; c++) { ctx.moveTo(x0 + c * cw, 116); ctx.lineTo(x0 + c * cw, 116 + rh * 5 + 34); }
      for (let r = 0; r <= 5; r++) { ctx.moveTo(x0, 150 + r * rh); ctx.lineTo(x0 + cw * 7, 150 + r * rh); }
      ctx.moveTo(x0, 116); ctx.lineTo(x0 + cw * 7, 116); ctx.stroke();
    },
    kwl(ctx) {
      const cols = [['K  What I Know', '34,197,94'], ['W  What I Want to know', '59,130,246'], ['L  What I Learned', '249,115,22']];
      const cw = (W - 120) / 3;
      cols.forEach(([t, c], i) => {
        const x = 60 + i * cw;
        ctx.fillStyle = `rgba(${c},.9)`; ctx.fillRect(x + 6, 60, cw - 12, 70);
        ctx.fillStyle = `rgba(${c},.08)`; ctx.fillRect(x + 6, 130, cw - 12, H - 190);
        ctx.strokeStyle = `rgba(${c},.8)`; ctx.lineWidth = 3; ctx.strokeRect(x + 6, 60, cw - 12, H - 120);
        ctx.fillStyle = '#fff'; ctx.font = `800 30px ${FONTS.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + cw / 2, 96);
      });
    },
    storyboard(ctx) {
      const fw = 470, fh = 290;
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const x = 60 + c * (fw + 45), y = 50 + r * (fh + 120);
        ctx.strokeStyle = 'rgba(30,41,59,.8)'; ctx.lineWidth = 3.5; ctx.strokeRect(x, y, fw, fh);
        ctx.fillStyle = 'rgba(30,41,59,.5)'; ctx.font = `700 22px ${FONTS.sans}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(r * 3 + c + 1), x + 10, y - 8);
        ctx.strokeStyle = 'rgba(59,130,246,.35)'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let k = 1; k <= 3; k++) { ctx.moveTo(x, y + fh + k * 28); ctx.lineTo(x + fw, y + fh + k * 28); }
        ctx.stroke();
      }
    },
    venn2(ctx) {
      ctx.lineWidth = 5;
      [[560, '59,130,246'], [1040, '239,68,68']].forEach(([cx, c]) => { ctx.fillStyle = `rgba(${c},.12)`; ctx.strokeStyle = `rgba(${c},.8)`; ctx.beginPath(); ctx.arc(cx, 460, 340, 0, 7); ctx.fill(); ctx.stroke(); });
      ctx.fillStyle = 'rgba(30,41,59,.5)'; ctx.font = `700 28px ${FONTS.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('Only A', 380, 70); ctx.fillText('Only B', 1220, 70); ctx.fillText('Both', 800, 70);
    },
    sky(ctx) {
      grad(ctx, [[0, '#6cc0ff'], [1, '#e3f4ff']]);
      const r = rng(31); ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 9; i++) { const x = r() * W, y = 60 + r() * 560, s = 0.7 + r() * 0.9; [[0, 0, 46], [44, -14, 56], [96, 0, 44], [50, 14, 50]].forEach(([dx, dy, rad]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, rad * s, 0, 7); ctx.fill(); }); }
    },
    lavender(ctx) { grad(ctx, [[0, '#f1ecff'], [1, '#d9cdff']], 0, 0, W, H); },
    slate(ctx) { grad(ctx, [[0, '#273449'], [1, '#0f172a']], 0, 0, W, H); },
    sand(ctx) {
      grad(ctx, [[0, '#f8ecd2'], [1, '#e9cf9f']]);
      ctx.strokeStyle = 'rgba(150,110,50,.12)'; ctx.lineWidth = 2;
      for (let k = 0; k < 14; k++) { ctx.beginPath(); for (let x = 0; x <= W; x += 30) { const y = 80 + k * 62 + Math.sin(x / 120 + k * 1.3) * 16; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
    },
    galaxy(ctx) {
      grad(ctx, [[0, '#0b0620'], [1, '#1b0f3a']]);
      [[400, 300, '168,85,247', 520], [1200, 600, '59,130,246', 560], [800, 450, '236,72,153', 380]].forEach(([x, y, c, rr]) => { const g = ctx.createRadialGradient(x, y, 10, x, y, rr); g.addColorStop(0, `rgba(${c},.38)`); g.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); });
      const r = rng(99); for (let i = 0; i < 330; i++) { ctx.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.75})`; ctx.beginPath(); ctx.arc(r() * W, r() * H, r() * 1.5 + 0.3, 0, 7); ctx.fill(); }
    },
  };

  const FONTS = {
    sans: "'Plus Jakarta Sans','Noto Sans Devanagari',sans-serif",
    hand: "'Kalam','Noto Sans Devanagari',cursive",
  };
  const NOTE_COLORS = ['#fde68a', '#bbf7d0', '#bae6fd', '#fbcfe8', '#ddd6fe', '#fed7aa'];
  const GEOM = ['x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2', 'fs'];
  const SHAPES = (() => {
    const poly = (n, rot = -Math.PI / 2) => Array.from({ length: n }, (_, i) => [0.5 + 0.5 * Math.cos(rot + (i * 2 * Math.PI) / n), 0.5 + 0.5 * Math.sin(rot + (i * 2 * Math.PI) / n)]);
    const star = Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 0.2 : 0.5, a = -Math.PI / 2 + (i * Math.PI) / 5; return [0.5 + r * Math.cos(a) * 1.0, 0.5 + r * Math.sin(a)]; });
    return {
      triangle: { name: 'Triangle', p: [[0.5, 0], [1, 1], [0, 1]] },
      rtri: { name: 'Right triangle', p: [[0, 0], [1, 1], [0, 1]] },
      diamond: { name: 'Diamond', p: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]] },
      pentagon: { name: 'Pentagon', p: poly(5) },
      hexagon: { name: 'Hexagon', p: poly(6, 0) },
      trapezoid: { name: 'Trapezoid', p: [[0.2, 0], [0.8, 0], [1, 1], [0, 1]] },
      para: { name: 'Parallelogram', p: [[0.25, 0], [1, 0], [0.75, 1], [0, 1]] },
      star: { name: 'Star', p: star },
      cross: { name: 'Plus', p: [[0.35, 0], [0.65, 0], [0.65, 0.35], [1, 0.35], [1, 0.65], [0.65, 0.65], [0.65, 1], [0.35, 1], [0.35, 0.65], [0, 0.65], [0, 0.35], [0.35, 0.35]] },
      rarrow: { name: 'Block arrow', p: [[0, 0.3], [0.6, 0.3], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.7], [0, 0.7]] },
      heart: { name: 'Heart', heart: true, p: [[0.5, 0.95], [0.05, 0.45], [0.2, 0.05], [0.5, 0.25], [0.8, 0.05], [0.95, 0.45]] },
    };
  })();
  const PENS = [['normal', 'Pen'], ['pencil', 'Pencil'], ['marker', 'Marker'], ['brush', 'Brush'], ['calli', 'Calligraphy'], ['neon', 'Neon glow'], ['rainbow', 'Rainbow'], ['dotted', 'Dotted'], ['dashed', 'Dashed']];
  const THEMES = [
    { id: 'ink', name: 'Ink', meta: '#0b0f17' },
    { id: 'paper', name: 'Paper', meta: '#f4efe6' },
    { id: 'ocean', name: 'Ocean', meta: '#06202b' },
    { id: 'forest', name: 'Forest', meta: '#0c1a14' },
    { id: 'sunset', name: 'Sunset', meta: '#1c1230' },
    { id: 'mint', name: 'Mint', meta: '#e8f5ef' },
    { id: 'chalk', name: 'Blackboard', meta: '#1d3a2f' },
  ];
  const FEATURE_EVENTS = ['react', 'poll:state', 'timer:state', 'people', 'hand:raised', 'hand:state', 'picked', 'room:title', 'call:state', 'rtc:joined', 'rtc:left', 'rtc:sig', 'rtc:ctl', 'ov:set', 'ask:state', 'break:state', 'chat:msg', 'chat:on', 'chat:clear', 'confuse:state', 'confuse:mine', 'cheer', 'lb:state'];

  const ICONS = {
    stretch: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4M3 5v14M21 5v14"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.600 13.500 6.800 4M15.400 6.500l-6.800 4"/>',
    logo: '<rect x="3" y="4" width="18" height="13" rx="2.5"/><path d="M8 21h8M12 17v4"/><path d="M7 12l3-3 2.5 2.5L16 8"/>',
    select: '<path d="m5 3 14 8-6 1.5L10 19Z"/><path d="m13 13 5 6"/>',
    lasso: '<path stroke-dasharray="3 2.6" d="M12 3.5c4.7 0 8.5 1.9 8.5 4.4s-3.8 4.4-8.5 4.4-8.5-2-8.5-4.4S7.300 3.500 12 3.500z"/><path d="M8.400 12c-.2 2.200-1.700 3.400-3.300 3.800"/><circle cx="4.400" cy="18.600" r="2"/>',
    pen: '<path d="M17 3.5a2.1 2.1 0 0 1 3 3L8 18.5 3.5 20 5 15.5Z"/><path d="m14.5 6 3.5 3.500"/>',
    hl: '<path d="m14 4 6 6-8 8H6.500L4 15.500Z"/><path d="m11 7 6 6"/><path d="M3 21h10" stroke-width="3.200"/>',
    eraser: '<path d="M19 20H8.5l-4.2-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4L11.5 20"/><path d="m18 13.3-6.3-6.3"/>',
    line: '<path d="M4 20 20 4"/><circle cx="4" cy="20" r="1.600"/><circle cx="20" cy="4" r="1.600"/>',
    arrow: '<path d="M5 19 19 5"/><path d="M9 5h10v10"/>',
    rect: '<rect x="3.500" y="5.500" width="17" height="13" rx="1.500"/>',
    ellipse: '<circle cx="12" cy="12" r="8"/>',
    text: '<path d="M4 6V4h16v2"/><path d="M12 4v16"/><path d="M8.500 20h7"/>',
    stamp: '<path d="m12 3 2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.300 6.800 19.100l1-5.800L3.500 9.200l5.900-.8Z"/>',
    laser: '<circle cx="12" cy="12" r="2.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 9"/>',
    pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M8.500 17v-4h1.300a1.200 1.200 0 0 1 0 2.400H8.500M13 17v-4h1.200a2 2 0 0 1 0 4Z" stroke-width="1.400"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    exit: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    fill: '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2a2 2 0 0 0 2.8 0Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>',
    wand: '<path d="M4 4h5v5H4zM15 15h5v5h-5z" stroke-dasharray="2.500 2"/><circle cx="17.500" cy="6.500" r="3.500"/><path d="m5 19 5-5"/><path d="m8 20 2-1M4 16l1-2"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2 0-1.5-1.2-1.6-1.2-3a2 2 0 0 1 2-2H17a4 4 0 0 0 4-4c0-4-4-7-9-7Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
    fullscreen: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0v4M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.4L3.4 16a2 2 0 0 1 3-2.6L8 15"/>',
    poll: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
    template: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M21 17v4"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    eyedrop: '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="15.5" cy="8.5" r="1"/><circle cx="8.5" cy="15.5" r="1"/>',
    save: '<path d="M5 3h11l4 4v14H5Z"/><path d="M8 3v6h7V3M8 21v-7h8v7"/>',
    shapes: '<path d="M8 3 14 14H2Z"/><circle cx="17" cy="7" r="4"/><rect x="12" y="15" width="9" height="6" rx="1"/>',
    dash: '<path d="M3 12h3M10.500 12h3M18 12h3" stroke-width="2.800"/>',
    snap: '<path d="M4 4h16v16H4ZM4 9.300h16M4 14.700h16M9.300 4v16M14.700 4v16" stroke-width="1.600"/>',
    present: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="m10 8 5 3-5 3Z"/><path d="M8 21h8"/>',
    spot: '<path d="M9 3h6l3 7H6Z"/><path d="M12 10v2"/><path d="m6 20 3-5M18 20l-3-5M12 21v-6"/>',
    note: '<path d="M4 4h16v11l-5 5H4Z"/><path d="M15 20v-5h5"/><path d="M8 9h8M8 13h4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14a5 5 0 0 0 8 0M9 9.5v.01M15 9.5v.01"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.300c-.7.4-1 1-1 1.700M12 17v.01"/>',
    chart: '<path d="M4 4v16h16"/><path d="m7 15 4-5 3 3 5-7"/>',
    chat: '<path d="M4 5h16v11H9l-5 4Z"/><path d="M8 9h8M8 12h5"/>',
    ruler: '<path d="M3 16 16 3l5 5L8 21Z"/><path d="m7 12 2 2M10 9l2 2M13 6l2 2"/>',
    move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    curtain: '<path d="M3 4h18"/><path d="M5 4v10c0 2 2 3 3 3h8c1 0 3-1 3-3V4"/><path d="M12 4v13M9 21h6"/>',
  };

  // ---------- helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage may be blocked */ } },
  };

  const H_ = {};
  const hook = (n, f) => { (H_[n] = H_[n] || []).push(f); };
  const fire = (n, d) => (H_[n] || []).forEach((f) => { try { f(d); } catch (e) { console.error(e); } });

  const svgOf = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  function paintIcons(root = document) {
    $$('[data-icon]', root).forEach((el) => { if (ICONS[el.dataset.icon]) el.innerHTML = svgOf(el.dataset.icon); });
  }

  function toast(msg, opt = {}) {
    const box = $('#toasts');
    let el = opt.id && box.querySelector(`[data-id="${opt.id}"]`);
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      if (opt.id) el.dataset.id = opt.id;
      box.appendChild(el);
    }
    el.textContent = msg;
    clearTimeout(el._t);
    if (opt.ms !== 0) el._t = setTimeout(() => el.remove(), opt.ms || 2600);
  }
  const toastDone = (id) => { const el = $(`#toasts [data-id="${id}"]`); if (el) el.remove(); };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some((s) => s.src === src)) return resolve();
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Could not load script: ' + src));
      document.head.appendChild(s);
    });
  }

  // ---------- modals ----------
  const modalStack = [];
  function openModal(id) {
    const m = $('#' + id);
    if (!m) return;
    m.classList.remove('hidden');
    if (!modalStack.includes(id)) modalStack.push(id);
    const f = $('input:not([type=hidden]):not([type=radio]), button.primary', m);
    if (f && window.innerWidth > 700) setTimeout(() => f.focus(), 30);
  }
  function closeModal(id) {
    const m = $('#' + id);
    if (m) m.classList.add('hidden');
    const i = modalStack.indexOf(id);
    if (i >= 0) modalStack.splice(i, 1);
  }
  let confirmDone = null;
  function uiConfirm(msg, okLabel = 'Yes', danger = false) {
    $('#confirmMsg').textContent = msg;
    const yes = $('#confirmYes');
    yes.textContent = okLabel;
    yes.classList.toggle('danger', danger);
    openModal('mConfirm');
    return new Promise((resolve) => { confirmDone = resolve; });
  }
  function settleConfirm(v) { closeModal('mConfirm'); if (confirmDone) { const f = confirmDone; confirmDone = null; f(v); } }

  // ---------- theme ----------
  function applyTheme(id) {
    S.lassoAc = null;
    const t = THEMES.find((x) => x.id === id) || THEMES[0];
    document.documentElement.setAttribute('data-sb-theme', t.id);
    const m = $('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t.meta);
    store.set('sb_theme', t.id);
    return t;
  }
  function cycleTheme() {
    const cur = document.documentElement.getAttribute('data-sb-theme') || 'ink';
    const i = THEMES.findIndex((x) => x.id === cur);
    const t = applyTheme(THEMES[(i + 1) % THEMES.length].id);
    toast(`Theme: ${t.name}`, { id: 'theme', ms: 1400 });
  }

  // ---------- state ----------
  const S = {
    socket: null, code: null, role: null, joined: false, name: '',
    pages: [[]], bgs: [], cur: 0, bg: 'white', studentDraw: false, count: 1, title: '',
    tool: 'pen', penStyle: 'normal', present: false, noteIdx: 0, color: INK, size: 4, fill: false, dash: false, both: false, snap: false, shapeKind: 'triangle', font: 'sans', smart: false, stamp: '⭐',
    eSize: 12, vz: 1, vx: 0, vy: 0, base: 1, strokeErase: false, curtain: null, erasing: false, scale: 1, drawing: null, tbox: null, laserOn: false, sel: null, grp: null, lasso: null, xf: null,
    imgs: new Map(),
  };
  const isTeacher = () => S.role === 'teacher';
  const inBrk = () => !isTeacher() && !!S.brk && S.brk.page != null;
  const canDraw = () => isTeacher() || (inBrk() ? S.cur === S.brk.page : S.studentDraw);
  const findObj = (page, id) => (S.pages[page] || []).find((o) => o.id === id);

  // ---------- canvas ----------
  const bgC = $('#bg'), bC = $('#board'), stage = $('#stage');
  const bgX = bgC.getContext('2d'), X = bC.getContext('2d');
  [bgC, bC].forEach((c) => { c.width = W * RES; c.height = H * RES; });
  bgX.setTransform(RES, 0, 0, RES, 0, 0);
  X.setTransform(RES, 0, 0, RES, 0, 0);

  function fit() {
    const area = $('#stageArea');
    const aw = area.clientWidth, ah = area.clientHeight;
    if (!aw || !ah) return;
    let w = aw, h = (aw * 9) / 16;
    if (h > ah) { h = ah; w = (ah * 16) / 9; }
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    S.base = w / W; S.scale = S.base * S.vz;
    placeSel(); placeOverlays();
  }
  // ---------- zoom and pan (local to each person, not synced) ----------
  function applyView() {
    S.vz = Math.max(1, Math.min(6, S.vz));
    S.vx = Math.max(0, Math.min(W - W / S.vz, S.vx)); S.vy = Math.max(0, Math.min(H - H / S.vz, S.vy));
    if (S.vz === 1) { S.vx = 0; S.vy = 0; }
    S.scale = (S.base || 1) * S.vz;
    const k = RES * S.vz;
    bgX.setTransform(k, 0, 0, k, -S.vx * k, -S.vy * k);
    X.setTransform(k, 0, 0, k, -S.vx * k, -S.vy * k);
    if (S.bg) paintBg(bgX, S.bg);
    const zp = $('#zPct'); if (zp) zp.textContent = Math.round(S.vz * 100) + '%';
    stage.classList.toggle('zoomed', S.vz > 1);
    render(); placeOverlays();
  }
  function zoomAt(z, cx, cy) {
    const r = bC.getBoundingClientRect();
    const fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height;
    const bx = S.vx + fx * (W / S.vz), by = S.vy + fy * (H / S.vz);
    S.vz = Math.max(1, Math.min(6, z));
    S.vx = bx - fx * (W / S.vz); S.vy = by - fy * (H / S.vz);
    applyView();
  }
  function zoomCenter(f) { const r = bC.getBoundingClientRect(); zoomAt(S.vz * f, r.left + r.width / 2, r.top + r.height / 2); }
  function panBy(dx, dy) { S.vx -= dx / S.scale; S.vy -= dy / S.scale; applyView(); }
  function resetView() { S.vz = 1; S.vx = 0; S.vy = 0; applyView(); }
  function placeOverlays() { fire('view'); }
  const touches = new Map();
  function abortStroke() {
    const d = S.drawing; if (!d) return;
    S.drawing = null; clearTimeout(d.timer);
    const p = S.pages[d.page], i = p ? p.indexOf(d.o) : -1; if (i >= 0) p.splice(i, 1);
    if (isTeacher()) emit('obj:del', { page: d.page, id: d.o.id });
    render();
  }
  function initView() {
    stage.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(S.vz * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); }
      else if (S.vz > 1) { e.preventDefault(); panBy(-e.deltaX, -e.deltaY); }
    }, { passive: false });
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) {
          abortStroke(); closeTextBox(false);
          const [a, b] = [...touches.values()];
          S.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        }
        if (S.pinch) { e.stopPropagation(); e.preventDefault(); return; }
      }
      if (e.target !== bC) return;
      if (S.panMode || S.space || e.button === 1) {
        S.pan = { x: e.clientX, y: e.clientY }; stage.setPointerCapture(e.pointerId); stage.classList.add('panning');
        e.stopPropagation(); e.preventDefault();
      }
    }, true);
    stage.addEventListener('pointermove', (e) => {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (S.pinch && touches.size >= 2) {
        const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const z = S.vz * (d / S.pinch.d);
        zoomAt(z, mx, my); panBy(mx - S.pinch.mx, my - S.pinch.my);
        S.pinch = { d, mx, my };
        e.stopPropagation(); e.preventDefault(); return;
      }
      if (S.pan) { panBy(e.clientX - S.pan.x, e.clientY - S.pan.y); S.pan = { x: e.clientX, y: e.clientY }; e.stopPropagation(); e.preventDefault(); }
    }, true);
    const up = (e) => {
      touches.delete(e.pointerId);
      if (S.pinch) { if (touches.size < 2) { S.pinch = null; S.noDraw = performance.now() + 250; } e.stopPropagation(); return; }
      if (S.pan) { S.pan = null; stage.classList.remove('panning'); e.stopPropagation(); }
    };
    stage.addEventListener('pointerup', up, true); stage.addEventListener('pointercancel', up, true);
    document.addEventListener('keydown', (e) => {
      if (/^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.code === 'Space' && !e.repeat) { S.space = true; stage.classList.add('panning'); e.preventDefault(); }
      else if (e.key === '+' || e.key === '=') zoomCenter(1.25);
      else if (e.key === '-' || e.key === '_') zoomCenter(1 / 1.25);
      else if (e.key === '0' && !e.ctrlKey) resetView();
    });
    document.addEventListener('keyup', (e) => { if (e.code === 'Space') { S.space = false; if (!S.panMode) stage.classList.remove('panning'); } });
    $('#zIn').onclick = () => zoomCenter(1.25);
    $('#zOut').onclick = () => zoomCenter(1 / 1.25);
    $('#zFit').onclick = resetView;
    $('#zPan').onclick = () => { S.panMode = !S.panMode; $('#zPan').classList.toggle('on', S.panMode); stage.classList.toggle('panning', S.panMode); toast(S.panMode ? 'Move mode: drag the board to move it. Tap again to go back to drawing.' : 'Drawing mode', { ms: 2200 }); };
  }
  new ResizeObserver(fit).observe($('#stageArea'));
  window.addEventListener('resize', fit);

  function paintBg(ctx, bg) {
    const t = BG[bg] || BG.white;
    ctx.save();
    ctx.fillStyle = t.color;
    ctx.fillRect(0, 0, W, H);
    if (bg === 'grid') {
      ctx.strokeStyle = 'rgba(99,102,241,.2)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0; y <= H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    } else if (bg === 'ruled') {
      ctx.strokeStyle = 'rgba(59,130,246,.28)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let y = 90; y <= H; y += 54) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(239,68,68,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(120, 0); ctx.lineTo(120, H); ctx.stroke();
    } else if (bg === 'dots') {
      ctx.fillStyle = 'rgba(99,102,241,.35)';
      for (let x = 40; x < W; x += 40) for (let y = 40; y < H; y += 40) { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); }
    } else if (bg === 'axes') {
      const cx = W / 2, cy = H / 2, u = 80;
      ctx.strokeStyle = 'rgba(99,102,241,.16)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = cx % 40; x <= W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = cy % 40; y <= H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.strokeStyle = '#334155'; ctx.fillStyle = '#334155'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(24, cy); ctx.lineTo(W - 24, cy); ctx.moveTo(cx, 24); ctx.lineTo(cx, H - 24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W - 14, cy); ctx.lineTo(W - 30, cy - 7); ctx.lineTo(W - 30, cy + 7); ctx.closePath();
      ctx.moveTo(cx, 14); ctx.lineTo(cx - 7, 30); ctx.lineTo(cx + 7, 30); ctx.closePath(); ctx.fill();
      ctx.lineWidth = 1.5; ctx.font = `600 15px ${FONTS.sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.beginPath();
      for (let k = 1; cx + k * u < W - 40; k++) {
        for (const s of [1, -1]) { ctx.moveTo(cx + s * k * u, cy - 6); ctx.lineTo(cx + s * k * u, cy + 6); }
      }
      for (let k = 1; cy + k * u < H - 40; k++) {
        for (const s of [1, -1]) { ctx.moveTo(cx - 6, cy + s * k * u); ctx.lineTo(cx + 6, cy + s * k * u); }
      }
      ctx.stroke();
      for (let k = 1; cx + k * u < W - 40; k++) { ctx.fillText(String(k), cx + k * u, cy + 10); ctx.fillText(String(-k), cx - k * u, cy + 10); }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let k = 1; cy + k * u < H - 40; k++) { ctx.fillText(String(k), cx - 12, cy - k * u); ctx.fillText(String(-k), cx - 12, cy + k * u); }
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `italic 700 20px ${FONTS.sans}`;
      ctx.fillText('x', W - 28, cy + 12); ctx.fillText('y', cx + 14, 14); ctx.fillText('O', cx + 8, cy + 8);
    } else if (WALL[bg]) {
      WALL[bg](ctx);
    } else if (bg === 'chalk') {
      const g = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(0,0,0,.3)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function getImg(o) {
    let im = S.imgs.get(o.id);
    if (!im || im._src !== o.src) {
      im = new Image();
      im._src = o.src;
      im.onload = () => render();
      im.src = o.src;
      S.imgs.set(o.id, im);
    }
    return im;
  }
  const imgReady = (o) => new Promise((res) => {
    const im = getImg(o);
    if (im.complete && im.naturalWidth) return res();
    im.addEventListener('load', res, { once: true });
    im.addEventListener('error', res, { once: true });
  });

  function strokePath(ctx, p) {
    if (p.length < 4) { ctx.beginPath(); ctx.arc(p[0], p[1], ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); return; }
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length - 2; i += 2) {
      ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
    }
    ctx.lineTo(p[p.length - 2], p[p.length - 1]);
    ctx.stroke();
  }

  function drawPenStyle(ctx, o) {
    const p = o.pts, c = o.color || '#000', w = o.size;
    ctx.strokeStyle = ctx.fillStyle = c; ctx.lineWidth = w;
    const segs = (fn) => { for (let i = 0; i + 3 < p.length; i += 2) fn(p[i], p[i + 1], p[i + 2], p[i + 3], i / 2, p.length / 2 - 1); };
    switch (o.ps) {
      case 'pencil':
        ctx.globalAlpha = 0.72; ctx.lineWidth = Math.max(1, w * 0.7); strokePath(ctx, p);
        ctx.globalAlpha = 0.32; ctx.translate(0.7, -0.5); strokePath(ctx, p);
        ctx.translate(-1.4, 1); ctx.globalAlpha = 0.22; strokePath(ctx, p);
        break;
      case 'marker':
        ctx.globalAlpha = 0.9; ctx.lineWidth = w * 2; strokePath(ctx, p);
        break;
      case 'brush':
        if (p.length < 4) { strokePath(ctx, p); break; }
        segs((x1, y1, x2, y2, i, n) => { const t = n ? i / n : 0; ctx.lineWidth = Math.max(1, w * (0.35 + 1.15 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))))); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); });
        break;
      case 'calli': {
        const nx = Math.cos(-Math.PI / 4) * w * 1.1, ny = Math.sin(-Math.PI / 4) * w * 1.1;
        if (p.length < 4) { ctx.beginPath(); ctx.moveTo(p[0] + nx, p[1] + ny); ctx.lineTo(p[0] - nx, p[1] - ny); ctx.lineWidth = 2; ctx.stroke(); break; }
        segs((x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1 + nx, y1 + ny); ctx.lineTo(x2 + nx, y2 + ny); ctx.lineTo(x2 - nx, y2 - ny); ctx.lineTo(x1 - nx, y1 - ny); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1; ctx.stroke(); });
        break;
      }
      case 'neon':
        ctx.shadowColor = c; ctx.shadowBlur = w * 3 + 6; ctx.lineWidth = w * 1.1; strokePath(ctx, p);
        ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.85; ctx.lineWidth = Math.max(1, w * 0.4); strokePath(ctx, p);
        break;
      case 'rainbow':
        if (p.length < 4) { strokePath(ctx, p); break; }
        segs((x1, y1, x2, y2, i) => { ctx.strokeStyle = `hsl(${(i * 7) % 360} 90% 55%)`; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); });
        break;
      case 'dotted': ctx.setLineDash([0, w * 2.4]); strokePath(ctx, p); break;
      case 'dashed': ctx.setLineDash([w * 3, w * 2.2]); strokePath(ctx, p); break;
      default: strokePath(ctx, p);
    }
  }

  const fontOf = (o) => `${o.fs}px ${FONTS[o.f] || FONTS.sans}`;

  function drawObj(ctx, o) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.dash && !o.pts && o.type !== 'text' && o.type !== 'image') ctx.setLineDash([o.size * 3, o.size * 2.2]);
    switch (o.type) {
      case 'pen':
      case 'hl':
      case 'eraser': {
        if (o.type === 'pen' && o.ps && o.pts && o.pts.length >= 2) { drawPenStyle(ctx, o); break; }
        ctx.strokeStyle = ctx.fillStyle = o.color || '#000';
        if (o.type === 'eraser') { ctx.lineWidth = o.size * 3; ctx.globalCompositeOperation = 'destination-out'; }
        else if (o.type === 'hl') { const hs = o.hs || 'classic'; ctx.lineWidth = o.size * (hs === 'thin' ? 1.6 : 3.2); ctx.globalAlpha = hs === 'soft' ? 0.2 : hs === 'bold' ? 0.62 : 0.38; ctx.lineCap = hs === 'round' || hs === 'thin' ? 'round' : 'square'; }
        else ctx.lineWidth = o.size;
        if (o.pts && o.pts.length >= 2) strokePath(ctx, o.pts);
        break;
      }
      case 'line':
        ctx.strokeStyle = o.color; ctx.lineWidth = o.size;
        ctx.beginPath(); ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); ctx.stroke();
        break;
      case 'arrow': {
        ctx.strokeStyle = ctx.fillStyle = o.color; ctx.lineWidth = o.size;
        const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1);
        const hl = Math.max(16, o.size * 4.2), sp = 0.46;
        const len = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);
        const back = Math.min(hl * 0.8, len);
        ctx.beginPath(); ctx.moveTo(o.x1, o.y1);
        ctx.lineTo(o.x2 - Math.cos(a) * back, o.y2 - Math.sin(a) * back); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(o.x2, o.y2);
        ctx.lineTo(o.x2 - hl * Math.cos(a - sp), o.y2 - hl * Math.sin(a - sp));
        ctx.lineTo(o.x2 - hl * Math.cos(a + sp), o.y2 - hl * Math.sin(a + sp));
        ctx.closePath(); ctx.fill();
        if (o.both) {
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(o.x1, o.y1);
          ctx.lineTo(o.x1 + hl * Math.cos(a - sp), o.y1 + hl * Math.sin(a - sp));
          ctx.lineTo(o.x1 + hl * Math.cos(a + sp), o.y1 + hl * Math.sin(a + sp));
          ctx.closePath(); ctx.fill();
        }
        break;
      }
      case 'note': {
        const fs = o.fs || 32, pad = 16;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
        ctx.fillStyle = o.color || NOTE_COLORS[0];
        ctx.beginPath(); ctx.roundRect(o.x, o.y, o.w, o.h, 10); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); ctx.clip();
        ctx.fillStyle = '#1f2937'; ctx.font = `${fs}px ${FONTS.hand}`; ctx.textBaseline = 'top';
        let yy = o.y + pad;
        for (const para of String(o.text).split('\n')) {
          let line = '';
          for (const w of para.split(' ')) {
            const t = line ? line + ' ' + w : w;
            if (ctx.measureText(t).width > o.w - pad * 2 && line) { ctx.fillText(line, o.x + pad, yy); yy += fs * 1.25; line = w; } else line = t;
          }
          ctx.fillText(line, o.x + pad, yy); yy += fs * 1.25;
        }
        ctx.restore();
        break;
      }
      case 'shape': {
        const sh = SHAPES[o.k] || SHAPES.triangle;
        const x = Math.min(o.x1, o.x2), y = Math.min(o.y1, o.y2), w = Math.abs(o.x2 - o.x1), h = Math.abs(o.y2 - o.y1);
        const P = sh.p.map(([u, v]) => [x + u * w, y + v * h]);
        ctx.strokeStyle = o.color; ctx.lineWidth = o.size;
        ctx.beginPath();
        if (sh.heart) {
          ctx.moveTo(x + w * 0.5, y + h * 0.95);
          ctx.bezierCurveTo(x - w * 0.15, y + h * 0.5, x + w * 0.05, y - h * 0.1, x + w * 0.5, y + h * 0.28);
          ctx.bezierCurveTo(x + w * 0.95, y - h * 0.1, x + w * 1.15, y + h * 0.5, x + w * 0.5, y + h * 0.95);
        } else { P.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); }
        ctx.closePath();
        if (o.fill) { ctx.globalAlpha = 0.28; ctx.fillStyle = o.color; ctx.fill(); ctx.globalAlpha = 1; }
        ctx.stroke();
        break;
      }
      case 'rect': {
        const x = Math.min(o.x1, o.x2), y = Math.min(o.y1, o.y2), w = Math.abs(o.x2 - o.x1), h = Math.abs(o.y2 - o.y1);
        ctx.strokeStyle = o.color; ctx.lineWidth = o.size;
        if (o.fill) { ctx.globalAlpha = 0.28; ctx.fillStyle = o.color; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; }
        ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'ellipse': {
        const cx = (o.x1 + o.x2) / 2, cy = (o.y1 + o.y2) / 2, rx = Math.abs(o.x2 - o.x1) / 2, ry = Math.abs(o.y2 - o.y1) / 2;
        ctx.strokeStyle = o.color; ctx.lineWidth = o.size;
        ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
        if (o.fill) { ctx.globalAlpha = 0.28; ctx.fillStyle = o.color; ctx.fill(); ctx.globalAlpha = 1; }
        ctx.stroke();
        break;
      }
      case 'text':
        ctx.fillStyle = o.color; ctx.font = fontOf(o); ctx.textBaseline = 'top';
        String(o.text).split('\n').forEach((ln, i) => ctx.fillText(ln, o.x, o.y + i * o.fs * 1.3));
        break;
      case 'image': {
        const im = getImg(o);
        if (im.complete && im.naturalWidth) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(im, o.x, o.y, o.w, o.h); }
        break;
      }
    }
    ctx.restore();
  }

  let raf = 0;
  function render() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderNow(); }); }
  function renderNow() {
    X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.clearRect(0, 0, bC.width, bC.height); X.restore();
    for (const o of S.pages[S.cur] || []) drawObj(X, o);
    if (S.lasso && S.lasso.length >= 4) {
      const ac = S.lassoAc || (S.lassoAc = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ffb84d'), k = 1 / (S.scale || 1);
      X.save(); X.beginPath(); X.moveTo(S.lasso[0], S.lasso[1]);
      for (let i = 2; i < S.lasso.length; i += 2) X.lineTo(S.lasso[i], S.lasso[i + 1]);
      X.closePath(); X.globalAlpha = 0.13; X.fillStyle = ac; X.fill(); X.globalAlpha = 1;
      X.lineWidth = 3 * k; X.strokeStyle = ac; X.setLineDash([9 * k, 7 * k]); X.lineJoin = 'round'; X.stroke(); X.restore();
    }
    placeSel();
  }

  // ---------- geometry: bounding boxes, hit testing, move / scale ----------
  function bbox(o) {
    if (o.pts) {
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (let i = 0; i < o.pts.length; i += 2) {
        a = Math.min(a, o.pts[i]); c = Math.max(c, o.pts[i]);
        b = Math.min(b, o.pts[i + 1]); d = Math.max(d, o.pts[i + 1]);
      }
      const p = (o.type === 'hl' ? o.size * 1.6 : o.ps === 'marker' || o.ps === 'neon' || o.ps === 'brush' || o.ps === 'calli' ? o.size * 1.6 : o.size / 2) + 4;
      return { x: a - p, y: b - p, w: c - a + 2 * p, h: d - b + 2 * p };
    }
    if (o.type === 'text') {
      X.save(); X.font = fontOf(o);
      const lines = String(o.text).split('\n');
      const w = Math.max(20, ...lines.map((l) => X.measureText(l).width));
      X.restore();
      return { x: o.x, y: o.y, w, h: lines.length * o.fs * 1.3 };
    }
    if (o.type === 'image' || o.type === 'note') return { x: o.x, y: o.y, w: o.w, h: o.h };
    const p = o.size / 2 + 3;
    const x = Math.min(o.x1, o.x2), y = Math.min(o.y1, o.y2);
    return { x: x - p, y: y - p, w: Math.abs(o.x2 - o.x1) + 2 * p, h: Math.abs(o.y2 - o.y1) + 2 * p };
  }

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function hit(o, x, y) {
    const tol = Math.max(8, 10 / (S.scale || 1));
    if (o.type === 'eraser') return false;
    if (o.pts) {
      const r = (o.type === 'hl' ? o.size * 1.6 : o.size / 2) + tol;
      const p = o.pts;
      if (p.length < 4) return Math.hypot(x - p[0], y - p[1]) <= r;
      for (let i = 0; i < p.length - 2; i += 2) if (segDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= r) return true;
      return false;
    }
    if (o.type === 'line' || o.type === 'arrow') return segDist(x, y, o.x1, o.y1, o.x2, o.y2) <= o.size / 2 + tol;
    const b = bbox(o);
    if (o.type === 'ellipse') {
      const rx = b.w / 2 + tol, ry = b.h / 2 + tol;
      return ((x - b.x - b.w / 2) / rx) ** 2 + ((y - b.y - b.h / 2) / ry) ** 2 <= 1;
    }
    return x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol;
  }

  function hitTest(x, y) {
    const list = S.pages[S.cur] || [];
    for (let i = list.length - 1; i >= 0; i--) if (hit(list[i], x, y)) return list[i];
    return null;
  }

  function moveObj(o, orig, dx, dy) {
    if (orig.pts) o.pts = orig.pts.map((v, i) => v + (i % 2 ? dy : dx));
    if ('x1' in orig) { o.x1 = orig.x1 + dx; o.y1 = orig.y1 + dy; o.x2 = orig.x2 + dx; o.y2 = orig.y2 + dy; }
    if ('x' in orig) { o.x = orig.x + dx; o.y = orig.y + dy; }
  }
  function scaleObj(o, orig, bx, by, sx, sy) {
    const mx = (v) => bx + (v - bx) * sx, my = (v) => by + (v - by) * sy;
    if (orig.pts) o.pts = orig.pts.map((v, i) => (i % 2 ? my(v) : mx(v)));
    if ('x1' in orig) { o.x1 = mx(orig.x1); o.y1 = my(orig.y1); o.x2 = mx(orig.x2); o.y2 = my(orig.y2); }
    if (orig.type === 'image' || orig.type === 'note') { o.x = mx(orig.x); o.y = my(orig.y); o.w = orig.w * sx; o.h = orig.h * sy; }
    if (orig.type === 'text') { o.x = mx(orig.x); o.y = my(orig.y); o.fs = Math.max(8, orig.fs * sy); }
  }
  function geomOf(o) {
    const g = {};
    GEOM.forEach((k) => { if (typeof o[k] === 'number') g[k] = o[k]; });
    if (o.pts) g.pts = o.pts.slice();
    return g;
  }

  // ---------- selection ----------
  function select(o) {
    S.sel = o ? { id: o.id, page: S.cur } : null;
    S.grp = null;
    placeSel();
  }
  // ---------- circle select (lasso) + group actions ----------
  const grpObjs = () => (S.grp ? S.grp.ids.map((id) => findObj(S.grp.page, id)).filter(Boolean) : []);
  function grpBox(list) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    list.forEach((o) => { const q = bbox(o); a = Math.min(a, q.x); b = Math.min(b, q.y); c = Math.max(c, q.x + q.w); d = Math.max(d, q.y + q.h); });
    return { x: a, y: b, w: c - a, h: d - b };
  }
  function inPoly(px, py, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
      const xi = poly[i], yi = poly[i + 1], xj = poly[j], yj = poly[j + 1];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function samplesOf(o) {
    const out = [];
    if (o.pts) { const n = o.pts.length / 2, st = Math.max(1, Math.floor(n / 24)); for (let i = 0; i < n; i += st) out.push([o.pts[2 * i], o.pts[2 * i + 1]]); return out; }
    if (o.type === 'line' || o.type === 'arrow') { for (let i = 0; i <= 8; i++) out.push([o.x1 + ((o.x2 - o.x1) * i) / 8, o.y1 + ((o.y2 - o.y1) * i) / 8]); return out; }
    const b = bbox(o);
    for (const fx of [0, 0.25, 0.5, 0.75, 1]) for (const fy of [0, 0.25, 0.5, 0.75, 1]) out.push([b.x + b.w * fx, b.y + b.h * fy]);
    return out;
  }
  function lassoPick(poly) {
    return (S.pages[S.cur] || []).filter((o) => {
      if (o.type === 'eraser') return false;
      const s = samplesOf(o);
      const inside = s.filter((p) => inPoly(p[0], p[1], poly)).length;
      const c = s[Math.floor(s.length / 2)];
      return inside / s.length >= 0.45 || (inside / s.length >= 0.3 && inPoly(c[0], c[1], poly));
    });
  }
  function lassoEnd() {
    const pts = S.lasso; S.lasso = null;
    if (!pts) return;
    let len = 0; for (let i = 2; i < pts.length; i += 2) len += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    let picked = [];
    if (len < 28 || pts.length < 12) { const o = hitTest(pts[0], pts[1]); if (o) picked = [o]; }
    else picked = lassoPick(pts);
    if (picked.length) { S.grp = { page: S.cur, ids: picked.map((o) => o.id) }; toast(picked.length + (picked.length === 1 ? ' object selected' : ' objects selected') + '. Drag to move, corner to resize.', { ms: 1800 }); }
    else { S.grp = null; toast('Nothing inside the circle. Draw a loop around the objects you want.', { ms: 2200 }); }
    render();
  }
  function placeGroup() {
    const box = $('#selBox'), bar = $('#selBar');
    const list = grpObjs();
    if (!list.length || !isTeacher() || S.tool !== 'lasso' || S.grp.page !== S.cur) {
      box.classList.add('hidden'); bar.classList.add('hidden'); $('#selCount').classList.add('hidden');
      if (S.grp && (!list.length || S.grp.page !== S.cur)) S.grp = null;
      return;
    }
    const b = grpBox(list), k = S.scale;
    box.classList.remove('hidden'); bar.classList.remove('hidden');
    box.style.left = (b.x - S.vx) * k + 'px'; box.style.top = (b.y - S.vy) * k + 'px'; box.style.width = b.w * k + 'px'; box.style.height = b.h * k + 'px';
    const cnt = $('#selCount'); cnt.classList.remove('hidden'); cnt.textContent = list.length + ' selected';
    $('#selFont').classList.add('hidden'); $('#selFill').classList.add('hidden');
    $('#selColorWrap').classList.toggle('hidden', list.every((o) => o.type === 'image'));
    $('#selFull').classList.add('hidden'); $('#selStretch').classList.add('hidden');
    const first = list.find((o) => o.type !== 'image');
    if (first) $('#selColor').style.background = /^#[0-9a-f]{6}$/i.test(first.color) ? first.color : '#000000';
    const bw = bar.offsetWidth || 160, sw = stage.clientWidth;
    let left = Math.max(6, Math.min(sw - bw - 6, (b.x - S.vx) * k + (b.w * k) / 2 - bw / 2));
    let top = (b.y - S.vy) * k - 50; if (top < 6) top = Math.min(stage.clientHeight - 50, (b.y + b.h - S.vy) * k + 12);
    bar.style.left = left + 'px'; bar.style.top = top + 'px';
  }
  function deleteGrp() {
    if (!isTeacher()) return;
    grpObjs().forEach((o) => { const p = S.pages[S.grp.page]; p.splice(p.indexOf(o), 1); emit('obj:del', { page: S.grp.page, id: o.id }); });
    S.grp = null; render();
  }
  function duplicateGrp() {
    if (!isTeacher()) return;
    const ids = [];
    grpObjs().forEach((o) => { const c = clone(o); c.id = uid(); moveObj(c, clone(o), 36, 36); addObj(c); ids.push(c.id); });
    if (ids.length) S.grp = { page: S.cur, ids };
    render();
  }
  function recolorGrp(c) {
    grpObjs().forEach((o) => { if (o.type === 'image') return; o.color = c; emit('obj:replace', { page: S.grp.page, obj: clone(o) }); });
    render();
  }

  function placeSel() {
    if (S.grp) { placeGroup(); return; }
    $('#selCount').classList.add('hidden');
    const box = $('#selBox'), bar = $('#selBar');
    const o = S.sel && S.sel.page === S.cur && findObj(S.sel.page, S.sel.id);
    if (!o || !isTeacher() || S.tool !== 'select') {
      box.classList.add('hidden'); bar.classList.add('hidden');
      if (S.sel && !o) S.sel = null;
      return;
    }
    const b = bbox(o), k = S.scale;
    box.classList.remove('hidden'); bar.classList.remove('hidden');
    box.style.left = (b.x - S.vx) * k + 'px'; box.style.top = (b.y - S.vy) * k + 'px';
    box.style.width = b.w * k + 'px'; box.style.height = b.h * k + 'px';
    const bw = bar.offsetWidth || 120;
    const sw = stage.clientWidth;
    let left = (b.x - S.vx) * k + (b.w * k) / 2 - bw / 2;
    left = Math.max(6, Math.min(sw - bw - 6, left));
    let top = (b.y - S.vy) * k - 50;
    if (top < 6) top = Math.min(stage.clientHeight - 50, (b.y + b.h - S.vy) * k + 12);
    bar.style.left = left + 'px'; bar.style.top = top + 'px';
    $('#selFont').classList.toggle('hidden', o.type !== 'text');
    $('#selFill').classList.toggle('hidden', !['rect', 'ellipse', 'shape'].includes(o.type));
    $('#selFont').classList.toggle('hidden', o.type !== 'text');
    $('#selColorWrap').classList.toggle('hidden', o.type === 'image');
    $('#selFull').classList.toggle('hidden', o.type !== 'image'); $('#selStretch').classList.toggle('hidden', o.type !== 'image');
    if (o.type !== 'image') $('#selColor').style.background = /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : '#000000';
    if (o.type === 'text') $('#selFont').textContent = o.f === 'hand' ? 'Aa·hand' : 'Aa';
  }
  function deleteSel() {
    if (S.grp) return deleteGrp();
    const o = S.sel && findObj(S.sel.page, S.sel.id);
    if (!o || !isTeacher()) return;
    const p = S.pages[S.sel.page];
    p.splice(p.indexOf(o), 1);
    emit('obj:del', { page: S.sel.page, id: o.id });
    S.sel = null; render();
  }
  function duplicateSel() {
    if (S.grp) return duplicateGrp();
    const o = S.sel && findObj(S.sel.page, S.sel.id);
    if (!o || !isTeacher()) return;
    const c = clone(o); c.id = uid();
    moveObj(c, clone(o), 36, 36);
    addObj(c);
    select(c);
  }
  function recolorSel(c) {
    const o = S.sel && findObj(S.sel.page, S.sel.id);
    if (!o || o.type === 'image') return;
    o.color = c;
    emit('obj:replace', { page: S.sel.page, obj: clone(o) });
    render();
  }
  function toggleSelFill() {
    const o = S.sel && findObj(S.sel.page, S.sel.id);
    if (!o || !['rect', 'ellipse', 'shape'].includes(o.type)) return;
    o.fill = !o.fill;
    emit('obj:replace', { page: S.sel.page, obj: clone(o) });
    render();
  }
  function toggleSelFont() {
    const o = S.sel && findObj(S.sel.page, S.sel.id);
    if (!o || o.type !== 'text') return;
    o.f = o.f === 'hand' ? 'sans' : 'hand';
    emit('obj:replace', { page: S.sel.page, obj: clone(o) });
    render();
  }

  // ---------- networking ----------
  const emit = (ev, data, cb) => { if (S.socket && S.socket.connected) S.socket.emit(ev, data, cb); };
  const keys = () => { try { return JSON.parse(store.get('sb_keys', '{}')); } catch { return {}; } };
  const saveKey = (code, key) => { const k = keys(); k[code] = key; store.set('sb_keys', JSON.stringify(k)); };
  const keyFor = (code) => keys()[code];

  function addObj(o, page = S.cur) {
    if (!S.pages[page]) return o;
    S.pages[page].push(o);
    emit('obj:add', { page, obj: clone(o) });
    render();
    return o;
  }

  function connect() {
    if (S.socket) return S.socket;
    if (typeof io === 'undefined') return null; // socket.io script could not load (offline)
    const s = window.SB_SERVER ? io(window.SB_SERVER, { transports: ["websocket", "polling"] }) : io();
    S.socket = s;

    s.on('connect', () => {
      S.ready = true; fire('server', true); toastDone('net');
      if (S.joined && S.code) {
        s.emit('room:join', { code: S.code, key: keyFor(S.code), name: S.name }, (res) => {
          if (res && res.ok) { S.role = res.role; applyState(res.state); updateUI(); toast('Reconnected ✅'); }
          else { toast('This room has ended.'); leaveRoom(); }
        });
      }
    });
    s.on('disconnect', () => { S.ready = false; if (S.joined) toast('Connection lost, trying to reconnect…', { id: 'net', ms: 0 }); });

    s.on('obj:add', ({ page, obj }) => {
      const p = S.pages[page]; if (!p) return;
      if (!p.some((o) => o.id === obj.id)) p.push(obj);
      if (page === S.cur) render();
    });
    s.on('obj:pts', ({ page, id, pts }) => {
      const o = findObj(page, id);
      if (o && o.pts) { for (const v of pts) o.pts.push(v); if (page === S.cur) render(); }
    });
    s.on('obj:upd', ({ page, id, g }) => {
      const o = findObj(page, id);
      if (o) { if (Number.isFinite(g.x2)) o.x2 = g.x2; if (Number.isFinite(g.y2)) o.y2 = g.y2; if (page === S.cur) render(); }
    });
    s.on('obj:geom', ({ page, id, g }) => {
      const o = findObj(page, id);
      if (o) { Object.assign(o, g); if (page === S.cur) render(); }
    });
    s.on('obj:replace', ({ page, obj }) => {
      const p = S.pages[page]; if (!p) return;
      const i = p.findIndex((o) => o.id === obj.id);
      if (i >= 0) p[i] = obj;
      if (page === S.cur) render();
    });
    s.on('obj:remove', ({ page, id }) => {
      const p = S.pages[page]; if (!p) return;
      const i = p.findIndex((o) => o.id === id);
      if (i >= 0) p.splice(i, 1);
      if (page === S.cur) render();
    });
    s.on('page:clear', ({ page }) => { S.pages[page] = []; if (page === S.cur) render(); });
    s.on('page:added', ({ index, bg }) => {
      while (S.pages.length <= index) S.pages.push([]);
      S.bgs[index] = bg || S.bg;
      if (!inBrk()) goPage(index, false); else updatePager();
    });
    s.on('page:duped', ({ index, objects, bg }) => { S.pages.splice(index, 0, objects); S.bgs.splice(index, 0, bg || S.bg); goPage(index, false); });
    s.on('curtain:set', (c) => setCurtain(c, false));
    s.on('pages:grew', ({ count }) => { while (S.pages.length < count) S.pages.push([]); updatePager(); });
    s.on('board:loaded', (st) => { applyState(st); toast('Board loaded ✅'); });
    s.on('page:go', ({ index }) => { if (S.pages[index] && !inBrk()) goPage(index, false); });
    s.on('page:deleted', ({ index, current }) => {
      S.pages.splice(index, 1); S.bgs.splice(index, 1);
      if (!S.pages.length) S.pages.push([]);
      goPage(Math.min(current, S.pages.length - 1), false);
    });
    s.on('bg:set', (d) => { if (d && typeof d === 'object') { if (d.all) S.bgs = S.pages.map(() => d.bg); applyBg(d.bg, d.page); } else applyBg(d); });
    s.on('perm:set', (on) => {
      S.studentDraw = on; updateUI();
      if (!isTeacher()) toast(on ? '✏️ The teacher allowed you to draw' : '👀 You can only view now');
    });
    s.on('room:count', (n) => { S.count = n; $('#countText').textContent = n; });
    s.on('laser', ({ x, y, s: sp }) => showLaser(x, y, sp));
    FEATURE_EVENTS.forEach((ev) => s.on(ev, (d) => fire('net:' + ev, d)));
    return s;
  }

  function applyState(st) {
    S.pages = st.pages.length ? st.pages : [[]];
    S.cur = Math.min(st.current, S.pages.length - 1);
    S.studentDraw = st.studentDraw;
    S.count = st.count;
    S.title = st.title || '';
    $('#countText').textContent = st.count;
    $('#boardTitle').value = S.title;
    S.bgs = (st.bgs || []).slice();
    applyBg(S.bgs[S.cur] || st.bg, S.cur);
    setCurtain(st.curtain || null, false);
    updatePager();
    render();
    fire('state', st);
  }

  // ---------- landing / room flow ----------
  function showView(name) {
    $('#landing').classList.toggle('active', name === 'landing');
    $('#app').classList.toggle('active', name === 'app');
    if (name === 'app') requestAnimationFrame(fit);
  }

  function enterRoom(res) {
    S.code = res.code; S.role = res.role; S.joined = true;
    applyState(res.state);
    $('#codeText').textContent = S.code;
    updateUI();
    showView('app');
    history.replaceState(null, '', '?room=' + S.code);
    fire('enter', { code: S.code, role: S.role, title: S.title });
    if (isTeacher() && res.fresh) {
      toast(`Board ready! Code: ${S.code}`, { ms: 4000 });
      setTimeout(() => (SB.openInvite ? SB.openInvite() : openModal('mInvite')), 350);
    }
    if (window.innerWidth < 600 && window.innerHeight > window.innerWidth) {
      setTimeout(() => toast('Tip: rotate your phone for a bigger board 📱', { ms: 4000 }), 1200);
    }
  }

  function leaveRoom() {
    emit('room:leave');
    if (S.present) setPresent(false);
    S.joined = false; S.code = null; S.role = null; S.sel = null; S.xf = null;
    S.pages = [[]]; S.cur = 0; S.imgs.clear();
    closeTextBox(false);
    modalStack.slice().forEach(closeModal);
    history.replaceState(null, '', location.pathname);
    showView('landing');
    fire('leave');
  }

  // Free hosting sleeps when unused. Start waking it (and connect the socket) as soon as the page opens.
  function warmUp() {
    const bar = $('#warmBar'); if (!bar) return;
    if (window.SB_SERVER === undefined && !location.protocol.startsWith('http')) return;
    const t0 = Date.now(); let slow = setTimeout(() => { bar.textContent = 'Server is waking up. This can take up to a minute the first time…'; bar.classList.remove('hidden'); }, 1800);
    try { fetch((window.SB_SERVER || '') + '/health', { cache: 'no-store' }).catch(() => {}); } catch (e) { /* ignore */ }
    const s = connect(); if (!s) { clearTimeout(slow); return; }
    const ok = () => { clearTimeout(slow); if (!bar.classList.contains('hidden')) { bar.textContent = 'Server is ready ✅'; setTimeout(() => bar.classList.add('hidden'), 1200); } };
    if (s.connected) ok(); else s.once('connect', ok);
  }

  function createBoard() {
    if (!navigator.onLine || !connect()) return toast('You are offline. Connect to the internet to create a board.');
    const title = $('#titleInput').value.trim();
    const cb = $('#createBtn'); const ct = cb.textContent; cb.disabled = true; cb.textContent = S.ready ? 'Creating…' : 'Waking server…';
    S.socket.timeout(S.ready ? 10000 : 70000).emit('room:create', { title, token: store.get('sb_token', '') || undefined }, (timedOut, res) => {
      cb.disabled = false; cb.textContent = ct;
      if (timedOut || !res || !res.ok) return toast('Could not create the board, please try again.');
      saveKey(res.code, res.key);
      res.fresh = true;
      enterRoom(res);
    });
  }

  function joinBoard(code) {
    code = (code || '').trim().toUpperCase();
    const err = $('#joinErr');
    err.textContent = '';
    if (code.length < 4) { err.textContent = 'Enter the full room code.'; return; }
    if (!navigator.onLine || !connect()) { err.textContent = 'You are offline. Connect to the internet to join a board.'; return; }
    S.name = $('#nameInput').value.trim().slice(0, 24);
    const ni = $('#nameInput'); ni.classList.remove('bad');
    if (!S.name && !keyFor(code)) { err.textContent = 'Please enter your name first.'; ni.classList.add('bad'); ni.focus(); return; }
    store.set('sb_name', S.name);
    const jb = $('#joinBtn'); const jt = jb.textContent; jb.disabled = true; jb.textContent = S.ready ? 'Joining…' : 'Waking server…';
    const done = () => { jb.disabled = false; jb.textContent = jt; };
    S.socket.timeout(S.ready ? 10000 : 70000).emit('room:join', { code, key: keyFor(code), name: S.name }, (timedOut, res) => {
      done();
      if (timedOut) { err.textContent = 'Server is not responding. Please try again.'; return; }
      if (!res || !res.ok) { err.textContent = (res && res.error) || 'Could not join.'; return; }
      enterRoom(res);
    });
  }

  // ---------- UI updates ----------
  function updateUI() {
    const app = $('#app');
    app.classList.toggle('is-teacher', isTeacher());
    app.classList.toggle('is-student', !isTeacher());
    app.classList.toggle('viewer', !canDraw());
    stage.classList.toggle('viewing', !canDraw());
    $('#roleBadge').textContent = isTeacher() ? 'Teacher' : 'Student';
    $('#studentDrawToggle').checked = S.studentDraw;
    $('#boardTitle').readOnly = !isTeacher();
    if (!isTeacher() && ['laser', 'select', 'lasso', 'spot'].includes(S.tool)) setTool('pen');
    if (!canDraw() && S.tbox) closeTextBox(false);
    updatePager();
    requestAnimationFrame(fit);
  }

  function updatePager() {
    $('#pageNum').textContent = `${S.cur + 1} / ${S.pages.length}`;
    const pp = $('#pPageNum'); if (pp) pp.textContent = `${S.cur + 1} / ${S.pages.length}`;
    $('#prevPage').disabled = S.cur === 0;
    $('#nextPage').disabled = S.cur >= S.pages.length - 1;
  }

  function goPage(i, notify = true) {
    closeTextBox(true);
    S.drawing = null; S.xf = null; S.sel = null;
    S.cur = i;
    if (S.bgs[i] && S.bgs[i] !== S.bg) applyBg(S.bgs[i], i);
    updatePager();
    render();
    if (notify) emit('page:go', { index: i });
  }

  const bgOf = (i) => (BG[S.bgs[i]] ? S.bgs[i] : (BG[S.defBg] ? S.defBg : 'white'));
  function applyBg(bg, page) {
    if (!BG[bg]) bg = 'white';
    if (page === undefined || page === null) page = S.cur;
    S.bgs[page] = bg; S.defBg = bg;
    if (page !== S.cur) return;
    S.bg = bg;
    paintBg(bgX, bg);
    $('#bgBtn').title = 'Wallpaper: ' + bg;
    const dark = BG[bg].dark;
    if (dark && S.color === INK) setColor('#ffffff');
    else if (!dark && S.color === '#ffffff') setColor(INK);
  }

  const DRAW_TOOLS = ['pen', 'hl', 'eraser'];
  function setTool(t) {
    closeTextBox(true);
    S.tool = t;
    $$('.tool[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    $$('[data-ptool]').forEach((b) => b.classList.toggle('active', b.dataset.ptool === t));
    stage.className = stage.className.replace(/\btool-\w+/g, '').trim() + ' tool-' + t;
    if (!DRAW_TOOLS.includes(t)) $('#cursorRing').style.display = 'none';
    const sr = $('#sizeRange'); if (sr) { sr.value = t === 'eraser' ? S.eSize : S.size; updateSizeDot(); }
    if (t !== 'select') S.sel = null;
    if (t !== 'lasso') { S.grp = null; S.lasso = null; }
    placeSel();
    fire('tool', t);
  }

  function setColor(c) {
    S.color = c;
    $$('.swatch').forEach((s) => s.classList.toggle('active', s.dataset.c === c));
    $('#customColor').style.background = c;
    updateSizeDot();
  }

  /* ---------- colour studio (own picker, replaces the phone's default one) ---------- */
  const CP = (() => {
    const HEX = /^#[0-9a-f]{6}$/i;
    const st = { h: 200, s: 0.7, v: 0.9, old: '#000000', cb: null, ready: false };
    const hsv2rgb = (h, s, v) => { const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)].map((x) => Math.round(x * 255)); };
    const rgb2hex = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
    const hex2hsv = (hex) => {
      const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
      if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return { h: h * 60, s: mx ? d / mx : 0, v: mx };
    };
    const cur = () => rgb2hex(...hsv2rgb(st.h, st.s, st.v));
    const norm = (t) => { t = String(t).trim().replace(/^#/, '').toLowerCase(); if (/^[0-9a-f]{3}$/.test(t)) t = t.split('').map((c) => c + c).join(''); return /^[0-9a-f]{6}$/.test(t) ? '#' + t : null; };
    const recent = () => { try { return JSON.parse(store.get('sb_recent_colors', '[]')).filter((c) => HEX.test(c)); } catch { return []; } };
    const hsl = (h, s, l) => { s /= 100; l /= 100; const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return rgb2hex(...[f(0), f(8), f(4)].map((x) => Math.round(x * 255))); };

    function strip(el, list, size) {
      el.innerHTML = '';
      list.forEach((c) => { const b = document.createElement('button'); b.className = 'cp-chip'; b.style.background = c; b.title = c; b.onclick = () => { setHex(c); }; el.appendChild(b); });
    }
    function paintSV() {
      const c = $('#cpSV'), x = c.getContext('2d'), w = c.width, h = c.height;
      x.fillStyle = rgb2hex(...hsv2rgb(st.h, 1, 1)); x.fillRect(0, 0, w, h);
      let g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    }
    function render(fromHex) {
      const hex = cur();
      paintSV();
      const k = $('#cpSVh'); k.style.left = st.s * 100 + '%'; k.style.top = (1 - st.v) * 100 + '%'; k.style.background = hex;
      $('#cpHue').value = Math.round(st.h);
      $('#cpHue').style.setProperty('--thumb', rgb2hex(...hsv2rgb(st.h, 1, 1)));
      $('#cpNew').style.background = hex;
      if (!fromHex) $('#cpHex').value = hex.slice(1).toUpperCase();
      const sh = []; for (let i = 0; i < 9; i++) sh.push(rgb2hex(...hsv2rgb(st.h, Math.max(0.08, st.s), 1 - i * 0.105)));
      strip($('#cpShades'), sh);
      if (st.cb) st.cb(hex);
    }
    function setHex(hex, fromHex) { Object.assign(st, hex2hsv(hex)); render(fromHex); }
    function build() {
      st.ready = true;
      const pal = $('#cpPal'), L = [88, 74, 60, 47, 34, 22], H = [0, 24, 45, 68, 140, 172, 200, 222, 266, 322], list = [];
      L.forEach((l) => H.forEach((h) => list.push(hsl(h, l > 80 ? 90 : 78, l))));
      for (let i = 0; i < 10; i++) list.push(hsl(0, 0, 100 - i * 11));
      strip(pal, list);
      const sv = $('#cpSV'); let drag = false;
      const move = (e) => { const r = sv.getBoundingClientRect(); st.s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); st.v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)); render(); };
      sv.addEventListener('pointerdown', (e) => { drag = true; sv.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
      sv.addEventListener('pointermove', (e) => { if (drag) move(e); });
      const up = () => { drag = false; }; sv.addEventListener('pointerup', up); sv.addEventListener('pointercancel', up);
      $('#cpHue').addEventListener('input', (e) => { st.h = +e.target.value; render(); });
      $('#cpHex').addEventListener('input', (e) => { const h = norm(e.target.value); if (h) setHex(h, true); });
      $('#cpHex').addEventListener('keydown', (e) => { if (e.key === 'Enter') done(); });
      $('#cpCancel').onclick = $('#cpX').onclick = cancel;
      $('#cpDone').onclick = done;
      $('#mColor').addEventListener('pointerdown', (e) => { if (e.target.id === 'mColor') done(true); });
      if (window.EyeDropper) { const eb = $('#cpEye'); eb.hidden = false; eb.onclick = async () => { try { const r = await new window.EyeDropper().open(); if (norm(r.sRGBHex)) setHex(norm(r.sRGBHex)); } catch { /* cancelled */ } }; }
    }
    function open(color, cb, title) {
      if (!st.ready) build();
      st.cb = null; st.old = HEX.test(color) ? color.toLowerCase() : '#1f2937';
      $('#cpTitle').textContent = title || 'Colour studio';
      $('#cpOld').style.background = st.old;
      const rc = recent(); $('#cpRecent').classList.toggle('hidden', !rc.length); $('#cpRecentL').classList.toggle('hidden', !rc.length); strip($('#cpRecent'), rc);
      openModal('mColor');
      requestAnimationFrame(() => { setHex(st.old); st.cb = cb; });
    }
    function done(fromBackdrop) {
      const c = cur(); const rc = [c, ...recent().filter((x) => x !== c)].slice(0, 10);
      store.set('sb_recent_colors', JSON.stringify(rc));
      st.cb = null; closeModal('mColor');
    }
    function cancel() { if (st.cb) st.cb(st.old); st.cb = null; closeModal('mColor'); }
    return { open };
  })();

  function updateSizeDot() {
    const d = $('#sizeDot');
    const px = Math.max(3, Math.min(26, (S.tool === 'eraser' ? S.eSize : S.size) + 2));
    d.style.width = d.style.height = px + 'px';
    d.style.background = S.color;
    d.parentElement.style.background = S.color.toLowerCase() === '#ffffff' ? '#374151' : '#ffffff';
  }

  // ---------- smart shapes: rough stroke -> perfect shape ----------
  // Resample a stroke to evenly spaced points
  function resample(pts, n) {
    const P = []; for (let i = 0; i < pts.length; i += 2) P.push([pts[i], pts[i + 1]]);
    let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const step = L / (n - 1), out = [P[0]]; let acc = 0, prev = P[0];
    for (let i = 1; i < P.length; i++) {
      let cur = P[i], d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      while (d > 0 && acc + d >= step) {
        const t = (step - acc) / d, q = [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t];
        out.push(q); prev = q; d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]); acc = 0;
      }
      acc += d; prev = cur;
    }
    while (out.length < n) out.push(P[P.length - 1]);
    return { pts: out, len: L };
  }
  // Douglas-Peucker: keep only the real corners
  function dp(P, i, j, eps, keep) {
    let md = 0, mi = -1;
    const [x1, y1] = P[i], [x2, y2] = P[j], dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1;
    for (let k = i + 1; k < j; k++) { const d = Math.abs(dx * (y1 - P[k][1]) - (x1 - P[k][0]) * dy) / l; if (d > md) { md = d; mi = k; } }
    if (md > eps && mi > 0) { dp(P, i, mi, eps, keep); keep.add(mi); dp(P, mi, j, eps, keep); }
  }
  function corners(P, eps) {
    // closed stroke: start the search from the point farthest from the start so the start is not forced to be a corner
    let far = 0, fd = 0; for (let i = 0; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[0][0], P[i][1] - P[0][1]); if (d > fd) { fd = d; far = i; } }
    const keep = new Set([0, far, P.length - 1]);
    dp(P, 0, far, eps, keep); dp(P, far, P.length - 1, eps, keep);
    const idx = [...keep].sort((a, b) => a - b);
    const V = idx.map((i) => P[i]);
    if (V.length > 1 && Math.hypot(V[0][0] - V[V.length - 1][0], V[0][1] - V[V.length - 1][1]) < eps * 2) V.pop();
    // merge corners that sit too close together
    const out = [];
    V.forEach((v) => { const l = out[out.length - 1]; if (!l || Math.hypot(v[0] - l[0], v[1] - l[1]) > eps * 1.5) out.push(v); });
    return out;
  }
  // distance from a point to a polyline (closed when `closed`)
  function pdist(px, py, poly, closed) {
    let best = Infinity; const n = poly.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % n];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d < best) best = d;
    }
    return best;
  }
  // how well does a closed outline match the stroke? (two-way average distance, relative to size)
  function fitErr(P, poly, diag) {
    let f = 0; P.forEach(([x, y]) => { f += pdist(x, y, poly, true); }); f /= P.length;
    // outline samples
    const S = []; const n = poly.length;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % n], k = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / (diag / 30)));
      for (let j = 0; j < k; j++) S.push([ax + (bx - ax) * j / k, ay + (by - ay) * j / k]);
    }
    let r = 0, rmax = 0;
    S.forEach(([x, y]) => { let m = Infinity; for (const q of P) { const d = Math.hypot(x - q[0], y - q[1]); if (d < m) m = d; } r += m; if (m > rmax) rmax = m; });
    r /= S.length;
    return { err: (f + r) / 2 / diag, cover: rmax / diag };
  }
  function recognize(pts) {
    const n = pts.length / 2;
    if (n < 6) return null;
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      a = Math.min(a, pts[i]); c = Math.max(c, pts[i]); b = Math.min(b, pts[i + 1]); d = Math.max(d, pts[i + 1]);
    }
    const w = c - a, h = d - b, diag = Math.hypot(w, h);
    if (diag < 40) return null;
    const sx = pts[0], sy = pts[1], ex = pts[pts.length - 2], ey = pts[pts.length - 1];
    const gap = Math.hypot(ex - sx, ey - sy);
    const R = resample(pts, 80), P = R.pts;
    // open stroke -> straight line
    if (gap > R.len * 0.3 || gap > diag * 0.55) {
      let maxd = 0;
      for (let i = 0; i < pts.length; i += 2) maxd = Math.max(maxd, Math.abs((ex - sx) * (sy - pts[i + 1]) - (sx - pts[i]) * (ey - sy)) / gap);
      if (gap > 50 && maxd < Math.max(12, gap * 0.12)) return { type: 'line', x1: sx, y1: sy, x2: ex, y2: ey, _name: 'line' };
      return null;
    }
    const cx = (a + c) / 2, cy = (b + d) / 2, rx = w / 2, ry = h / 2;
    if (rx < 18 || ry < 18) return null;
    // candidate outlines
    const ellipse = Array.from({ length: 96 }, (_, i) => [cx + rx * Math.cos(i / 96 * 6.2832), cy + ry * Math.sin(i / 96 * 6.2832)]);
    const box = [[a, b], [c, b], [c, d], [a, d]];
    const dia = [[cx, b], [c, cy], [cx, d], [a, cy]];
    const tri = [[cx, b], [c, d], [a, d]];
    const rtri = [[a, b], [c, d], [a, d]];
    const C = [
      { name: 'ellipse', poly: ellipse, bias: 1 },
      { name: 'box', poly: box, bias: 1.03 },
      { name: 'diamond', poly: dia, bias: 1.03 },
      { name: 'triangle', poly: tri, bias: 1.03 },
      { name: 'right triangle', poly: rtri, bias: 1.05 },
    ];
    // free polygons (any triangle / 4-sided shape, also rotated): find the real corners
    for (const k of [3, 4]) {
      let V = null;
      for (let e = 0.03; e <= 0.34; e += 0.01) { const v = corners(P, diag * e); if (v.length === k) { V = v; break; } if (v.length < k) break; }
      if (V) {
        const mn = Math.min(...V.map((p, i) => Math.hypot(p[0] - V[(i + 1) % k][0], p[1] - V[(i + 1) % k][1])));
        if (mn > diag * 0.14) C.push({ name: k === 3 ? 'triangle' : 'shape', poly: V, bias: 1.12, free: true });
      }
    }
    let best = null;
    let plen = 0; for (let i = 1; i < P.length; i++) plen += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    const perim = (poly) => poly.reduce((t, p, i) => t + Math.hypot(p[0] - poly[(i + 1) % poly.length][0], p[1] - poly[(i + 1) % poly.length][1]), 0);
    C.forEach((cd) => { const ratio = plen / perim(cd.poly); if (ratio < 0.7 || ratio > 1.55) return; const f = fitErr(P, cd.poly, diag); cd.err = f.err; cd.cover = f.cover; cd.score = f.err * cd.bias; if (f.err < (cd.free ? 0.034 : 0.06) && f.cover < 0.3 && (!best || cd.score < best.score)) best = cd; });
    if (!best) return null;
    const bb = { x1: a, y1: b, x2: c, y2: d };
    switch (best.name) {
      case 'ellipse': {
        if (Math.abs(w - h) < Math.max(w, h) * 0.2) { const r = (w + h) / 4; return { type: 'ellipse', x1: cx - r, y1: cy - r, x2: cx + r, y2: cy + r, _name: 'circle' }; }
        return { type: 'ellipse', ...bb, _name: 'oval' };
      }
      case 'box': return { type: 'rect', ...bb, _name: 'box' };
      case 'diamond': return { type: 'shape', k: 'diamond', ...bb, _name: 'diamond' };
      case 'triangle': if (!best.free) return { type: 'shape', k: 'triangle', ...bb, _name: 'triangle' }; break;
      case 'right triangle': return { type: 'shape', k: 'rtri', ...bb, _name: 'right triangle' };
    }
    // free polygon -> straight-edged outline (works for slanted boxes, scalene triangles ...)
    const V = best.poly, out = [];
    for (let i = 0; i <= V.length; i++) {
      const [ax, ay] = V[i % V.length], [bx2, by2] = V[(i + 1) % V.length], k = Math.max(1, Math.round(Math.hypot(bx2 - ax, by2 - ay) / 5));
      if (i === V.length) { out.push(ax, ay); break; }
      for (let j = 0; j < k; j++) out.push(ax + (bx2 - ax) * j / k, ay + (by2 - ay) * j / k);
    }
    return { type: 'pen', pts: out, _name: V.length === 3 ? 'triangle' : 'four-sided shape' };
  }

  // ---------- pointer handling ----------
  const snapPt = (x, y) => [Math.round(x / 40) * 40, Math.round(y / 40) * 40];
  function pos(e) {
    const r = bC.getBoundingClientRect();
    return [S.vx + ((e.clientX - r.left) / r.width) * (W / S.vz), S.vy + ((e.clientY - r.top) / r.height) * (H / S.vz)];
  }

  function scheduleFlush(d) {
    if (d.timer) return;
    d.timer = setTimeout(() => { d.timer = null; flush(d); }, 40);
  }
  function flush(d) {
    if (d.buf.length) { emit('obj:pts', { page: d.page, id: d.o.id, pts: d.buf }); d.buf = []; }
    if (d.dirty) { d.dirty = false; emit('obj:upd', { page: d.page, id: d.o.id, g: { x2: d.o.x2, y2: d.o.y2 } }); }
  }

  const PTR = ['laser', 'spot'];
  let lastTap = { id: null, t: 0 };

  function onDown(e) {
    if (e.button > 0) return;
    if (PTR.includes(S.tool)) {
      if (!isTeacher()) return;
      S.laserOn = true; bC.setPointerCapture(e.pointerId); sendLaser(e); return;
    }
    if (S.tool === 'lasso') {
      if (!isTeacher()) return;
      e.preventDefault();
      const [x, y] = pos(e);
      const list = grpObjs();
      if (list.length) {
        const b = grpBox(list), m = 6;
        if (x >= b.x - m && x <= b.x + b.w + m && y >= b.y - m && y <= b.y + b.h + m) {
          bC.setPointerCapture(e.pointerId);
          S.xf = { mode: 'gmove', page: S.grp.page, ids: S.grp.ids.slice(), origs: Object.fromEntries(list.map((o) => [o.id, clone(o)])), x0: x, y0: y, last: 0, moved: false };
          return;
        }
      }
      S.grp = null; bC.setPointerCapture(e.pointerId);
      S.lasso = [x, y]; render();
      return;
    }
    if (S.tool === 'select') {
      if (!isTeacher()) return;
      e.preventDefault();
      const [x, y] = pos(e);
      const o = hitTest(x, y);
      if (!o) { select(null); return; }
      const dbl = lastTap.id === o.id && performance.now() - lastTap.t < 380;
      lastTap = { id: o.id, t: performance.now() };
      select(o);
      if (dbl && o.type === 'text') { editText(o); return; }
      bC.setPointerCapture(e.pointerId);
      S.xf = { mode: 'move', id: o.id, page: S.cur, orig: clone(o), x0: x, y0: y, last: 0, moved: false };
      return;
    }
    if (!canDraw() || performance.now() < (S.noDraw || 0)) return;
    if (S.tool === 'eraser' && S.strokeErase && isTeacher()) { e.preventDefault(); bC.setPointerCapture(e.pointerId); S.erasing = true; eraseAt(...pos(e)); return; }
    if (S.tool === 'text' || S.tool === 'note') { S.textAt = pos(e); return; }
    if (S.tool === 'stamp') {
      e.preventDefault();
      const [x, y] = pos(e);
      const fs = 46 + S.size * 6;
      addObj({ id: uid(), type: 'text', x: x - fs * 0.55, y: y - fs * 0.6, text: S.stamp, fs, color: S.color, f: 'sans' });
      return;
    }
    e.preventDefault();
    bC.setPointerCapture(e.pointerId);
    let [x, y] = pos(e);
    S.lock = SB.edgeBegin && ['pen', 'hl', 'line', 'arrow'].includes(S.tool) ? SB.edgeBegin(x, y) : null;
    if (S.lock) [x, y] = SB.edgeProject(S.lock, x, y);
    const base = { id: uid(), color: S.color, size: S.tool === 'eraser' ? S.eSize : S.size };
    const sp = S.snap && !DRAW_TOOLS.includes(S.tool) ? snapPt(x, y) : [x, y];
    const type = S.tool === 'shape' ? 'shape' : S.tool;
    const o = DRAW_TOOLS.includes(S.tool)
      ? { ...base, type: S.tool, pts: [x, y] }
      : { ...base, type, x1: sp[0], y1: sp[1], x2: sp[0], y2: sp[1], fill: S.fill };
    if (S.tool === 'shape') o.k = S.shapeKind;
    if (S.tool === 'pen' && S.penStyle !== 'normal') o.ps = S.penStyle;
    if (S.tool === 'hl' && S.hlStyle && S.hlStyle !== 'classic') o.hs = S.hlStyle;
    if (S.dash && !DRAW_TOOLS.includes(S.tool)) o.dash = true;
    if (S.tool === 'arrow' && S.both) o.both = true;
    S.drawing = { o, page: S.cur, buf: [], timer: null, dirty: false };
    S.pages[S.cur].push(o);
    emit('obj:add', { page: S.cur, obj: clone(o) });
    render();
  }

  function xformMove(e) {
    const xf = S.xf;
    if (xf.mode === 'gmove' || xf.mode === 'gresize') {
      const [x, y] = pos(e);
      let sx = 1, dx = 0, dy = 0, bb = null;
      if (xf.mode === 'gmove') { dx = x - xf.x0; dy = y - xf.y0; if (!xf.moved && Math.hypot(dx, dy) < 3) return; xf.moved = true; }
      else { bb = xf.bb; sx = Math.max(0.1, (x - bb.x) / bb.w, (y - bb.y) / bb.h); }
      xf.ids.forEach((id) => {
        const o = findObj(xf.page, id); if (!o) return;
        if (bb) scaleObj(o, xf.origs[id], bb.x, bb.y, sx, sx); else moveObj(o, xf.origs[id], dx, dy);
      });
      const t = performance.now();
      if (t - xf.last > 60) { xf.last = t; xf.ids.forEach((id) => { const o = findObj(xf.page, id); if (o) emit('obj:geom', { page: xf.page, id, g: geomOf(o) }); }); }
      render(); return;
    }
    const o = findObj(xf.page, xf.id);
    if (!o) { S.xf = null; return; }
    const [x, y] = pos(e);
    if (xf.mode === 'move') {
      const dx = x - xf.x0, dy = y - xf.y0;
      if (!xf.moved && Math.hypot(dx, dy) < 3) return;
      xf.moved = true;
      moveObj(o, xf.orig, dx, dy);
    } else {
      const b = bbox(xf.orig);
      let sx = Math.max(0.08, (x - b.x) / b.w), sy = Math.max(0.08, (y - b.y) / b.h);
      if (xf.orig.type === 'image' || xf.orig.type === 'text') sx = sy = Math.max(sx, sy);
      scaleObj(o, xf.orig, b.x, b.y, sx, sy);
    }
    const t = performance.now();
    if (t - xf.last > 60) { xf.last = t; emit('obj:geom', { page: xf.page, id: xf.id, g: geomOf(o) }); }
    render();
  }
  function xformEnd() {
    const xf = S.xf; S.xf = null;
    if (!xf) return;
    if (xf.mode === 'gmove' || xf.mode === 'gresize') {
      if (xf.moved || xf.mode === 'gresize') xf.ids.forEach((id) => { const o = findObj(xf.page, id); if (o) emit('obj:geom', { page: xf.page, id, g: geomOf(o) }); });
      return;
    }
    const o = findObj(xf.page, xf.id);
    if (o && (xf.moved || xf.mode === 'resize')) emit('obj:geom', { page: xf.page, id: xf.id, g: geomOf(o) });
  }

  function eraseAt(x, y) {
    const o = hitTest(x, y); if (!o) return;
    const p = S.pages[S.cur]; const i = p.indexOf(o); if (i >= 0) p.splice(i, 1);
    emit('obj:del', { page: S.cur, id: o.id }); render();
  }

  function onMove(e) {
    updateCursor(e);
    if (S.erasing) { eraseAt(...pos(e)); return; }
    if (S.xf) { xformMove(e); return; }
    if (S.lasso) {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of evs.length ? evs : [e]) { const [x, y] = pos(ev), n = S.lasso.length; if (Math.hypot(x - S.lasso[n - 2], y - S.lasso[n - 1]) >= 3) S.lasso.push(x, y); }
      render(); return;
    }
    if (PTR.includes(S.tool)) {
      if (isTeacher() && (e.pointerType === 'mouse' || S.laserOn)) sendLaser(e);
      return;
    }
    const d = S.drawing;
    if (!d) return;
    const o = d.o;
    if (o.pts) {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      for (const ev of evs.length ? evs : [e]) {
        let [x, y] = pos(ev);
        if (S.lock) [x, y] = SB.edgeProject(S.lock, x, y);
        const n = o.pts.length;
        if (Math.hypot(x - o.pts[n - 2], y - o.pts[n - 1]) < 0.8) continue;
        o.pts.push(x, y); d.buf.push(x, y);
      }
    } else {
      let [x, y] = pos(e);
      if (S.snap) [x, y] = snapPt(x, y);
      if (S.lock) [x, y] = SB.edgeProject(S.lock, x, y);
      o.x2 = x; o.y2 = y; d.dirty = true;
    }
    scheduleFlush(d);
    render();
  }

  function onUp() {
    if (S.erasing) { S.erasing = false; return; }
    if (S.xf) { xformEnd(); return; }
    if (S.lasso) { lassoEnd(); return; }
    if (S.laserOn) { S.laserOn = false; return; }
    if ((S.tool === 'text' || S.tool === 'note') && S.textAt) { const at = S.textAt; S.textAt = null; if (canDraw()) openTextBox(S.tool === 'note' ? { x: Math.max(0, at[0] - 150), y: Math.max(0, at[1] - 40), note: true, w: 300, h: 220, color: NOTE_COLORS[S.noteIdx % NOTE_COLORS.length] } : { x: at[0], y: at[1] }); return; }
    const d = S.drawing;
    if (!d) return;
    clearTimeout(d.timer); d.timer = null;
    flush(d);
    S.drawing = null;
    const locked = S.lock; S.lock = null;
    if (S.smart && !locked && d.o.type === 'pen' && d.o.pts) {
      const shape = recognize(d.o.pts);
      if (shape) {
        const name = shape._name; delete shape._name;
        const o = { id: d.o.id, color: d.o.color, size: d.o.size, fill: false, ...shape };
        const p = S.pages[d.page];
        const i = p.findIndex((q) => q.id === o.id);
        if (i >= 0) { p[i] = o; emit('obj:replace', { page: d.page, obj: clone(o) }); render(); toast(`Auto shape: made a perfect ${name} ✨`, { id: 'auto', ms: 1300 }); }
      }
    }
  }

  bC.addEventListener('pointerdown', onDown);
  bC.addEventListener('pointermove', onMove);
  bC.addEventListener('pointerup', onUp);
  bC.addEventListener('pointercancel', onUp);
  bC.addEventListener('pointerleave', () => { $('#cursorRing').style.display = 'none'; });

  const handle = $('#selHandle');
  handle.addEventListener('pointerdown', (e) => {
    if (S.grp) {
      const list = grpObjs(); if (!list.length || !isTeacher()) return;
      e.preventDefault(); e.stopPropagation(); handle.setPointerCapture(e.pointerId);
      S.xf = { mode: 'gresize', page: S.grp.page, ids: S.grp.ids.slice(), origs: Object.fromEntries(list.map((o) => [o.id, clone(o)])), bb: grpBox(list), last: 0, moved: true };
      return;
    }
    const o = S.sel && findObj(S.sel.page, S.sel.id);
    if (!o || !isTeacher()) return;
    e.preventDefault(); e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    S.xf = { mode: 'resize', id: o.id, page: S.sel.page, orig: clone(o), last: 0, moved: true };
  });
  handle.addEventListener('pointermove', (e) => { if (S.xf && (S.xf.mode === 'resize' || S.xf.mode === 'gresize')) xformMove(e); });
  handle.addEventListener('pointerup', () => { if (S.xf && (S.xf.mode === 'resize' || S.xf.mode === 'gresize')) xformEnd(); });
  handle.addEventListener('pointercancel', () => { if (S.xf && (S.xf.mode === 'resize' || S.xf.mode === 'gresize')) xformEnd(); });

  // brush-size ring that follows the mouse
  function updateCursor(e) {
    const ring = $('#cursorRing');
    if (e.pointerType !== 'mouse' || !canDraw() || !DRAW_TOOLS.includes(S.tool)) { ring.style.display = 'none'; return; }
    const w = S.tool === 'eraser' ? S.eSize * 3 : S.tool === 'hl' ? S.size * 3.2 : Math.max(S.size, 4);
    const r = stage.getBoundingClientRect();
    const dia = Math.max(8, w * S.scale);
    ring.style.display = 'block';
    ring.style.width = ring.style.height = dia + 'px';
    ring.style.left = e.clientX - r.left + 'px';
    ring.style.top = e.clientY - r.top + 'px';
    ring.style.background = S.tool === 'eraser' ? 'rgba(255,255,255,.25)' : S.tool === 'hl' ? S.color + '55' : S.color;
    ring.style.borderStyle = S.tool === 'eraser' ? 'dashed' : 'solid';
  }

  // ---------- text tool (new text and editing existing text) ----------
  function openTextBox(t) {
    closeTextBox(true);
    const fs = t.fs || Math.round(16 + S.size * 2.2);
    const ta = document.createElement('textarea');
    ta.className = 'text-box';
    ta.placeholder = 'Type here…';
    ta.rows = 1;
    ta.value = t.text || '';
    const font = t.f || S.font;
    ta.style.left = (t.x - S.vx) * S.scale + 'px';
    ta.style.top = (t.y - S.vy) * S.scale + 'px';
    ta.style.fontSize = fs * S.scale + 'px';
    ta.style.fontFamily = FONTS[font];
    ta.style.lineHeight = '1.3';
    ta.style.color = t.color || S.color;
    if (t.note) {
      ta.classList.add('note-box');
      ta.style.fontFamily = FONTS.hand; ta.style.fontSize = 32 * S.scale + 'px'; ta.style.lineHeight = '1.25';
      ta.style.width = t.w * S.scale + 'px'; ta.style.height = t.h * S.scale + 'px';
      ta.style.background = t.color; ta.style.color = '#1f2937'; ta.style.padding = 16 * S.scale + 'px';
      ta.placeholder = 'Write a note…';
    }
    stage.appendChild(ta);
    S.tbox = { ta, x: t.x, y: t.y, fs, color: t.color || S.color, f: font, page: S.cur, editId: t.editId || null, note: !!t.note, w: t.w, h: t.h };
    const grow = () => { if (t.note) return; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ta.addEventListener('input', grow);
    ta.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Escape') closeTextBox(false);
      else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) closeTextBox(true);
    });
    ta.addEventListener('blur', () => closeTextBox(true));
    setTimeout(() => { ta.focus(); grow(); }, 0);
  }

  function editText(o) {
    if (o.type === 'note') return openTextBox({ x: o.x, y: o.y, text: o.text, note: true, w: o.w, h: o.h, color: o.color, editId: o.id });
    openTextBox({ x: o.x, y: o.y, fs: o.fs, color: o.color, f: o.f || 'sans', text: o.text, editId: o.id });
  }

  function closeTextBox(commit) {
    const t = S.tbox;
    if (!t) return;
    S.tbox = null;
    const txt = t.ta.value.replace(/\s+$/, '');
    t.ta.remove();
    if (!commit || !S.pages[t.page]) return;
    if (t.editId) {
      const o = findObj(t.page, t.editId);
      if (!o) return;
      if (!txt.trim()) { deleteSel(); return; }
      if (txt !== o.text) { o.text = txt; emit('obj:replace', { page: t.page, obj: clone(o) }); render(); }
    } else if (txt.trim() && t.note) {
      S.noteIdx++;
      addObj({ id: uid(), type: 'note', x: t.x, y: t.y, w: t.w, h: t.h, text: txt, fs: 32, color: t.ta.style.background ? NOTE_COLORS[(S.noteIdx - 1) % NOTE_COLORS.length] : NOTE_COLORS[0] }, t.page);
    } else if (txt.trim()) {
      addObj({ id: uid(), type: 'text', x: t.x, y: t.y, text: txt, fs: t.fs, color: t.color, f: t.f }, t.page);
    }
  }

  // ---------- laser pointer ----------
  let lastLaser = 0;
  function sendLaser(e) {
    const [x, y] = pos(e);
    const sp = S.tool === 'spot';
    showLaser(x, y, sp);
    const now = performance.now();
    if (now - lastLaser < 30) return;
    lastLaser = now;
    emit('laser', { x, y, s: sp });
  }
  function showLaser(x, y, spot) {
    const d = $('#laserDot'), sp = $('#spot');
    const px = (x - S.vx) * S.scale, py = (y - S.vy) * S.scale;
    if (spot) {
      d.style.display = 'none';
      const r = 170 * S.scale;
      sp.style.display = 'block';
      sp.style.background = `radial-gradient(circle ${r}px at ${px}px ${py}px, rgba(0,0,0,0) 0, rgba(0,0,0,0) ${r * 0.8}px, rgba(0,0,0,.78) ${r * 1.15}px)`;
    } else {
      sp.style.display = 'none';
      d.style.display = 'block';
      d.style.left = px + 'px';
      d.style.top = py + 'px';
    }
    clearTimeout(S.laserT);
    S.laserT = setTimeout(() => { d.style.display = 'none'; sp.style.display = 'none'; }, spot ? 2500 : 1500);
  }

  // ---------- images & PDF ----------
  function readScaled(file, maxDim) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        const im = new Image();
        im.onerror = reject;
        im.onload = () => {
          const k = Math.min(1, maxDim / Math.max(im.naturalWidth, im.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
          const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, c.width, c.height);
          const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          resolve({ src: c.toDataURL(type, 0.93), w: c.width, h: c.height });
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  // ask how big an uploaded picture / PDF should be placed on the board
  function askFit(what) {
    return new Promise((resolve) => {
      let m = document.getElementById('mFit');
      if (!m) {
        m = document.createElement('div'); m.id = 'mFit'; m.className = 'modal hidden';
        m.innerHTML = '<div class="sheet"><div class="sheet-head"><h3 id="fitTitle">Place on board</h3></div><p class="hint">Choose how it sits on the board. You can change it later with the buttons that appear when you select it.</p><div class="fit-opts"><button class="btn primary" data-fit="full"><b>Full screen</b><small>Fills the board, keeps the shape</small></button><button class="btn soft" data-fit="stretch"><b>Stretch</b><small>Fills every corner (can look stretched)</small></button><button class="btn ghost" data-fit="normal"><b>Normal size</b><small>Smaller, write around it</small></button></div></div>';
        document.body.append(m);
      }
      $('#fitTitle').textContent = 'Place ' + what + ' on the board';
      openModal('mFit');
      const done = (v) => { closeModal('mFit'); m.removeEventListener('click', onc); resolve(v); };
      const onc = (e) => { const b = e.target.closest('[data-fit]'); if (b) done(b.dataset.fit); else if (e.target === m) done('normal'); };
      m.addEventListener('click', onc);
    });
  }
  function stretchBoard(o) { o.x = 0; o.y = 0; o.w = W; o.h = H; }
  function fillBoard(o) {
    const k = Math.min(W / o.w, H / o.h);
    const w = o.w * k, h = o.h * k;
    o.x = (W - w) / 2; o.y = (H - h) / 2; o.w = w; o.h = h;
  }

  async function insertImage(file) {
    if (!file) return;
    try {
      const mode = await askFit('the image');
      const { src, w, h } = await readScaled(file, 2600);
      const k = mode === 'full' ? Math.min(W / w, H / h) : Math.min((W * 0.8) / w, (H * 0.8) / h);
      const ob = { id: uid(), type: 'image', x: (W - w * k) / 2, y: (H - h * k) / 2, w: w * k, h: h * k, src };
      if (mode === 'stretch') stretchBoard(ob);
      addObj(ob);
      toast(mode === 'full' ? 'Image added full screen 🖼️' : 'Image added. Use the Select tool to move or resize it 🖼️');
    } catch { toast('Could not load the image.'); }
  }

  const addPage = () => new Promise((resolve) => {
    if (!S.socket) return resolve(null);
    S.socket.emit('page:add', null, (r) => resolve(r && r.ok ? r.index : null));
  });

  async function importPdf(file) {
    if (!file) return;
    try {
      const mode = await askFit('the PDF pages');
      toast('Loading PDF…', { id: 'pdf', ms: 0 });
      const V = '3.11.174';
      await loadScript(`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${V}/pdf.min.js`);
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${V}/pdf.worker.min.js`;
      const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const n = Math.min(pdf.numPages, 40);
      const useCurrent = S.pages[S.cur].length === 0;
      let first = null, used = 0;
      for (let i = 1; i <= n; i++) {
        toast(`Importing PDF: page ${i} / ${n}`, { id: 'pdf', ms: 0 });
        const page = await pdf.getPage(i);
        const v0 = page.getViewport({ scale: 1 });
        const f = Math.min(W / v0.width, H / v0.height);
        // render at about 2x the board width so text stays sharp, keep the size sensible for many pages
        const target = used > 9e6 ? 1.4 : 2.0;
        const vp = page.getViewport({ scale: f * target });
        const c = document.createElement('canvas');
        c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const cx = c.getContext('2d');
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: cx, viewport: vp }).promise;
        let src = c.toDataURL('image/jpeg', used > 9e6 ? 0.85 : 0.94);
        if (src.length > 3.2e6) src = c.toDataURL('image/jpeg', 0.86);
        used += src.length;
        const idx = i === 1 && useCurrent ? S.cur : await addPage();
        if (idx === null) { toast('Page limit reached.'); break; }
        if (first === null) first = idx;
        const kk = mode === 'full' ? 1 : 0.85;
        const w = v0.width * f * kk, h = v0.height * f * kk;
        addObj({ id: uid(), type: 'image', x: (W - w) / 2, y: (H - h) / 2, w, h, src }, idx);
      }
      if (first !== null) goPage(first);
      toastDone('pdf');
      toast(`PDF imported (${n} pages) 📄`);
    } catch (err) {
      toastDone('pdf');
      toast('PDF import failed. Please check your internet connection.');
      console.error(err);
    }
  }

  // ---------- export ----------
  async function pageCanvas(idx, E) {
    const objs = S.pages[idx] || [];
    await Promise.all(objs.filter((o) => o.type === 'image').map(imgReady));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const layer = document.createElement('canvas');
    layer.width = W * E; layer.height = H * E;
    const lx = layer.getContext('2d'); lx.scale(E, E);
    objs.forEach((o) => drawObj(lx, o));
    const out = document.createElement('canvas');
    out.width = W * E; out.height = H * E;
    const ox = out.getContext('2d'); ox.scale(E, E);
    paintBg(ox, bgOf(idx));
    ox.setTransform(1, 0, 0, 1, 0, 0);
    ox.drawImage(layer, 0, 0);
    return out;
  }

  const SB = {};
  function saveBlob(blob, name) {
    if (SB.saveHook) return SB.saveHook(blob, name);
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
    return Promise.resolve();
  }

  const fileBase = () => 'smartboard-' + ((S.title || '').trim().replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || S.code);

  async function exportPng() {
    const c = await pageCanvas(S.cur, 1.5);
    c.toBlob((b) => { saveBlob(b, `${fileBase()}-page${S.cur + 1}.png`); }, 'image/png');
    toast('Saving PNG 🖼️');
  }

  async function exportPdf() {
    try {
      toast('Creating PDF…', { id: 'exp', ms: 0 });
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [W, H], compress: true });
      for (let i = 0; i < S.pages.length; i++) {
        const c = await pageCanvas(i, 1.25);
        if (i > 0) pdf.addPage([W, H], 'landscape');
        pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, W, H);
      }
      await saveBlob(pdf.output('blob'), `${fileBase()}.pdf`);
      toastDone('exp');
      toast('PDF saved 📄');
    } catch (err) {
      toastDone('exp');
      toast('Could not create the PDF. Please check your internet connection.');
      console.error(err);
    }
  }

  // ---------- PWA: service worker, install button, offline bar ----------
  let deferredPrompt = null;
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function setupPwa() {
    const btn = $('#installBtn'), bar = $('#offlineBar');
    if ('serviceWorker' in navigator && btn) {
      const reg = () => navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('Service worker failed:', e));
      if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg);
    }
    if (btn) {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (!isStandalone()) btn.classList.remove('hidden');
      });
      btn.onclick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        btn.classList.add('hidden');
      };
      window.addEventListener('appinstalled', () => { btn.classList.add('hidden'); toast('SmartBoard installed 🎉'); });
      if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone()) $('#iosHint').classList.remove('hidden');
    }
    if (bar) {
      const sync = () => bar.classList.toggle('hidden', navigator.onLine);
      window.addEventListener('online', () => { sync(); toast('Back online ✅'); });
      window.addEventListener('offline', sync);
      sync();
    }
  }

  function setPresent(on) {
    if (on && !S.joined) return;
    S.present = !!on;
    $('#app').classList.toggle('presenting', S.present);
    closeTextBox(true);
    ['#stampMenu', '#shapeMenu', '#penMenu', '#pPop', '#people', '#teachMenu', '#exportMenu', '#reactMenu'].forEach((q) => { const e = $(q); if (e) e.classList.add('hidden'); });
    if (S.present) {
      toast('Present mode: press Esc or F to exit', { ms: 2200 });
      try { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch { /* optional */ }
    } else {
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* ignore */ }
    }
    requestAnimationFrame(fit);
    setTimeout(fit, 250);
  }

  function toggleFullscreen() {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => toast('Fullscreen is not available here.'));
    } catch { toast('Fullscreen is not available here.'); }
  }

  function toggleSmart() {
    S.smart = !S.smart;
    $('#smartBtn').classList.toggle('on', S.smart);
    $$('.pp-smart').forEach((b) => b.classList.toggle('on', S.smart));
    toast(S.smart ? 'Auto shape ON: draw a rough circle, box, triangle or line with the pen and it turns perfect ✨' : 'Auto shape OFF', { ms: S.smart ? 4200 : 1800 });
  }

  // ---------- curtain (cover the board, then reveal slowly) ----------
  function setCurtain(c, send) {
    S.curtain = c && typeof c.h === 'number' ? { h: Math.max(0, Math.min(100, c.h)) } : null;
    const el = $('#curtain'); if (!el) return;
    el.classList.toggle('hidden', !S.curtain);
    if (S.curtain) el.style.height = S.curtain.h + '%';
    $$('.curtain-btn').forEach((b) => b.classList.toggle('on', !!S.curtain));
    if (send && isTeacher()) emit('curtain:set', S.curtain ? { on: true, h: S.curtain.h } : { on: false });
  }
  function toggleCurtain() {
    if (!isTeacher()) return;
    if (S.curtain) { setCurtain(null, true); toast('Curtain removed', { ms: 1200 }); }
    else { setCurtain({ h: 100 }, true); toast('Curtain on: students cannot see the board. Drag the bar down to reveal slowly.', { ms: 3600 }); }
  }
  function initCurtain() {
    const h = $('#curtainHandle'); if (!h) return;
    let drag = false, last = 0;
    const move = (e) => {
      if (!drag) return;
      const r = stage.getBoundingClientRect();
      const pct = 100 - ((e.clientY - r.top) / r.height) * 100;
      const t = performance.now(); const fin = e.type !== 'pointermove';
      setCurtain({ h: pct }, fin || t - last > 60); if (!fin && t - last > 60) last = t;
    };
    h.addEventListener('pointerdown', (e) => { if (!isTeacher()) return; drag = true; h.setPointerCapture(e.pointerId); e.preventDefault(); });
    h.addEventListener('pointermove', move);
    const end = (e) => { if (!drag) return; drag = false; move({ clientY: e.clientY, type: 'up' }); };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  }

  // ---------- present mode: tool popover (shapes, colour, brush / eraser size) ----------
  const PP_SHAPES = [
    ['pen', 'Free pencil', 'pen'], ['line', 'Line', 'line'], ['arrow', 'Arrow', 'arrow'], ['rect', 'Box', 'rect'], ['ellipse', 'Circle', 'ellipse'],
    ['k:triangle', 'Triangle', null], ['k:diamond', 'Diamond', null], ['k:star', 'Star', null], ['k:pentagon', 'Pentagon', null], ['k:hexagon', 'Hexagon', null], ['k:heart', 'Heart', null],
  ];
  function buildPresentPop() {
    const pop = $('#pPop'); if (!pop) return;
    const sh = (k) => { const x = SHAPES[k]; if (!x) return ''; const d = x.heart ? 'M12 21C3 14 3 5.5 8 4.5c2-.3 3.4.8 4 2 .6-1.2 2-2.3 4-2C21 5.5 21 14 12 21Z' : x.p.map(([u, v], i) => `${i ? 'L' : 'M'}${(2 + u * 20).toFixed(1)} ${(2 + v * 20).toFixed(1)}`).join('') + 'Z'; return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="${d}"/></svg>`; };
    const draw = () => {
      const mode = pop.dataset.mode || 'pen';
      pop.textContent = '';
      const row = (cls) => { const r = document.createElement('div'); r.className = 'pp-row ' + (cls || ''); pop.appendChild(r); return r; };
      const lab = (t) => { const l = document.createElement('div'); l.className = 'pp-lab'; l.textContent = t; pop.appendChild(l); };
      const colours = () => {
        lab('Colour');
        const r2 = row('pp-colors');
        COLORS.forEach((c) => {
          const b = document.createElement('button'); b.className = 'swatch' + (S.color === c ? ' active' : ''); b.style.background = c; b.title = c;
          b.onclick = (e) => { e.stopPropagation(); setColor(c); draw(); };
          r2.appendChild(b);
        });
        const cu = document.createElement('button'); cu.className = 'custom-color'; cu.title = 'Mix your own colour'; cu.innerHTML = '<i></i>'; cu.firstChild.style.background = S.color;
        cu.onclick = (e) => { e.stopPropagation(); CP.open(/^#[0-9a-f]{6}$/i.test(S.color) ? S.color : '#1f2937', (c) => { setColor(c); draw(); }, 'Pen colour'); };
        r2.appendChild(cu);
      };
      const shades = () => {
        const m = /^#([0-9a-f]{6})$/i.exec(S.color); if (!m) return;
        const n = parseInt(m[1], 16); let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0, sat = 0; const l0 = (mx + mn) / 2;
        if (d) { sat = d / (1 - Math.abs(2 * l0 - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
        const hx = (L) => { const c = (1 - Math.abs(2 * L - 1)) * sat, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), mm = L - c / 2; const [R, G, B] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return '#' + [R, G, B].map((v) => Math.round((v + mm) * 255).toString(16).padStart(2, '0')).join(''); };
        lab('Shade (light to dark)');
        const rs = row('pp-colors');
        [0.88, 0.76, 0.64, 0.52, 0.42, 0.32, 0.22, 0.14].forEach((L) => {
          const c = hx(L); const bt = document.createElement('button'); bt.className = 'swatch' + (c === S.color ? ' active' : ''); bt.style.background = c; bt.title = 'Shade';
          bt.onclick = (e) => { e.stopPropagation(); setColor(c); draw(); }; rs.appendChild(bt);
        });
      };
      const sizer = (title, get, set, max) => {
        lab(title);
        const r3 = row('pp-size');
        const prev = document.createElement('span'); prev.className = 'pp-prev'; const dot = document.createElement('i'); prev.appendChild(dot);
        const upd = () => { const v = get(); const px = Math.max(3, Math.min(34, mode === 'eraser' ? v * 1.4 : v * (mode === 'hl' ? 1.6 : 1))); dot.style.width = dot.style.height = px + 'px'; dot.style.background = mode === 'eraser' ? 'transparent' : S.color; dot.style.border = mode === 'eraser' ? '2px dashed var(--text)' : '0'; };
        const rng = document.createElement('input'); rng.type = 'range'; rng.min = 1; rng.max = max; rng.value = get();
        const num = document.createElement('b'); num.className = 'pp-num'; num.textContent = get();
        rng.oninput = () => { set(+rng.value); num.textContent = rng.value; upd(); updateSizeDot(); };
        r3.append(prev, rng, num); upd();
      };
      if (mode === 'eraser') {
        lab('Eraser type');
        const r1 = row('pp-opts');
        [['Rub out (like a duster)', false], ['Whole stroke (tap to remove)', true]].forEach(([t, v]) => {
          const b = document.createElement('button'); b.className = 'pp-opt' + (S.strokeErase === v ? ' on' : ''); b.innerHTML = `<span>${t}</span>`;
          b.onclick = (e) => { e.stopPropagation(); S.strokeErase = v; draw(); };
          r1.appendChild(b);
        });
        sizer('Eraser size', () => S.eSize, (v) => { S.eSize = v; }, 40);
        return;
      }
      if (mode === 'hl') { colours(); shades(); sizer('Marker thickness', () => S.size, (v) => { S.size = v; }, 30); return; }
      lab('Draw with');
      const r1 = row('pp-shapes');
      PP_SHAPES.forEach(([id, name, ic]) => {
        const b = document.createElement('button'); b.className = 'pp-shape'; b.title = name;
        b.innerHTML = (ic ? svgOf(ic) : sh(id.slice(2))) + `<span>${name}</span>`;
        const on = id.startsWith('k:') ? (S.tool === 'shape' && S.shapeKind === id.slice(2)) : S.tool === id;
        if (on) b.classList.add('on');
        b.onclick = (e) => {
          e.stopPropagation();
          if (id.startsWith('k:')) { S.shapeKind = id.slice(2); setTool('shape'); }
          else { if (id === 'arrow') S.both = false; setTool(id); }
          draw();
        };
        r1.appendChild(b);
      });
      lab('Pen style');
      const rp = row('pp-pens');
      PENS.forEach(([id, name]) => {
        const b = document.createElement('button'); b.className = 'pp-pen' + (S.tool === 'pen' && S.penStyle === id ? ' on' : ''); b.title = name;
        const c = document.createElement('canvas'); c.width = 168; c.height = 44; const x = c.getContext('2d'); x.scale(2, 2);
        const pts = []; for (let i = 0; i <= 34; i++) pts.push(6 + i * 2.2, 11 + Math.sin(i / 3.6) * 5);
        drawObj(x, { type: 'pen', ps: id === 'normal' ? undefined : id, color: '#f1f5f9', size: 3.2, pts });
        const sp = document.createElement('span'); sp.textContent = name; b.append(c, sp);
        b.onclick = (e) => { e.stopPropagation(); S.penStyle = id; setTool('pen'); draw(); };
        rp.appendChild(b);
      });
      colours();
      shades();
      sizer('Brush thickness', () => S.size, (v) => { S.size = v; }, 30);
      const r4 = row('pp-opts');
      const mk = (txt, icon, on, fn, cls) => { const b = document.createElement('button'); b.className = 'pp-opt ' + (cls || '') + (on ? ' on' : ''); b.innerHTML = svgOf(icon) + `<span>${txt}</span>`; b.onclick = (e) => { e.stopPropagation(); fn(); draw(); }; r4.appendChild(b); };
      mk('Fill', 'fill', S.fill, () => { S.fill = !S.fill; $('#fillBtn').classList.toggle('on', S.fill); });
      mk('Dashed', 'dash', S.dash, () => { S.dash = !S.dash; $('#dashBtn').classList.toggle('on', S.dash); });
      mk('Auto shape', 'wand', S.smart, toggleSmart, 'pp-smart');
    };
    pop._draw = draw;
    ['pen', 'hl', 'eraser'].forEach((m) => {
      const btn = $(`[data-ptool="${m}"]`); if (!btn) return;
      btn.addEventListener('click', () => {
        const open = !pop.classList.contains('hidden');
        if (open && pop.dataset.mode === m) { pop.classList.add('hidden'); return; }
        pop.dataset.mode = m; draw(); pop.classList.remove('hidden');
      });
    });
    document.addEventListener('pointerdown', (e) => { if (!pop.classList.contains('hidden') && !e.target.closest('#pPop') && !e.target.closest('[data-ptool]')) pop.classList.add('hidden'); });
  }

  // ---------- wire up UI ----------
  let titleT = null;
  function init() {
    applyTheme(store.get('sb_theme', 'ink'));
    paintIcons();
    $$('[data-lab]').forEach((b) => { const sp = document.createElement('span'); sp.className = 'lab'; sp.textContent = b.dataset.lab; b.appendChild(sp); });
    setupPwa();

    // colour swatches
    const box = $('#colors');
    COLORS.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'swatch'; b.dataset.c = c; b.style.background = c; b.title = c;
      b.onclick = () => { if (['eraser', 'laser', 'select', 'lasso', 'spot'].includes(S.tool)) setTool('pen'); setColor(c); };
      box.appendChild(b);
    });
    setColor(S.color);

    $('#customColorBtn').onclick = () => CP.open(/^#[0-9a-f]{6}$/i.test(S.color) ? S.color : '#1f2937', (c) => { if (['eraser', 'laser', 'select', 'lasso', 'spot'].includes(S.tool)) setTool('pen'); setColor(c); }, 'Pen colour');
    $('#sizeRange').addEventListener('input', (e) => { if (S.tool === 'eraser') S.eSize = +e.target.value; else S.size = +e.target.value; updateSizeDot(); });
    $('#fillBtn').onclick = () => { S.fill = !S.fill; $('#fillBtn').classList.toggle('on', S.fill); toast(S.fill ? 'Shapes will be filled' : 'Shapes will be outline only'); };
    $('#smartBtn').onclick = toggleSmart;
    $('#fontBtn').onclick = () => {
      S.font = S.font === 'sans' ? 'hand' : 'sans';
      $('#fontBtn').style.fontFamily = FONTS[S.font];
      $('#fontBtn').classList.toggle('on', S.font === 'hand');
      toast(S.font === 'hand' ? 'Handwriting font for new text' : 'Clean font for new text', { ms: 1600 });
    };

    $$('.tool[data-tool]').forEach((b) => { b.onclick = () => { if (b.dataset.tool === 'arrow') S.both = false; setTool(b.dataset.tool); }; });
    $('#imgBtn').onclick = () => $('#imgInput').click();
    $('#pdfBtn').onclick = () => $('#pdfInput').click();
    $('#imgInput').onchange = (e) => { insertImage(e.target.files[0]); e.target.value = ''; };
    $('#pdfInput').onchange = (e) => { importPdf(e.target.files[0]); e.target.value = ''; };

    $('#undoBtn').onclick = () => emit('obj:undo', { page: S.cur });
    $('#redoBtn').onclick = () => emit('obj:redo', { page: S.cur });
    $('#clearBtn').onclick = async () => { if (await uiConfirm('Clear everything on this page?', 'Clear page', true)) emit('page:clear', { page: S.cur }); };
    $('#bgBtn').onclick = () => openModal('mBg');
    $('#studentDrawToggle').onchange = (e) => { S.studentDraw = e.target.checked; emit('perm:set', S.studentDraw); toast(S.studentDraw ? 'Students can now draw ✏️' : 'Students can only view 👀'); };

    $('#prevPage').onclick = () => { if (S.cur > 0) goPage(S.cur - 1); };
    $('#nextPage').onclick = () => { if (S.cur < S.pages.length - 1) goPage(S.cur + 1); };
    $('#addPage').onclick = () => emit('page:add', null);
    $('#delPage').onclick = async () => {
      if (S.pages.length < 2) return toast('At least one page is required.');
      if (await uiConfirm('Delete this page?', 'Delete', true)) emit('page:del', { index: S.cur });
    };

    $('#selDup').onclick = duplicateSel;
    $('#selStretch').onclick = () => { const o = S.sel && findObj(S.sel.page, S.sel.id); if (!o || o.type !== 'image') return; stretchBoard(o); emit('obj:replace', { page: S.sel.page, obj: clone(o) }); render(); placeSel(); toast('Image stretched to the board'); };
    $('#selFull').onclick = () => { const o = S.sel && findObj(S.sel.page, S.sel.id); if (!o || o.type !== 'image') return; fillBoard(o); emit('obj:replace', { page: S.sel.page, obj: clone(o) }); render(); placeSel(); toast('Image fitted to the full board'); };
    $('#selDel').onclick = deleteSel;
    $('#selFont').onclick = toggleSelFont;
    $('#selFill').onclick = toggleSelFill;
    $('#selColorWrap').onclick = () => { if (S.grp) { const f = grpObjs().find((q) => q.type !== 'image'); if (f) CP.open(/^#[0-9a-f]{6}$/i.test(f.color) ? f.color : '#000000', recolorGrp, 'Colour of selection'); return; } const o = S.sel && findObj(S.sel.page, S.sel.id); if (o) CP.open(/^#[0-9a-f]{6}$/i.test(o.color) ? o.color : '#000000', recolorSel, 'Object colour'); };
    $('#dashBtn').onclick = () => { S.dash = !S.dash; $('#dashBtn').classList.toggle('on', S.dash); toast(S.dash ? 'Dashed lines ON' : 'Dashed lines OFF', { ms: 1400 }); };
    $('#snapBtn').onclick = () => { S.snap = !S.snap; $('#snapBtn').classList.toggle('on', S.snap); toast(S.snap ? 'Snap to grid ON: shapes and lines land on grid points' : 'Snap to grid OFF', { ms: 2200 }); };

    $('#boardTitle').addEventListener('input', (e) => {
      if (!isTeacher()) return;
      S.title = e.target.value.slice(0, 60);
      clearTimeout(titleT);
      titleT = setTimeout(() => { emit('room:title', S.title); fire('title', S.title); }, 400);
    });
    hook('net:room:title', (t) => { S.title = t || ''; $('#boardTitle').value = S.title; fire('title', S.title); });

    // menus
    const menus = [['exportBtn', 'exportMenu'], ['teachBtn', 'teachMenu']];
    menus.forEach(([b, m]) => {
      $('#' + b).onclick = (e) => { e.stopPropagation(); menus.forEach(([, o]) => { if (o !== m) $('#' + o).classList.add('hidden'); }); $('#' + m).classList.toggle('hidden'); };
    });
    document.addEventListener('click', (e) => {
      menus.forEach(([, m]) => { if (!e.target.closest('#' + m + ' .keep')) $('#' + m).classList.add('hidden'); });
      const rm = $('#reactMenu'); if (rm && !e.target.closest('#reactBtn')) rm.classList.add('hidden');
      const pm = $('#penMenu'); if (pm && !e.target.closest('#penMenu') && !e.target.closest('[data-tool="pen"]')) pm.classList.add('hidden');
      const sm = $('#stampMenu'), shm = $('#shapeMenu');
      if (sm && !e.target.closest('#stampMenu') && !e.target.closest('[data-tool="stamp"]')) sm.classList.add('hidden');
      if (shm && !e.target.closest('#shapeMenu') && !e.target.closest('[data-tool="shape"]')) shm.classList.add('hidden');
    });
    $('#expPng').onclick = exportPng;
    $('#expPdf').onclick = exportPdf;
    $('#codeChip').onclick = () => openModal('mInvite');
    $('#leaveBtn').onclick = async () => { if (await uiConfirm('Leave this board?', 'Leave')) leaveRoom(); };
    $('#themeBtn').onclick = cycleTheme;
    $('#themeBtnL').onclick = cycleTheme;
    $('#fsBtn').onclick = toggleFullscreen;
    $('#presentBtn').onclick = () => setPresent(true);
    $('#presentExit').onclick = () => setPresent(false);
    $('#pPrev').onclick = () => { if (isTeacher() && S.cur > 0) goPage(S.cur - 1); };
    $('#pAdd').onclick = () => { if (isTeacher()) emit('page:add', null); };
    $('#pNext').onclick = () => { if (isTeacher() && S.cur < S.pages.length - 1) goPage(S.cur + 1); };
    $$('[data-ptool]').forEach((b) => { b.addEventListener('click', () => { if (!['pen', 'hl', 'eraser'].includes(b.dataset.ptool)) { const p = $('#pPop'); if (p) p.classList.add('hidden'); } setTool(b.dataset.ptool); }); });
    buildPresentPop();
    initCurtain();
    initView();
    $('#pUndo').onclick = () => { if (isTeacher()) emit('obj:undo', { page: S.cur }); };
    $('#pRedo').onclick = () => { if (isTeacher()) emit('obj:redo', { page: S.cur }); };
    $$('.curtain-btn').forEach((b) => { b.onclick = () => { $('#teachMenu').classList.add('hidden'); toggleCurtain(); }; });
    $('#dupPage').onclick = () => { if (isTeacher()) { emit('page:dup', { index: S.cur }); toast('Page copied', { ms: 1200 }); } };
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && S.present) setPresent(false); });
    $('#reactBtn').onclick = (e) => { e.stopPropagation(); $('#reactMenu').classList.toggle('hidden'); };

    // modals
    $$('.modal').forEach((m) => {
      m.addEventListener('pointerdown', (e) => { if (e.target === m) { if (m.id === 'mConfirm') settleConfirm(false); else closeModal(m.id); } });
      $$('[data-close]', m).forEach((b) => { b.onclick = () => { if (m.id === 'mConfirm') settleConfirm(false); else closeModal(m.id); }; });
    });
    $('#confirmYes').onclick = () => settleConfirm(true);
    $('#confirmNo').onclick = () => settleConfirm(false);

    // landing
    $('#nameInput').value = store.get('sb_name', '');
    $('#nameInput').addEventListener('input', () => { $('#nameInput').classList.remove('bad'); $('#joinErr').textContent = ''; });
    warmUp();
    $('#createBtn').onclick = createBoard;
    $('#titleInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') createBoard(); });
    $('#joinBtn').onclick = () => joinBoard($('#codeInput').value);
    $('#codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinBoard(e.target.value); });
    $('#nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinBoard($('#codeInput').value); });
    $('#codeInput').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });

    // keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modalStack.length && S.present) { setPresent(false); return; }
      if (e.key === 'Escape' && modalStack.length) {
        const top = modalStack[modalStack.length - 1];
        if (top === 'mConfirm') settleConfirm(false); else closeModal(top);
        return;
      }
      if (!$('#app').classList.contains('active')) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); if (isTeacher()) emit(e.shiftKey ? 'obj:redo' : 'obj:undo', { page: S.cur }); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); if (isTeacher()) emit('obj:redo', { page: S.cur }); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'a' && isTeacher()) { e.preventDefault(); setTool('lasso'); const all = (S.pages[S.cur] || []).filter((o) => o.type !== 'eraser'); S.grp = all.length ? { page: S.cur, ids: all.map((o) => o.id) } : null; render(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); duplicateSel(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && (S.sel || S.grp)) { e.preventDefault(); deleteSel(); return; }
      if (e.key === 'Escape') { S.grp = null; select(null); return; }
      if (k === 'f') { setPresent(!S.present); return; }
      if (e.key === '?') { openModal('mHelp'); return; }
      const map = { n: 'note', j: 'spot', s: 'shape', v: 'select', q: 'lasso', p: 'pen', h: 'hl', e: 'eraser', l: 'line', a: 'arrow', r: 'rect', o: 'ellipse', t: 'text', k: 'laser' };
      if (map[k] && canDraw() && (!['laser', 'select', 'lasso', 'spot'].includes(map[k]) || isTeacher())) { e.preventDefault(); setTool(map[k]); }
      if (isTeacher() && e.key === 'ArrowRight' && S.cur < S.pages.length - 1) goPage(S.cur + 1);
      if (isTeacher() && e.key === 'ArrowLeft' && S.cur > 0) goPage(S.cur - 1);
    });

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
    paintBg(bgX, 'white');
    fire('init');

    // auto-join when opened with ?room=CODE
    const q = new URLSearchParams(location.search).get('room');
    if (q) { $('#codeInput').value = q.toUpperCase(); joinBoard(q); }
  }

  Object.assign(SB, {
    joinBoard, saveKey, store,
    S, W, H, $, $$, ICONS, THEMES, store, uid, clone, emit, toast, toastDone, hook, fire, paintIcons, svgOf,
    openModal, closeModal, uiConfirm, addObj, addPage, goPage, setTool, setColor, select, isTeacher, canDraw,
    updateUI, goPage, bboxOf: bbox, inBrk, applyView, zoomAt, resetView, pos, joinBoard, loadScript, SHAPES, pageCanvas, setPresent, bgOf, BG, BG_LIST, paintBg, applyBg, drawObj, PENS, applyTheme, saveBlob, start: init,
    ink: () => (BG[S.bg].dark ? '#f1f5f9' : INK),
  });
  window.SB = SB;
})();
