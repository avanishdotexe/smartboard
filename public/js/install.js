/* Install popup: shows as soon as the site opens (Android / desktop Chrome / Edge), with steps for iPhone. */
(() => {
  const KEY = 'sb_install_later';
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  let ev = null, card = null, back = null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent) || (/iphone|ipad|ipod/i.test(navigator.userAgent));
  const snoozed = () => { const t = +get(KEY) || 0; return Date.now() - t < 12 * 3600 * 1000; };

  const css = document.createElement('style');
  css.textContent = `
  .inst-card{position:fixed;left:50%;top:50%;opacity:0;transform:translate(-50%,-40%) scale(.92);z-index:600;width:min(440px,calc(100vw - 24px));display:flex;gap:12px;align-items:center;padding:14px;border-radius:20px;background:var(--surface-solid,#fff);color:var(--text,#111);border:1px solid var(--line,#ddd);box-shadow:0 18px 50px rgba(0,0,0,.35);transition:transform .4s cubic-bezier(.2,.9,.3,1.1),opacity .3s;font-family:inherit}
  .inst-back{position:fixed;inset:0;z-index:599;background:rgba(2,6,14,.55);opacity:0;transition:opacity .3s}.inst-back.show{opacity:1}
  .inst-card.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
  .inst-card{flex-direction:column;text-align:center;padding:24px 20px 18px;gap:14px}.inst-card img{width:72px;height:72px;border-radius:20px}.inst-card .ib{width:100%}.inst-card .go{padding:13px 16px;font-size:16px}.inst-card b{font-size:18px}.inst-card span{font-size:13.5px}
  .inst-card img{width:52px;height:52px;border-radius:14px;flex:none}
  .inst-card .it{flex:1;min-width:0}
  .inst-card b{display:block;font-size:15px}
  .inst-card span{display:block;font-size:12.5px;opacity:.75;margin-top:2px;line-height:1.35}
  .inst-card .ib{display:flex;flex-direction:column;gap:6px;flex:none}
  .inst-card button{border:0;border-radius:12px;padding:9px 16px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit}
  .inst-card .go{background:var(--grad,linear-gradient(135deg,#f59e0b,#f97316));color:var(--on-accent,#1b1200)}
  .inst-card .no{background:transparent;color:inherit;opacity:.65;font-weight:600;padding:4px 8px;font-size:12.5px}
  `;
  document.head.appendChild(css);

  function build(ios) {
    if (card || standalone() || snoozed()) return;
    card = document.createElement('div'); card.className = 'inst-card'; card.setAttribute('role', 'dialog');
    card.innerHTML = `<img src="/icons/icon-192.png" alt=""><div class="it"><b>Install SmartBoard</b><span>${ios ? 'Tap <b style="display:inline">Share</b> then <b style="display:inline">Add to Home Screen</b> to install.' : 'Open it like an app: full screen, faster, one tap from your home screen.'}</span></div><div class="ib">${ios ? '' : '<button class="go">Install</button>'}<button class="no">${ios ? 'Got it' : 'Not now'}</button></div>`;
    back = document.createElement('div'); back.className = 'inst-back'; document.body.append(back, card);
    requestAnimationFrame(() => requestAnimationFrame(() => { card.classList.add('show'); back.classList.add('show'); }));
    const close = (later) => { if (later) set(KEY, String(Date.now())); card.classList.remove('show'); back.classList.remove('show'); setTimeout(() => { card && card.remove(); back && back.remove(); card = back = null; }, 500); };
    card.querySelector('.no').onclick = () => close(true);
    const go = card.querySelector('.go');
    if (go) go.onclick = async () => { const ok = await api.prompt(); close(!ok); };
  }

  const api = window.SBInstall = {
    can: () => !!ev && !standalone(),
    async prompt() {
      if (!ev) return false;
      const e = ev; ev = null;
      try { e.prompt(); const r = await e.userChoice; return r && r.outcome === 'accepted'; } catch (x) { return false; }
    },
  };

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ev = e; const go = () => setTimeout(function w() { if (window.__sbWaking) return setTimeout(w, 800); build(false); }, 600); if (document.body) go(); else document.addEventListener('DOMContentLoaded', go); });
  window.addEventListener('appinstalled', () => { set(KEY, String(Date.now() + 3650 * 86400000)); if (card) { card.remove(); back && back.remove(); card = back = null; } });
  if (ios && !standalone()) { const go = () => setTimeout(function w() { if (window.__sbWaking) return setTimeout(w, 800); build(true); }, 1200); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); }
})();

/* when a new version of the app takes over, reload once so the user sees it right away */
(() => {
  if (!('serviceWorker' in navigator)) return;
  const had = !!navigator.serviceWorker.controller; let done = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!had || done) return; done = true; location.reload(); });
})();

/* auto-update: ask the server for its build id; if it changed (new deploy), refresh by itself */
(() => {
  let cur = null, shown = false;
  const get = async () => { try { const r = await fetch('/api/version', { cache: 'no-store' }); return (await r.json()).v; } catch (e) { return null; } };
  const refresh = async () => {
    try { const k = await caches.keys(); await Promise.all(k.map((x) => caches.delete(x))); } catch (e) {}
    try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map((r) => r.update())); } catch (e) {}
    location.reload();
  };
  const banner = () => {
    if (shown) return; shown = true;
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:700;display:flex;gap:10px;align-items:center;padding:10px 12px 10px 16px;border-radius:99px;background:#16a34a;color:#fff;font:700 14px system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35)';
    b.innerHTML = '<span>New version ready</span><button style="border:0;border-radius:99px;padding:7px 14px;font-weight:800;background:#fff;color:#166534;cursor:pointer">Update</button>';
    b.querySelector('button').onclick = refresh; document.body.appendChild(b);
  };
  const check = async () => {
    const v = await get(); if (!cur) { cur = v; return; } if (!v || v === cur) return;
    const onLanding = !!document.querySelector('#landing.active');
    if (onLanding) refresh(); else banner();   // never interrupt a running class
  };
  const start = () => { check(); document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); }); setInterval(check, 3 * 60 * 1000); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* Server wake-up screen: Render's free plan sleeps when idle and needs a while to wake.
 * If the server does not answer quickly, show a friendly loading card with a progress bar until it is ready. */
(function () {
  if (window.SB_DEMO || location.protocol === 'file:') return;
  window.__sbWaking = true; // the install popup waits until the server is ready
  var card = null, t0 = Date.now(), done = false, shown = false, shownAt = 0, pct = 0, raf = 0, tipT = 0, stepT = 0;
  var STEPS = ['Waking up the server', 'Warming up the classroom', 'Sharpening the pens', 'Almost ready'];
  var TIPS = ['💡 Students join with a QR code. No install, no login.', '💡 Circle your work with the lasso, then move it anywhere.', '💡 Draw a rough circle and it turns into a perfect one.', '💡 Add a PDF and use Full screen for the whole class.', '💡 One-tap 👍 / 👎 polls show who is stuck.', '💡 Install the app from the menu for a faster start.'];
  function css() {
    if (document.getElementById('wakeCss')) return;
    var st = document.createElement('style'); st.id = 'wakeCss';
    st.textContent = '.wk-back{position:fixed;left:0;right:0;top:calc(10px + env(safe-area-inset-top,0px));z-index:9999;display:flex;justify-content:center;padding:0 12px;pointer-events:none;animation:wkIn .35s ease both}' +
      '.wk-back.out{animation:wkOut .5s ease both}' +
      '.wk-card{pointer-events:auto;width:min(300px,100%);padding:9px 12px 10px;border-radius:16px;background:linear-gradient(160deg,#14212d,#0d1822);border:1px solid rgba(255,255,255,.12);box-shadow:0 12px 34px rgba(0,0,0,.55);color:#eaf6fb;font-family:Inter,system-ui,sans-serif}' +
      '.wk-row{display:flex;align-items:center;gap:10px;margin-bottom:7px}' +
      '.wk-logo{width:32px;height:32px;flex:none;border-radius:10px;background:linear-gradient(135deg,#ffb08a,#ff6b4a);display:grid;place-items:center;box-shadow:0 4px 14px rgba(255,107,74,.5);animation:wkBob 1.8s ease-in-out infinite}' +
      '.wk-txt{flex:1;min-width:0}.wk-step{font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .3s}' +
      '.wk-tip{font-size:11px;color:#9fc3d1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .35s;margin-top:1px}' +
      '.wk-pct{font-size:20px;font-weight:800;line-height:1;background:linear-gradient(135deg,#ffb08a,#ff6b4a);-webkit-background-clip:text;background-clip:text;color:transparent}.wk-pct small{font-size:12px;margin-left:1px}' +
      '.wk-bar{position:relative;height:7px;border-radius:99px;background:rgba(255,255,255,.09);overflow:hidden}' +
      '.wk-fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:99px;background:linear-gradient(90deg,#ff9a6b,#ff6b4a,#fbbf24);background-size:200% 100%;animation:wkFlow 1.4s linear infinite}' +
      '.wk-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);transform:translateX(-100%);animation:wkShine 1.6s ease-in-out infinite}' +
      '.wk-card.ok .wk-fill{background:linear-gradient(90deg,#10b981,#34d399);animation:none}.wk-card.ok .wk-pct{background:linear-gradient(135deg,#6ee7b7,#10b981);-webkit-background-clip:text;background-clip:text}' +
      '@keyframes wkIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1}}@keyframes wkOut{to{opacity:0;transform:translateY(-10px)}}@keyframes wkBob{50%{transform:translateY(-2px) rotate(-4deg)}}' +
      '@keyframes wkFlow{to{background-position:-200% 0}}@keyframes wkShine{to{transform:translateX(100%)}}' +
      '@media (prefers-reduced-motion:reduce){.wk-logo,.wk-fill,.wk-fill::after{animation:none}}';
    document.head.appendChild(st);
  }
  function show() {
    if (done || shown) return; css(); shown = true; shownAt = Date.now();
    var b = document.createElement('div'); b.className = 'wk-back';
    b.innerHTML = '<div class="wk-card"><div class="wk-row"><div class="wk-logo"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2b0f06" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 12l3-3 3 2 4-4M12 16v4M8 20h8"/></svg></div>' +
      '<div class="wk-txt"><div class="wk-step" id="wkStep"></div></div><div class="wk-pct"><span id="wkNum">0</span><small>%</small></div></div>' +
      '<div class="wk-bar"><div class="wk-fill" id="wkFill"></div></div></div>';
    document.body.appendChild(b); card = b;
    var si = 0;
    var step = document.getElementById('wkStep');
    function swap(el, txt) { el.style.opacity = 0; setTimeout(function () { el.textContent = txt; el.style.opacity = 1; }, 250); }
    step.textContent = STEPS[0] + '…';
    stepT = setInterval(function () { si = Math.min(si + 1, STEPS.length - 1); swap(step, STEPS[si] + '…'); }, 6500);
    (function loop() {
      if (!card) return;
      var el = (Date.now() - shownAt) / 1000;
      var target = done ? 100 : Math.min(94, 100 * (1 - Math.exp(-el / 16)));   // eases up, jumps to 100 when ready
      pct += (target - pct) * (done ? 0.25 : 0.06);
      var n = Math.min(100, Math.round(pct)), f = document.getElementById('wkFill'), nm = document.getElementById('wkNum');
      if (f) f.style.width = pct.toFixed(1) + '%'; if (nm) nm.textContent = n;
      raf = requestAnimationFrame(loop);
    })();
  }
  function ready() {
    done = true; window.__sbWaking = false;
    if (!shown) return;
    var c = card && card.firstChild, step = document.getElementById('wkStep');
    if (c) c.classList.add('ok'); if (step) step.textContent = '✅ Ready!';
    setTimeout(function () {
      if (!card) return; card.classList.add('out'); clearInterval(stepT);
      setTimeout(function () { cancelAnimationFrame(raf); if (card) card.remove(); card = null; }, 520);
    }, 900);
  }
  function ping() {
    if (done) return;
    var ctl = window.AbortController ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);
    fetch('/api/version?_=' + Date.now(), { cache: 'no-store', signal: ctl && ctl.signal })
      .then(function (r) { clearTimeout(to); if (r.ok && r.headers.get('X-SB')) ready(); else throw new Error('waking'); })
      .catch(function () { clearTimeout(to); show(); setTimeout(ping, 2500); });
  }
  setTimeout(function () { if (!done) show(); }, 1200);
  function start() { ping(); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
