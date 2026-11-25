import { Router } from 'express';
import {
  createLoginLimiter, createToken, hashPin, isValidPin, publicUser, requireAuth, sessionCookie, verifyPin,
} from '../auth.js';
import { HttpError, handle, requireString } from '../errors.js';
import { buildUser, staffKey } from '../store.js';

export const isDuplicate = (error) => error?.code === 11000;

// A profile picture is stored as a small data URL, so it needs no file storage. The browser shrinks it before sending;
// the server still checks the type, the size and the first bytes, so that only a real picture is ever kept.
const PHOTO_SIGNATURES = { jpeg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47], webp: [0x52, 0x49, 0x46, 0x46] };
export const MAX_PHOTO_CHARS = 70_000; // the request limit is 100 kb

export function checkPhoto(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'Choose a picture to upload.');
  if (value.length > MAX_PHOTO_CHARS) throw new HttpError(400, 'That picture is too large. Choose a smaller one.');
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new HttpError(400, 'Choose a JPEG, PNG or WebP picture.');
  const bytes = Buffer.from(match[2], 'base64');
  if (!PHOTO_SIGNATURES[match[1]].every((byte, i) => bytes[i] === byte)) throw new HttpError(400, 'That file is not a valid picture.');
  return value;
}

export function authRoutes(store, config) {
  const router = Router();
  const limiter = createLoginLimiter();
  // Checked against when the badge does not exist, so a missing account takes as long as a wrong PIN.
  let decoy;

  const startSession = (res, user) => {
    res.setHeader('Set-Cookie', sessionCookie(createToken(user._id, config.sessionSecret, config.sessionHours), config));
  };

  router.get('/config', (_req, res) => {
    res.json({ selfRegistration: config.allowSelfRegistration });
  });

  router.post('/login', handle(async (req, res) => {
    const badge = requireString(req.body?.staffNumber, 'Badge ID', { max: 40 });
    const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
    const keys = [`ip:${req.ip}`, `badge:${staffKey(badge)}`];
    if (limiter.blocked(...keys)) throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.');

    const user = await store.users.findOne({ staffKey: staffKey(badge) });
    decoy ??= await hashPin('000000');
    const valid = await verifyPin(pin, user?.pinHash ?? decoy);
    if (!user || !valid) {
      limiter.fail(...keys);
      throw new HttpError(401, 'Incorrect badge ID or PIN.');
    }
    if ((user.status || 'active') === 'suspended') throw new HttpError(403, 'This account is suspended. Contact an administrator.');

    limiter.clear(...keys);
    startSession(res, user);
    res.json({ user: publicUser(user) });
  }));

  router.post('/register', handle(async (req, res) => {
    if (!config.allowSelfRegistration) throw new HttpError(403, 'Accounts are created by an administrator.');
    const name = requireString(req.body?.name, 'Name', { max: 80 });
    const staffNumber = requireString(req.body?.staffNumber, 'Badge ID', { min: 4, max: 40 });
    if (!isValidPin(req.body?.pin)) throw new HttpError(400, 'The PIN must be 4 to 6 digits.');
    const user = await buildUser({ name, staffNumber, pin: req.body.pin, role: 'Staff member' });
    try {
      await store.users.insertOne(user);
    } catch (error) {
      if (isDuplicate(error)) throw new HttpError(409, 'A worker with this badge ID already exists.');
      throw error;
    }
    startSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  }));

  router.post('/logout', (_req, res) => {
    res.setHeader('Set-Cookie', sessionCookie('', config, { clear: true }));
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    res.json({ user: req.user ?? null });
  });

  router.post('/pin', requireAuth, handle(async (req, res) => {
    const user = await store.users.findOne({ _id: req.user.id });
    if (!user || !(await verifyPin(typeof req.body?.currentPin === 'string' ? req.body.currentPin : '', user.pinHash))) {
      throw new HttpError(401, 'The current PIN is not correct.');
    }
    if (!isValidPin(req.body?.newPin)) throw new HttpError(400, 'The new PIN must be 4 to 6 digits.');
    await store.users.updateOne({ _id: user._id }, { $set: { pinHash: await hashPin(req.body.newPin) } });
    res.json({ ok: true });
  }));

  // Sets or removes the signed-in person's own profile picture. Nobody can change anyone else's.
  router.put('/photo', requireAuth, handle(async (req, res) => {
    const photo = req.body?.photo;
    const change = photo === null ? { $unset: { photo: '' } } : { $set: { photo: checkPhoto(photo) } };
    await store.users.updateOne({ _id: req.user.id }, change);
    res.json({ user: publicUser(await store.users.findOne({ _id: req.user.id })) });
  }));

  return router;
}
