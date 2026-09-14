// Runs the POS API alone (no Electron) so the UI can be tested in a normal browser
// at http://127.0.0.1:5173 with `npm run dev:web`. Data lives in ./.dev-data.
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from '../server/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.dev-data');
const PORT = Number(process.env.POS_PORT || 8001);

const app = await createServer({
  dbPath: path.join(root, 'pos.sqlite'),
  uploadsPath: path.join(root, 'uploads'),
  jwtSecret: 'dev-only-secret',
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`POS API (dev) listening on http://127.0.0.1:${PORT} — data in ${root}`);
});
