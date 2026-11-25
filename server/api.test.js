import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { LATE_GRACE_MINUTES, lateMinutesFor, scheduledStartFor, sealHandover as serverSeal } from './rules.js';
import { connectStore, seedAdministrator } from './store.js';
import { sealHandover as clientSeal } from '../src/lib/shiftRules';

let mongod;
let store;
let server;
let base;
let config;
let ipCounter = 0;

const ADMIN = { staffNumber: 'ADMIN-0001', pin: '2468' };

/** Calls the API like a browser would, with an optional session cookie. */
async function call(method, path, { body, cookie, origin, ip, headers } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
      'x-forwarded-for': ip ?? '10.0.0.1',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const setCookie = response.headers.get('set-cookie');
  return {
    status: response.status,
    data: text ? JSON.parse(text) : null,
    text,
    cookie: setCookie ? setCookie.split(';')[0] : undefined,
    setCookie,
  };
}

const freshIp = () => `10.1.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`;

async function login(staffNumber, pin) {
  const result = await call('POST', '/api/auth/login', { body: { staffNumber, pin }, ip: freshIp() });
  expect(result.status, `login as ${staffNumber}: ${result.text}`).toBe(200);
  return result.cookie;
}

async function createStaff(adminCookie, staffNumber, name, pin = '1111') {
  const result = await call('POST', '/api/users', { cookie: adminCookie, body: { staffNumber, name, pin, role: 'Cargo handler' } });
  expect(result.status, result.text).toBe(201);
  return login(staffNumber, pin);
}

const SBAR = { subjectRef: 'Dock door 4', situation: 'S', background: 'B', assessment: 'A', recommendation: 'R' };

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  config = loadConfig({
    NODE_ENV: 'test', SESSION_SECRET: 'x'.repeat(40), MONGODB_URI: mongod.getUri(), MONGODB_DB: 'test',
    ALLOW_SELF_REGISTRATION: 'false', INITIAL_ADMIN_BADGE: ADMIN.staffNumber, INITIAL_ADMIN_PIN: ADMIN.pin,
  });
  store = await connectStore(config);
  await seedAdministrator(store, config, { info() {}, warn() {} });
  server = createApp(store, config).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  server?.close();
  await store?.close();
  await mongod?.stop();
});

describe('sign-in and sessions', () => {
  it('creates the first administrator from the environment, once', async () => {
    expect(await store.users.countDocuments({ isAdmin: true })).toBe(1);
    expect(await seedAdministrator(store, config, { info() {}, warn() {} })).toBe(false);
    expect(await store.users.countDocuments({})).toBe(1);
  });

  it('stores only a salted hash of the PIN', async () => {
    const doc = await store.users.findOne({ staffKey: 'admin-0001' });
    expect(doc.pinHash).toMatchObject({ salt: expect.any(String), hash: expect.any(String) });
    expect(JSON.stringify(doc)).not.toContain(ADMIN.pin);
  });

  it('signs in with the right PIN, with an HttpOnly session cookie, and never returns the PIN hash', async () => {
    const result = await call('POST', '/api/auth/login', { body: { staffNumber: 'admin-0001', pin: ADMIN.pin }, ip: freshIp() });
    expect(result.status).toBe(200);
    expect(result.data.user).toMatchObject({ staffNumber: 'ADMIN-0001', isAdmin: true });
    expect(result.setCookie).toMatch(/HttpOnly/i);
    expect(result.setCookie).toMatch(/SameSite=Lax/i);
    expect(result.text).not.toMatch(/pinHash|salt|"hash"/);
    const me = await call('GET', '/api/auth/me', { cookie: result.cookie });
    expect(me.data.user.staffNumber).toBe('ADMIN-0001');
  });

  it('gives the same answer for a wrong PIN and an unknown badge', async () => {
    const wrongPin = await call('POST', '/api/auth/login', { body: { staffNumber: ADMIN.staffNumber, pin: '0000' }, ip: freshIp() });
    const unknown = await call('POST', '/api/auth/login', { body: { staffNumber: 'NOPE-9999', pin: '0000' }, ip: freshIp() });
    expect(wrongPin.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPin.data.error).toBe(unknown.data.error);
  });

  it('rejects query-operator injection in the badge and the PIN', async () => {
    const badge = await call('POST', '/api/auth/login', { body: { staffNumber: { $ne: null }, pin: ADMIN.pin }, ip: freshIp() });
    expect(badge.status).toBe(400);
    const pin = await call('POST', '/api/auth/login', { body: { staffNumber: ADMIN.staffNumber, pin: { $ne: '' } }, ip: freshIp() });
    expect(pin.status).toBe(401);
  });

  it('blocks repeated failed attempts, for a badge and for an address, for a limited time', async () => {
    const admin = await login(ADMIN.staffNumber, ADMIN.pin);
    await createStaff(admin, 'RL-0001', 'Rate Limited', '1111');
    const ip = '10.99.99.99';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect((await call('POST', '/api/auth/login', { body: { staffNumber: 'RL-0001', pin: '0000' }, ip })).status).toBe(401);
    }
    // The right PIN is refused too while the block lasts, from this address and from another.
    expect((await call('POST', '/api/auth/login', { body: { staffNumber: 'RL-0001', pin: '1111' }, ip })).status).toBe(429);
    expect((await call('POST', '/api/auth/login', { body: { staffNumber: 'RL-0001', pin: '1111' }, ip: freshIp() })).status).toBe(429);
    // Other badges are not affected from another address.
    expect((await call('POST', '/api/auth/login', { body: { staffNumber: ADMIN.staffNumber, pin: ADMIN.pin }, ip: freshIp() })).status).toBe(200);
  });

  it('does not accept a forged or tampered session cookie', async () => {
    const real = await login(ADMIN.staffNumber, ADMIN.pin);
    const tampered = `${real.slice(0, -3)}abc`;
    expect((await call('GET', '/api/users', { cookie: tampered })).status).toBe(401);
    expect((await call('GET', '/api/users', { cookie: 'zc_session=garbage' })).status).toBe(401);
  });

  it('signs out', async () => {
    const cookie = await login(ADMIN.staffNumber, ADMIN.pin);
    const result = await call('POST', '/api/auth/logout', { cookie });
    expect(result.setCookie).toMatch(/Max-Age=0/);
  });

  it('refuses registration while accounts are created by an administrator', async () => {
    const result = await call('POST', '/api/auth/register', { body: { name: 'Eve', staffNumber: 'EVE-0001', pin: '1234' } });
    expect(result.status).toBe(403);
  });

  it('lets a user change their own PIN only with the current one', async () => {
    const admin = await login(ADMIN.staffNumber, ADMIN.pin);
    const cookie = await createStaff(admin, 'PIN-0001', 'Pin Changer', '1111');
    expect((await call('POST', '/api/auth/pin', { cookie, body: { currentPin: '9999', newPin: '2222' } })).status).toBe(401);
    expect((await call('POST', '/api/auth/pin', { cookie, body: { currentPin: '1111', newPin: '12' } })).status).toBe(400);
    expect((await call('POST', '/api/auth/pin', { cookie, body: { currentPin: '1111', newPin: '2222' } })).status).toBe(200);
    expect((await call('POST', '/api/auth/login', { body: { staffNumber: 'PIN-0001', pin: '1111' }, ip: freshIp() })).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { body: { staffNumber: 'PIN-0001', pin: '2222' }, ip: freshIp() })).status).toBe(200);
  });
});

describe('access control', () => {
  it('requires sign-in for every data route', async () => {
    for (const path of ['/api/shifts/active', '/api/shifts/archive', '/api/users', '/api/departments', '/api/incidents', '/api/overrides', '/api/forecast-decisions', '/api/timing-runs']) {
      expect((await call('GET', path)).status, path).toBe(401);
    }
    expect((await call('POST', '/api/shifts', { body: { shiftType: 'morning', workArea: 'X' } })).status).toBe(401);
  });

  it('keeps administrator routes away from staff', async () => {
    const admin = await login(ADMIN.staffNumber, ADMIN.pin);
    const staff = await createStaff(admin, 'ACC-0001', 'Access Check');
    for (const path of ['/api/users', '/api/shifts/archive', '/api/incidents', '/api/overrides', '/api/forecast-decisions', '/api/timing-runs', '/api/categories']) {
      expect((await call('GET', path, { cookie: staff })).status, path).toBe(403);
    }
    expect((await call('POST', '/api/users', { cookie: staff, body: { name: 'X', staffNumber: 'X-0001', pin: '1234', isAdmin: true } })).status).toBe(403);
    expect((await call('POST', '/api/departments', { cookie: staff, body: { code: 'A', name: 'A' } })).status).toBe(403);
    expect((await call('GET', '/api/departments', { cookie: staff })).status).toBe(200);
  });

  it('refuses state-changing requests from another website', async () => {
    const cookie = await login(ADMIN.staffNumber, ADMIN.pin);
    const evil = await call('POST', '/api/departments', { cookie, origin: 'https://evil.example', body: { code: 'EV', name: 'Evil zone' } });
    expect(evil.status).toBe(403);
    const same = await call('POST', '/api/departments', { cookie, origin: base, body: { code: 'OK', name: 'Same-origin zone' } });
    expect(same.status).toBe(201);
  });

  it('is stricter in production: only its own address is accepted as an origin', async () => {
    const productionConfig = loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'z'.repeat(40), MONGODB_URI: mongod.getUri() });
    const production = createApp(store, productionConfig).listen(0);
    try {
      const url = `http://127.0.0.1:${production.address().port}`;
      const attempt = (origin) => fetch(`${url}/api/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': freshIp() },
        body: JSON.stringify({ staffNumber: ADMIN.staffNumber, pin: '0000' }),
      });
      expect((await attempt('http://localhost:5173')).status).toBe(403);
      expect((await attempt('https://evil.example')).status).toBe(403);
      // Its own address passes the origin check and is then judged on the PIN.
      expect((await attempt(url)).status).toBe(401);
    } finally {
      production.close();
    }
  });

  it('stops a tab acting as one account after another account has signed in on the same browser', async () => {
    const admin = await login(ADMIN.staffNumber, ADMIN.pin);
    const ian = await createStaff(admin, 'ID-0001', 'Tab Ian');
    const ryan = await createStaff(admin, 'ID-0002', 'Tab Ryan');
    const ianId = (await call('GET', '/api/auth/me', { cookie: ian })).data.user.id;
    const ryanId = (await call('GET', '/api/auth/me', { cookie: ryan })).data.user.id;

    // The browser's cookie is now Ryan's, but the old tab still believes it is Ian.
    const staleRead = await call('GET', '/api/shifts/active', { cookie: ryan, headers: { 'x-expected-user': ianId } });
    expect(staleRead.status).toBe(401);
    expect(staleRead.data.error).toMatch(/another account signed in/);

    const before = await store.shifts.countDocuments({});
    const staleWrite = await call('POST', '/api/shifts', { cookie: ryan, headers: { 'x-expected-user': ianId }, body: { shiftType: 'morning', workArea: 'Stale tab' } });
    expect(staleWrite.status).toBe(401);
    expect(await store.shifts.countDocuments({})).toBe(before);

    // A signed-out tab cannot act either, and signing out from a stale tab does not end the other account's session.
    expect((await call('POST', '/api/auth/logout', { cookie: ryan, headers: { 'x-expected-user': ianId } })).status).toBe(401);
    expect((await call('GET', '/api/auth/me', { cookie: ryan })).data.user.id).toBe(ryanId);

    // The tab that matches the cookie works, and a tab can always ask who it is in order to recover.
    expect((await call('GET', '/api/shifts/active', { cookie: ryan, headers: { 'x-expected-user': ryanId } })).status).toBe(200);
    expect((await call('GET', '/api/auth/me', { cookie: ryan, headers: { 'x-expected-user': ianId } })).status).toBe(200);
    // Requests that send no identity (for example the sign-in screen) are not affected.
    expect((await call('GET', '/api/auth/config')).status).toBe(200);
  });

  it('keeps two accounts that share a PIN apart', async () => {
    const admin = await login(ADMIN.staffNumber, ADMIN.pin);
    const first = await createStaff(admin, 'PINSHARE-1', 'Shared One', '4545');
    const second = await createStaff(admin, 'PINSHARE-2', 'Shared Two', '4545');
    expect((await call('GET', '/api/auth/me', { cookie: first })).data.user.name).toBe('Shared One');
    expect((await call('GET', '/api/auth/me', { cookie: second })).data.user.name).toBe('Shared Two');
    const docs = await store.users.find({ staffKey: { $in: ['pinshare-1', 'pinshare-2'] } }).toArray();
    // Equal PINs still get different salts and hashes, so one PIN reveals nothing about the other account.
    expect(docs[0].pinHash.hash).not.toBe(docs[1].pinHash.hash);
    expect(docs[0].pinHash.salt).not.toBe(docs[1].pinHash.salt);
  });

  it('signs a suspended user out at once', async () => {
    const admin = await login(ADMIN.staffNumber, ADMIN.pin);
    const staff = await createStaff(admin, 'SUS-0001', 'Suspend Me', '3333');
    expect((await call('GET', '/api/shifts/active', { cookie: staff })).status).toBe(200);
    const users = (await call('GET', '/api/users', { cookie: admin })).data;
    const target = users.find((user) => user.staffNumber === 'SUS-0001');
    expect((await call('PATCH', `/api/users/${target.id}`, { cookie: admin, body: { status: 'suspended' } })).status).toBe(200);
    expect((await call('GET', '/api/shifts/active', { cookie: staff })).status).toBe(401);
    const again = await call('POST', '/api/auth/login', { body: { staffNumber: 'SUS-0001', pin: '3333' }, ip: freshIp() });
    expect(again.status).toBe(403);
    expect(again.data.error).toMatch(/suspended/i);
  });
});

describe('user management', () => {
  it('creates, updates and deletes users, with unique badge IDs', async () => {
    const admin = await login(ADMIN.staffNumber, ADMIN.pin);
    const created = await call('POST', '/api/users', { cookie: admin, body: { name: 'Grace Otieno', staffNumber: 'crud-0001', pin: '4444', role: 'Dock lead' } });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({ staffNumber: 'CRUD-0001', isAdmin: false, avatarSeed: 'GO' });
    expect(created.text).not.toMatch(/pinHash/);

    const duplicate = await call('POST', '/api/users', { cookie: admin, body: { name: 'Other', staffNumber: 'CRUD-0001', pin: '5555' } });
    expect(duplicate.status).toBe(409);

    const updated = await call('PATCH', `/api/users/${created.data.id}`, { cookie: admin, body: { role: 'Shift lead', pin: '6666' } });
    expect(updated.data.role).toBe('Shift lead');
    expect((await call('POST', '/api/auth/login', { body: { staffNumber: 'CRUD-0001', pin: '4444' }, ip: freshIp() })).status).toBe(401);
    expect((await call('POST', '/api/auth/login', { body: { staffNumber: 'CRUD-0001', pin: '6666' }, ip: freshIp() })).status).toBe(200);

    expect((await call('PATCH', `/api/users/${created.data.id}`, { cookie: admin, body: { pin: '12' } })).status).toBe(400);
    expect((await call('DELETE', `/api/users/${created.data.id}`, { cookie: admin })).status).toBe(200);
    expect((await call('DELETE', `/api/users/${created.data.id}`, { cookie: admin })).status).toBe(404);
  });

  it('validates input', async () => {
    const admin = await login(ADMIN.staffNumber, ADMIN.pin);
    expect((await call('POST', '/api/users', { cookie: admin, body: { name: '', staffNumber: 'VAL-0001', pin: '1234' } })).status).toBe(400);
    expect((await call('POST', '/api/users', { cookie: admin, body: { name: 'V', staffNumber: 'ab', pin: '1234' } })).status).toBe(400);
    expect((await call('POST', '/api/users', { cookie: admin, body: { name: 'V', staffNumber: 'VAL-0001', pin: 'abcd' } })).status).toBe(400);
    expect((await call('POST', '/api/users', { cookie: admin, body: { name: 'V', staffNumber: 'VAL-0001', pin: '1234', status: 'bogus' } })).status).toBe(400);
  });

  it('never removes the only active administrator, and never deletes your own account', async () => {
    const admin = await login(ADMIN.staffNumber, ADMIN.pin);
    const me = (await call('GET', '/api/auth/me', { cookie: admin })).data.user;
    expect((await call('DELETE', `/api/users/${me.id}`, { cookie: admin })).status).toBe(409);
    expect((await call('PATCH', `/api/users/${me.id}`, { cookie: admin, body: { isAdmin: false } })).status).toBe(409);
    expect((await call('PATCH', `/api/users/${me.id}`, { cookie: admin, body: { status: 'suspended' } })).status).toBe(409);

    // With a second administrator, the first may be demoted.
    const second = await call('POST', '/api/users', { cookie: admin, body: { name: 'Second Admin', staffNumber: 'ADMIN-0002', pin: '7777', isAdmin: true } });
    expect(second.status).toBe(201);
    expect((await call('PATCH', `/api/users/${second.data.id}`, { cookie: admin, body: { isAdmin: false } })).status).toBe(200);
  });
});

describe('the handover workflow', () => {
  let admin;
  let anna;
  let ben;
  let carl;
  let shiftId;

  beforeAll(async () => {
    admin = await login(ADMIN.staffNumber, ADMIN.pin);
    anna = await createStaff(admin, 'WF-0001', 'Anna Wanjiru');
    ben = await createStaff(admin, 'WF-0002', 'Ben Kiprop');
    carl = await createStaff(admin, 'WF-0003', 'Carl Mutua');
  });

  it('starts one shift, and refuses a second while one is open', async () => {
    expect((await call('GET', '/api/shifts/active', { cookie: anna })).data).toBeNull();
    const started = await call('POST', '/api/shifts', { cookie: anna, body: { shiftType: 'evening', workArea: 'Import warehouse' } });
    expect(started.status).toBe(201);
    expect(started.data).toMatchObject({ status: 'in_progress', shiftType: 'evening', wardOrDepartment: 'Import warehouse' });
    expect(started.data.handoverCode).toMatch(/^ZAMU-\d{4}-EVE-\d{3}$/);
    expect(started.data).not.toHaveProperty('_id');
    expect(started.data).not.toHaveProperty('rev');
    // Pressing Start shift records who started it and when, and how far that was from the scheduled start.
    expect(started.data).toMatchObject({ startedByName: 'Anna Wanjiru', scheduledStart: expect.any(String), startedAt: expect.any(String), lateMinutes: expect.any(Number) });
    expect(started.data.lateMinutes).toBeGreaterThanOrEqual(0);
    shiftId = started.data.id;

    const second = await call('POST', '/api/shifts', { cookie: ben, body: { shiftType: 'night', workArea: 'Other' } });
    expect(second.status).toBe(409);
    expect((await call('GET', '/api/shifts/active', { cookie: ben })).data.id).toBe(shiftId);
  });

  it('validates shifts and updates', async () => {
    expect((await call('POST', '/api/shifts', { cookie: anna, body: { shiftType: 'dawn', workArea: 'X' } })).status).toBe(400);
    expect((await call('POST', `/api/shifts/${shiftId}/cases`, { cookie: anna, body: { ...SBAR, situation: '   ' } })).status).toBe(400);
    expect((await call('POST', `/api/shifts/${shiftId}/cases`, { cookie: anna, body: { ...SBAR, recommendation: 'x'.repeat(2001) } })).status).toBe(400);
    expect((await call('POST', `/api/shifts/${shiftId}/cases`, { cookie: anna, body: { ...SBAR, subjectRef: { $gt: '' } } })).status).toBe(400);
    expect((await call('POST', '/api/shifts/does-not-exist/cases', { cookie: anna, body: SBAR })).status).toBe(404);
  });

  it('records updates and equipment, and cannot be signed without an update', async () => {
    expect((await call('POST', `/api/shifts/${shiftId}/sign/outgoing`, { cookie: anna })).status).toBe(409);

    const plain = await call('POST', `/api/shifts/${shiftId}/cases`, { cookie: anna, body: SBAR });
    expect(plain.status).toBe(201);
    expect(plain.data.cases[0]).toMatchObject({ subjectRef: 'Dock door 4', updatedBy: 'Anna Wanjiru' });

    const warned = await call('POST', `/api/shifts/${shiftId}/cases`, { cookie: anna, body: { ...SBAR, subjectRef: 'Cold room', isolationOrHazardAlert: 'Door seal damaged' } });
    expect(warned.data.cases).toHaveLength(2);

    const equipment = await call('POST', `/api/shifts/${shiftId}/equipment`, { cookie: anna, body: { name: 'Reach truck', assetTag: 'RT-01' } });
    expect(equipment.data.equipment[0]).toMatchObject({ name: 'Reach truck', custodyChecked: false, status: 'functional' });
    const itemId = equipment.data.equipment[0].id;
    expect((await call('PATCH', `/api/shifts/${shiftId}/equipment/${itemId}`, { cookie: anna, body: { custodyChecked: 'yes' } })).status).toBe(400);
    const checked = await call('PATCH', `/api/shifts/${shiftId}/equipment/${itemId}`, { cookie: anna, body: { custodyChecked: true } });
    expect(checked.data.equipment[0].custodyChecked).toBe(true);
  });

  it('lets only the author or an administrator remove an update', async () => {
    const mine = await call('POST', `/api/shifts/${shiftId}/cases`, { cookie: anna, body: { ...SBAR, subjectRef: 'Remove test' } });
    const target = mine.data.cases.find((update) => update.subjectRef === 'Remove test');
    expect(target.authorId).toBeTruthy();
    const refused = await call('DELETE', `/api/shifts/${shiftId}/cases/${target.id}`, { cookie: ben });
    expect(refused.status).toBe(403);
    expect(refused.data.error).toMatch(/person who wrote/);
    expect((await call('DELETE', `/api/shifts/${shiftId}/cases/${target.id}`, { cookie: admin })).status).toBe(200);
  });

  it('applies several updates made at the same moment without losing any', async () => {
    const results = await Promise.all(
      ['a', 'b', 'c', 'd'].map((label) => call('POST', `/api/shifts/${shiftId}/cases`, { cookie: anna, body: { ...SBAR, subjectRef: `Parallel ${label}` } }))
    );
    expect(results.map((result) => result.status)).toEqual([201, 201, 201, 201]);
    const shift = (await call('GET', '/api/shifts/active', { cookie: anna })).data;
    expect(shift.cases.filter((update) => update.subjectRef.startsWith('Parallel'))).toHaveLength(4);
    // Remove them again so the later steps see only the two planned updates.
    for (const update of shift.cases.filter((entry) => entry.subjectRef.startsWith('Parallel'))) {
      expect((await call('DELETE', `/api/shifts/${shiftId}/cases/${update.id}`, { cookie: anna })).status).toBe(200);
    }
  });

  it('lets only staff sign, and locks the handover once the outgoing staff member has signed', async () => {
    expect((await call('POST', `/api/shifts/${shiftId}/sign/outgoing`, { cookie: admin })).status).toBe(403);
    const signed = await call('POST', `/api/shifts/${shiftId}/sign/outgoing`, { cookie: anna });
    expect(signed.status).toBe(200);
    expect(signed.data.signoff).toMatchObject({ outgoingConfirmed: true, outgoingStaffName: 'Anna Wanjiru' });
    expect((await call('POST', `/api/shifts/${shiftId}/sign/outgoing`, { cookie: ben })).status).toBe(409);

    const update = signed.data.cases[0];
    expect((await call('POST', `/api/shifts/${shiftId}/cases`, { cookie: anna, body: SBAR })).status).toBe(409);
    expect((await call('DELETE', `/api/shifts/${shiftId}/cases/${update.id}`, { cookie: anna })).status).toBe(409);
    expect((await call('POST', `/api/shifts/${shiftId}/equipment`, { cookie: anna, body: { name: 'Late addition' } })).status).toBe(409);
    expect((await call('PATCH', `/api/shifts/${shiftId}/equipment/${signed.data.equipment[0].id}`, { cookie: anna, body: { custodyChecked: false } })).status).toBe(409);
  });

  it('does not let the outgoing staff member acknowledge or sign as the incoming one', async () => {
    const shift = (await call('GET', '/api/shifts/active', { cookie: anna })).data;
    const warned = shift.cases.find((update) => update.isolationOrHazardAlert);
    expect((await call('POST', `/api/shifts/${shiftId}/cases/${warned.id}/acknowledge`, { cookie: anna })).status).toBe(403);
    expect((await call('POST', `/api/shifts/${shiftId}/sign/incoming`, { cookie: anna })).status).toBe(403);
    expect((await call('POST', `/api/shifts/${shiftId}/cases/${warned.id}/acknowledge`, { cookie: admin })).status).toBe(403);
  });

  it('blocks the incoming signature until every safety warning is acknowledged', async () => {
    const shift = (await call('GET', '/api/shifts/active', { cookie: ben })).data;
    const plain = shift.cases.find((update) => !update.isolationOrHazardAlert);
    const warned = shift.cases.find((update) => update.isolationOrHazardAlert);

    const early = await call('POST', `/api/shifts/${shiftId}/sign/incoming`, { cookie: ben });
    expect(early.status).toBe(409);
    expect(early.data.error).toMatch(/safety warning/);
    expect((await call('POST', `/api/shifts/${shiftId}/cases/${plain.id}/acknowledge`, { cookie: ben })).status).toBe(400);

    const acknowledged = await call('POST', `/api/shifts/${shiftId}/cases/${warned.id}/acknowledge`, { cookie: ben });
    expect(acknowledged.status).toBe(200);
    expect(acknowledged.data.cases.find((update) => update.id === warned.id)).toMatchObject({ acknowledgedBy: 'Ben Kiprop' });
  });

  it('seals the signed handover, and the browser formula agrees with the server formula', async () => {
    const signed = await call('POST', `/api/shifts/${shiftId}/sign/incoming`, { cookie: ben });
    expect(signed.status).toBe(200);
    expect(signed.data.status).toBe('pending_signoff');
    expect(signed.data.signoff).toMatchObject({ incomingConfirmed: true, incomingStaffName: 'Ben Kiprop' });
    expect(signed.data.signoff.verificationHash).toMatch(/^[0-9a-f]{64}$/);
    expect(signed.data.transitionDurationMinutes).toBeGreaterThan(0);

    const asStored = await store.shifts.findOne({ _id: shiftId });
    expect(serverSeal(asStored)).toBe(signed.data.signoff.verificationHash);
    expect(await clientSeal(signed.data)).toBe(signed.data.signoff.verificationHash);

    expect((await call('POST', `/api/shifts/${shiftId}/sign/incoming`, { cookie: carl })).status).toBe(409);
  });

  it('lets only an administrator approve, and approval closes the shift and opens the next', async () => {
    expect((await call('POST', `/api/shifts/${shiftId}/approve`, { cookie: carl })).status).toBe(403);
    expect((await call('POST', `/api/shifts/${shiftId}/override`, { cookie: ben, body: { reason: 'x' } })).status).toBe(403);

    const approved = await call('POST', `/api/shifts/${shiftId}/approve`, { cookie: admin });
    expect(approved.status).toBe(200);
    const { closed, next } = approved.data;
    expect(closed).toMatchObject({ status: 'completed', approvedBy: expect.any(String) });
    expect(next).toMatchObject({ status: 'in_progress', shiftType: 'night', wardOrDepartment: 'Import warehouse' });
    expect(next.id).not.toBe(shiftId);
    expect(next.cases).toHaveLength(2);
    expect(next.cases.every((update) => !update.acknowledgedAt)).toBe(true);
    expect(next.equipment.every((item) => item.custodyChecked === false)).toBe(true);
    expect(next.signoff.outgoingConfirmed).toBe(false);
    expect(next.leadOutgoing.name).toBe('Ben Kiprop');
    // A shift that opens by itself has a scheduled start but no start time until someone starts it.
    expect(next).toMatchObject({ startedAt: null, lateMinutes: 0, scheduledStart: expect.any(String) });

    expect((await call('GET', '/api/shifts/active', { cookie: carl })).data.id).toBe(next.id);
    expect((await call('POST', `/api/shifts/${shiftId}/approve`, { cookie: admin })).status).toBe(409);
    expect(await store.shifts.countDocuments({ open: true })).toBe(1);
  });

  it('lists the archive for administrators only', async () => {
    const archive = await call('GET', '/api/shifts/archive', { cookie: admin });
    expect(archive.status).toBe(200);
    expect(archive.data.map((shift) => shift.status)).toContain('completed');
    expect(archive.data.every((shift) => shift.status === 'completed' || shift.status === 'archived')).toBe(true);
    expect((await call('GET', '/api/shifts/archive', { cookie: anna })).status).toBe(403);
  });

  it('records an override in the ledger, needs a reason, and approves only once', async () => {
    const open = (await call('GET', '/api/shifts/active', { cookie: carl })).data;
    await call('POST', `/api/shifts/${open.id}/cases`, { cookie: carl, body: SBAR });
    await call('POST', `/api/shifts/${open.id}/sign/outgoing`, { cookie: carl });
    const warned = (await call('GET', '/api/shifts/active', { cookie: anna })).data.cases.find((update) => update.isolationOrHazardAlert);
    await call('POST', `/api/shifts/${open.id}/cases/${warned.id}/acknowledge`, { cookie: anna });
    expect((await call('POST', `/api/shifts/${open.id}/sign/incoming`, { cookie: anna })).status).toBe(200);

    expect((await call('POST', `/api/shifts/${open.id}/override`, { cookie: admin, body: { reason: '   ' } })).status).toBe(400);
    const [first, second] = await Promise.all([
      call('POST', `/api/shifts/${open.id}/override`, { cookie: admin, body: { reason: 'Lead was unavailable' } }),
      call('POST', `/api/shifts/${open.id}/override`, { cookie: admin, body: { reason: 'Lead was unavailable' } }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(await store.shifts.countDocuments({ open: true })).toBe(1);

    const ledger = (await call('GET', '/api/overrides', { cookie: admin })).data;
    expect(ledger.filter((entry) => entry.reason === 'Lead was unavailable')).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ actionType: 'emergency_signoff', adminName: expect.any(String) });
  });

  it('lets staff start a shift that opened by itself, once, and not administrators', async () => {
    const open = (await call('GET', '/api/shifts/active', { cookie: carl })).data;
    expect(open.startedAt).toBeNull();
    expect((await call('POST', `/api/shifts/${open.id}/start`, { cookie: admin })).status).toBe(403);
    const first = await call('POST', `/api/shifts/${open.id}/start`, { cookie: anna });
    expect(first.status).toBe(200);
    expect(first.data).toMatchObject({ startedByName: 'Anna Wanjiru', startedAt: expect.any(String), lateMinutes: expect.any(Number) });
    const second = await call('POST', `/api/shifts/${open.id}/start`, { cookie: ben });
    expect(second.status).toBe(200);
    expect(second.data.startedAt).toBe(first.data.startedAt);
    expect(second.data.startedByName).toBe('Anna Wanjiru');
    expect((await call('POST', '/api/shifts/does-not-exist/start', { cookie: anna })).status).toBe(404);
  });

  it('counts the first update as starting a shift that has not been started', async () => {
    const open = (await call('GET', '/api/shifts/active', { cookie: carl })).data;
    // Cancel and start again from a clean, unstarted shift is not possible, so check the rule on the stored record.
    await store.shifts.updateOne({ _id: open.id }, { $set: { startedAt: null, startedById: undefined, startedByName: undefined, lateMinutes: 0 } });
    const added = await call('POST', `/api/shifts/${open.id}/cases`, { cookie: ben, body: SBAR });
    expect(added.status).toBe(201);
    expect(added.data).toMatchObject({ startedByName: 'Ben Kiprop', startedAt: expect.any(String) });
  });

  it('cancels a shift that cannot be signed, with a reason, and records it', async () => {
    const open = (await call('GET', '/api/shifts/active', { cookie: carl })).data;
    expect((await call('POST', `/api/shifts/${open.id}/cancel`, { cookie: anna, body: { reason: 'x' } })).status).toBe(403);
    expect((await call('POST', `/api/shifts/${open.id}/cancel`, { cookie: admin, body: {} })).status).toBe(400);
    const cancelled = await call('POST', `/api/shifts/${open.id}/cancel`, { cookie: admin, body: { reason: 'Started by mistake' } });
    expect(cancelled.status).toBe(200);
    expect(cancelled.data).toMatchObject({ status: 'archived', overrideReason: 'Cancelled: Started by mistake' });
    expect((await call('GET', '/api/shifts/active', { cookie: carl })).data).toBeNull();
    const ledger = (await call('GET', '/api/overrides', { cookie: admin })).data;
    expect(ledger.some((entry) => entry.actionType === 'cancel_shift')).toBe(true);
    // A new shift can start again.
    expect((await call('POST', '/api/shifts', { cookie: carl, body: { shiftType: 'morning', workArea: 'Import warehouse' } })).status).toBe(201);
  });
});

describe('zones, incidents, forecast decisions and the timing study', () => {
  let admin;
  beforeAll(async () => {
    admin = await login(ADMIN.staffNumber, ADMIN.pin);
  });

  it('manages zones and categories', async () => {
    const zone = await call('POST', '/api/departments', { cookie: admin, body: { code: 'bay-5a', name: 'Bay 5A', capacity: 800 } });
    expect(zone.status).toBe(201);
    expect(zone.data).toMatchObject({ code: 'BAY-5A', capacity: 800 });
    expect((await call('POST', '/api/departments', { cookie: admin, body: { code: 'X' } })).status).toBe(400);
    expect((await call('DELETE', `/api/departments/${zone.data.id}`, { cookie: admin })).status).toBe(200);

    expect((await call('POST', '/api/categories', { cookie: admin, body: { name: 'Hazardous goods' } })).status).toBe(201);
    expect((await call('GET', '/api/categories', { cookie: admin })).data).toContain('Hazardous goods');
    expect((await call('DELETE', '/api/categories/Hazardous%20goods', { cookie: admin })).status).toBe(200);
  });

  it('reports and resolves incidents', async () => {
    const incident = await call('POST', '/api/incidents', { cookie: admin, body: { title: 'Pallet rack deflection', severity: 'major' } });
    expect(incident.status).toBe(201);
    expect(incident.data).toMatchObject({ status: 'open', reportedBy: expect.any(String) });
    expect((await call('POST', '/api/incidents', { cookie: admin, body: { title: 'x', severity: 'catastrophic' } })).status).toBe(400);
    const resolved = await call('POST', `/api/incidents/${incident.data.id}/resolve`, { cookie: admin, body: { notes: 'Rack replaced', rootCause: 'Forklift impact' } });
    expect(resolved.data).toMatchObject({ status: 'resolved', rootCause: 'Forklift impact' });
    expect((await call('POST', `/api/incidents/${incident.data.id}/resolve`, { cookie: admin, body: { notes: 'again', rootCause: 'x' } })).status).toBe(404);
  });

  it('records forecast decisions and checks them', async () => {
    const good = { metric: 'handovers', date: '2026-11-27', shift: 'evening', expected: 7.2, decision: 'plan', note: 'Add a second lead' };
    const saved = await call('POST', '/api/forecast-decisions', { cookie: admin, body: good });
    expect(saved.status).toBe(201);
    expect(saved.data).toMatchObject({ decision: 'plan', by: expect.any(String) });
    expect((await call('POST', '/api/forecast-decisions', { cookie: admin, body: { ...good, decision: 'maybe' } })).status).toBe(400);
    expect((await call('POST', '/api/forecast-decisions', { cookie: admin, body: { ...good, expected: 'lots' } })).status).toBe(400);
    expect((await call('GET', '/api/forecast-decisions', { cookie: admin })).data[0].id).toBe(saved.data.id);
  });

  it('records timing runs for the baseline study and checks them', async () => {
    const run = { method: 'paper', task: 'Full handover', participant: 'P1', seconds: 412, note: 'Logbook' };
    const saved = await call('POST', '/api/timing-runs', { cookie: admin, body: run });
    expect(saved.status).toBe(201);
    expect(saved.data).toMatchObject({ method: 'paper', seconds: 412 });
    expect((await call('POST', '/api/timing-runs', { cookie: admin, body: { ...run, method: 'telepathy' } })).status).toBe(400);
    expect((await call('POST', '/api/timing-runs', { cookie: admin, body: { ...run, seconds: 0 } })).status).toBe(400);
    expect((await call('POST', '/api/timing-runs', { cookie: admin, body: { ...run, seconds: 99999 } })).status).toBe(400);
    expect((await call('POST', '/api/timing-runs', { cookie: admin, body: { ...run, participant: '' } })).status).toBe(400);
    expect((await call('DELETE', `/api/timing-runs/${saved.data.id}`, { cookie: admin })).status).toBe(200);
  });
});

describe('server hygiene', () => {
  it('reports health without any data', async () => {
    const result = await call('GET', '/healthz');
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ status: 'ok', database: 'connected' });
  });

  it('answers malformed and oversized bodies with a clean error', async () => {
    const bad = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' });
    expect(bad.status).toBe(400);
    const big = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ staffNumber: 'x'.repeat(200000) }) });
    expect(big.status).toBe(413);
  });

  it('sends security headers and does not reveal the framework', async () => {
    const response = await fetch(`${base}/healthz`);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('x-powered-by')).toBeNull();
  });

  it('returns JSON for unknown API routes', async () => {
    const result = await call('GET', '/api/nothing-here');
    expect(result.status).toBe(404);
    expect(result.data.error).toBeTruthy();
  });

  it('requires a long session secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 'y'.repeat(32) })).not.toThrow();
  });
});

describe('the shift schedule', () => {
  const nairobi = 'Africa/Nairobi';

  it('uses a 15 minute grace period', () => {
    expect(LATE_GRACE_MINUTES).toBe(15);
  });

  it('finds the scheduled start of a shift opened after it began', () => {
    // 08:00 in Nairobi is 05:00 UTC; the morning shift is meant to start at 07:00, which is 04:00 UTC.
    const now = new Date('2026-11-19T05:00:00Z');
    const scheduled = scheduledStartFor('morning', now, nairobi);
    expect(scheduled).toBe('2026-11-19T04:00:00.000Z');
    expect(lateMinutesFor(now.toISOString(), scheduled)).toBe(60);
  });

  it('measures a night shift opened after midnight against 23:00 the evening before', () => {
    const now = new Date('2026-11-19T21:30:00Z'); // 00:30 on 20 November in Nairobi
    const scheduled = scheduledStartFor('night', now, nairobi);
    expect(scheduled).toBe('2026-11-19T20:00:00.000Z');
    expect(lateMinutesFor(now.toISOString(), scheduled)).toBe(90);
  });

  it('treats an early start as on time, not as hours late', () => {
    const now = new Date('2026-11-19T09:00:00Z'); // 12:00 in Nairobi, three hours before the evening shift
    const scheduled = scheduledStartFor('evening', now, nairobi);
    expect(scheduled).toBe('2026-11-19T12:00:00.000Z');
    expect(lateMinutesFor(now.toISOString(), scheduled)).toBe(0);
  });

  it('works in another time zone, including daylight saving time', () => {
    const now = new Date('2026-07-01T11:20:00Z'); // 07:20 in New York in summer
    const scheduled = scheduledStartFor('morning', now, 'America/New_York');
    expect(scheduled).toBe('2026-07-01T11:00:00.000Z');
    expect(lateMinutesFor(now.toISOString(), scheduled)).toBe(20);
    const winter = new Date('2026-01-15T12:20:00Z'); // 07:20 in New York in winter
    expect(scheduledStartFor('morning', winter, 'America/New_York')).toBe('2026-01-15T12:00:00.000Z');
  });
});

describe('profile pictures', () => {
  const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  let pia;
  let sam;

  beforeAll(async () => {
    const admin = await login(ADMIN.staffNumber, ADMIN.pin);
    pia = await createStaff(admin, 'PH-0001', 'Pia Hassan');
    sam = await createStaff(admin, 'PH-0002', 'Sam Ouma');
  });

  it('needs a signed-in user', async () => {
    expect((await call('PUT', '/api/auth/photo', { body: { photo: JPEG } })).status).toBe(401);
  });

  it('keeps a JPEG or PNG for the person who sent it, and returns it with their account', async () => {
    const saved = await call('PUT', '/api/auth/photo', { cookie: pia, body: { photo: JPEG } });
    expect(saved.status).toBe(200);
    expect(saved.data.user).toMatchObject({ staffNumber: 'PH-0001', photo: JPEG });
    expect((await call('GET', '/api/auth/me', { cookie: pia })).data.user.photo).toBe(JPEG);
    const png = await call('PUT', '/api/auth/photo', { cookie: pia, body: { photo: PNG } });
    expect(png.data.user.photo).toBe(PNG);
  });

  it('does not touch anyone else\'s picture', async () => {
    expect((await call('GET', '/api/auth/me', { cookie: sam })).data.user.photo).toBe('');
  });

  it('refuses anything that is not a real, small picture', async () => {
    const refuse = async (photo) => (await call('PUT', '/api/auth/photo', { cookie: pia, body: { photo } })).status;
    expect(await refuse('data:image/svg+xml;base64,PHN2Zy8+')).toBe(400); // scripts can hide in an SVG
    expect(await refuse('data:text/html;base64,PGgxPmhpPC9oMT4=')).toBe(400);
    expect(await refuse('https://example.com/me.png')).toBe(400);
    expect(await refuse('not a picture')).toBe(400);
    expect(await refuse(`data:image/png;base64,${JPEG.split(',')[1]}`)).toBe(400); // JPEG bytes labelled as PNG
    expect(await refuse(`data:image/jpeg;base64,${'A'.repeat(70_000)}`)).toBe(400); // too large
    expect(await refuse(12345)).toBe(400);
    expect(await refuse({ $ne: null })).toBe(400);
    expect((await call('PUT', '/api/auth/photo', { cookie: pia })).status).toBe(400);
    // The refused attempts left the earlier picture in place.
    expect((await call('GET', '/api/auth/me', { cookie: pia })).data.user.photo).toBe(PNG);
  });

  it('removes the picture when asked', async () => {
    const removed = await call('PUT', '/api/auth/photo', { cookie: pia, body: { photo: null } });
    expect(removed.status).toBe(200);
    expect(removed.data.user.photo).toBe('');
    expect((await call('GET', '/api/auth/me', { cookie: pia })).data.user.photo).toBe('');
  });
});
