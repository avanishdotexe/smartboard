/* SmartBoard 2.12: QR share (share sheet, save QR picture) and QR scan (join with the camera). */
(() => {
  'use strict';
  const SB = window.SB;
  const { S, $, toast, openModal, closeModal } = SB;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const btn = (txt, cls, fn, ico) => { const b = el('button', 'btn ' + (cls || '')); if (ico) { const i = el('i'); i.dataset.icon = ico; b.append(i); } b.append(el('span', null, txt)); if (fn) b.onclick = fn; return b; };

  const joinUrl = () => ($('#joinUrl') && $('#joinUrl').value) || `${location.origin}/?room=${S.code}`;

  // ---------- share + save QR ----------
  async function qrPng() {
    const svg = $('#qrBox svg');
    if (!svg) return null;
    const n = svg.viewBox.baseVal.width, px = 1024, pad = 64, k = (px - pad * 2) / n;
    const c = document.createElement('canvas'); c.width = c.height = px;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, px, px); x.fillStyle = '#000';
    svg.querySelectorAll('path').forEach(() => { /* modules read from the path below */ });
    const d = svg.querySelector('path').getAttribute('d'); const re = /M(\d+),(\d+)h1v1h-1z/g; let m;
    while ((m = re.exec(d))) x.fillRect(pad + m[1] * k, pad + m[2] * k, Math.ceil(k), Math.ceil(k));
    x.fillStyle = '#111'; x.font = '700 44px sans-serif'; x.textAlign = 'center'; x.fillText('Code: ' + S.code, px / 2, px - 14);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }
  async function shareLink() {
    const url = joinUrl(), text = `Join my SmartBoard class. Code: ${S.code}`;
    try {
      if (navigator.share) {
        const blob = await qrPng();
        const data = { title: 'SmartBoard class', text, url };
        if (blob && navigator.canShare) { const f = new File([blob], `smartboard-${S.code}.png`, { type: 'image/png' }); if (navigator.canShare({ files: [f] })) data.files = [f]; }
        await navigator.share(data); return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Link copied. Paste it in WhatsApp or anywhere 📋'); } catch (e) { toast('Copy the link from the box above.'); }
  }
  async function saveQr() {
    const b = await qrPng(); if (!b) return toast('QR is not ready yet.');
    SB.saveBlob(b, `smartboard-${S.code}-qr.png`); toast('QR picture saved 📷');
  }
  function addShareButtons() {
    const row = $('#copyCode') && $('#copyCode').parentElement; if (!row || $('#shareQr')) return;
    const a = btn('Share', 'soft', shareLink, 'share'); a.id = 'shareQr';
    const b = btn('Save QR', 'soft', saveQr, 'qr'); b.id = 'saveQr';
    row.append(a, b); row.style.flexWrap = 'wrap';
    SB.paintIcons();
  }

  // ---------- scan QR ----------
  let stream = null, raf = 0, scanning = false;
  const codeFrom = (txt) => {
    if (!txt) return null;
    try { const u = new URL(txt); const r = u.searchParams.get('room'); if (r) return r.toUpperCase(); } catch (e) { /* maybe plain code */ }
    const m = String(txt).trim().toUpperCase().match(/^[A-Z0-9]{6}$/);
    return m ? m[0] : null;
  };
  function stopScan() {
    scanning = false; cancelAnimationFrame(raf);
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    const v = $('#scanVideo'); if (v) v.srcObject = null;
  }
  async function startScan() {
    const msg = $('#scanMsg'); msg.textContent = 'Starting camera…';
    openModal('mScan');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = 'Camera is not available here. Type the code instead.'; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
    } catch (e) { msg.textContent = 'Camera permission was blocked. Allow the camera, or type the code.'; return; }
    const v = $('#scanVideo'); v.srcObject = stream; v.setAttribute('playsinline', ''); await v.play().catch(() => {});
    msg.textContent = 'Point the camera at the QR code';
    let det = null;
    if ('BarcodeDetector' in window) { try { det = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { det = null; } }
    if (!det) { try { await SB.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js'); } catch (e) { msg.textContent = 'Scanner could not load (needs internet). Type the code instead.'; return; } }
    const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
    scanning = true;
    const found = (txt) => {
      const code = codeFrom(txt);
      if (!code) { msg.textContent = 'This QR is not a SmartBoard code. Try again.'; return false; }
      stopScan(); closeModal('mScan'); $('#codeInput').value = code; toast('Code found: ' + code + ' ✅', { ms: 1800 });
      if (!$('#nameInput').value.trim()) { $('#nameInput').classList.add('bad'); $('#joinErr').textContent = 'Now type your name and press Join.'; $('#nameInput').focus(); } else SB.joinBoard(code);
      return true;
    };
    const tick = async () => {
      if (!scanning) return;
      if (v.readyState >= 2 && v.videoWidth) {
        try {
          if (det) { const r = await det.detect(v); if (r.length && found(r[0].rawValue)) return; }
          else {
            const k = Math.min(1, 640 / v.videoWidth); cv.width = Math.round(v.videoWidth * k); cv.height = Math.round(v.videoHeight * k);
            cx.drawImage(v, 0, 0, cv.width, cv.height);
            const r = window.jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height);
            if (r && found(r.data)) return;
          }
        } catch (e) { /* keep scanning */ }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
  }
  function initScan() {
    if (!$('#joinBtn') || $('#scanBtn')) return;
    const m = el('div', 'modal hidden'); m.id = 'mScan';
    m.innerHTML = '<div class="sheet"><div class="sheet-head"><h3>Scan QR to join</h3><button class="icon-btn sm" id="scanX"><i data-icon="close"></i></button></div><div class="scan-box"><video id="scanVideo" muted playsinline></video><i class="scan-frame"></i></div><p id="scanMsg" class="hint"></p></div>';
    document.body.append(m);
    $('#scanX').onclick = () => { stopScan(); closeModal('mScan'); };
    m.addEventListener('pointerdown', (e) => { if (e.target === m) { stopScan(); closeModal('mScan'); } });
    const b = el('button', 'btn soft big scan-btn'); b.id = 'scanBtn'; b.title = 'Scan the teacher\'s QR code';
    const i = el('i'); i.dataset.icon = 'scan'; b.append(i, el('span', null, 'Scan'));
    b.onclick = startScan;
    $('#joinBtn').before(b);
    SB.paintIcons();
  }

  function init() {
    initScan();
    addShareButtons();
    const ci = $('#codeChip'); if (ci) ci.addEventListener('click', () => setTimeout(addShareButtons, 0));
    SB.hook('state', addShareButtons);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
