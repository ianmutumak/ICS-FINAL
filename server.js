import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Serves the built client (run "npm run build" first).
const app = express();
const port = Number(process.env.PORT || 3004);
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, 'dist');

app.disable('x-powered-by');

// Health check for monitoring and deployment checks: confirms the server is up and a build is present.
app.get('/healthz', (_req, res) => {
  const built = fs.existsSync(path.join(dist, 'index.html'));
  res.status(built ? 200 : 503).json({ status: built ? 'ok' : 'no build found', uptimeSeconds: Math.round(process.uptime()) });
});

app.use(express.static(dist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(dist, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Zamu-Check server listening on port ${port}`);
});
