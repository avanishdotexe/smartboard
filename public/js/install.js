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

  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ev = e; const go = () => setTimeout(() => build(false), 600); if (document.body) go(); else document.addEventListener('DOMContentLoaded', go); });
  window.addEventListener('appinstalled', () => { set(KEY, String(Date.now() + 3650 * 86400000)); if (card) { card.remove(); back && back.remove(); card = back = null; } });
  if (ios && !standalone()) { const go = () => setTimeout(() => build(true), 1200); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go(); }
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

/* Server wake-up notice: Render's free plan sleeps when idle and needs up to a minute to wake.
 * If the server does not answer quickly, show a friendly message until it is ready. */
(function () {
  if (window.SB_DEMO || location.protocol === 'file:') return;
  var bar = null, t0 = Date.now(), done = false, shown = false;
  function css() {
    if (document.getElementById('wakeCss')) return;
    var st = document.createElement('style'); st.id = 'wakeCss';
    st.textContent = '.wake-bar{position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:9999;max-width:92vw;padding:11px 18px;border-radius:99px;background:linear-gradient(135deg,#f59e0b,#f97316);color:#1f1300;font:700 14px/1.3 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(249,115,22,.45);display:flex;gap:10px;align-items:center;text-align:center}.wake-bar i{width:14px;height:14px;border-radius:50%;border:2.5px solid rgba(31,19,0,.3);border-top-color:#1f1300;animation:wakeSpin .8s linear infinite;flex:none}.wake-bar.ok{background:linear-gradient(135deg,#10b981,#059669);color:#fff}@keyframes wakeSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
  }
  function show() {
    if (done) return; css();
    if (!bar) { bar = document.createElement('div'); bar.className = 'wake-bar'; bar.innerHTML = '<i></i><span></span>'; document.body.appendChild(bar); shown = true; }
    bar.lastChild.textContent = '⏳ Waking up the server, please wait…';
  }
  function ready() {
    done = true;
    if (bar && shown) { bar.className = 'wake-bar ok'; bar.innerHTML = '<span>✅ Server is ready</span>'; setTimeout(function () { if (bar) bar.remove(); }, 1600); }
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
  var tick = setInterval(function () { if (done) clearInterval(tick); else if (bar) show(); }, 1000);
  function start() { ping(); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
