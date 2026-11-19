import { MongoClient } from 'mongodb';
import { hashPin, isValidPin } from './auth.js';
import { newId } from './rules.js';

/** Connects to MongoDB and returns the collections the server uses. */
export async function connectStore(config) {
  if (!config.mongoUri) throw new Error('MONGODB_URI is not set.');
  const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 10000, appName: 'zamu-check' });
  await client.connect();
  const db = client.db(config.dbName);

  const store = {
    client,
    db,
    users: db.collection('users'),
    shifts: db.collection('shifts'),
    departments: db.collection('departments'),
    categories: db.collection('categories'),
    incidents: db.collection('incidents'),
    overrides: db.collection('overrides'),
    forecastDecisions: db.collection('forecastDecisions'),
    timingRuns: db.collection('timingRuns'),
    close: () => client.close(),
  };

  await Promise.all([
    // One account per badge ID, whatever the letter case.
    store.users.createIndex({ staffKey: 1 }, { unique: true }),
    store.shifts.createIndex({ status: 1, createdAt: -1 }),
    // At most one shift can be open at a time; the database enforces this, not just the code.
    store.shifts.createIndex({ open: 1 }, { unique: true, partialFilterExpression: { open: true } }),
    store.overrides.createIndex({ timestamp: -1 }),
    store.forecastDecisions.createIndex({ at: -1 }),
    store.timingRuns.createIndex({ at: -1 }),
  ]);
  return store;
}

export const staffKey = (staffNumber) => staffNumber.trim().toLowerCase();

/** Builds a new user document from validated input. */
export async function buildUser({ name, staffNumber, pin, role = '', department = '', qualification = '', isAdmin = false, status = 'active' }) {
  const initials = name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return {
    _id: newId('usr'),
    staffNumber: staffNumber.trim().toUpperCase(),
    staffKey: staffKey(staffNumber),
    name: name.trim(),
    role,
    department,
    qualification,
    avatarSeed: initials || '?',
    isAdmin,
    status,
    pinHash: await hashPin(pin),
    createdAt: new Date().toISOString(),
  };
}

/** Creates the first administrator from the environment, but only while no administrator exists. */
export async function seedAdministrator(store, config, log = console) {
  if (await store.users.countDocuments({ isAdmin: true }, { limit: 1 })) return false;
  const { staffNumber, name, pin } = config.initialAdmin;
  if (!staffNumber || !isValidPin(pin)) {
    log.warn('No administrator exists. Set INITIAL_ADMIN_BADGE and INITIAL_ADMIN_PIN (4 to 6 digits) and restart to create one.');
    return false;
  }
  await store.users.insertOne(await buildUser({ name, staffNumber, pin, role: 'Administrator', isAdmin: true }));
  log.info(`Created the first administrator (${staffNumber.toUpperCase()}). Remove INITIAL_ADMIN_PIN from the environment now.`);
  return true;
}
