// SmartBoard server: Express (static files) + Socket.io (real-time transport).
// All room rules live in public/js/core.js, so this file stays small.
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');
const { createEngine } = require('./public/js/core.js');

const app = express();
app.set('trust proxy', 1);
// one bad request must never take the whole board down
process.on('uncaughtException', (e) => console.error('uncaughtException', e));
process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 15e6, // images / PDF pages are sent as data URLs
  pingInterval: 20000, pingTimeout: 60000, // tolerate slow phones / weak networks before saying "connection lost"
  cors: { origin: '*' },
});

// Build id of the files in /public. It changes on every deploy; the page asks for it and reloads itself when it changes.
const BUILD_ID = (() => {
  const fs = require('fs'), crypto = require('crypto'), h = crypto.createHash('sha1');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) return walk(f);
    h.update(f.replace(__dirname, '') + fs.statSync(f).size + fs.readFileSync(f));
  });
  try { walk(path.join(__dirname, 'public')); } catch (e) { h.update(String(Date.now())); }
  return h.digest('hex').slice(0, 10);
})();
// marks responses that really come from SmartBoard (Render's "waking up" page does not have it)
app.use((_req, res, next) => { res.setHeader('X-SB', '1'); next(); });
// ICE servers for video/voice. Set TURN_URLS (comma separated), TURN_USER, TURN_PASS on Render to use your own TURN server.
app.get('/api/ice', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const ice = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const urls = (process.env.TURN_URLS || 'turn:staticauth.openrelay.metered.ca:80,turn:staticauth.openrelay.metered.ca:443,turns:staticauth.openrelay.metered.ca:443?transport=tcp').split(',').map((x) => x.trim()).filter(Boolean);
  ice.push({ urls, username: process.env.TURN_USER || 'openrelayproject', credential: process.env.TURN_PASS || 'openrelayproject' });
  res.json({ iceServers: ice });
});
app.get('/api/version', (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({ v: BUILD_ID }); });

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, file) => {
    // App files are always re-checked with the server, so a new deploy reaches users at once (unchanged files still answer 304, which is cheap).
    if (/\.(html|js|css|webmanifest|json)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
  },
}));
app.get('/health', (_req, res) => res.send('ok'));
// Android app (Trusted Web Activity) proof file. Paste the JSON that PWABuilder gives you into assetlinks.json
app.get('/.well-known/assetlinks.json', (_req, res) => {
  try { res.type('application/json').send(require('fs').readFileSync(path.join(__dirname, 'assetlinks.json'), 'utf8')); }
  catch (e) { res.type('application/json').send('[]'); }
});

// ---------- room engine ----------
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'boards.json');
const KEEP_BOARDS_MS = 7 * 24 * 60 * 60 * 1000; // empty boards are kept for 7 days

const engine = createEngine({
  send: (cid, ev, data) => io.to(cid).emit(ev, data),
  randomKey: () => crypto.randomBytes(12).toString('hex'), // secret that proves "I am the teacher"
  onChange: schedulePersist,
});

// ---------- saving boards (MongoDB when MONGODB_URI is set, JSON files otherwise) ----------
const { fileStore, mongoStore } = require('./store');
const auth = require('./auth');
const store = process.env.MONGODB_URI ? mongoStore(process.env.MONGODB_URI) : fileStore(DATA_DIR);
let persistTimer = null, saving = false, dirty = false;
function schedulePersist() {
  dirty = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => { persistTimer = null; persist(); }, 3000);
}
async function persist() {
  if (saving) { dirty = true; return; }
  saving = true; dirty = false;
  try { await store.saveRooms(engine.exportRooms()); }
  catch (err) { console.error('Could not save boards:', err.message); dirty = true; }
  saving = false;
  if (dirty && !persistTimer) schedulePersist();
}
const ready = (async () => {
  await store.init();
  engine.importRooms(await store.loadRooms());
  engine.sweep(KEEP_BOARDS_MS);
  console.log(`Storage: ${store.kind}. Loaded ${engine.size()} saved board(s).`);
})().catch((e) => { console.error('Storage failed to start:', e.message); process.exit(1); });

// ---------- accounts (teachers only; students never need one) ----------
app.use('/api', express.json({ limit: '10kb' }));
const hits = new Map();
const limited = (req, res, max) => {
  const k = req.ip + req.path, t = Date.now(), a = (hits.get(k) || []).filter((x) => t - x < 60000);
  a.push(t); hits.set(k, a);
  if (a.length > max) { res.status(429).json({ error: 'Too many attempts. Please wait a minute.' }); return true; }
  return false;
};
setInterval(() => hits.clear(), 10 * 60 * 1000).unref();
const pub = (u) => ({ id: u.id, name: u.name, email: u.email });
const me = async (req) => { const id = auth.verify((req.get('authorization') || '').replace(/^Bearer /, '')); return id ? store.userById(id) : null; };
const wrap = (fn) => async (req, res) => { try { await ready; await fn(req, res); } catch (e) { console.error(e); res.status(500).json({ error: 'Server error. Please try again.' }); } };

app.post('/api/signup', wrap(async (req, res) => {
  if (limited(req, res, 10)) return;
  const name = String((req.body || {}).name || '').trim().slice(0, 40), email = String((req.body || {}).email || '').trim().toLowerCase(), pw = String((req.body || {}).password || '');
  if (!name) return res.status(400).json({ error: 'Please enter your name.' });
  if (!auth.EMAIL.test(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (pw.length < 6 || pw.length > 100) return res.status(400).json({ error: 'Password must be 6 to 100 characters.' });
  const u = { id: crypto.randomBytes(9).toString('hex'), name, email, pass: auth.hashPassword(pw), created: Date.now() };
  if (!(await store.createUser(u))) return res.status(409).json({ error: 'This email is already registered. Please log in.' });
  res.json({ token: auth.sign(u.id), user: pub(u) });
}));
app.post('/api/login', wrap(async (req, res) => {
  if (limited(req, res, 10)) return;
  const email = String((req.body || {}).email || '').trim().toLowerCase(), pw = String((req.body || {}).password || '');
  const u = await store.userByEmail(email);
  if (!u || !auth.checkPassword(pw, u.pass)) return res.status(401).json({ error: 'Wrong email or password.' });
  res.json({ token: auth.sign(u.id), user: pub(u) });
}));
app.get('/api/me', wrap(async (req, res) => { const u = await me(req); if (!u) return res.status(401).json({ error: 'Please log in.' }); res.json({ user: pub(u) }); }));
app.get('/api/boards', wrap(async (req, res) => { const u = await me(req); if (!u) return res.status(401).json({ error: 'Please log in.' }); res.json({ boards: engine.boardsOf(u.id).sort((a, b) => b.last - a.last) }); }));
app.post('/api/boards/:code/open', wrap(async (req, res) => {
  const u = await me(req), code = String(req.params.code || '').toUpperCase();
  if (!u || engine.ownerOf(code) !== u.id) return res.status(403).json({ error: 'This is not your board.' });
  res.json({ code, key: engine.keyOf(code) });
}));
app.delete('/api/boards/:code', wrap(async (req, res) => {
  const u = await me(req), code = String(req.params.code || '').toUpperCase();
  if (!u || engine.ownerOf(code) !== u.id) return res.status(403).json({ error: 'This is not your board.' });
  const b = engine.boardsOf(u.id).find((x) => x.code === code);
  if (b && b.live) return res.status(409).json({ error: 'The class is live right now. End it first.' });
  engine.remove(code); schedulePersist(); res.json({ ok: true });
}));

// ---------- sockets ----------
io.on('connection', (socket) => {
  socket.onAny(async (ev, ...args) => {
    const ack = typeof args[args.length - 1] === 'function' ? args.pop() : null;
    await ready;
    if (ev === 'room:create') { // attach the logged-in teacher as owner (token is verified here, never trusted from the client)
      const a = args[0] && typeof args[0] === 'object' ? args[0] : {};
      args[0] = { title: a.title, tname: a.tname, owner: auth.verify(a.token) };
    }
    engine.handle(socket.id, ev, args[0], ack);
  });
  socket.on('disconnect', () => engine.disconnect(socket.id));
});

setInterval(() => { engine.sweep(KEEP_BOARDS_MS); schedulePersist(); }, 30 * 60 * 1000).unref();

async function shutdown() { try { await store.saveRooms(engine.exportRooms()); await store.close(); } catch (e) { console.error(e.message); } process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  SmartBoard is running -> http://localhost:${PORT}\n`);
});
