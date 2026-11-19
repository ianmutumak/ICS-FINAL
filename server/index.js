import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectStore, seedAdministrator } from './store.js';

// A local .env file is optional; on a host the settings come from its environment.
try {
  process.loadEnvFile();
} catch {
  // No .env file.
}

const config = loadConfig();
const store = await connectStore(config);
await seedAdministrator(store, config);

const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const server = createApp(store, config, { distDir }).listen(config.port, '0.0.0.0', () => {
  console.log(`Zamu-Check listening on port ${config.port} (${config.production ? 'production' : 'development'})`);
});

const shutdown = async () => {
  server.close();
  await store.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
