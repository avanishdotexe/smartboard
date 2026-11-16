// Storage layer. With MONGODB_URI set, boards and users live in MongoDB (Atlas).
// Without it, everything falls back to JSON files in ./data (good for local use).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

function fileStore(dir) {
  const rooms = path.join(dir, 'boards.json'), users = path.join(dir, 'users.json');
  const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
  const writeJ = (f, v) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(v)); fs.renameSync(f + '.tmp', f); };
  let U = null; const loadU = () => (U = U || readJ(users, []));
  return {
    kind: 'file',
    async init() {},
    async loadRooms() { return readJ(rooms, []); },
    async saveRooms(list) { writeJ(rooms, list); },
    async createUser(u) { const a = loadU(); if (a.some((x) => x.email === u.email)) return false; a.push(u); writeJ(users, a); return true; },
    async userByEmail(email) { return loadU().find((x) => x.email === email) || null; },
    async userById(id) { return loadU().find((x) => x.id === id) || null; },
    async close() {},
  };
}

function mongoStore(uri, driver) {
  const { MongoClient } = driver || require('mongodb');
  let client, R, U; const seen = new Map(); // code -> hash of last saved JSON
  return {
    kind: 'mongo',
    async init() {
      client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
      await client.connect();
      const db = client.db(process.env.MONGODB_DB || 'smartboard');
      R = db.collection('rooms'); U = db.collection('users');
      await U.createIndex({ email: 1 }, { unique: true });
      await R.createIndex({ owner: 1 });
    },
    async loadRooms() {
      const docs = await R.find({}).toArray();
      return docs.map((d) => { const { _id, ...rest } = d; const s = Object.assign({ code: _id }, rest); seen.set(_id, md5(JSON.stringify(s))); return s; });
    },
    async saveRooms(list) {
      const ops = []; const live = new Set();
      for (const r of list) {
        live.add(r.code);
        const h = md5(JSON.stringify(r)); if (seen.get(r.code) === h) continue;
        const { code, ...doc } = r;
        ops.push({ updateOne: { filter: { _id: code }, update: { $set: Object.assign({}, doc, { updatedAt: new Date() }) }, upsert: true }, _code: code, _h: h });
      }
      const gone = [...seen.keys()].filter((c) => !live.has(c));
      if (gone.length) { await R.deleteMany({ _id: { $in: gone } }); gone.forEach((c) => seen.delete(c)); }
      for (const op of ops) { // one by one so a single oversized board cannot block the rest
        try { await R.bulkWrite([{ updateOne: op.updateOne }]); seen.set(op._code, op._h); } catch (e) { console.error('Could not save board', op._code, e.message); }
      }
    },
    async createUser(u) { try { await U.insertOne(Object.assign({ _id: u.id }, u)); return true; } catch (e) { if (e && e.code === 11000) return false; throw e; } },
    async userByEmail(email) { return U.findOne({ email }); },
    async userById(id) { return U.findOne({ _id: id }); },
    async close() { if (client) await client.close(); },
  };
}

module.exports = { fileStore, mongoStore };
