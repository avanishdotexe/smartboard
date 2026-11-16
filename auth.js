// Small, dependency-free auth: scrypt password hashes + HMAC signed tokens.
const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) console.warn('JWT_SECRET is not set: logins will reset on every restart. Set it in production.');
const TTL = 30 * 24 * 3600 * 1000;
const b64 = (b) => Buffer.from(b).toString('base64url');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPassword(pw, stored) {
  const [s, h] = String(stored || '').split(':'); if (!s || !h) return false;
  const a = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 64), b = Buffer.from(h, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function sign(uid) {
  const body = b64(JSON.stringify({ u: uid, e: Date.now() + TTL }));
  return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
}
function verify(token) {
  if (typeof token !== 'string' || token.length > 400) return null;
  const [body, sig] = token.split('.'); if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.e > Date.now() ? p.u : null; } catch (e) { return null; }
}
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
module.exports = { hashPassword, checkPassword, sign, verify, EMAIL };
