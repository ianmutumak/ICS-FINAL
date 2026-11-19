import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Development only: runs a MongoDB on this computer, with its data kept in .devdata/, so the app can be tried
 * without an Atlas account. These sign-in details exist only on this machine.
 */
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.join(root, '.devdata');
fs.mkdirSync(dbPath, { recursive: true });

const mongod = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger' } });
process.env.MONGODB_URI = mongod.getUri();
process.env.INITIAL_ADMIN_BADGE ||= 'ADMIN-0001';
process.env.INITIAL_ADMIN_PIN ||= '2468';
process.env.ALLOW_SELF_REGISTRATION ||= 'true';
console.log(`Local test database ready. Sign in as ${process.env.INITIAL_ADMIN_BADGE} with PIN ${process.env.INITIAL_ADMIN_PIN}.`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await mongod.stop();
    process.exit(0);
  });
}
await import('./index.js');
