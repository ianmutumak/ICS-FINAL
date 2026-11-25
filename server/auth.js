import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { HttpError } from './errors.js';

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 64 };
export const SESSION_COOKIE = 'zc_session';

export const isValidPin = (pin) => typeof pin === 'string' && /^\d{4,6}$/.test(pin);

/** A PIN is stored only as a salted scrypt hash. */
export async function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt, SCRYPT.keyLength, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return { salt: salt.toString('hex'), hash: hash.toString('hex'), n: SCRYPT.N };
}

export async function verifyPin(pin, record) {
  if (!record?.salt || !record?.hash || typeof pin !== 'string') return false;
  const expected = Buffer.from(record.hash, 'hex');
  const actual = await scryptAsync(pin, Buffer.from(record.salt, 'hex'), expected.length, {
    N: record.n || SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const encode = (value) => Buffer.from(value).toString('base64url');
const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url');

/** A signed, expiring session token. It holds only the user id; the user is loaded again on every request. */
export function createToken(userId, secret, hours) {
  const payload = encode(JSON.stringify({ u: userId, exp: Date.now() + hours * 3600000 }));
  return `${payload}.${sign(payload, secret)}`;
}

export function readToken(token, secret) {
  if (typeof token !== 'string') return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.u === 'string' && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const index = part.indexOf('=');
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    })
  );
}

export function sessionCookie(token, config, { clear = false } = {}) {
  const parts = [`${SESSION_COOKIE}=${clear ? '' : encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (config.production) parts.push('Secure');
  if (clear) parts.push('Max-Age=0');
  return parts.join('; ');
}

/** The user as the browser may see them: never the PIN hash. */
export const publicUser = (doc) => ({
  id: doc._id,
  staffNumber: doc.staffNumber,
  name: doc.name,
  role: doc.role || '',
  department: doc.department || '',
  qualification: doc.qualification || '',
  avatarSeed: doc.avatarSeed || '',
  photo: doc.photo || '',
  isAdmin: Boolean(doc.isAdmin),
  status: doc.status || 'active',
});

/** Loads the signed-in user from the session cookie. Suspended or deleted users are signed out at once. */
export function authenticate(store, config) {
  return async (req, _res, next) => {
    try {
      const data = readToken(parseCookies(req.headers.cookie)[SESSION_COOKIE], config.sessionSecret);
      if (data) {
        const user = await store.users.findOne({ _id: data.u });
        if (user && (user.status || 'active') !== 'suspended') req.user = publicUser(user);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in.'));
  next();
}

export function requireAdmin(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in.'));
  if (!req.user.isAdmin) return next(new HttpError(403, 'Only an administrator can do this.'));
  next();
}

/** Limits repeated failed sign-ins, per address and per badge, so a PIN cannot be guessed quickly. */
export function createLoginLimiter({ maxFailures = 8, windowMs = 15 * 60 * 1000 } = {}) {
  const failures = new Map();
  const recent = (key) => (failures.get(key) || []).filter((time) => Date.now() - time < windowMs);
  return {
    blocked: (...keys) => keys.some((key) => recent(key).length >= maxFailures),
    fail: (...keys) => keys.forEach((key) => failures.set(key, [...recent(key), Date.now()])),
    clear: (...keys) => keys.forEach((key) => failures.delete(key)),
  };
}
