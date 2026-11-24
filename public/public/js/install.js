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
