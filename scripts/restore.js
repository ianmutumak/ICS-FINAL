import fs from 'node:fs';
import { MongoClient } from 'mongodb';
import { importDatabase } from '../server/backup.js';

// Restores a backup file into the database named in .env.
//   npm run restore -- backups/zamu-2026-11-19T10-00-00-000Z.json
// The target must be empty. Add --replace to overwrite the collections in the backup.
try {
  process.loadEnvFile();
} catch {
  // No .env file; the settings may come from the environment.
}

const file = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
const replace = process.argv.includes('--replace');
const uri = process.env.MONGODB_URI;
if (!file || !uri) {
  console.error('Usage: npm run restore -- <backup file> [--replace]   (MONGODB_URI must be set)');
  process.exit(1);
}

const client = await MongoClient.connect(uri, { serverSelectionTimeoutMS: 10000 });
try {
  const restored = await importDatabase(client.db(process.env.MONGODB_DB || 'zamucheck'), JSON.parse(fs.readFileSync(file, 'utf8')), { replace });
  console.log('Restored:', Object.entries(restored).map(([name, count]) => `${name}: ${count}`).join(', '));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
