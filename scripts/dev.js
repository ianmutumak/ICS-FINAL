import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Starts the API server and the Vite dev server together.
//   npm run dev         the API uses a MongoDB that runs on this computer (no account needed)
//   npm run dev:atlas   the API uses MONGODB_URI from your .env file (for example MongoDB Atlas)
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const useAtlas = process.argv.includes('--atlas');
const serverFile = useAtlas ? 'index.js' : 'dev-memory.js';

const children = [
  spawn(process.execPath, [path.join(root, 'server', serverFile)], { cwd: root, stdio: 'inherit', env: process.env }),
  spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port=3000', '--host=0.0.0.0'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill();
  setTimeout(() => process.exit(code), 300);
}

for (const child of children) {
  child.on('error', (error) => {
    console.error('Could not start a development service:', error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping && code !== 0) stop(code || 1);
  });
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
