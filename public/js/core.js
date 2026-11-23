/* SmartBoard core: the room engine.
 * One file, two homes: the Node.js server uses it for real classes, and the single-file
 * Claude artifact uses it as an in-browser demo server. It only knows rooms, roles and rules.
 * Transport (Socket.io, BroadcastChannel) is injected through opts.send.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SmartBoardCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const BACKGROUNDS = ['white', 'grid', 'ruled', 'dots', 'axes', 'chalk', 'dark', 'paper', 'kraft', 'mm', 'hex', 'iso', 'polar', 'music', 'fourline', 'blueprint', 'chess', 'sunrise', 'sunset', 'ocean', 'forest', 'aurora', 'stars', 'pastel', 'mint', 'peach', 'wood', 'cornell', 'numline', 'table', 'calendar', 'kwl', 'storyboard', 'venn2', 'sky', 'lavender', 'slate', 'sand', 'galaxy'];
  const TYPES = ['pen', 'hl', 'eraser', 'line', 'arrow', 'rect', 'ellipse', 'shape', 'note', 'text', 'image'];
  const GEOM_KEYS = ['x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2', 'fs'];
  const MAX_OBJECTS = 6000;
  const MAX_PAGES = 60;

  const isNum = Number.isFinite;
  const clean = (v, max) =>
    String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const cleanMultiline = (v, max) =>
    String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, max);

  function createEngine(opts) {
    opts = opts || {};
    const send = opts.send || function () {};
    const now = opts.now || Date.now;
    const changed = opts.onChange || function () {};
    const randomKey = opts.randomKey || function () {
      return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + now().toString(36);
    };

    const rooms = new Map();   // code -> room
    const clients = new Map(); // client id -> { room, role, name, hand }

    const rid = () => Math.random().toString(36).slice(2, 10);

    function newCode() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing 0/O/1/I
      let code;
      do {
        code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      } while (rooms.has(code));
      return code;
    }

    const newPage = () => ({ objects: [], redo: [] });

    // ---------- delivery helpers ----------
    const toRoom = (r, ev, data, except) => r.members.forEach((cid) => { if (cid !== except) send(cid, ev, data); });
    const teacherIds = (r) => [...r.members].filter((cid) => { const c = clients.get(cid); return c && c.role === 'teacher'; });
    const toTeachers = (r, ev, data) => teacherIds(r).forEach((cid) => send(cid, ev, data));

    const peopleOf = (r) => [...r.members].map((cid) => {
      const c = clients.get(cid);
      return { id: cid, name: c.name, role: c.role, hand: !!c.hand };
    });
    const pushPeople = (r) => toTeachers(r, 'people', peopleOf(r));

    // ---------- poll + timer views ----------
    function pollView(r, cid) {
      const p = r.poll;
      if (!p) return null;
      const c = clients.get(cid);
      const teacher = !!c && c.role === 'teacher';
      const counts = p.options.map(() => 0);
      p.votes.forEach((v) => { counts[v] += 1; });
      return {
        id: p.id,
        question: p.question,
        options: p.options,
        open: p.open,
        total: p.votes.size,
        counts: teacher || !p.open ? counts : null,   // students see results only after the poll closes
        correct: teacher || !p.open ? p.correct : null,
        myVote: p.votes.has(cid) ? p.votes.get(cid) : null,
      };
    }
    const pushPoll = (r, only) => (only || [...r.members]).forEach((cid) => send(cid, 'poll:state', pollView(r, cid)));
    const lbList = (r) => [...(r.lb || new Map()).entries()].map(([k, v]) => ({ k, name: v.name, pts: v.pts })).sort((a, b) => b.pts - a.pts).slice(0, 50);
    const pushLb = (r, gain) => toRoom(r, 'lb:state', { list: lbList(r), gain: gain || {}, show: true });
    const timerView = (r) => (r.timer ? { remaining: Math.max(0, r.timer.endAt - now()), total: r.timer.total } : null);

    // ---------- questions (short answer / word cloud) ----------
    function askView(r, cid) {
      const a = r.ask;
      if (!a) return null;
      const c = clients.get(cid), t = !!c && c.role === 'teacher';
      const mine = a.ans.get(cid);
      const list = [...a.ans.entries()].map(([id, v]) => ({ id, name: v.name, text: v.text }));
      return { id: a.id, q: a.q, mode: a.mode, open: a.open, share: a.share, total: a.ans.size, mine: mine ? mine.text : null,
        answers: t ? list : null, words: !t && a.share ? list.map((x) => x.text) : null };
    }
    const pushAsk = (r) => r.members.forEach((cid) => send(cid, 'ask:state', askView(r, cid)));

    // ---------- breakout groups: every group gets its own page ----------
    function brkView(r, cid) {
      const b = r.brk;
      if (!b) return null;
      const c = clients.get(cid);
      if (c && c.role === 'teacher') {
        const groups = b.pages.map((page) => ({ page, members: [] }));
        b.assign.forEach((g, id) => { const m = clients.get(id); if (m && groups[g]) groups[g].members.push({ id, name: m.name }); });
        return { on: true, n: b.n, groups };
      }
      const g = b.assign.get(cid);
      return { on: true, n: b.n, group: g === undefined ? null : g, page: g === undefined ? null : b.pages[g] };
    }
    const pushBrk = (r) => r.members.forEach((cid) => send(cid, 'break:state', brkView(r, cid)));
    function brkAssign(r, cid) {
      const b = r.brk; if (!b) return;
      const sizes = b.pages.map(() => 0); b.assign.forEach((g) => { sizes[g] += 1; });
      b.assign.set(cid, sizes.indexOf(Math.min(...sizes)));
    }

    const confNames = (r) => [...(r.conf || [])].map((id) => (clients.get(id) || {}).name).filter(Boolean);
    const confView = (r, who) => ({ n: r.conf.size, names: confNames(r), who: who || null });

    function stateOf(r, cid) {
      const c = clients.get(cid);
      return {
        pages: r.pages.map((p) => p.objects),
        current: r.current,
        bg: r.bg,
        bgs: r.pages.map((p) => p.bg || r.bg),
        studentDraw: r.studentDraw,
        count: r.members.size,
        title: r.title,
        poll: pollView(r, cid),
        lb: lbList(r),
        timer: timerView(r),
        curtain: r.curtain || null,
        ov: r.ov || {},
        ask: askView(r, cid),
        brk: brkView(r, cid),
        chat: (r.chat || []).slice(-100),
        chatOn: r.chatOn !== false,
        confuse: (r.conf || new Set()).size,
        confNames: c && c.role === 'teacher' ? confNames(r) : null,
        confMine: !!(r.conf && r.conf.has(cid)),
        people: c && c.role === 'teacher' ? peopleOf(r) : null,
        hand: !!(c && c.hand),
      };
    }

    // ---------- membership ----------
    function leaveRoom(cid) {
      const c = clients.get(cid);
      if (!c) return;
      clients.delete(cid);
      const r = c.room;
      r.members.delete(cid);
      if (c.call) { toRoom(r, 'rtc:left', { id: cid }); pushCall(r); }
      if (c.attKey && r.att && r.att[c.attKey]) {
        const a = r.att[c.attKey]; a.open = Math.max(0, a.open - 1);
        if (a.open === 0 && a.at) { a.ms += now() - a.at; a.at = null; a.last = now(); }
      }
      if (r.conf && r.conf.delete(cid)) toTeachers(r, 'confuse:state', confView(r));
      if (r.brk && r.brk.assign.delete(cid)) pushBrk(r);
      r.last = now();
      toRoom(r, 'room:count', r.members.size);
      pushPeople(r);
    }

    function enter(cid, r, role, name) {
      leaveRoom(cid);
      clients.set(cid, { room: r, role, name, hand: false });
      r.members.add(cid);
      if (role === 'student') {
        r.att = r.att || {};
        const key = name.toLowerCase();
        const a = r.att[key] || (r.att[key] = { name, first: now(), last: now(), ms: 0, open: 0, at: null, joins: 0 });
        a.open += 1; a.joins += 1; a.last = now(); if (a.open === 1) a.at = now();
        clients.get(cid).attKey = key;
        if (r.brk) { brkAssign(r, cid); pushBrk(r); }
      }
      r.last = now();
      toRoom(r, 'room:count', r.members.size);
      pushPeople(r);
      if (callLive(r)) send(cid, 'call:state', { live: true, count: inCall(r).length });
    }

    // ---------- video class (WebRTC signalling only: media never touches the server) ----------
    const inCall = (r) => [...r.members].filter((id) => { const c = clients.get(id); return c && c.call; });
    const callLive = (r) => inCall(r).some((id) => clients.get(id).role === 'teacher');
    const pushCall = (r) => toRoom(r, 'call:state', { live: callLive(r), count: inCall(r).length });

    const findIndex = (p, id) => {
      for (let i = p.objects.length - 1; i >= 0; i--) if (p.objects[i].id === id) return i;
      return -1;
    };
    const validObj = (o) => !!o && typeof o.id === 'string' && o.id.length <= 40 && TYPES.indexOf(o.type) >= 0;

    // ---------- the event handler ----------
    function handle(cid, ev, data, ack) {
      ack = typeof ack === 'function' ? ack : function () {};
      const d = data && typeof data === 'object' ? data : {};

      if (ev === 'room:create') {
        const r = {
          code: newCode(), key: randomKey(), title: clean(d.title, 60), pages: [newPage()], current: 0,
          bg: 'white', studentDraw: false, poll: null, timer: null, members: new Set(), last: now(),
          owner: typeof d.owner === 'string' ? d.owner.slice(0, 64) : null,
        };
        rooms.set(r.code, r);
        enter(cid, r, 'teacher', clean(d.tname, 24) || 'Teacher');
        changed();
        return ack({ ok: true, code: r.code, key: r.key, role: 'teacher', state: stateOf(r, cid) });
      }

      if (ev === 'room:join') {
        const r = rooms.get(String(d.code || '').trim().toUpperCase());
        if (!r) return ack({ ok: false, error: 'Room code not found. Please check the code and try again.' });
        const teacher = !!d.key && d.key === r.key;
        if (!teacher && !clean(d.name, 24)) return ack({ ok: false, error: 'Please enter your name to join.' });
        enter(cid, r, teacher ? 'teacher' : 'student', teacher ? (clean(d.tname, 24) || 'Teacher') : clean(d.name, 24) || 'Student');
        return ack({ ok: true, code: r.code, role: teacher ? 'teacher' : 'student', state: stateOf(r, cid) });
      }

      if (ev === 'room:leave') { leaveRoom(cid); return; }

      const c = clients.get(cid);
      if (!c) return;
      const r = c.room;
      const isT = c.role === 'teacher';
      const canEdit = isT || r.studentDraw;
      const bg0 = r.brk ? r.brk.assign.get(cid) : undefined;
      const canEditP = (pageIdx) => isT || (bg0 !== undefined ? pageIdx === r.brk.pages[bg0] : r.studentDraw);
      const pg = (i) => (Number.isInteger(i) ? r.pages[i] : undefined);
      const others = (e, x) => toRoom(r, e, x, cid);
      const all = (e, x) => toRoom(r, e, x);
      const touch = () => { r.last = now(); changed(); };

      switch (ev) {
        // ----- drawing objects -----
        case 'obj:add': {
          const p = pg(d.page);
          if (!canEditP(d.page) || !p || !validObj(d.obj) || p.objects.length >= MAX_OBJECTS) return;
          p.objects.push(d.obj); p.redo = [];
          touch(); others('obj:add', { page: d.page, obj: d.obj }); break;
        }
        case 'obj:pts': {
          const p = pg(d.page);
          if (!canEditP(d.page) || !p || !Array.isArray(d.pts) || d.pts.length > 2000) return;
          const i = findIndex(p, d.id);
          if (i >= 0 && Array.isArray(p.objects[i].pts)) for (let k = 0; k < d.pts.length; k++) p.objects[i].pts.push(d.pts[k]);
          touch(); others('obj:pts', { page: d.page, id: d.id, pts: d.pts }); break;
        }
        case 'obj:upd': {
          const p = pg(d.page);
          if (!canEditP(d.page) || !p || !d.g) return;
          const i = findIndex(p, d.id);
          if (i >= 0) {
            if (isNum(d.g.x2)) p.objects[i].x2 = d.g.x2;
            if (isNum(d.g.y2)) p.objects[i].y2 = d.g.y2;
          }
          others('obj:upd', { page: d.page, id: d.id, g: { x2: d.g.x2, y2: d.g.y2 } }); break;
        }
        case 'obj:replace': { // smart shapes (stroke -> shape) and text edits
          const p = pg(d.page);
          if (!canEditP(d.page) || !p || !validObj(d.obj)) return;
          const i = findIndex(p, d.obj.id);
          if (i < 0) return;
          p.objects[i] = d.obj;
          touch(); others('obj:replace', { page: d.page, obj: d.obj }); break;
        }
        case 'obj:geom': { // move / resize (teacher only)
          const p = pg(d.page);
          if (!isT || !p || !d.g) return;
          const i = findIndex(p, d.id);
          if (i < 0) return;
          const o = p.objects[i];
          const g = {};
          GEOM_KEYS.forEach((k) => { if (isNum(d.g[k]) && o[k] !== undefined) { o[k] = d.g[k]; g[k] = d.g[k]; } });
          if (Array.isArray(d.g.pts) && Array.isArray(o.pts) && d.g.pts.length <= 40000 && d.g.pts.every(isNum)) {
            o.pts = d.g.pts; g.pts = d.g.pts;
          }
          touch(); others('obj:geom', { page: d.page, id: d.id, g }); break;
        }
        case 'obj:del': {
          const p = pg(d.page);
          if (!isT || !p) return;
          const i = findIndex(p, d.id);
          if (i < 0) return;
          p.objects.splice(i, 1);
          touch(); all('obj:remove', { page: d.page, id: d.id }); break;
        }
        case 'obj:undo': {
          const p = pg(d.page);
          if (!isT || !p) return;
          const o = p.objects.pop();
          if (o) { p.redo.push(o); touch(); all('obj:remove', { page: d.page, id: o.id }); }
          break;
        }
        case 'obj:redo': {
          const p = pg(d.page);
          if (!isT || !p) return;
          const o = p.redo.pop();
          if (o) { p.objects.push(o); touch(); all('obj:add', { page: d.page, obj: o }); }
          break;
        }
        case 'page:clear': {
          const p = pg(d.page);
          if (!isT || !p) return;
          p.objects = []; p.redo = [];
          touch(); all('page:clear', { page: d.page }); break;
        }

        // ----- pages -----
        case 'page:add': {
          if (!isT || r.pages.length >= MAX_PAGES) return ack({ ok: false });
          const prev = r.pages[r.current]; r.pages.push(newPage()); r.current = r.pages.length - 1;
          r.pages[r.current].bg = (prev && prev.bg) || r.bg;
          touch(); all('page:added', { index: r.current, bg: r.pages[r.current].bg }); ack({ ok: true, index: r.current }); break;
        }
        case 'page:go': {
          if (!isT || !pg(d.index)) return;
          r.current = d.index; others('page:go', { index: d.index }); break;
        }
        case 'page:del': {
          if (!isT || !pg(d.index) || r.pages.length < 2) return;
          r.pages.splice(d.index, 1); r.current = Math.min(d.index, r.pages.length - 1);
          touch(); all('page:deleted', { index: d.index, current: r.current }); break;
        }

        case 'page:dup': {
          const src = pg(d.index);
          if (!isT || !src || r.pages.length >= MAX_PAGES) return ack && ack({ ok: false });
          const copy = JSON.parse(JSON.stringify(src.objects)).map((o, k) => { o.id = Math.random().toString(36).slice(2, 9) + k; return o; });
          const idx = d.index + 1;
          r.pages.splice(idx, 0, { objects: copy, redo: [], bg: src.bg || r.bg }); r.current = idx;
          touch(); all('page:duped', { index: idx, objects: copy, bg: src.bg || r.bg }); break;
        }
        case 'curtain:set': {
          if (!isT) return;
          r.curtain = d.on ? { h: Math.max(0, Math.min(100, Number(d.h) || 0)) } : null;
          others('curtain:set', r.curtain); break;
        }

        // ----- board settings -----
        case 'bg:set': {
          const bgv = data && typeof data === 'object' ? data.bg : data;
          const pgi = data && typeof data === 'object' && Number.isInteger(data.page) ? data.page : r.current;
          if (!isT || BACKGROUNDS.indexOf(bgv) < 0 || !r.pages[pgi]) return;
          r.pages[pgi].bg = bgv; r.bg = bgv;
          if (data && data.all) r.pages.forEach((p) => { p.bg = bgv; });
          touch(); others('bg:set', { page: pgi, bg: bgv, all: !!(data && data.all) }); break;
        }
        case 'perm:set': {
          if (!isT) return;
          r.studentDraw = !!data; touch(); all('perm:set', r.studentDraw); break;
        }
        case 'room:title': {
          if (!isT) return;
          r.title = clean(typeof data === 'string' ? data : d.title, 60); touch(); others('room:title', r.title); break;
        }
        case 'laser': {
          if (!isT || !isNum(d.x) || !isNum(d.y)) return;
          others('laser', { x: d.x, y: d.y, s: !!d.s }); break;
        }

        // ----- people -----
        case 'hand:toggle': {
          if (isT) return;
          c.hand = !!(d.up);
          pushPeople(r);
          if (c.hand) toTeachers(r, 'hand:raised', { name: c.name });
          break;
        }
        case 'hand:lower': {
          if (!isT) return;
          const target = d.all ? null : clients.get(d.id);
          [...r.members].forEach((id) => {
            const t = clients.get(id);
            if (t && t.role !== 'teacher' && t.hand && (d.all || id === d.id) && (d.all || target)) {
              t.hand = false; send(id, 'hand:state', false);
            }
          });
          pushPeople(r); break;
        }
        case 'pick': {
          if (!isT) return;
          const students = [...r.members].filter((id) => clients.get(id).role !== 'teacher');
          if (!students.length) return ack({ ok: false });
          const pickedId = students[Math.floor(Math.random() * students.length)];
          all('picked', { name: clients.get(pickedId).name });
          ack({ ok: true }); break;
        }

        // ----- quick poll -----
        case 'poll:start': {
          if (!isT) return;
          const question = clean(d.question, 200);
          const options = Array.isArray(d.options) ? d.options.map((o) => clean(o, 80)).filter(Boolean).slice(0, 4) : [];
          if (!question || options.length < 2) return ack({ ok: false, error: 'Add a question and at least two options.' });
          const correct = Number.isInteger(d.correct) && d.correct >= 0 && d.correct < options.length ? d.correct : null;
          r.poll = { id: rid(), question, options, correct, open: true, votes: new Map(), times: new Map(), t0: now() };
          pushPoll(r); ack({ ok: true }); break;
        }
        case 'poll:vote': {
          const p = r.poll;
          if (!p || !p.open || isT) return;
          if (!Number.isInteger(d.choice) || d.choice < 0 || d.choice >= p.options.length) return;
          if (d.id && d.id !== p.id) return;
          if (!p.votes.has(cid)) p.times = p.times || new Map(), p.times.set(cid, now() - (p.t0 || now()));
          p.votes.set(cid, d.choice);
          pushPoll(r, [cid].concat(teacherIds(r))); break;
        }
        case 'poll:close': {
          if (!isT || !r.poll) return;
          const p = r.poll; if (!p.open) return;
          p.open = false; pushPoll(r);
          if (p.correct !== null && p.votes.size) {
            r.lb = r.lb || new Map(); const gain = {};
            p.votes.forEach((v, id) => {
              const c2 = clients.get(id); if (!c2) return;
              const key = c2.name.toLowerCase(); const row = r.lb.get(key) || { name: c2.name, pts: 0 }; row.name = c2.name;
              if (v === p.correct) { const el = Math.min(30000, (p.times && p.times.get(id)) || 0); const g = 500 + Math.round(500 * (1 - el / 30000)); row.pts += g; gain[key] = g; }
              r.lb.set(key, row);
            });
            pushLb(r, gain);
          }
          break;
        }
        case 'lb:clear': {
          if (!isT) return;
          r.lb = new Map(); toRoom(r, 'lb:state', { list: [], gain: {}, show: false }); break;
        }
        case 'lb:show': {
          if (!isT) return;
          pushLb(r); break;
        }
        case 'poll:clear': {
          if (!isT) return;
          r.poll = null; all('poll:state', null); break;
        }

        // ----- emoji reactions (anyone, rate limited) -----
        case 'react': {
          if (['👍', '🤔', '👏', '😮', '❤️', '🙋'].indexOf(d.e) < 0) return;
          const t = now();
          if (c.lastReact && t - c.lastReact < 600) return;
          c.lastReact = t;
          all('react', { e: d.e }); break;
        }

        // ----- video class: join / leave / signalling relay / mute everyone -----
        case 'rtc:join': {
          c.call = true;
          const peers = inCall(r).filter((id) => id !== cid).map((id) => ({ id, role: clients.get(id).role, name: clients.get(id).name }));
          toRoom(r, 'rtc:joined', { id: cid, role: c.role, name: c.name }, cid);
          pushCall(r);
          ack({ ok: true, me: cid, peers }); break;
        }
        case 'rtc:leave': {
          if (!c.call) return;
          c.call = false;
          toRoom(r, 'rtc:left', { id: cid }, cid); pushCall(r); break;
        }
        case 'rtc:sig': {
          const t = clients.get(d.to);
          if (!c.call || !t || t.room !== r || !t.call || d.data == null) return;
          if (JSON.stringify(d.data).length > 30000) return;
          send(d.to, 'rtc:sig', { from: cid, data: d.data }); break;
        }
        case 'rtc:muteall': { // teacher: mic off (and optionally camera off) for every student
          if (!isT) return;
          inCall(r).forEach((id) => { if (clients.get(id).role !== 'teacher') send(id, 'rtc:ctl', { mic: true, cam: !!d.cam }); }); break;
        }
        case 'rtc:ctl': { // teacher: switch one student's mic and / or camera off
          const t = clients.get(d.to);
          if (!isT || !t || t.room !== r || !t.call || t.role === 'teacher') return;
          send(d.to, 'rtc:ctl', { mic: !!d.mic, cam: !!d.cam }); break;
        }

        // ----- geometry tools (ruler, protractor, set squares) shown to everyone -----
        case 'cheer:go': {
          if (!isT) return;
          const t = now(); if (r.lastCheer && t - r.lastCheer < 1500) return; r.lastCheer = t;
          const txt = typeof d.text === 'string' ? d.text.slice(0, 30) : 'Well done!';
          toRoom(r, 'cheer', { text: txt }); break;
        }
        case 'ov:set': {
          if (!isT || ['ruler', 'protractor', 'sq45', 'sq30'].indexOf(d.kind) < 0) return;
          r.ov = r.ov || {};
          if (d.on && isNum(d.x) && isNum(d.y) && isNum(d.rot)) r.ov[d.kind] = { x: d.x, y: d.y, rot: d.rot };
          else delete r.ov[d.kind];
          others('ov:set', { kind: d.kind, on: !!d.on, x: d.x, y: d.y, rot: d.rot }); break;
        }

        // ----- questions: short answers and word cloud -----
        case 'ask:start': {
          const q = clean(d.q, 200);
          if (!isT || !q) return ack({ ok: false, error: 'Type a question first.' });
          r.ask = { id: rid(), q, mode: d.mode === 'word' ? 'word' : 'text', open: true, share: false, ans: new Map() };
          pushAsk(r); ack({ ok: true }); break;
        }
        case 'ask:send': {
          const a = r.ask;
          if (!a || !a.open || isT) return;
          const text = clean(d.text, a.mode === 'word' ? 24 : 300);
          if (!text) return;
          a.ans.set(cid, { name: c.name, text });
          pushAsk(r); break;
        }
        case 'ask:ctl': {
          if (!isT || !r.ask) return;
          if (d.act === 'close') r.ask.open = false;
          else if (d.act === 'open') r.ask.open = true;
          else if (d.act === 'share') r.ask.share = !!d.on;
          else if (d.act === 'end') r.ask = null;
          pushAsk(r); break;
        }

        // ----- breakout groups -----
        case 'break:start': {
          if (!isT) return;
          const n = Math.max(2, Math.min(8, Math.floor(Number(d.n) || 0)));
          const students = [...r.members].filter((id) => clients.get(id).role === 'student');
          if (r.brk) return ack({ ok: false, error: 'Breakout groups are already running.' });
          if (!students.length) return ack({ ok: false, error: 'No students are in the room yet.' });
          if (r.pages.length + n > MAX_PAGES) return ack({ ok: false, error: 'Not enough free pages.' });
          for (let i = students.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [students[i], students[j]] = [students[j], students[i]]; }
          const pages = [];
          for (let i = 0; i < n; i++) { r.pages.push(newPage()); r.pages[r.pages.length - 1].bg = r.bg; pages.push(r.pages.length - 1); }
          r.brk = { n, pages, assign: new Map() };
          students.forEach((id, i) => r.brk.assign.set(id, i % n));
          all('pages:grew', { count: r.pages.length });
          pushBrk(r); touch(); ack({ ok: true }); break;
        }
        case 'break:end': {
          if (!isT || !r.brk) return;
          r.brk = null; all('break:state', null); break;
        }

        // ----- attendance (teacher) -----
        case 'att:get': {
          if (!isT) return;
          const t = now();
          ack({ ok: true, list: Object.values(r.att || {}).map((a) => ({ name: a.name, first: a.first, last: a.last, ms: a.ms + (a.at ? t - a.at : 0), here: a.open > 0, joins: a.joins })) }); break;
        }

        // ----- chat + "I don't understand" -----
        case 'chat:send': {
          const text = clean(d.text, 300);
          const img = typeof d.img === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d.img) && d.img.length <= 420000 ? d.img : null;
          if ((!text && !img) || (!isT && r.chatOn === false)) return;
          const t = now();
          if (c.lastChat && t - c.lastChat < (img ? 1500 : 400)) return;
          c.lastChat = t;
          r.chat = r.chat || [];
          const msg = { id: rid(), name: c.name, role: c.role, text, t };
          if (img) msg.img = img;
          r.chat.push(msg); if (r.chat.length > 100) r.chat.shift();
          // keep the room small: only the newest ~3 MB of chat photos are kept
          let bytes = 0;
          for (let i = r.chat.length - 1; i >= 0; i--) { const m = r.chat[i]; if (m.img) { bytes += m.img.length; if (bytes > 3e6) { delete m.img; m.imgGone = true; } } }
          all('chat:msg', msg); break;
        }
        case 'name:set': {
          if (!isT) return;
          c.name = clean(d.name, 24) || 'Teacher';
          all('teacher:name', { name: c.name }); pushPeople(r); break;
        }
        case 'chat:on': {
          if (!isT) return;
          r.chatOn = !!d.on; all('chat:on', r.chatOn); break;
        }
        case 'chat:clear': {
          if (!isT) return;
          r.chat = []; all('chat:clear', true); break;
        }
        case 'confuse:toggle': {
          if (isT) return;
          r.conf = r.conf || new Set();
          const on = !r.conf.has(cid);
          if (on) r.conf.add(cid); else r.conf.delete(cid);
          send(cid, 'confuse:mine', { on });
          toTeachers(r, 'confuse:state', confView(r, on ? c.name : null)); break;
        }
        case 'confuse:clear': {
          if (!isT) return;
          r.conf = new Set();
          all('confuse:state', { n: 0, names: [] });
          r.members.forEach((id) => { if (clients.get(id).role !== 'teacher') send(id, 'confuse:mine', { on: false }); }); break;
        }

        // ----- open a saved board file (teacher) -----
        case 'board:load': {
          if (!isT || !Array.isArray(d.pages) || !d.pages.length || d.pages.length > MAX_PAGES) return ack({ ok: false, error: 'This file is not a SmartBoard file.' });
          let size = 0;
          const pages = d.pages.map((objs) => (Array.isArray(objs) ? objs.filter(validObj).slice(0, MAX_OBJECTS) : []));
          try { size = JSON.stringify(pages).length; } catch (e) { size = 1e9; }
          if (size > 12e6) return ack({ ok: false, error: 'This board file is too large.' });
          r.pages = pages.map((objects, i) => ({ objects, redo: [], bg: BACKGROUNDS.indexOf(Array.isArray(d.bgs) ? d.bgs[i] : d.bg) >= 0 ? (Array.isArray(d.bgs) ? d.bgs[i] : d.bg) : undefined }));
          r.current = 0; r.brk = null; r.curtain = null;
          if (BACKGROUNDS.indexOf(d.bg) >= 0) r.bg = d.bg;
          r.pages.forEach((p) => { if (!p.bg) p.bg = r.bg; });
          if (d.title) r.title = clean(d.title, 60);
          touch();
          r.members.forEach((id) => send(id, 'board:loaded', stateOf(r, id)));
          ack({ ok: true }); break;
        }

        // ----- class timer -----
        case 'timer:start': {
          const s = Number(d.seconds);
          if (!isT || !Number.isInteger(s) || s < 5 || s > 7200) return;
          r.timer = { endAt: now() + s * 1000, total: s };
          all('timer:state', timerView(r)); break;
        }
        case 'timer:stop': {
          if (!isT) return;
          r.timer = null; all('timer:state', null); break;
        }
        default:
      }
    }

    // ---------- persistence helpers ----------
    function exportRooms() {
      return [...rooms.values()].map((r) => ({
        code: r.code, key: r.key, title: r.title, pages: r.pages.map((p) => p.objects),
        bgs: r.pages.map((p) => p.bg || r.bg), current: r.current, bg: r.bg, studentDraw: r.studentDraw, last: r.last, owner: r.owner || null,
      }));
    }

    function importRooms(list) {
      (Array.isArray(list) ? list : []).forEach((s) => {
        if (!s || !s.code || !s.key || !Array.isArray(s.pages) || !s.pages.length || rooms.has(s.code)) return;
        rooms.set(s.code, {
          code: s.code, key: s.key, title: clean(s.title, 60),
          pages: s.pages.map((objs, i) => ({ objects: Array.isArray(objs) ? objs : [], redo: [], bg: Array.isArray(s.bgs) && BACKGROUNDS.indexOf(s.bgs[i]) >= 0 ? s.bgs[i] : undefined })),
          current: Math.max(0, Math.min(Number(s.current) || 0, s.pages.length - 1)),
          bg: BACKGROUNDS.indexOf(s.bg) >= 0 ? s.bg : 'white', studentDraw: !!s.studentDraw,
          poll: null, timer: null, members: new Set(), last: Number(s.last) || now(),
          owner: typeof s.owner === 'string' ? s.owner : null,
        });
      });
    }

    function sweep(maxAgeMs) {
      const t = now();
      rooms.forEach((r, code) => { if (!r.owner && r.members.size === 0 && t - r.last > maxAgeMs) rooms.delete(code); });
    }

    return {
      handle,
      disconnect: leaveRoom,
      hasRoom: (code) => rooms.has(String(code || '').trim().toUpperCase()),
      exportRooms,
      importRooms,
      sweep,
      size: () => rooms.size,
      boardsOf: (uid) => [...rooms.values()].filter((r) => r.owner === uid).map((r) => ({ code: r.code, title: r.title, pages: r.pages.length, last: r.last, live: r.members.size })),
      ownerOf: (code) => (rooms.get(code) || {}).owner || null,
      keyOf: (code) => (rooms.get(code) || {}).key || null,
      remove: (code) => { const r = rooms.get(code); if (!r) return false; r.members.forEach((id) => { /* kicked by next action */ }); rooms.delete(code); return true; },
    };
  }

  return { createEngine, BACKGROUNDS };
});
