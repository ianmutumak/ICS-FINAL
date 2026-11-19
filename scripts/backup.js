import fs from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { exportDatabase } from '../server/backup.js';

// Saves the whole database to backups/zamu-<date>.json. The file holds PIN hashes, so keep it private.
//   npm run backup
try {
  process.loadEnvFile();
} catch {
  // No .env file; the settings may come from the environment.
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set.');
  process.exit(1);
}

const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 10000 });
try {
  const backup = await exportDatabase(client.db(process.env.MONGODB_DB || 'zamucheck'));
  const folder = path.join(process.cwd(), 'backups');
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `zamu-${backup.exportedAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify(backup));
  const counts = Object.entries(backup.collections).map(([name, docs]) => `${name}: ${docs.length}`).join(', ');
  console.log(`Backup written to ${file}\n${counts}`);
} finally {
  await client.close();
}
