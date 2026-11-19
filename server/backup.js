/**
 * Backup and restore of the whole database as one JSON file. It uses the same driver as the server, so it needs
 * no extra tools, and works on MongoDB Atlas's free tier, which has no automatic backups.
 */

export const BACKUP_FORMAT = 'zamu-check-backup-v1';

/** Reads every collection into one plain object. Passwords are included only as salted hashes. */
export async function exportDatabase(db) {
  const collections = {};
  for (const { name } of await db.listCollections({}, { nameOnly: true }).toArray()) {
    if (name.startsWith('system.')) continue;
    collections[name] = await db.collection(name).find({}).toArray();
  }
  return { format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), database: db.databaseName, collections };
}

/**
 * Writes a backup into a database. By default the target must be empty, so a restore can never silently overwrite
 * live records; pass replace: true to clear the collections in the backup first.
 */
export async function importDatabase(db, backup, { replace = false } = {}) {
  if (backup?.format !== BACKUP_FORMAT || typeof backup.collections !== 'object') {
    throw new Error('This file is not a Zamu-Check backup.');
  }
  const names = Object.keys(backup.collections);
  for (const name of names) {
    const existing = await db.collection(name).countDocuments({}, { limit: 1 });
    if (existing > 0 && !replace) {
      throw new Error(`The collection "${name}" already has records. Restore into an empty database, or use --replace to overwrite.`);
    }
  }
  const restored = {};
  for (const name of names) {
    const documents = backup.collections[name];
    const collection = db.collection(name);
    if (replace) await collection.deleteMany({});
    if (documents.length > 0) await collection.insertMany(documents);
    restored[name] = documents.length;
  }
  return restored;
}
