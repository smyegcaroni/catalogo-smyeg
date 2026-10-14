import { createHash } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const manifestPath = path.join(dist, '.vite', 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const selected = Object.entries(manifest)
  .filter(([key, entry]) =>
    entry.isEntry ||
    key.endsWith('/SearchPage.tsx') ||
    key.endsWith('/LoginPage.tsx'))
  .map(([key]) => key);

if (!selected.some((key) => key.endsWith('/SearchPage.tsx')) ||
    !selected.some((key) => key.endsWith('/LoginPage.tsx'))) {
  throw new Error('Faltan las rutas iniciales del catálogo en el manifiesto Vite');
}

const visited = new Set();
const assets = new Set();

function includeChunk(key) {
  if (visited.has(key)) return;
  const chunk = manifest[key];
  if (!chunk) throw new Error(`No existe el módulo ${key} en el manifiesto Vite`);
  visited.add(key);
  for (const file of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) {
    if (file?.startsWith('assets/')) assets.add(`/${file}`);
  }
  for (const imported of chunk.imports ?? []) includeChunk(imported);
}

for (const key of selected) includeChunk(key);
const urls = [...assets].sort();
if (urls.length === 0) throw new Error('La compilación no contiene recursos PWA');

await writeFile(
  path.join(dist, 'pwa-assets.json'),
  `${JSON.stringify({ assets: urls }, null, 2)}\n`,
);

const hash = createHash('sha256');
hash.update(await readFile(path.join(dist, 'index.html')));
hash.update(await readFile(path.join(dist, 'offline.html')));
hash.update(await readFile(path.join(dist, 'service-worker.js')));
for (const file of [
  'manifest.webmanifest', 'app-icon-192.png', 'app-icon-512.png',
  'app-icon-maskable-192.png', 'app-icon-maskable-512.png',
  'apple-touch-icon.png', 'favicon-16.png', 'favicon-32.png', 'favicon-64.png',
  'favicon.ico', 'favicon.svg',
]) {
  hash.update(await readFile(path.join(dist, file)));
}
hash.update(urls.join('\n'));
const buildId = hash.digest('hex').slice(0, 16);

const workerPath = path.join(dist, 'service-worker.js');
const worker = await readFile(workerPath, 'utf8');
const marker = "const VERSION = '__PWA_BUILD_ID__';";
if (!worker.includes(marker)) throw new Error('Falta el marcador de versión PWA');
await writeFile(workerPath, worker.replace(marker, `const VERSION = '${buildId}';`));

await unlink(manifestPath);
process.stdout.write(`PWA: ${urls.length} recursos esenciales, versión ${buildId}\n`);
