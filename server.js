import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Serves the built client (run "npm run build" first).
const app = express();
const port = Number(process.env.PORT || 3004);
const here = path.dirname(fileURLToPath(import.meta.url));

app.disable('x-powered-by');
app.use(express.static(path.join(here, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(here, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Zamu-Check server listening on port ${port}`);
});
