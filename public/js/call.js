/* SmartBoard video class: teacher <-> students over WebRTC.
 * Topology is a star: every student connects to the teacher only (cheap for the students, fine for a class of ~10-15).
 * The Node server only relays the tiny "signalling" messages; audio and video never pass through it. */
(() => {
  'use strict';
  const SB = window.SB;
  const { S, $, $$, toast, emit, hook } = SB;

  Object.assign(SB.ICONS, {
    video: '<path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="3"/>',
    videoOff: '<path d="M10.7 6H13a3 3 0 0 1 3 3v2.3l5.2-3.8a.5.5 0 0 1 .8.4v8.2"/><path d="M16 16a3 3 0 0 1-3 2H5a3 3 0 0 1-3-3V9a3 3 0 0 1 .9-2.1"/><path d="m2 2 20 20"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/>',
    micOff: '<path d="m2 2 20 20"/><path d="M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.7-1.3"/><path d="M5 11a7 7 0 0 0 11.7 5.2M19 11a7 7 0 0 1-.6 2.8M12 18v4M8 22h8"/>',
    screen: '<rect x="2" y="4" width="20" height="13" rx="2.5"/><path d="M8 21h8M12 17v4"/><path d="m9 11 3-3 3 3M12 8v5"/>',
    hangup: '<path d="M3 14.5c5-4.5 13-4.5 18 0l-1.6 2.6a1.4 1.4 0 0 1-1.8.6l-2.6-1.2a1.4 1.4 0 0 1-.8-1.3v-1.5a11 11 0 0 0-5.6 0v1.5a1.4 1.4 0 0 1-.8 1.3l-2.6 1.2a1.4 1.4 0 0 1-1.8-.6Z"/>',
  });

  const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const ic = (el0, name) => { el0.innerHTML = SB.svgOf(name); };

  const st = { on: false, me: null, known: new Map(), peers: new Map(), local: { audio: null, video: null, screen: null }, mic: false, cam: false, scr: false, live: false, count: 0, wasLive: false, mine: null };
  const isTeacher = () => S.role === 'teacher';
  const sig = (to, data) => emit('rtc:sig', { to, data });
  const curVideo = () => st.local.screen || st.local.video || null;

  // ---------- tiles ----------
  function makeTile(label, local, peerId) {
    const t = el('div', 'vtile' + (local ? ' me' : ''));
    const v = el('video'); v.autoplay = true; v.playsInline = true; if (local) v.muted = true;
    const av = el('div', 'vavatar', (label || '?').trim().charAt(0).toUpperCase() || '?');
    const nm = el('span', 'vname', label);
    const mi = el('span', 'vmic'); ic(mi, 'micOff');
    t.append(v, av, nm, mi);
    const tile = { t, v, av, nm, mi };
    if (peerId && isTeacher()) {           // host controls: switch a student's mic / camera off
      const box = el('div', 'vctl'), mk = (k, icon, tip) => {
        const b = el('button', 'vctl-btn'); b.title = tip; ic(b, icon); b.hidden = true;
        b.onclick = (ev) => { ev.stopPropagation(); emit('rtc:ctl', { to: peerId, [k]: true }); toast(`${label}: ${k === 'mic' ? 'microphone' : 'camera'} turned off`, { ms: 1600 }); };
        box.appendChild(b); return b;
      };
      tile.cm = mk('mic', 'micOff', `Turn off ${label}'s microphone`); tile.cv = mk('cam', 'videoOff', `Turn off ${label}'s camera`);
      t.appendChild(box);
    }
    $('#callTiles').appendChild(t);
    return tile;
  }
  function renderRemote(e) {
    const r = e.remote;
    e.tile.av.hidden = !!r.cam; e.tile.mi.hidden = !!r.mic;
    if (e.tile.cm) { e.tile.cm.hidden = !r.mic; e.tile.cv.hidden = !r.cam || !!r.scr; }
    e.tile.t.classList.toggle('scr', !!r.scr);
  }
  function renderLocal() {
    const m = st.mine; if (!m) return;
    const tr = curVideo();
    m.v.srcObject = tr ? new MediaStream([tr]) : null;
    if (tr) m.v.play().catch(() => {});
    m.av.hidden = !!tr; m.mi.hidden = st.mic;
    m.t.classList.toggle('scr', !!st.local.screen);
  }

  // ---------- media (camera, microphone, screen) ----------
  function mediaErr(err, what) {
    const n = err && err.name;
    if (!window.isSecureContext) toast('Camera and microphone need https:// (or localhost). Deploy the app with HTTPS.', { ms: 4500 });
    else if (n === 'NotAllowedError' || n === 'SecurityError') toast(`Allow the ${what} in your browser (lock icon in the address bar) and try again.`, { ms: 4500 });
    else if (n === 'NotFoundError' || n === 'OverconstrainedError') toast(`No ${what} found on this device.`, { ms: 3500 });
    else toast(`Could not start the ${what}.`, { ms: 3000 });
  }
  const hasMedia = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const AUDIO = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  const VIDEO = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' };

  async function getMedia(wantAudio, wantVideo) {
    if (!hasMedia()) { mediaErr(null, wantVideo ? 'camera' : 'microphone'); return false; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: wantAudio ? AUDIO : false, video: wantVideo ? VIDEO : false });
      if (wantAudio && s.getAudioTracks()[0]) { st.local.audio = s.getAudioTracks()[0]; st.mic = true; watchLocal(); }
      if (wantVideo && s.getVideoTracks()[0]) { st.local.video = s.getVideoTracks()[0]; st.cam = true; }
      return true;
    } catch (err) { mediaErr(err, wantVideo && !wantAudio ? 'camera' : 'microphone'); return false; }
  }
  async function setMic(on) {
    if (on) { if (!(await getMedia(true, false))) return; }
    else { if (st.local.audio) st.local.audio.stop(); st.local.audio = null; st.mic = false; }
    applyAll();
  }
  async function setCam(on) {
    if (on) { if (!(await getMedia(false, true))) return; }
    else { if (st.local.video) st.local.video.stop(); st.local.video = null; st.cam = false; }
    applyAll();
  }
  async function setScreen(on) {
    if (on) {
      try {
        const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false });
        st.local.screen = s.getVideoTracks()[0]; st.scr = true;
        st.local.screen.onended = () => setScreen(false);
      } catch { return; }
    } else { if (st.local.screen) { st.local.screen.onended = null; st.local.screen.stop(); } st.local.screen = null; st.scr = false; }
    applyAll();
  }

  // ---------- peer connections ----------
  function applyTracks(e) {
    if (e.aS) e.aS.replaceTrack(st.local.audio || null).catch(() => {});
    if (e.vS) {
      e.vS.replaceTrack(curVideo()).catch(() => {});
      try { const p = e.vS.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}]; p.encodings[0].maxBitrate = st.local.screen ? 1200000 : 450000; e.vS.setParameters(p).catch(() => {}); } catch { /* optional */ }
    }
  }
  function mineState() { return { mic: st.mic, cam: !!curVideo(), scr: st.scr }; }
  function sendState(id) { const d = { st: mineState() }; if (id) sig(id, d); else st.peers.forEach((e) => sig(e.id, d)); }
  function applyAll() { st.peers.forEach(applyTracks); sendState(); renderLocal(); updateUI(); }

  function addPeer(info) {
    if (!info || st.peers.has(info.id) || info.id === st.me) return null;
    const amT = isTeacher();
    if (!amT && info.role !== 'teacher') return null;          // students only talk to the teacher
    const init = amT && (info.role !== 'teacher' || st.me < info.id);
    const pc = new RTCPeerConnection(ICE);
    const e = { id: info.id, role: info.role, name: info.name || '', pc, init, ice: [], remote: { mic: false, cam: false, scr: false }, stream: new MediaStream(), aS: null, vS: null, tile: null, ctx: null };
    e.tile = makeTile(info.role === 'teacher' ? 'Teacher' : (info.name || 'Student'), false, info.id);
    if (info.role === 'teacher') e.tile.t.classList.add('teacher');
    renderRemote(e);
    st.peers.set(info.id, e);
    pc.onicecandidate = (ev) => { if (ev.candidate) sig(e.id, { ice: ev.candidate }); };
    pc.ontrack = (ev) => {
      e.stream.addTrack(ev.track); e.tile.v.srcObject = e.stream; e.tile.v.play().catch(() => {});
      if (ev.track.kind === 'audio') watchRemote(e);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') sendState(e.id);
      if (pc.connectionState === 'failed' && e.init) offer(e, { iceRestart: true });
      updateUI();
    };
    if (init) {
      e.aS = pc.addTransceiver('audio').sender; e.vS = pc.addTransceiver('video').sender;
      applyTracks(e); offer(e);
    }
    updateUI();
    return e;
  }
  async function offer(e, opts) {
    try { const o = await e.pc.createOffer(opts); await e.pc.setLocalDescription(o); sig(e.id, { sdp: e.pc.localDescription }); } catch (err) { console.warn('offer failed', err); }
  }
  async function flushIce(e) { while (e.ice.length) { try { await e.pc.addIceCandidate(e.ice.shift()); } catch { /* stale candidate */ } } }
  async function onSig({ from, data }) {
    if (!st.on || !data) return;
    let e = st.peers.get(from);
    if (!e) e = addPeer(st.known.get(from) || { id: from, role: 'teacher', name: '' });
    if (!e) return;
    try {
      if (data.sdp) {
        await e.pc.setRemoteDescription(data.sdp);
        if (data.sdp.type === 'offer') {
          e.pc.getTransceivers().forEach((t) => { if (t.receiver.track.kind === 'audio') e.aS = t.sender; else e.vS = t.sender; try { t.direction = 'sendrecv'; } catch { /* ignore */ } });
          applyTracks(e);
          const ans = await e.pc.createAnswer(); await e.pc.setLocalDescription(ans); sig(from, { sdp: e.pc.localDescription });
        }
        await flushIce(e); sendState(from);
      } else if (data.ice) {
        if (e.pc.remoteDescription) { try { await e.pc.addIceCandidate(data.ice); } catch { /* ignore */ } } else e.ice.push(data.ice);
      } else if (data.st) { e.remote = data.st; renderRemote(e); }
    } catch (err) { console.warn('signal error', err); }
  }
  function removePeer(id) {
    const e = st.peers.get(id); if (!e) return;
    try { e.pc.close(); } catch { /* closed */ }
    if (e.src) { try { e.src.disconnect(); } catch { /* ignore */ } }
    e.tile.t.remove(); st.peers.delete(id); updateUI();
  }

  // ---------- who is speaking ----------
  let actx = null; const meters = [];
  function meter(stream, tileEl) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const src = actx.createMediaStreamSource(stream), an = actx.createAnalyser(); an.fftSize = 256; src.connect(an);
      const m = { an, tileEl, buf: new Uint8Array(an.frequencyBinCount), src }; meters.push(m); return m;
    } catch { return null; }
  }
  function watchRemote(e) { e.meter = meter(new MediaStream(e.stream.getAudioTracks()), e.tile.t); }
  function watchLocal() { if (st.mine && st.local.audio) { if (st.mineMeter) st.mineMeter.dead = true; st.mineMeter = meter(new MediaStream([st.local.audio]), st.mine.t); } }
  setInterval(() => {
    for (let i = meters.length - 1; i >= 0; i--) {
      const m = meters[i];
      if (m.dead || !m.tileEl.isConnected) { try { m.src.disconnect(); } catch { /* ignore */ } m.tileEl.classList.remove('speaking'); meters.splice(i, 1); continue; }
      m.an.getByteTimeDomainData(m.buf);
      let peak = 0; for (let k = 0; k < m.buf.length; k++) peak = Math.max(peak, Math.abs(m.buf[k] - 128));
      m.tileEl.classList.toggle('speaking', peak > 12);
    }
  }, 280);

  // ---------- join / leave ----------
  function joinCall() {
    if (st.on) { showPanel(true); return; }
    emit('rtc:join', {}, async (res) => {
      if (!res || !res.ok) { toast('Could not join the video class. Try again.'); return; }
      st.on = true; st.me = res.me; st.known = new Map(); (res.peers || []).forEach((p) => st.known.set(p.id, p));
      $('#callTiles').innerHTML = '';
      st.mine = makeTile('You', true); renderLocal();
      showPanel(true);
      (res.peers || []).forEach(addPeer);
      updateUI();
      if (isTeacher()) { await getMedia(true, true); applyAll(); }
      else toast('You joined the video class. Tap the mic or camera to speak or show yourself.', { ms: 3200 });
    });
  }
  function leaveCall() {
    if (!st.on) return;
    emit('rtc:leave', {});
    [...st.peers.keys()].forEach(removePeer);
    ['audio', 'video', 'screen'].forEach((k) => { if (st.local[k]) st.local[k].stop(); st.local[k] = null; });
    st.mic = st.cam = st.scr = false; st.on = false; st.me = null; st.mine = null; st.known = new Map();
    $('#callTiles').innerHTML = ''; showPanel(false); updateUI();
  }

  // ---------- panel UI ----------
  function showPanel(on) { $('#callPanel').classList.toggle('hidden', !on); if (on) $('#callPanel').classList.remove('min'); }
  function updateUI() {
    const btn = $('#callBtn'); if (!btn) return;
    btn.classList.toggle('on', st.on); btn.classList.toggle('live', st.live && !st.on);
    $('#callDot').classList.toggle('hidden', !(st.live && !st.on));
    btn.title = st.on ? 'Video class (you are in)' : st.live ? 'Join the video class (live now)' : 'Start / join video class';
    if (!st.on) return;
    const n = st.peers.size + 1;
    $('#callCount').textContent = n + ' in class';
    const bar = (id, on, iconOn, iconOff) => { const b = $(id); b.classList.toggle('on', on); ic(b, on ? iconOn : iconOff); };
    bar('#cMic', st.mic, 'mic', 'micOff'); bar('#cCam', !!st.local.video, 'video', 'videoOff');
    $('#cScr').classList.toggle('on', st.scr);
    $('#cScr').classList.toggle('hidden', !isTeacher() || !(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia));
    $('#cMuteAll').classList.toggle('hidden', !isTeacher());
    $('#cCamsOff').classList.toggle('hidden', !isTeacher());
    let hint = '';
    const hasT = [...st.peers.values()].some((e) => e.role === 'teacher');
    if (!isTeacher() && !hasT) hint = 'Waiting for the teacher to join the class…';
    else if (isTeacher() && st.peers.size === 0) hint = 'Waiting for students to join the video class…';
    else if ([...st.peers.values()].some((e) => e.pc.connectionState === 'connecting' || e.pc.connectionState === 'new')) hint = 'Connecting…';
    $('#callHint').textContent = hint;
  }

  function wire() {
    const demo = () => !!window.SB_DEMO;
    $('#callBtn').onclick = () => {
      if (demo()) { toast('Video class needs camera and microphone access, which this preview page cannot use. Run the downloaded SmartBoard app to try it.', { ms: 5200 }); return; }
      if (!st.on) joinCall(); else showPanel($('#callPanel').classList.contains('hidden'));
    };
    $('#cMic').onclick = () => setMic(!st.mic);
    $('#cCam').onclick = () => setCam(!st.local.video);
    $('#cScr').onclick = () => setScreen(!st.scr);
    $('#cMuteAll').onclick = () => { emit('rtc:muteall', {}); toast('Every student\'s microphone is now off', { ms: 1800 }); };
    $('#cCamsOff').onclick = () => { emit('rtc:muteall', { cam: true }); toast('Every student\'s camera is now off', { ms: 1800 }); };
    $('#cLeave').onclick = leaveCall;
    $('#callMin').onclick = () => $('#callPanel').classList.toggle('min');
    // drag the panel by its header (desktop)
    const head = $('#callHead'), panel = $('#callPanel'); let drag = null;
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || window.innerWidth <= 760) return;
      const r = panel.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      head.setPointerCapture(e.pointerId);
    });
    head.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const x = Math.max(4, Math.min(window.innerWidth - panel.offsetWidth - 4, e.clientX - drag.dx));
      const y = Math.max(4, Math.min(window.innerHeight - 60, e.clientY - drag.dy));
      panel.style.left = x + 'px'; panel.style.top = y + 'px'; panel.style.right = 'auto';
    });
    const end = () => { drag = null; };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
    SB.paintIcons($('#callPanel')); updateUI();
  }

  hook('init', wire);
  hook('net:rtc:joined', (p) => { st.known.set(p.id, p); if (st.on) addPeer(p); });
  hook('net:rtc:left', ({ id }) => { st.known.delete(id); removePeer(id); });
  hook('net:rtc:sig', onSig);
  hook('net:rtc:ctl', ({ mic, cam }) => {       // the teacher switched my mic / camera off
    if (mic && st.mic) { setMic(false); toast('The teacher turned off your microphone', { ms: 2600 }); }
    if (cam && st.local.video) { setCam(false); toast('The teacher turned off your camera', { ms: 2600 }); }
  });
  hook('net:call:state', ({ live, count }) => {
    st.live = !!live; st.count = count || 0;
    if (st.live && !st.wasLive && !st.on && !isTeacher()) toast('📹 The teacher started a video class. Tap the camera button at the top to join.', { ms: 5000 });
    st.wasLive = st.live; updateUI();
  });
  hook('leave', () => { leaveCall(); st.live = false; st.wasLive = false; updateUI(); });
  window.addEventListener('pagehide', () => { if (st.on) emit('rtc:leave', {}); });

  SB.call = { join: joinCall, leave: leaveCall, state: st };
})();
